import { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useWalletStore } from '../stores/wallet';
import { ADDRESSES, TOKEN_ABI, VAULT_ABI } from '../config';

export function DepositCard() {
  const { address, signer, tokenBalance, createNote, addNote, updateNoteIndex, fetchBalances } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  const handleDeposit = async () => {
    if (!address || !signer) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > parseFloat(tokenBalance)) {
      toast.error('Insufficient balance');
      return;
    }

    setIsDepositing(true);
    const toastId = toast.loading('Preparing deposit...');

    try {
      // Create new note (async - calls Poseidon2 contract)
      toast.loading('Creating commitment...', { id: toastId });
      const note = await createNote(amount);
      const amountWei = ethers.parseEther(amount);

      // Get contracts
      const token = new ethers.Contract(ADDRESSES.token, TOKEN_ABI, signer);
      const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, signer);

      // Check allowance
      const allowance = await token.allowance(address, ADDRESSES.vault);
      if (allowance < amountWei) {
        toast.loading('Approving tokens...', { id: toastId });
        const approveTx = await token.approve(ADDRESSES.vault, amountWei);
        await approveTx.wait();
      }

      // Deposit
      toast.loading('Depositing to vault...', { id: toastId });
      const tx = await vault.deposit(note.commitment, amountWei);
      const receipt = await tx.wait();

      // Find note index from event
      let noteIndex = null;
      for (const log of receipt.logs) {
        try {
          const parsed = vault.interface.parseLog(log);
          if (parsed.name === 'NoteCreated' && parsed.args.commitment.toString() === note.commitment.toString()) {
            noteIndex = Number(parsed.args.noteIndex);
            break;
          }
        } catch {
          continue;
        }
      }

      // Save note with index
      note.noteIndex = noteIndex;
      addNote(note);

      // Refresh balances
      await fetchBalances();

      toast.success(
        <div>
          <p className="font-semibold">Deposit successful!</p>
          <p className="text-sm text-white/60">{amount} NOCTIS deposited privately</p>
        </div>,
        { id: toastId, duration: 5000 }
      );

      setAmount('');
    } catch (err) {
      console.error('Deposit failed:', err);
      toast.error(err.reason || err.message || 'Deposit failed', { id: toastId });
    } finally {
      setIsDepositing(false);
    }
  };

  const presetAmounts = ['1000', '5000', '10000', '50000'];

  return (
    <div id="deposit" className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold">Deposit</h2>
          <p className="text-sm text-white/60">Add tokens to your private balance</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-2">Amount (NOCTIS)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="input"
            disabled={isDepositing}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {presetAmounts.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              disabled={isDepositing}
            >
              {parseInt(preset).toLocaleString()}
            </button>
          ))}
          <button
            onClick={() => setAmount(tokenBalance)}
            className="px-3 py-1.5 text-sm bg-noctis-purple/20 border border-noctis-purple/30 rounded-lg hover:bg-noctis-purple/30 transition-colors"
            disabled={isDepositing}
          >
            MAX
          </button>
        </div>

        {amount && (
          <div className="p-4 bg-white/5 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">You deposit</span>
              <span>{parseFloat(amount).toLocaleString()} NOCTIS</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Privacy set</span>
              <span className="text-green-400">Anonymous</span>
            </div>
          </div>
        )}

        <button
          onClick={handleDeposit}
          disabled={!address || isDepositing || !amount}
          className="w-full btn-primary"
        >
          {isDepositing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : !address ? (
            'Connect Wallet'
          ) : (
            'Deposit'
          )}
        </button>
      </div>
    </div>
  );
}
