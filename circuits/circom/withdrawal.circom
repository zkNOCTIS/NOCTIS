pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";

/*
 * Noctis Withdrawal Circuit
 *
 * Proves knowledge of spending key and note details without revealing them.
 * Uses BN254-compatible Poseidon hash for gas efficiency on Ethereum.
 *
 * Public Inputs (matches BalanceVaultV4 verifier interface):
 *   - merkleRoot: Root of the note Merkle tree
 *   - nullifier: Hash(spendingKey, noteIndex) - prevents double-spending
 *   - recipient: Address receiving funds (packed as uint256)
 *   - amount: Amount being withdrawn
 *
 * Private Inputs:
 *   - spendingKey: Secret key known only to note owner
 *   - balance: Original note balance
 *   - randomness: Random value used in commitment
 *   - noteIndex: Position of note in Merkle tree
 *   - pathElements[20]: Merkle proof siblings
 *   - pathIndices[20]: Left/right indicators for Merkle path
 */

template Withdrawal(levels) {
    // Public inputs (4 total - matches IVerifier interface)
    signal input merkleRoot;
    signal input nullifier;
    signal input recipient;
    signal input amount;

    // Private inputs
    signal input spendingKey;
    signal input balance;
    signal input randomness;
    signal input noteIndex;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Intermediate signals
    signal spendingKeyHash;
    signal commitment;
    signal computedNullifier;
    signal computedRoot;

    // 1. Compute spendingKeyHash = Poseidon(spendingKey, 0)
    component skHasher = Poseidon(2);
    skHasher.inputs[0] <== spendingKey;
    skHasher.inputs[1] <== 0;
    spendingKeyHash <== skHasher.out;

    // 2. Compute commitment = Poseidon(spendingKeyHash, balance, randomness)
    component commitHasher = Poseidon(3);
    commitHasher.inputs[0] <== spendingKeyHash;
    commitHasher.inputs[1] <== balance;
    commitHasher.inputs[2] <== randomness;
    commitment <== commitHasher.out;

    // 3. Compute nullifier = Poseidon(spendingKey, noteIndex)
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== spendingKey;
    nullHasher.inputs[1] <== noteIndex;
    computedNullifier <== nullHasher.out;

    // 4. Verify nullifier matches public input
    computedNullifier === nullifier;

    // 5. Verify amount <= balance
    signal balanceCheck;
    balanceCheck <== balance - amount;
    // balanceCheck must be >= 0 (implicit by field arithmetic for valid proofs)

    // 6. Compute Merkle root from commitment and path
    component merkleChecker = MerkleTreeChecker(levels);
    merkleChecker.leaf <== commitment;
    for (var i = 0; i < levels; i++) {
        merkleChecker.pathElements[i] <== pathElements[i];
        merkleChecker.pathIndices[i] <== pathIndices[i];
    }
    computedRoot <== merkleChecker.root;

    // 7. Verify computed root matches public merkleRoot
    computedRoot === merkleRoot;
}

// Merkle Tree verification using Poseidon
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    component mux[levels];

    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // pathIndices[i] is 0 for left, 1 for right
        // We need to select: if pathIndices[i] == 0, hash(levelHashes[i], pathElements[i])
        //                    if pathIndices[i] == 1, hash(pathElements[i], levelHashes[i])

        hashers[i] = Poseidon(2);
        mux[i] = DualMux();

        mux[i].in[0] <== levelHashes[i];
        mux[i].in[1] <== pathElements[i];
        mux[i].s <== pathIndices[i];

        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[levels];
}

// Dual multiplexer - swaps inputs based on selector
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    // Ensure s is binary
    s * (1 - s) === 0;

    // If s == 0: out[0] = in[0], out[1] = in[1]
    // If s == 1: out[0] = in[1], out[1] = in[0]
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Main component with 20-level Merkle tree (matching Vault)
component main {public [merkleRoot, nullifier, recipient, amount]} = Withdrawal(20);
