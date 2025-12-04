import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { groth16 } from 'snarkjs';
import { useWalletStore } from '../stores/wallet';
import { ADDRESSES, VAULT_ABI, ACTIVE_NETWORK, RELAYER_CONFIG } from '../config';
import { decodeNoteFromLink } from './NotesPanel';
import { initProver, hashPair, computeCommitment, computeNullifier, getZeros } from '../lib/prover';

export function ClaimLink({ linkData, onClose }) {
  const {
    address, // Only for "use connected wallet" button
    provider,
    fetchBalances,
    createChangeNote,
    addNote, // For saving change notes from partial withdrawals
    spendNote, // For marking original note as spent (if it's in our wallet)
  } = useWalletStore();

  const [note, setNote] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState(null);

  // Decode the note from URL
  useEffect(() => {
    if (linkData) {
      const decoded = decodeNoteFromLink(linkData);
      if (decoded) {
        setNote(decoded);
        setAmount(ethers.formatEther(decoded.balance));
      } else {
        setError('Invalid or corrupted link');
      }
    }
  }, [linkData]);

  // Auto-fill recipient when wallet connects
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address);
    }
  }, [address, recipient]);

  // Build merkle proof (same as WithdrawCard)
  const buildMerkleProof = async (noteIndex, vault) => {
    const TREE_DEPTH = 20;
    await initProver();
    const zeros = await getZeros(TREE_DEPTH);

    const noteCount = Number(await vault.getNoteCount());
    const leaves = [];
    for (let i = 0; i < noteCount; i++) {
      leaves.push((await vault.noteCommitments(i)).toString());
    }

    let currentLevel = [...leaves];
    const pathElements = [];
    const pathIndices = [];
    let idx = noteIndex;

    for (let level = 0; level < TREE_DEPTH; level++) {
      if (currentLevel.length % 2 !== 0) {
        currentLevel.push(zeros[level]);
      }

      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      const sibling = siblingIdx < currentLevel.length ? currentLevel[siblingIdx] : zeros[level];
      pathElements.push(sibling);
      pathIndices.push(idx % 2);

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

  const handleClaim = async () => {
    // No wallet connection needed - relayer handles everything

    if (!note) {
      toast.error('No valid note to claim');
      return;
    }

    const trimmedRecipient = recipient.trim();
    console.log('Recipient:', trimmedRecipient, 'Length:', trimmedRecipient.length, 'isAddress:', ethers.isAddress(trimmedRecipient));
    if (!trimmedRecipient || !ethers.isAddress(trimmedRecipient)) {
      toast.error(`Invalid recipient address: ${trimmedRecipient.length} chars`);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const noteBalance = parseFloat(ethers.formatEther(note.balance));
    if (parseFloat(amount) > noteBalance) {
      toast.error('Amount exceeds available balance');
      return;
    }

    setIsClaiming(true);
    const toastId = toast.loading('Initializing prover...');

    // Define change variables in outer scope
    let changeCommitment = 0n;
    let changeNote = null;

    try {
      // OPTIMIZATION: Create and save change note IMMEDIATELY
      const noteBalanceWei = BigInt(note.balance);
      const amountWei = ethers.parseEther(amount);

      if (amountWei < noteBalanceWei) {
        const changeBalance = noteBalanceWei - amountWei;
        // Use createChangeNote (no fee) instead of createNote (applies deposit fee)
        changeNote = await createChangeNote(changeBalance.toString());
        changeCommitment = BigInt(changeNote.commitment);

        // Save as pending (index: null)
        addNote(changeNote);
      }

      await initProver();

      const rpcProvider = new ethers.JsonRpcProvider(ACTIVE_NETWORK.rpcUrl);
      const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, rpcProvider);

      const vaultWithCommitments = new ethers.Contract(
        ADDRESSES.vault,
        [...VAULT_ABI, "function noteCommitments(uint256) view returns (uint256)"],
        rpcProvider
      );

      toast.loading('Building merkle proof...', { id: toastId });

      const { pathElements, pathIndices, computedRoot } = await buildMerkleProof(
        note.noteIndex,
        vaultWithCommitments
      );

      const spendingKey = BigInt(note.spendingKey);
      const balance = BigInt(note.balance);
      const randomness = BigInt(note.randomness);
      const noteIndex = BigInt(note.noteIndex);
      // amountWei is already defined above

      const nullifier = await computeNullifier(spendingKey.toString(), noteIndex.toString());
      const commitment = await computeCommitment(spendingKey.toString(), balance.toString(), randomness.toString());

      const circuitInputs = {
        merkleRoot: computedRoot,
        nullifier: nullifier,
        recipient: BigInt(trimmedRecipient).toString(),
        amount: amountWei.toString(),
        spendingKey: spendingKey.toString(),
        balance: balance.toString(),
        randomness: randomness.toString(),
        noteIndex: noteIndex.toString(),
        pathElements: pathElements.map(p => p.toString()),
        pathIndices: pathIndices.map(i => i.toString())
      };

      toast.loading('Generating ZK proof (10-30 seconds)...', { id: toastId });

      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        '/circuits/withdrawal.wasm',
        '/circuits/withdrawal_final.zkey'
      );

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

      // Change note logic moved to top

      const publicInputsContract = [
        BigInt(computedRoot).toString(),
        BigInt(nullifier).toString(),
        BigInt(trimmedRecipient).toString(),
        amountWei.toString(),
        changeCommitment.toString()
      ];

      // Debug: Verify public inputs match
      console.log('=== CLAIM LINK: VERIFYING PUBLIC INPUTS ===');
      console.log('Public signals from proof:', publicSignals);
      console.log('Sending to contract:', publicInputsContract.slice(0, 4));
      console.log('Match check:');
      console.log('  merkleRoot:', publicSignals[0] === publicInputsContract[0]);
      console.log('  nullifier:', publicSignals[1] === publicInputsContract[1]);
      console.log('  recipient:', publicSignals[2] === publicInputsContract[2]);
      console.log('  amount:', publicSignals[3] === publicInputsContract[3]);

      // Verify proof locally
      try {
        const vkResponse = await fetch('/circuits/verification_key.json');
        const vk = await vkResponse.json();
        const isValidLocally = await groth16.verify(vk, publicSignals, proof);
        console.log('Local proof verification:', isValidLocally ? 'VALID' : 'INVALID');
      } catch (e) {
        console.error('Local verification error:', e);
      }

      // Submit via relayer
      toast.loading('Submitting to relayer...', { id: toastId });

      const response = await fetch(`${RELAYER_CONFIG.url}/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: encodedProof,
          publicInputs: publicInputsContract,
          vaultAddress: ADDRESSES.vault
        })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Relayer submission failed');
      }

      // Wait for confirmation
      toast.loading('Waiting for confirmation...', { id: toastId });
      const receipt = await rpcProvider.waitForTransaction(result.txHash);

      // If partial withdrawal, save the change note with its noteIndex from the event
      if (changeNote) {
        const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, rpcProvider);
        for (const log of receipt.logs) {
          try {
            const parsed = vault.interface.parseLog(log);
            if (parsed.name === 'NoteCreated' && parsed.args.commitment.toString() === changeNote.commitment) {
              const newIndex = Number(parsed.args.noteIndex);
              useWalletStore.getState().updateNoteIndex(changeNote.commitment, newIndex);
              break;
            }
          } catch {
            continue;
          }
        }
        console.log('Change note updated with index');
      }

      // Mark the original note as spent (if it exists in our wallet)
      // This handles the case where user claims their own note via ClaimLink
      console.log('=== MARKING NOTE AS SPENT ===');
      console.log('Original note commitment from link:', note.commitment);
      console.log('Commitment type:', typeof note.commitment);
      const walletNotes = useWalletStore.getState().notes;
      console.log('Notes in wallet:', walletNotes.map(n => ({ commitment: n.commitment, spent: n.spent })));
      spendNote(note.commitment);

      await fetchBalances();

      toast.success(
        <div>
          <p className="font-semibold">Funds claimed!</p>
          <p className="text-sm text-white/60">
            {amount} ETH sent to {recipient.slice(0, 6)}...{recipient.slice(-4)}
          </p>
        </div>,
        { id: toastId, duration: 5000 }
      );

      // Clear the hash and close
      window.location.hash = '';
      onClose();
    } catch (err) {
      console.error('Claim failed:', err);
      toast.error(err.reason || err.message || 'Claim failed', { id: toastId });

      // Cleanup pending note if anything fails
      if (changeNote) {
        useWalletStore.getState().removeNote(changeNote.commitment);
      }
    }

    setIsClaiming(false);
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Invalid Link</h2>
          <p className="text-white/60 mb-4">{error}</p>
          <button onClick={onClose} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-6 max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-2 border-noctis-purple border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  const noteBalance = parseFloat(ethers.formatEther(note.balance));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-noctis-purple/20 to-noctis-blue/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-noctis-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-1">Claim Private Payment</h2>
          <p className="text-white/60">Someone sent you ETH!</p>
        </div>

        {/* Amount */}
        <div className="p-4 bg-gradient-to-r from-noctis-purple/20 to-noctis-blue/20 rounded-xl text-center mb-6">
          <div className="text-sm text-white/60 mb-1">Available to claim</div>
          <div className="text-3xl font-bold gradient-text">{noteBalance.toFixed(6)} ETH</div>
        </div>

        <div className="space-y-4">
          {/* Recipient */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Withdraw to address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="input font-mono text-sm"
              disabled={isClaiming}
            />
            {address && recipient !== address && (
              <button
                onClick={() => setRecipient(address)}
                className="mt-2 text-xs text-noctis-purple hover:text-noctis-blue"
              >
                Use connected wallet
              </button>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="input"
              disabled={isClaiming}
              max={noteBalance}
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setAmount(noteBalance.toString())}
                className="text-xs text-noctis-purple hover:text-noctis-blue"
                disabled={isClaiming}
              >
                Full amount
              </button>
              <button
                onClick={() => setAmount((noteBalance / 2).toString())}
                className="text-xs text-noctis-purple hover:text-noctis-blue"
                disabled={isClaiming}
              >
                Half
              </button>
            </div>
          </div>

          {/* Fee info */}
          {amount && (
            <div className="p-3 bg-white/5 rounded-xl space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Relayer fee ({RELAYER_CONFIG.feeBps / 100}%)</span>
                <span className="text-yellow-400">
                  -{(parseFloat(amount) * RELAYER_CONFIG.feeBps / 10000).toFixed(6)} ETH
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">You receive</span>
                <span className="text-green-400 font-semibold">
                  {(parseFloat(amount) * (1 - RELAYER_CONFIG.feeBps / 10000)).toFixed(6)} ETH
                </span>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-noctis-purple/10 border border-noctis-purple/20 rounded-xl text-xs text-noctis-purple">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>
              No wallet or ETH needed. Just paste your address and claim!
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={isClaiming}
            >
              Cancel
            </button>
            <button
              onClick={handleClaim}
              disabled={isClaiming || !recipient || !amount}
              className="flex-1 btn-primary"
            >
              {isClaiming ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Claiming...
                </span>
              ) : (
                'Claim Funds'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
