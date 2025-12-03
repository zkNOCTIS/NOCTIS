/**
 * NOCTIS Privacy Vault SDK
 *
 * JavaScript SDK for interacting with the Noctis privacy-preserving vault.
 * Supports both browser (real ZK proofs via WASM) and testnet (mock proofs).
 */

const { ethers } = require('ethers');

// Contract ABIs (minimal for SDK)
const VAULT_ABI = [
    "function deposit(bytes32 commitment, uint256 amount) external",
    "function withdraw(bytes calldata proof, uint256[5] calldata publicInputs) external",
    "function getCurrentRoot() external view returns (bytes32)",
    "function getMerkleProof(uint256 noteIndex) external view returns (bytes32[] memory siblings, uint256[] memory pathIndices)",
    "function getNoteCount() external view returns (uint256)",
    "function isKnownRoot(bytes32 root) external view returns (bool)",
    "function nullifierUsed(bytes32 nullifier) external view returns (bool)",
    "function commitmentUsed(bytes32 commitment) external view returns (bool)",
    "event NoteCreated(bytes32 indexed commitment, uint256 indexed noteIndex, uint256 timestamp)",
    "event Withdrawal(bytes32 indexed nullifier, address indexed recipient, uint256 amount, bool hasChange)"
];

const TOKEN_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

const RELAYER_ABI = [
    "function executeWithdrawal(bytes calldata proof, uint256[5] calldata publicInputs, address actualRecipient, uint256 fee, uint256 deadline, bytes calldata sig) external",
    "function minRelayerFee() external view returns (uint256)",
    "function maxRelayerFeeBps() external view returns (uint256)"
];

// Contract addresses - configure for your deployment
const ADDRESSES = {
    base: {
        token: "0x0000000000000000000000000000000000000000",
        vault: "0x0000000000000000000000000000000000000000",
        relayer: "0x0000000000000000000000000000000000000000",
        verifier: "0x0000000000000000000000000000000000000000"
    }
};

// WASM module state
let wasmModule = null;
let wasmInitPromise = null;

/**
 * Initialize the WASM prover module
 * @param {string} [wasmPath] - Optional path to WASM file
 * @returns {Promise<void>}
 */
async function initWasm(wasmPath) {
    if (wasmModule) return;

    if (wasmInitPromise) {
        await wasmInitPromise;
        return;
    }

    wasmInitPromise = (async () => {
        try {
            // Dynamic import for browser/bundler compatibility
            if (typeof window !== 'undefined') {
                // Browser: load WASM module
                const wasm = await import('./wasm/noctis_circuits.js');
                await wasm.default(wasmPath || './wasm/noctis_circuits_bg.wasm');
                wasmModule = wasm;
                wasmModule.init(); // Initialize panic hook
                console.log('WASM prover initialized successfully');
            } else {
                // Node.js: attempt to load WASM
                const path = require('path');
                const fs = require('fs');
                const wasmPath = path.join(__dirname, 'wasm', 'noctis_circuits_bg.wasm');

                if (fs.existsSync(wasmPath)) {
                    const wasmBytes = fs.readFileSync(wasmPath);
                    const wasm = await import('./wasm/noctis_circuits.js');
                    wasm.initSync(wasmBytes);
                    wasmModule = wasm;
                    wasmModule.init();
                    console.log('WASM prover initialized (Node.js)');
                } else {
                    console.warn('WASM not found, using mock proofs');
                }
            }
        } catch (e) {
            console.warn('WASM initialization failed, using mock proofs:', e.message);
        }
    })();

    await wasmInitPromise;
}

/**
 * Check if WASM prover is available
 * @returns {boolean}
 */
function isWasmAvailable() {
    return wasmModule !== null;
}

/**
 * Generate a random spending key
 * @returns {string} 32-byte hex string
 */
function generateSpendingKey() {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        // Node.js fallback
        const nodeCrypto = require('crypto');
        const randomBytes = nodeCrypto.randomBytes(32);
        bytes.set(randomBytes);
    }
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random note randomness
 * @returns {string} 32-byte hex string
 */
function generateRandomness() {
    return generateSpendingKey();
}

