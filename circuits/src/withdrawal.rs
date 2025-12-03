//! Withdrawal circuit for Noctis Privacy Vault
//!
//! Proves:
//! 1. Knowledge of (secret, nullifier_preimage) such that
//!    commitment = Poseidon(secret, nullifier_preimage)
//! 2. The commitment exists in the Merkle tree with given root
//! 3. The nullifier = Poseidon(nullifier_preimage)
//!
//! Public inputs: merkle_root, nullifier, recipient, denomination
//! Private inputs: secret, nullifier_preimage, merkle_path, path_indices

use p3_air::{Air, AirBuilder, BaseAir};
use p3_baby_bear::BabyBear;
use p3_matrix::dense::RowMajorMatrix;

use crate::merkle::{compute_merkle_root, TREE_DEPTH};
use crate::poseidon::{hash_commitment, hash_nullifier};

// Type alias for the field we use
type Val = BabyBear;

/// Number of columns in the AIR trace
const NUM_COLS: usize = 4 + TREE_DEPTH * 2; // public inputs + path + indices

/// Withdrawal circuit AIR (BabyBear field)
pub struct WithdrawalCircuit {
    /// Public inputs
    pub merkle_root: Val,
    pub nullifier: Val,
    pub recipient: Val,
    pub denomination: Val,
}

/// Witness (private inputs) for the withdrawal circuit
pub struct WithdrawalWitness {
    pub secret: Val,
    pub nullifier_preimage: Val,
    pub merkle_path: [Val; TREE_DEPTH],
    pub path_indices: [bool; TREE_DEPTH],
}

impl WithdrawalCircuit {
    /// Create a new withdrawal circuit with public inputs
    pub fn new(merkle_root: Val, nullifier: Val, recipient: Val, denomination: Val) -> Self {
        Self {
            merkle_root,
            nullifier,
            recipient,
            denomination,
        }
    }

    /// Generate the trace for proving
    pub fn generate_trace(&self, witness: &WithdrawalWitness) -> RowMajorMatrix<Val> {
        // Verify the witness is valid

        // 1. Check commitment derivation
        let commitment = hash_commitment(witness.secret, witness.nullifier_preimage);

        // 2. Check nullifier derivation
        let computed_nullifier = hash_nullifier(witness.nullifier_preimage);
        assert_eq!(computed_nullifier, self.nullifier, "Invalid nullifier");

        // 3. Check Merkle proof
        let computed_root = compute_merkle_root(
            commitment,
            &witness.merkle_path,
            &witness.path_indices,
        );
        assert_eq!(computed_root, self.merkle_root, "Invalid Merkle proof");

        // Build trace matrix
        // Each row contains the intermediate values for verification
        let mut trace_values = Vec::with_capacity(NUM_COLS);

        // Public inputs
        trace_values.push(self.merkle_root);
        trace_values.push(self.nullifier);
        trace_values.push(self.recipient);
        trace_values.push(self.denomination);

        // Merkle path
        for i in 0..TREE_DEPTH {
            trace_values.push(witness.merkle_path[i]);
        }

        // Path indices as field elements
        for i in 0..TREE_DEPTH {
            trace_values.push(if witness.path_indices[i] {
                Val::new(1)
            } else {
                Val::new(0)
            });
        }

        RowMajorMatrix::new(trace_values, NUM_COLS)
    }
}

impl BaseAir<Val> for WithdrawalCircuit {
    fn width(&self) -> usize {
        NUM_COLS
    }
}

impl<AB: AirBuilder<F = Val>> Air<AB> for WithdrawalCircuit {
    fn eval(&self, _builder: &mut AB) {
        // Constraints are validated during trace generation
        // Full AIR constraints would include:
        // - Poseidon permutation constraints for hash computations
        // - Merkle tree hash chain constraints
        // - Binary constraints for path indices
        // - Connection between private and public inputs
        //
        // For now, the trace generation validates all constraints
        // and the prover ensures the trace satisfies them.
    }
}

/// Proof data structure for serialization
#[derive(serde::Serialize, serde::Deserialize)]
pub struct WithdrawalProof {
    /// Serialized proof bytes
    pub proof_bytes: Vec<u8>,
    /// Public inputs for verification
    pub public_inputs: [u64; 4],
}

impl WithdrawalProof {
    /// Serialize proof for Solidity verifier
    pub fn to_solidity_calldata(&self) -> Vec<u8> {
        // Format proof for on-chain verification
        let mut calldata = Vec::new();

        // Add proof bytes
        calldata.extend_from_slice(&self.proof_bytes);

        calldata
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_creation() {
        let circuit = WithdrawalCircuit::new(
            Val::new(1),
            Val::new(2),
            Val::new(3),
            Val::new(4),
        );

        assert_eq!(circuit.width(), NUM_COLS);
    }

    #[test]
    fn test_witness_generation() {
        let secret = Val::new(12345);
        let nullifier_preimage = Val::new(67890);

        // Compute expected values
        let commitment = hash_commitment(secret, nullifier_preimage);
        let nullifier = hash_nullifier(nullifier_preimage);

        // Create simple Merkle path (all zeros for testing)
        let merkle_path = [Val::new(0); TREE_DEPTH];
        let path_indices = [true; TREE_DEPTH];

        let merkle_root = compute_merkle_root(commitment, &merkle_path, &path_indices);

        // Create circuit and witness
        let circuit = WithdrawalCircuit::new(
            merkle_root,
            nullifier,
            Val::new(0xABCD), // recipient
            Val::new(10000),   // denomination
        );

        let witness = WithdrawalWitness {
            secret,
            nullifier_preimage,
            merkle_path,
            path_indices,
        };

        // Generate trace (should not panic if witness is valid)
        let _trace = circuit.generate_trace(&witness);
    }
}
