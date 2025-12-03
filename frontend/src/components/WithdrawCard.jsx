import { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { groth16 } from 'snarkjs';
import { useWalletStore } from '../stores/wallet';
import { ADDRESSES, VAULT_ABI, BASE_SEPOLIA } from '../config';
import { initProver, hashPair, computeCommitment, computeNullifier, getZeros } from '../lib/prover';

export function WithdrawCard() {
  const {
    address,
    signer,
    provider,
    getActiveNotes,
    spendNote,
    addNote,
    createNote,
    fetchBalances,
    connect
  } = useWalletStore();

  const [selectedNote, setSelectedNote] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [manualNoteJson, setManualNoteJson] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const activeNotes = getActiveNotes();

  // Parse manual note from JSON
  const parseManualNote = () => {
    try {
      const parsed = JSON.parse(manualNoteJson);
      const note = parsed.notes ? parsed.notes[0] : parsed;
      if (!note.spendingKey || !note.balance || note.noteIndex === undefined) {
        throw new Error('Invalid note format');
      }
      return note;
    } catch {
      return null;
    }
  };

  const manualNote = parseManualNote();
  const currentNote = selectedNote || manualNote;

  // Build proper merkle proof by reconstructing tree from all commitments
  const buildMerkleProof = async (noteIndex, vault) => {
    const TREE_DEPTH = 20;
    await initProver();
    const zeros = await getZeros(TREE_DEPTH);

    // Get all commitments from the contract
    const noteCount = Number(await vault.getNoteCount());
    const leaves = [];
    for (let i = 0; i < noteCount; i++) {
      leaves.push((await vault.noteCommitments(i)).toString());
    }

    // Build tree level by level
    let currentLevel = [...leaves];
    const pathElements = [];
    const pathIndices = [];
    let idx = noteIndex;

    for (let level = 0; level < TREE_DEPTH; level++) {
      // Pad to even
      if (currentLevel.length % 2 !== 0) {
        currentLevel.push(zeros[level]);
      }

      // Get sibling
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      const sibling = siblingIdx < currentLevel.length ? currentLevel[siblingIdx] : zeros[level];
      pathElements.push(sibling);
      pathIndices.push(idx % 2); // 0 = left, 1 = right

      // Build next level
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : zeros[level];
        nextLevel.push(await hashPair(left, right));
      }
      currentLevel = nextLevel;
      idx = Math.floor(idx / 2);
    }

    return {
      pathElements,
      pathIndices,
      computedRoot: currentLevel[0]
    };
  };

  const handleWithdraw = async () => {
    if (!address || !signer) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!currentNote) {
      toast.error('Please select or paste a note');
      return;
    }

    if (!recipient || !ethers.isAddress(recipient)) {
      toast.error('Please enter a valid recipient address');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const noteBalance = parseFloat(ethers.formatEther(currentNote.balance));
    if (parseFloat(amount) > noteBalance) {
      toast.error('Amount exceeds note balance');
      return;
    }

    setIsWithdrawing(true);
    const toastId = toast.loading('Initializing prover...');

    try {
      await initProver();

      const currentProvider = provider || new ethers.JsonRpcProvider(BASE_SEPOLIA.rpcUrl);
      const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, currentProvider);

      // Add noteCommitments to ABI for reading
      const vaultWithCommitments = new ethers.Contract(
        ADDRESSES.vault,
        [...VAULT_ABI, "function noteCommitments(uint256) view returns (uint256)"],
        currentProvider
      );

      toast.loading('Building merkle proof...', { id: toastId });

      // Build proper merkle proof by reconstructing tree
      const { pathElements, pathIndices, computedRoot } = await buildMerkleProof(
        currentNote.noteIndex,
        vaultWithCommitments
      );

      const merkleRoot = await vault.getCurrentRoot();

      // Verify computed root matches contract root
      if (computedRoot !== merkleRoot.toString()) {
        console.warn('Root mismatch:', { computed: computedRoot, contract: merkleRoot.toString() });
      }

      // Compute values using JS Poseidon (from prover.js)
      const spendingKey = BigInt(currentNote.spendingKey);
      const balance = BigInt(currentNote.balance);
      const randomness = BigInt(currentNote.randomness);
      const noteIndex = BigInt(currentNote.noteIndex);
      const amountWei = ethers.parseEther(amount);

      const nullifier = await computeNullifier(spendingKey.toString(), noteIndex.toString());
      const commitment = await computeCommitment(spendingKey.toString(), balance.toString(), randomness.toString());

      console.log('Note commitment check:', {
        storedCommitment: currentNote.commitment,
        computedCommitment: commitment
      });

      // Prepare circuit inputs
      const circuitInputs = {
        // Public inputs (will be verified by contract)
        merkleRoot: computedRoot,
        nullifier: nullifier,
        recipient: BigInt(recipient).toString(),
        amount: amountWei.toString(),
        // Private inputs (stay secret)
        spendingKey: spendingKey.toString(),
        balance: balance.toString(),
        randomness: randomness.toString(),
        noteIndex: noteIndex.toString(),
        pathElements: pathElements.map(p => p.toString()),
        pathIndices: pathIndices.map(i => i.toString())
      };

      console.log('Circuit inputs:', circuitInputs);

      toast.loading('Generating Groth16 proof (this may take 10-30 seconds)...', { id: toastId });

      // Generate Groth16 proof using snarkjs
      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        '/circuits/withdrawal.wasm',
        '/circuits/withdrawal_final.zkey'
      );

      console.log('Proof generated:', { proof, publicSignals });

      // Encode proof for Solidity verifier (pA, pB, pC with coordinate swaps for pB)
      const proofCalldata = [
        [proof.pi_a[0], proof.pi_a[1]],
        [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        [proof.pi_c[0], proof.pi_c[1]]
      ];

      const abiCoder = new ethers.AbiCoder();
      const encodedProof = abiCoder.encode(
        ['uint256[2]', 'uint256[2][2]', 'uint256[2]'],
        proofCalldata
      );

      // Handle change note
      let changeCommitment = 0n;
      let changeNote = null;
      const noteBalanceWei = BigInt(currentNote.balance);

      if (amountWei < noteBalanceWei) {
        const changeBalance = noteBalanceWei - amountWei;
        changeNote = await createNote(ethers.formatEther(changeBalance));
        changeCommitment = BigInt(changeNote.commitment);
      }

      // Public inputs for contract: [merkleRoot, nullifier, recipient, amount, changeCommitment]
      const publicInputsContract = [
        BigInt(computedRoot),
        BigInt(nullifier),
        BigInt(recipient),
        amountWei,
        changeCommitment
      ];

      toast.loading('Executing withdrawal...', { id: toastId });
      const vaultWithSigner = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, signer);
      const tx = await vaultWithSigner.withdraw(encodedProof, publicInputsContract);
      const receipt = await tx.wait();

      // Mark the spent note (works for both selected and manual/pasted notes)
      spendNote(currentNote.commitment.toString());

      if (changeNote) {
        for (const log of receipt.logs) {
          try {
            const parsed = vault.interface.parseLog(log);
            if (parsed.name === 'NoteCreated' && parsed.args.commitment.toString() === changeNote.commitment) {
              changeNote.noteIndex = Number(parsed.args.noteIndex);
              break;
            }
          } catch {
            continue;
          }
        }
        addNote(changeNote);
      }

      await fetchBalances();

      toast.success(
        <div>
          <p className="font-semibold">Withdrawal successful!</p>
          <p className="text-sm text-white/60">
            {amount} NOCTIS sent to {recipient.slice(0, 6)}...{recipient.slice(-4)}
          </p>
        </div>,
        { id: toastId, duration: 5000 }
      );

      setSelectedNote(null);
      setManualNoteJson('');
      setRecipient('');
      setAmount('');
    } catch (err) {
      console.error('Withdrawal failed:', err);
      toast.error(err.reason || err.message || 'Withdrawal failed', { id: toastId });
    }

    setIsWithdrawing(false);
  };

  const formatNoteBalance = (balance) => {
    return parseFloat(ethers.formatEther(balance)).toLocaleString();
  };

  return (
    <div id="withdraw" className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold">Withdraw</h2>
          <p className="text-sm text-white/60">Send tokens from your private balance</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Note Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-white/60">Select Note to Spend</label>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs text-noctis-purple hover:text-noctis-blue transition-colors"
            >
              {showManualInput ? 'Use saved notes' : 'Paste note manually'}
            </button>
          </div>

          {showManualInput ? (
            <div>
              <textarea
                value={manualNoteJson}
                onChange={(e) => {
                  setManualNoteJson(e.target.value);
                  setSelectedNote(null);
                }}
                placeholder='Paste your note JSON or backup file contents here...'
                className="input h-24 font-mono text-xs"
                disabled={isWithdrawing}
              />
              {manualNoteJson && (
                <div className={`mt-2 text-xs ${manualNote ? 'text-green-400' : 'text-red-400'}`}>
                  {manualNote
                    ? `✓ Valid note: ${formatNoteBalance(manualNote.balance)} NOCTIS (Note #${manualNote.noteIndex})`
                    : '✗ Invalid note format'}
                </div>
              )}
            </div>
          ) : activeNotes.length === 0 ? (
            <div className="p-4 bg-white/5 rounded-xl text-center text-white/40">
              <p>No saved notes found</p>
              <button
                onClick={() => setShowManualInput(true)}
                className="mt-2 text-sm text-noctis-purple hover:text-noctis-blue"
              >
                Paste a note from backup
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeNotes.map((note) => (
                <button
                  key={note.commitment}
                  onClick={() => {
                    setSelectedNote(note);
                    setManualNoteJson('');
                    setAmount(ethers.formatEther(note.balance));
                  }}
                  className={`w-full p-3 rounded-xl border transition-all text-left ${
                    selectedNote?.commitment === note.commitment
                      ? 'bg-noctis-purple/20 border-noctis-purple'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                  disabled={isWithdrawing}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-white/60">Note #{note.noteIndex}</span>
                    <span className="font-semibold">{formatNoteBalance(note.balance)} NOCTIS</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-sm text-white/60 mb-2">Recipient Address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="input font-mono text-sm"
            disabled={isWithdrawing}
          />
          {address && (
            <button
              onClick={() => setRecipient(address)}
              className="mt-2 text-xs text-noctis-purple hover:text-noctis-blue transition-colors"
              disabled={isWithdrawing}
            >
              Use connected wallet ({address.slice(0, 6)}...{address.slice(-4)})
            </button>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm text-white/60 mb-2">Amount (NOCTIS)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="input"
            disabled={isWithdrawing || !currentNote}
          />
          {currentNote && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setAmount(ethers.formatEther(currentNote.balance))}
                className="text-xs text-noctis-purple hover:text-noctis-blue transition-colors"
                disabled={isWithdrawing}
              >
                Full amount
              </button>
              <button
                onClick={() => setAmount((parseFloat(ethers.formatEther(currentNote.balance)) / 2).toString())}
                className="text-xs text-noctis-purple hover:text-noctis-blue transition-colors"
                disabled={isWithdrawing}
              >
                Half
              </button>
            </div>
          )}
        </div>

        {/* Summary */}
        {currentNote && amount && recipient && (
          <div className="p-4 bg-white/5 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Sending</span>
              <span className="text-green-400">{parseFloat(amount).toLocaleString()} NOCTIS</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">To</span>
              <span className="font-mono">{recipient.slice(0, 8)}...{recipient.slice(-6)}</span>
            </div>
            {parseFloat(amount) < parseFloat(ethers.formatEther(currentNote.balance)) && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Change (new note)</span>
                <span className="text-blue-400">
                  {(parseFloat(ethers.formatEther(currentNote.balance)) - parseFloat(amount)).toLocaleString()} NOCTIS
                </span>
              </div>
            )}
          </div>
        )}

        {/* Info box */}
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Connect the wallet you want to receive tokens. You'll pay gas from this wallet.
          </span>
        </div>

        {/* Withdraw Button */}
        {!address ? (
          <button
            onClick={connect}
            className="w-full btn-primary"
          >
            Connect Wallet to Withdraw
          </button>
        ) : (
          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !currentNote || !amount || !recipient}
            className="w-full btn-primary"
          >
            {isWithdrawing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : (
              'Withdraw'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