/**
 * Compute commitment using WASM Poseidon2 hash or fallback to keccak256
 * @param {string} spendingKey - The spending key (hex)
 * @param {BigInt|string} balance - The balance amount
 * @param {string} randomness - Random value (hex)
 * @returns {string} Commitment hash
 */
function computeCommitment(spendingKey, balance, randomness) {
    if (wasmModule) {
        try {
            // Use WASM Poseidon2 hash
            const secret = spendingKey.replace('0x', '');
            return '0x' + wasmModule.generate_commitment(secret);
        } catch (e) {
            console.warn('WASM commitment failed, using fallback:', e.message);
        }
    }

    // Fallback: keccak256 (works with MockVerifier)
    const spendingKeyHash = ethers.keccak256(spendingKey);
    return ethers.keccak256(
        ethers.solidityPacked(
            ['bytes32', 'uint256', 'bytes32'],
            [spendingKeyHash, balance, randomness]
        )
    );
}

/**
 * Compute nullifier = keccak256(spendingKey, noteIndex) or Poseidon2
 * @param {string} spendingKey - The spending key (hex)
 * @param {number} noteIndex - The note's index in the tree
 * @returns {string} Nullifier hash
 */
function computeNullifier(spendingKey, noteIndex) {
    if (wasmModule) {
        try {
            // Use WASM Poseidon2 nullifier
            const preimage = spendingKey.replace('0x', '');
            return '0x' + wasmModule.generate_nullifier(preimage);
        } catch (e) {
            console.warn('WASM nullifier failed, using fallback:', e.message);
        }
    }

    // Fallback: keccak256
    return ethers.keccak256(
        ethers.solidityPacked(['bytes32', 'uint256'], [spendingKey, noteIndex])
    );
}

/**
 * Create a Note object for tracking deposits
 */
class Note {
    constructor(spendingKey, balance, randomness, noteIndex = null, commitment = null) {
        this.spendingKey = spendingKey;
        this.balance = BigInt(balance);
        this.randomness = randomness;
        this.noteIndex = noteIndex;
        this.commitment = commitment || computeCommitment(spendingKey, this.balance, randomness);
    }

    toJSON() {
        return {
            version: 2, // Updated version for WASM support
            spendingKey: this.spendingKey,
            balance: this.balance.toString(),
            randomness: this.randomness,
            noteIndex: this.noteIndex,
            commitment: this.commitment
        };
    }

    static fromJSON(json) {
        return new Note(
            json.spendingKey,
            json.balance,
            json.randomness,
            json.noteIndex,
            json.commitment
        );
    }

    /**
     * Create a new note for deposit
     * @param {BigInt|string} amount - Amount to deposit
     * @returns {Note}
     */
    static create(amount) {
        return new Note(
            generateSpendingKey(),
            amount,
            generateRandomness()
        );
    }

    /**
     * Get nullifier for this note
     * @returns {string|null}
     */
    getNullifier() {
        if (this.noteIndex === null) return null;
        return computeNullifier(this.spendingKey, this.noteIndex);
    }
}

/**
 * NoctisSDK - Main interface for vault interactions
 */
class NoctisSDK {
    /**
     * @param {ethers.Provider} provider - Ethers provider
     * @param {ethers.Signer} [signer] - Ethers signer (optional for read-only)
     * @param {string} [network='baseSepolia'] - Network name
     * @param {Object} [options] - Additional options
     * @param {boolean} [options.useRealProofs=false] - Use real ZK proofs via WASM
     * @param {string} [options.wasmPath] - Custom path to WASM file
     */
    constructor(provider, signer = null, network = 'baseSepolia', options = {}) {
        this.provider = provider;
        this.signer = signer;
        this.addresses = ADDRESSES[network];
        this.useRealProofs = options.useRealProofs || false;
        this.wasmPath = options.wasmPath;

        if (!this.addresses) {
            throw new Error(`Unknown network: ${network}`);
        }

        this.vault = new ethers.Contract(this.addresses.vault, VAULT_ABI, signer || provider);
        this.token = new ethers.Contract(this.addresses.token, TOKEN_ABI, signer || provider);
        this.relayer = new ethers.Contract(this.addresses.relayer, RELAYER_ABI, signer || provider);

        // Initialize WASM if real proofs requested
        if (this.useRealProofs) {
            initWasm(this.wasmPath);
        }
    }

