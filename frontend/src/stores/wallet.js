import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ethers } from 'ethers';
import { ADDRESSES, TOKEN_ABI, VAULT_ABI, BASE_SEPOLIA, FIELD_MODULUS } from '../config';
import { initProver, computeCommitment as jsComputeCommitment, randomFieldElement } from '../lib/prover';

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
      error: null,

      // Balances
      ethBalance: '0',
      tokenBalance: '0',

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

          // Check if on Base Sepolia
          if (Number(network.chainId) !== BASE_SEPOLIA.chainId) {
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_SEPOLIA.chainIdHex }],
              });
            } catch (switchError) {
              if (switchError.code === 4902) {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: BASE_SEPOLIA.chainIdHex,
                    chainName: BASE_SEPOLIA.name,
                    rpcUrls: [BASE_SEPOLIA.rpcUrl],
                    blockExplorerUrls: [BASE_SEPOLIA.blockExplorer],
                    nativeCurrency: BASE_SEPOLIA.nativeCurrency
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
          set({ error: err.message, isConnecting: false });
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
          tokenBalance: '0',
        });
      },

      // Fetch balances
      fetchBalances: async () => {
        const { provider, address } = get();
        if (!provider || !address) return;

        try {
          const ethBal = await provider.getBalance(address);
          const token = new ethers.Contract(ADDRESSES.token, TOKEN_ABI, provider);
          const tokenBal = await token.balanceOf(address);

          set({
            ethBalance: ethers.formatEther(ethBal),
            tokenBalance: ethers.formatEther(tokenBal),
          });
        } catch (err) {
          console.error('Failed to fetch balances:', err);
        }
      },

      // Create a new note for deposit (using JS Poseidon from prover.js)
      createNote: async (amount) => {
        await initProver();

        const spendingKey = randomSpendingKey();
        const randomness = randomFieldElement().toString();
        const amountWei = ethers.parseEther(amount.toString());

        // Compute commitment using JS Poseidon: hash(hash(spendingKey, 0), balance, randomness)
        const commitment = await jsComputeCommitment(spendingKey, amountWei.toString(), randomness);

        return {
          spendingKey,
          randomness,
          balance: amountWei.toString(),
          commitment: commitment.toString(),
          noteIndex: null,
          createdAt: Date.now(),
          spent: false,
          version: 'v5' // Mark as V5 note (BN254 Poseidon + Groth16)
        };
      },

      // Add note after deposit
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
        set(state => ({
          notes: state.notes.map(n =>
            n.commitment === commitment.toString()
              ? { ...n, spent: true }
              : n
          )
        }));
      },

      // Remove spent notes
      removeSpentNotes: () => {
        set(state => ({
          notes: state.notes.filter(n => !n.spent)
        }));
      },

      // Get active (unspent) notes
      getActiveNotes: () => {
        return get().notes.filter(n => !n.spent && n.noteIndex !== null);
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
          version: 5,
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
      }
    }),
    {
      name: 'noctis-wallet-v5',
      partialize: (state) => ({ notes: state.notes }),
    }
  )
);
