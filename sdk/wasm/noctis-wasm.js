/**
 * NOCTIS WASM Prover - JavaScript Wrapper
 *
 * This module loads the WASM prover and provides a clean API for proof generation.
 *
 * Note: The current WASM module requires wasm-bindgen generated JS bindings.
 * This is a placeholder that provides mock implementations until wasm-pack
 * can be run (requires Visual Studio Build Tools with C++ workload on Windows).
 *
 * For production, run: wasm-pack build --target web
 * in the circuits directory to generate proper bindings.
 */

// Mock implementation for development/testing
// In production, this would load the actual WASM module

const BABY_BEAR_MODULUS = 2013265921n; // 2^31 - 2^27 + 1

/**
 * Simple Poseidon hash mock (for testing - NOT secure)
 * Real implementation is in the WASM module
 */
function mockPoseidonHash(input) {
    // Simple hash for testing - multiply by prime and mod
    let hash = 0n;
    for (const byte of input) {
        hash = (hash * 31n + BigInt(byte)) % BABY_BEAR_MODULUS;
    }
    return hash;
}

/**
 * Generate a commitment from a secret
 * @param {string} secretHex - The secret as a hex string (with or without 0x prefix)
 * @returns {Promise<string>} The commitment as a hex string
 */
async function generateCommitment(secretHex) {
    const cleanHex = secretHex.replace(/^0x/, '');
    const bytes = Buffer.from(cleanHex, 'hex');
    const hash = mockPoseidonHash(bytes);
    return `0x${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Generate a nullifier from a preimage
 * @param {string} preimageHex - The nullifier preimage as hex
 * @returns {Promise<string>} The nullifier as a hex string
 */
async function generateNullifier(preimageHex) {
    const cleanHex = preimageHex.replace(/^0x/, '');
    const bytes = Buffer.from(cleanHex, 'hex');
    const hash = mockPoseidonHash(bytes);
    return `0x${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Generate a withdrawal proof
 * @param {Object} params - Proof parameters
 * @param {string} params.secret - The deposit secret (hex)
 * @param {string} params.nullifierPreimage - Preimage for nullifier (hex)
 * @param {Array<string>} params.merklePath - Array of sibling hashes
 * @param {Array<boolean>} params.pathIndices - Array of booleans (left/right)
 * @param {string} params.recipient - Ethereum address (hex)
 * @param {string} params.amount - Amount in wei (string)
 * @returns {Promise<Uint8Array>} The proof as bytes
 */
async function generateProof({
    secret,
    nullifierPreimage,
    merklePath,
    pathIndices,
    recipient,
    amount
}) {
    // In production, this calls the WASM prover
    // For now, create a mock proof structure that passes the MockVerifier

    const secretBytes = Buffer.from(secret.replace(/^0x/, ''), 'hex');
    const nullifierBytes = Buffer.from(nullifierPreimage.replace(/^0x/, ''), 'hex');
    const recipientBytes = Buffer.from(recipient.replace(/^0x/, ''), 'hex');

    const commitment = mockPoseidonHash(secretBytes);
    const nullifier = mockPoseidonHash(nullifierBytes);

    // Build mock proof structure (128 bytes minimum for MockVerifier)
    const proof = new Uint8Array(128);

    // Trace commitment (32 bytes)
    const commitmentBytes = Buffer.alloc(4);
    commitmentBytes.writeUInt32LE(Number(commitment % (2n ** 32n)));
    proof.set(commitmentBytes, 0);

    // Quotient commitment (32 bytes)
    const nullifierBytesBuf = Buffer.alloc(4);
    nullifierBytesBuf.writeUInt32LE(Number(nullifier % (2n ** 32n)));
    proof.set(nullifierBytesBuf, 32);

    // FRI commitment (32 bytes)
    proof.set(commitmentBytes, 64);

    // FRI layers (32 bytes) - include recipient and amount
    if (recipientBytes.length >= 8) {
        proof.set(recipientBytes.slice(-8), 96);
    }
    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(amount));
    proof.set(amountBuf, 104);

    return proof;
}

/**
 * Get public inputs for a withdrawal
 * @param {Object} params - Same as generateProof
 * @returns {Promise<Object>} Public inputs object
 */
async function getPublicInputs({
    secret,
    nullifierPreimage,
    merklePath,
    pathIndices,
    recipient,
    amount
}) {
    const secretBytes = Buffer.from(secret.replace(/^0x/, ''), 'hex');
    const nullifierBytes = Buffer.from(nullifierPreimage.replace(/^0x/, ''), 'hex');

    const commitment = mockPoseidonHash(secretBytes);
    const nullifier = mockPoseidonHash(nullifierBytes);

    // Compute merkle root (simplified - production uses WASM)
    let current = commitment;
    for (let i = 0; i < merklePath.length; i++) {
        const sibling = BigInt(merklePath[i]);
        if (pathIndices[i]) {
            // Current is on left
            current = (current * 31n + sibling) % BABY_BEAR_MODULUS;
        } else {
            // Current is on right
            current = (sibling * 31n + current) % BABY_BEAR_MODULUS;
        }
    }

    return {
        merkleRoot: `0x${current.toString(16).padStart(8, '0')}`,
        nullifier: `0x${nullifier.toString(16).padStart(8, '0')}`,
        recipient,
        amount
    };
}

/**
 * Verify a merkle proof locally (for debugging)
 * @param {string} commitmentHex - The commitment
 * @param {Array<string>} merklePath - Sibling hashes
 * @param {Array<boolean>} pathIndices - Left/right indicators
 * @param {string} expectedRootHex - Expected root
 * @returns {Promise<boolean>} True if valid
 */
async function verifyMerklePath(commitmentHex, merklePath, pathIndices, expectedRootHex) {
    const commitment = BigInt(commitmentHex);
    const expectedRoot = BigInt(expectedRootHex);

    let current = commitment;
    for (let i = 0; i < merklePath.length; i++) {
        const sibling = BigInt(merklePath[i]);
        if (pathIndices[i]) {
            current = (current * 31n + sibling) % BABY_BEAR_MODULUS;
        } else {
            current = (sibling * 31n + current) % BABY_BEAR_MODULUS;
        }
    }

    return current === expectedRoot;
}

/**
 * Check if real WASM prover is available
 * @returns {boolean} True if WASM is loaded
 */
function isWasmAvailable() {
    return false; // Mock implementation
}

/**
 * Get prover info
 * @returns {Object} Prover information
 */
function getProverInfo() {
    return {
        type: 'mock',
        version: '1.0.0',
        field: 'BabyBear',
        hashFunction: 'mock-poseidon',
        note: 'Using mock prover. For production, build WASM with: wasm-pack build --target web'
    };
}

module.exports = {
    generateCommitment,
    generateNullifier,
    generateProof,
    getPublicInputs,
    verifyMerklePath,
    isWasmAvailable,
    getProverInfo
};