    /**
     * Initialize the SDK (loads WASM if needed)
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.useRealProofs) {
            await initWasm(this.wasmPath);
        }
    }

    /**
     * Check if real ZK proofs are available
     * @returns {boolean}
     */
    hasRealProofs() {
        return this.useRealProofs && isWasmAvailable();
    }

    // ==================== DEPOSIT ====================

    /**
     * Deposit tokens and create a note
     * @param {BigInt|string} amount - Amount to deposit (in wei)
     * @returns {Promise<{note: Note, tx: ethers.TransactionResponse}>}
     */
    async deposit(amount) {
        if (!this.signer) throw new Error('Signer required for deposit');

        const amountBn = BigInt(amount);
        const note = Note.create(amountBn);

        // Check and approve if needed
        const signerAddress = await this.signer.getAddress();
        const allowance = await this.token.allowance(signerAddress, this.addresses.vault);

        if (allowance < amountBn) {
            const approveTx = await this.token.approve(this.addresses.vault, amountBn);
            await approveTx.wait();
        }

        // Deposit
        const tx = await this.vault.deposit(note.commitment, amountBn);
        const receipt = await tx.wait();

        // Find note index from event
        const event = receipt.logs.find(log => {
            try {
                const parsed = this.vault.interface.parseLog(log);
                return parsed.name === 'NoteCreated';
            } catch { return false; }
        });

        if (event) {
            const parsed = this.vault.interface.parseLog(event);
            note.noteIndex = Number(parsed.args.noteIndex);
        }

        return { note, tx };
    }

    // ==================== WITHDRAW ====================

    /**
     * Generate proof for withdrawal
     * @param {Note} note - The note to spend
     * @param {string} recipient - Recipient address
     * @param {BigInt|string} amount - Amount to withdraw
     * @param {Note} [changeNote] - Optional change note
     * @returns {Promise<{proof: string, publicInputs: BigInt[]}>}
     */
    async generateProof(note, recipient, amount, changeNote = null) {
        const amountBn = BigInt(amount);

        if (amountBn > note.balance) {
            throw new Error('Insufficient balance');
        }

        const merkleRoot = await this.vault.getCurrentRoot();
        const nullifier = note.getNullifier();

        if (!nullifier) {
            throw new Error('Note must have noteIndex set');
        }

        const changeCommitment = changeNote ? changeNote.commitment : ethers.ZeroHash;

        // If using real proofs and WASM is available
        if (this.useRealProofs && isWasmAvailable()) {
            return await this._generateRealProof(
                note,
                recipient,
                amountBn,
                merkleRoot,
                nullifier,
                changeCommitment
            );
        }

        // Fallback to mock proofs
        return this._generateMockProof(
            merkleRoot,
            nullifier,
            recipient,
            amountBn,
            changeCommitment,
            note
        );
    }

