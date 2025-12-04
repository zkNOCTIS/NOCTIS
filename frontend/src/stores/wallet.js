import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ethers } from 'ethers';
import { ADDRESSES, VAULT_ABI, ACTIVE_NETWORK, FIELD_MODULUS, FEE_BPS } from '../config';
import { initProver, computeCommitment as jsComputeCommitment, computeNullifier as jsComputeNullifier, randomFieldElement } from '../lib/prover';

// Generate random 32-byte spending key as BigInt (mod field)
function randomSpendingKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let value = 0n;
  for (let i = 0; i < 32; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return (value % FIELD_MODULUS).toString();
}

export const useWalletStore = create(
  persist(
    (set, get) => ({
      // Connection state
      address: null,
      chainId: null,
      provider: null,
      signer: null,
      isConnecting: false,
      isConnected: false,
      error: null,

      // Balances
      ethBalance: '0',

      // Private notes (stored locally)
      notes: [],

      // Connect wallet
      connect: async () => {
        if (!window.ethereum) {
          set({ error: 'Please install MetaMask' });
          return;
        }

        set({ isConnecting: true, error: null });

        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send('eth_requestAccounts', []);
          const signer = await provider.getSigner();
          const network = await provider.getNetwork();

          // Check if on correct network
          if (Number(network.chainId) !== ACTIVE_NETWORK.chainId) {
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ACTIVE_NETWORK.chainIdHex }],
              });
            } catch (switchError) {
              if (switchError.code === 4902) {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: ACTIVE_NETWORK.chainIdHex,
                    chainName: ACTIVE_NETWORK.name,
                    rpcUrls: [ACTIVE_NETWORK.rpcUrl],
                    blockExplorerUrls: ACTIVE_NETWORK.blockExplorer ? [ACTIVE_NETWORK.blockExplorer] : [],
                    nativeCurrency: ACTIVE_NETWORK.nativeCurrency
                  }],
                });
              }
            }
          }

          set({
            address: accounts[0],
            chainId: Number(network.chainId),
            provider,
            signer,
            isConnecting: false,
            isConnected: true,
          });

          get().fetchBalances();

          window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
              get().disconnect();
            } else {
              set({ address: accounts[0] });
              get().fetchBalances();
            }
          });

          window.ethereum.on('chainChanged', () => {
            window.location.reload();
          });

        } catch (err) {
          console.error('Connection error:', err);
          set({ error: err.message, isConnecting: false, isConnected: false });
        }
      },

      // Reconnect (called on mount)
      reconnect: async () => {
        const { isConnected } = get();
        if (isConnected && window.ethereum) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            get().connect();
          } else {
            set({ isConnected: false });
          }
        }
      },

      // Disconnect
      disconnect: () => {
        set({
          address: null,
          chainId: null,
          provider: null,
          signer: null,
          ethBalance: '0',
          isConnected: false,
        });
      },

      // Fetch ETH balance
      fetchBalances: async () => {
        const { address } = get();
        if (!address) return;

        const rpcProvider = new ethers.JsonRpcProvider(ACTIVE_NETWORK.rpcUrl);

        try {
          const ethBal = await rpcProvider.getBalance(address);
          set({ ethBalance: ethers.formatEther(ethBal) });
        } catch (err) {
          console.error('Failed to fetch ETH balance:', err);
        }
      },

      // Create a new note for ETH deposit
      // IMPORTANT: Fee is deducted from deposit, so note balance = depositAmount - fee
      createNote: async (depositAmountEth) => {
        await initProver();

        const spendingKey = randomSpendingKey();
        const randomness = randomFieldElement().toString();
        const depositWei = ethers.parseEther(depositAmountEth.toString());

        // Calculate fee and note balance (fee is deducted on deposit)
        const fee = (depositWei * FEE_BPS) / 10000n;
        const noteBalance = depositWei - fee;

        // Compute commitment with POST-FEE balance
        const commitment = await jsComputeCommitment(spendingKey, noteBalance.toString(), randomness);

        return {
          spendingKey,
          randomness,
          balance: noteBalance.toString(),
          depositAmount: depositWei.toString(),
          fee: fee.toString(),
          commitment: commitment.toString(),
          noteIndex: null,
          createdAt: Date.now(),
          spent: false,
          type: 'ETH'
        };
      },

      // Create a change note (no fee) for partial withdrawals
      createChangeNote: async (balanceWei) => {
        await initProver();

        const spendingKey = randomSpendingKey();
        const randomness = randomFieldElement().toString();
        const balance = BigInt(balanceWei);

        // Compute commitment with exact balance (no fee for change notes)
        const commitment = await jsComputeCommitment(spendingKey, balance.toString(), randomness);

        return {
          spendingKey,
          randomness,
          balance: balance.toString(),
          commitment: commitment.toString(),
          noteIndex: null,
          createdAt: Date.now(),
          spent: false,
          type: 'ETH'
        };
      },

      // Deposit ETH to vault
      depositEth: async (amountEth) => {
        const { signer } = get();
        if (!signer) throw new Error('Not connected');

        // Create note with fee calculation
        const note = await get().createNote(amountEth);

        // Connect to vault
        const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, signer);

        // Send deposit with full ETH amount (fee deducted by contract)
        const tx = await vault.deposit(note.commitment, {
          value: note.depositAmount
        });

        const receipt = await tx.wait();

        // Get note index from event
        const event = receipt.logs.find(log => {
          try {
            return vault.interface.parseLog(log)?.name === 'NoteCreated';
          } catch { return false; }
        });

        if (event) {
          const parsed = vault.interface.parseLog(event);
          note.noteIndex = Number(parsed.args.noteIndex);
        }

        // Save note
        set(state => ({
          notes: [...state.notes, note]
        }));

        get().fetchBalances();

        return { tx, note };
      },

      // Add note (for imports or change notes)
      addNote: (note) => {
        set(state => ({
          notes: [...state.notes, note]
        }));
      },

      // Update note with index after deposit
      updateNoteIndex: (commitment, noteIndex) => {
        set(state => ({
          notes: state.notes.map(n =>
            n.commitment === commitment.toString()
              ? { ...n, noteIndex }
              : n
          )
        }));
      },

      // Mark note as spent
      spendNote: (commitment) => {
        const commitmentStr = commitment.toString();
        console.log('spendNote called with:', commitmentStr);

        set(state => {
          const updatedNotes = state.notes.map(n => {
            const match = n.commitment === commitmentStr;
            if (match) {
              console.log('Found matching note, marking as spent');
            }
            return match ? { ...n, spent: true } : n;
          });
          return { notes: updatedNotes };
        });
      },

      // Remove spent notes
      removeSpentNotes: () => {
        set(state => ({
          notes: state.notes.filter(n => !n.spent)
        }));
      },

      // Remove note (used for cleanup if transaction fails)
      removeNote: (commitment) => {
        set(state => ({
          notes: state.notes.filter(n => n.commitment !== commitment.toString())
        }));
      },

      // Get active (unspent) notes
      getActiveNotes: () => {
        return get().notes.filter(n => !n.spent);
      },

      // Get total private balance
      getPrivateBalance: () => {
        const notes = get().getActiveNotes();
        const total = notes.reduce((sum, n) => sum + BigInt(n.balance), 0n);
        return ethers.formatEther(total);
      },

      // Export notes for backup
      exportNotes: () => {
        return JSON.stringify({
          version: 1,
          type: 'ETH',
          notes: get().notes,
          exportedAt: Date.now()
        });
      },

      // Import notes from backup
      importNotes: (json) => {
        try {
          const data = JSON.parse(json);
          if (!data.notes || !Array.isArray(data.notes)) {
            throw new Error('Invalid backup format');
          }

          const existing = new Set(get().notes.map(n => n.commitment));
          const newNotes = data.notes.filter(n => !existing.has(n.commitment));

          set(state => ({
            notes: [...state.notes, ...newNotes]
          }));

          return newNotes.length;
        } catch (err) {
          throw new Error('Failed to import: ' + err.message);
        }
      },

      // Sync notes with blockchain - check if any notes have been spent
      syncNotes: async () => {
        const notes = get().notes;
        const activeNotes = notes.filter(n => !n.spent && n.noteIndex !== null);
        const pendingNotes = notes.filter(n => !n.spent && n.noteIndex === null);

        if (activeNotes.length === 0 && pendingNotes.length === 0) return 0;

        try {
          await initProver();

          const provider = new ethers.JsonRpcProvider(ACTIVE_NETWORK.rpcUrl);
          const vault = new ethers.Contract(ADDRESSES.vault, VAULT_ABI, provider);

          const vaultWithCommitments = new ethers.Contract(
            ADDRESSES.vault,
            [...VAULT_ABI, "function noteCommitments(uint256) view returns (uint256)"],
            provider
          );

          let spentCount = 0;
          let recoveredCount = 0;

          // Check pending notes (recover index if confirmed)
          for (const note of pendingNotes) {
            try {
              const isUsed = await vault.commitmentUsed(note.commitment);
              if (isUsed) {
                console.log(`Pending note ${note.commitment.slice(0, 10)}... is confirmed. Finding index...`);

                const noteCount = Number(await vault.getNoteCount());
                let foundIndex = null;

                const startScan = Math.max(0, noteCount - 1000);
                for (let i = noteCount - 1; i >= startScan; i--) {
                  const commitment = await vaultWithCommitments.noteCommitments(i);
                  if (commitment.toString() === note.commitment) {
                    foundIndex = i;
                    break;
                  }
                }

                if (foundIndex !== null) {
                  console.log(`Found index ${foundIndex} for pending note`);
                  get().updateNoteIndex(note.commitment, foundIndex);
                  recoveredCount++;
                }
              }
            } catch (err) {
              console.error('Failed to check pending note:', err);
            }
          }

          // Check active notes (mark as spent if nullifier used)
          for (const note of activeNotes) {
            try {
              const nullifier = await jsComputeNullifier(
                note.spendingKey.toString(),
                note.noteIndex.toString()
              );

              const isUsed = await vault.nullifierUsed(nullifier);

              if (isUsed) {
                console.log(`Note #${note.noteIndex} has been spent on-chain`);
                get().spendNote(note.commitment);
                spentCount++;
              }
            } catch (err) {
              console.error(`Failed to check note #${note.noteIndex}:`, err);
            }
          }

          return spentCount + recoveredCount;
        } catch (err) {
          console.error('Failed to sync notes:', err);
          return 0;
        }
      }
    }),
    {
      name: 'eth-vault-wallet-v1',
      partialize: (state) => ({ notes: state.notes, isConnected: state.isConnected }),
    }
  )
);