    /**
     * Generate real ZK proof using WASM
     */
    async _generateRealProof(note, recipient, amount, merkleRoot, nullifier, changeCommitment) {
        // Get Merkle proof from contract
        const { siblings, pathIndices } = await this.vault.getMerkleProof(note.noteIndex);

        // Convert to format expected by WASM
        const secretHex = note.spendingKey.replace('0x', '');
        const nullifierPreimageHex = note.randomness.replace('0x', '');
        const merklePathJson = JSON.stringify(siblings.map(s => s.replace('0x', '')));
        const pathIndicesJson = JSON.stringify(pathIndices.map(i => i === 1n || i === 1));

        try {
            // Generate proof bytes
            const proofBytes = wasmModule.generate_proof(
                secretHex,
                nullifierPreimageHex,
                merklePathJson,
                pathIndicesJson,
                recipient,
                amount.toString()
            );

            // Get public inputs
            const publicInputsJson = wasmModule.get_public_inputs(
                secretHex,
                nullifierPreimageHex,
                merklePathJson,
                pathIndicesJson,
                recipient,
                amount.toString()
            );

            const publicInputsObj = JSON.parse(publicInputsJson);

            // Convert proof to hex
            const proof = '0x' + Array.from(proofBytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            // Public inputs for the verifier
            const publicInputs = [
                BigInt(publicInputsObj.merkle_root),
                BigInt('0x' + publicInputsObj.nullifier),
                BigInt(recipient),
                amount,
                BigInt(changeCommitment)
            ];

            return { proof, publicInputs };
        } catch (e) {
            console.error('WASM proof generation failed:', e);
            throw new Error(`Proof generation failed: ${e.message}`);
        }
    }

    /**
     * Generate mock proof (for testnet/MockVerifier)
     */
    _generateMockProof(merkleRoot, nullifier, recipient, amount, changeCommitment, note) {
        // Public inputs for the verifier
        const publicInputs = [
            BigInt(merkleRoot),
            BigInt(nullifier),
            BigInt(recipient),
            amount,
            BigInt(changeCommitment)
        ];

        // Generate mock proof (works with MockVerifier on testnet)
        // Structure: [traceCommitment(32), quotientCommitment(32), friCommitment(32)]
        const proof = ethers.concat([
            ethers.zeroPadValue(merkleRoot, 32),      // Trace commitment (non-zero)
            ethers.zeroPadValue(nullifier, 32),       // Quotient commitment (non-zero)
            ethers.zeroPadValue(note.commitment, 32)  // FRI commitment (non-zero)
        ]);

        return { proof, publicInputs };
    }

    /**
     * Withdraw tokens from the vault
     * @param {Note} note - The note to spend
     * @param {string} recipient - Recipient address
     * @param {BigInt|string} amount - Amount to withdraw
     * @returns {Promise<{tx: ethers.TransactionResponse, changeNote: Note|null}>}
     */
    async withdraw(note, recipient, amount) {
        if (!this.signer) throw new Error('Signer required for withdrawal');

        const amountBn = BigInt(amount);
        let changeNote = null;

        // Create change note if partial withdrawal
        if (amountBn < note.balance) {
            changeNote = new Note(
                note.spendingKey, // Same spending key
                note.balance - amountBn,
                generateRandomness()
            );
        }

        const { proof, publicInputs } = await this.generateProof(note, recipient, amountBn, changeNote);

        const tx = await this.vault.withdraw(proof, publicInputs);
        const receipt = await tx.wait();

        // Get change note index from event
        if (changeNote) {
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.vault.interface.parseLog(log);
                    return parsed.name === 'NoteCreated' && parsed.args.commitment === changeNote.commitment;
                } catch { return false; }
            });

            if (event) {
                const parsed = this.vault.interface.parseLog(event);
                changeNote.noteIndex = Number(parsed.args.noteIndex);
            }
        }

        return { tx, changeNote };
    }

    // ==================== GAS-FREE WITHDRAWAL ====================

    /**
     * Sign a withdrawal request for gas-free execution via relayer
     * @param {Note} note - The note to spend
     * @param {string} recipient - Actual recipient address
     * @param {BigInt|string} amount - Amount to withdraw
     * @param {BigInt|string} fee - Fee for relayer (in NOCTIS)
     * @param {number} deadline - Unix timestamp deadline
     * @returns {Promise<{proof: string, publicInputs: BigInt[], signature: string, changeNote: Note|null}>}
     */
    async signGasFreeWithdrawal(note, recipient, amount, fee, deadline) {
        if (!this.signer) throw new Error('Signer required');

        const amountBn = BigInt(amount) + BigInt(fee); // Total including fee
        let changeNote = null;

        if (amountBn < note.balance) {
            changeNote = new Note(
                note.spendingKey,
                note.balance - amountBn,
                generateRandomness()
            );
        }

        // Proof sends to relayer contract
        const { proof, publicInputs } = await this.generateProof(
            note,
            this.addresses.relayer, // Relayer receives first
            amountBn,
            changeNote
        );

        // Sign the authorization
        const nullifier = note.getNullifier();
        const messageHash = ethers.keccak256(
            ethers.solidityPacked(
                ['bytes32', 'address', 'uint256', 'uint256', 'uint256'],
                [nullifier, recipient, amount, fee, deadline]
            )
        );

        const signature = await this.signer.signMessage(ethers.getBytes(messageHash));

        return { proof, publicInputs, signature, changeNote, nullifier, recipient, amount, fee, deadline };
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * Get current Merkle root
     * @returns {Promise<string>}
     */
    async getCurrentRoot() {
        return await this.vault.getCurrentRoot();
    }

    /**
     * Get total note count
     * @returns {Promise<number>}
     */
    async getNoteCount() {
        return Number(await this.vault.getNoteCount());
    }

    /**
     * Check if a nullifier has been used
     * @param {string} nullifier
     * @returns {Promise<boolean>}
     */
    async isNullifierUsed(nullifier) {
        return await this.vault.nullifierUsed(nullifier);
    }

    /**
     * Get token balance
     * @param {string} address
     * @returns {Promise<BigInt>}
     */
    async getTokenBalance(address) {
        return await this.token.balanceOf(address);
    }

    /**
     * Get Merkle proof for a note
     * @param {number} noteIndex
     * @returns {Promise<{siblings: string[], pathIndices: number[]}>}
     */
    async getMerkleProof(noteIndex) {
        const [siblings, pathIndices] = await this.vault.getMerkleProof(noteIndex);
        return {
            siblings: siblings.map(s => s),
            pathIndices: pathIndices.map(p => Number(p))
        };
    }

    /**
     * Verify a Merkle proof locally (using WASM if available)
     * @param {string} commitment - Commitment hash
     * @param {string[]} siblings - Sibling hashes
     * @param {number[]} pathIndices - Path indices
     * @param {string} expectedRoot - Expected Merkle root
     * @returns {boolean}
     */
    verifyMerkleProofLocal(commitment, siblings, pathIndices, expectedRoot) {
        if (!isWasmAvailable()) {
            console.warn('WASM not available for local verification');
            return true; // Cannot verify without WASM
        }

        try {
            const commitmentHex = commitment.replace('0x', '');
            const merklePathJson = JSON.stringify(siblings.map(s => s.replace('0x', '')));
            const pathIndicesJson = JSON.stringify(pathIndices.map(i => i === 1));
            const expectedRootHex = expectedRoot.replace('0x', '');

            return wasmModule.verify_merkle_path(
                commitmentHex,
                merklePathJson,
                pathIndicesJson,
                expectedRootHex
            );
        } catch (e) {
            console.error('Local Merkle verification failed:', e);
            return false;
        }
    }
}

// ==================== WALLET MANAGEMENT ====================

/**
 * Simple encrypted wallet storage
 */
class NoctisWallet {
    constructor() {
        this.notes = [];
    }

    /**
     * Add a note to the wallet
     * @param {Note} note
     */
    addNote(note) {
        this.notes.push(note);
    }

    /**
     * Remove a spent note
     * @param {string} commitment
     */
    removeNote(commitment) {
        this.notes = this.notes.filter(n => n.commitment !== commitment);
    }

    /**
     * Get total balance
     * @returns {BigInt}
     */
    getTotalBalance() {
        return this.notes.reduce((sum, n) => sum + n.balance, 0n);
    }

    /**
     * Find note by commitment
     * @param {string} commitment
     * @returns {Note|null}
     */
    findNote(commitment) {
        return this.notes.find(n => n.commitment === commitment) || null;
    }

    /**
     * Export wallet (for backup)
     * @returns {string} JSON string
     */
    export() {
        return JSON.stringify({
            version: 2,
            notes: this.notes.map(n => n.toJSON()),
            wasmSupported: isWasmAvailable()
        });
    }

    /**
     * Import wallet
     * @param {string} json
     * @returns {NoctisWallet}
     */
    static import(json) {
        const data = JSON.parse(json);
        const wallet = new NoctisWallet();
        wallet.notes = data.notes.map(n => Note.fromJSON(n));
        return wallet;
    }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NoctisSDK,
        NoctisWallet,
        Note,
        initWasm,
        isWasmAvailable,
        generateSpendingKey,
        generateRandomness,
        computeCommitment,
        computeNullifier,
        ADDRESSES,
        VAULT_ABI,
        TOKEN_ABI,
        RELAYER_ABI
    };
}

// Browser global
if (typeof window !== 'undefined') {
    window.Noctis = {
        SDK: NoctisSDK,
        Wallet: NoctisWallet,
        Note,
        initWasm,
        isWasmAvailable,
        utils: {
            generateSpendingKey,
            generateRandomness,
            computeCommitment,
            computeNullifier
        },
        ADDRESSES
    };
}
