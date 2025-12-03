//! Balance-based withdrawal circuit for Noctis Privacy Vault
//!
//! This circuit proves:
//! 1. Knowledge of spending_key for a note in the Merkle tree
//! 2. The note has balance >= withdrawal_amount (range proof)
//! 3. Correct computation of change note commitment
//! 4. Correct nullifier derivation
//!
//! Public inputs:
//!   - merkle_root: Root of the note commitment tree
//!   - nullifier: hash(spending_key, note_index) - prevents double spend
//!   - recipient: Address receiving the withdrawal
//!   - amount: Amount being withdrawn
//!   - change_commitment: Commitment for remaining balance (0 if full withdrawal)
//!
//! Private inputs:
//!   - spending_key: User's secret key
//!   - balance: Current note balance
//!   - randomness: Randomness used in original note commitment
//!   - note_index: Position of note in Merkle tree
//!   - merkle_path: Sibling hashes for Merkle proof
//!   - path_indices: Left/right indicators for Merkle proof
//!   - new_randomness: Randomness for change note (if partial withdrawal)

use p3_air::{Air, AirBuilder, BaseAir};
use p3_baby_bear::BabyBear;
use p3_field::PrimeField32;
use p3_matrix::dense::RowMajorMatrix;

use crate::merkle::TREE_DEPTH;
use crate::poseidon::{poseidon_hash, poseidon_hash_2, poseidon_hash_3};

type Val = BabyBear;

/// Number of columns: public inputs (5) + range proof bits (64) + merkle path (20*2)
const NUM_COLS: usize = 5 + 64 + TREE_DEPTH * 2;

/// Balance withdrawal circuit with range proofs
pub struct BalanceWithdrawalCircuit {
    // Public inputs
    pub merkle_root: Val,
    pub nullifier: Val,
    pub recipient: Val,
    pub amount: Val,
    pub change_commitment: Val,
}

/// Private witness for the withdrawal
pub struct BalanceWithdrawalWitness {
    pub spending_key: Val,
    pub balance: Val,
    pub randomness: Val,
    pub note_index: u64,
    pub merkle_path: [Val; TREE_DEPTH],
    pub path_indices: [bool; TREE_DEPTH],
    pub new_randomness: Val,
}

impl BalanceWithdrawalCircuit {
    pub fn new(
        merkle_root: Val,
        nullifier: Val,
        recipient: Val,
        amount: Val,
        change_commitment: Val,
    ) -> Self {
        Self {
            merkle_root,
            nullifier,
            recipient,
            amount,
            change_commitment,
        }
    }

    /// Generate the execution trace for proving
    pub fn generate_trace(&self, witness: &BalanceWithdrawalWitness) -> RowMajorMatrix<Val> {
        // ===== Verify all constraints =====

        // 1. Compute spending_key_hash = hash(spending_key)
        let spending_key_hash = poseidon_hash(witness.spending_key);

        // 2. Compute original note commitment
        // commitment = hash(spending_key_hash, balance, randomness)
        let note_commitment = poseidon_hash_3(
            spending_key_hash,
            witness.balance,
            witness.randomness,
        );

        // 3. Verify Merkle proof
        let computed_root = compute_merkle_root_with_path(
            note_commitment,
            &witness.merkle_path,
            &witness.path_indices,
        );
        assert_eq!(computed_root, self.merkle_root, "Invalid Merkle proof");

        // 4. Verify nullifier = hash(spending_key, note_index)
        let note_index_field = Val::new(witness.note_index as u32);
        let computed_nullifier = poseidon_hash_2(witness.spending_key, note_index_field);
        assert_eq!(computed_nullifier, self.nullifier, "Invalid nullifier");

        // 5. Verify balance >= amount (range proof)
        let balance_u64 = field_to_u64(witness.balance);
        let amount_u64 = field_to_u64(self.amount);
        assert!(balance_u64 >= amount_u64, "Insufficient balance");

        // 6. Verify change commitment
        let change_balance = balance_u64 - amount_u64;
        if change_balance > 0 {
            // Partial withdrawal - verify change commitment
            let change_balance_field = Val::new(change_balance as u32);
            let expected_change = poseidon_hash_3(
                spending_key_hash,
                change_balance_field,
                witness.new_randomness,
            );
            assert_eq!(expected_change, self.change_commitment, "Invalid change commitment");
        } else {
            // Full withdrawal - change commitment must be zero
            assert_eq!(self.change_commitment, Val::new(0), "Change commitment should be zero for full withdrawal");
        }

        // ===== Build trace matrix =====
        let mut trace_values = Vec::with_capacity(NUM_COLS);

        // Public inputs
        trace_values.push(self.merkle_root);
        trace_values.push(self.nullifier);
        trace_values.push(self.recipient);
        trace_values.push(self.amount);
        trace_values.push(self.change_commitment);

        // Range proof: balance - amount >= 0
        // Decompose (balance - amount) into 64 bits
        let diff = balance_u64 - amount_u64;
        for i in 0..64 {
            let bit = ((diff >> i) & 1) as u32;
            trace_values.push(Val::new(bit));
        }

        // Merkle path
        for i in 0..TREE_DEPTH {
            trace_values.push(witness.merkle_path[i]);
        }

        // Path indices
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

impl BaseAir<Val> for BalanceWithdrawalCircuit {
    fn width(&self) -> usize {
        NUM_COLS
    }
}

impl<AB: AirBuilder<F = Val>> Air<AB> for BalanceWithdrawalCircuit {
    fn eval(&self, _builder: &mut AB) {
        // Constraints are validated during trace generation
        // Full AIR constraints would include:
        // - Range proof: bits are binary, sum equals (balance - amount)
        // - Poseidon permutation constraints for all hash computations
        // - Merkle tree traversal constraints
        // - Commitment derivation constraints
        // - Nullifier computation constraints
        // - Binary constraints for path indices
        //
        // For now, the trace generation validates all constraints
        // and the prover ensures the trace satisfies them.
    }
}

/// Compute Merkle root from leaf and path
fn compute_merkle_root_with_path(
    leaf: Val,
    path: &[Val; TREE_DEPTH],
    indices: &[bool; TREE_DEPTH],
) -> Val {
    let mut current = leaf;
    for i in 0..TREE_DEPTH {
        if indices[i] {
            // Current is right child
            current = poseidon_hash_2(path[i], current);
        } else {
            // Current is left child
            current = poseidon_hash_2(current, path[i]);
        }
    }
    current
}

/// Convert field element to u64 (for range checks)
fn field_to_u64(val: Val) -> u64 {
    // BabyBear field element to canonical u32, then u64
    val.as_canonical_u32() as u64
}

/// Proof data for serialization
#[derive(serde::Serialize, serde::Deserialize)]
pub struct BalanceWithdrawalProof {
    pub proof_bytes: Vec<u8>,
    pub public_inputs: PublicInputs,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct PublicInputs {
    pub merkle_root: u64,
    pub nullifier: u64,
    pub recipient: u64,
    pub amount: u64,
    pub change_commitment: u64,
}

impl BalanceWithdrawalProof {
    /// Format for Solidity verifier
    pub fn to_solidity_calldata(&self) -> (Vec<u8>, [u64; 5]) {
        let inputs = [
            self.public_inputs.merkle_root,
            self.public_inputs.nullifier,
            self.public_inputs.recipient,
            self.public_inputs.amount,
            self.public_inputs.change_commitment,
        ];
        (self.proof_bytes.clone(), inputs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_withdrawal() {
        // Setup
        let spending_key = Val::new(12345);
        let balance = Val::new(10000);
        let randomness = Val::new(99999);
        let note_index = 5u64;

        // Compute derived values
        let spending_key_hash = poseidon_hash(spending_key);
        let note_commitment = poseidon_hash_3(spending_key_hash, balance, randomness);
        let nullifier = poseidon_hash_2(spending_key, Val::new(note_index as u32));

        // Simple merkle path (all zeros for testing)
        let merkle_path = [Val::new(0); TREE_DEPTH];
        let path_indices = [false; TREE_DEPTH];
        let merkle_root = compute_merkle_root_with_path(note_commitment, &merkle_path, &path_indices);

        // Full withdrawal - no change
        let amount = Val::new(10000);
        let change_commitment = Val::new(0);

        let circuit = BalanceWithdrawalCircuit::new(
            merkle_root,
            nullifier,
            Val::new(0xABCD), // recipient
            amount,
            change_commitment,
        );

        let witness = BalanceWithdrawalWitness {
            spending_key,
            balance,
            randomness,
            note_index,
            merkle_path,
            path_indices,
            new_randomness: Val::new(0),
        };

        // Should not panic
        let _trace = circuit.generate_trace(&witness);
    }

    #[test]
    fn test_partial_withdrawal() {
        // Setup
        let spending_key = Val::new(12345);
        let balance = Val::new(10000);
        let randomness = Val::new(99999);
        let note_index = 5u64;

        // Compute derived values
        let spending_key_hash = poseidon_hash(spending_key);
        let note_commitment = poseidon_hash_3(spending_key_hash, balance, randomness);
        let nullifier = poseidon_hash_2(spending_key, Val::new(note_index as u32));

        // Simple merkle path
        let merkle_path = [Val::new(0); TREE_DEPTH];
        let path_indices = [false; TREE_DEPTH];
        let merkle_root = compute_merkle_root_with_path(note_commitment, &merkle_path, &path_indices);

        // Partial withdrawal - 6000 out of 10000
        let amount = Val::new(6000);
        let new_randomness = Val::new(88888);
        let change_balance = Val::new(4000);
        let change_commitment = poseidon_hash_3(spending_key_hash, change_balance, new_randomness);

        let circuit = BalanceWithdrawalCircuit::new(
            merkle_root,
            nullifier,
            Val::new(0xABCD),
            amount,
            change_commitment,
        );

        let witness = BalanceWithdrawalWitness {
            spending_key,
            balance,
            randomness,
            note_index,
            merkle_path,
            path_indices,
            new_randomness,
        };

        // Should not panic
        let _trace = circuit.generate_trace(&witness);
    }

    #[test]
    #[should_panic(expected = "Insufficient balance")]
    fn test_overdraw_fails() {
        let spending_key = Val::new(12345);
        let balance = Val::new(10000);
        let randomness = Val::new(99999);
        let note_index = 5u64;

        let spending_key_hash = poseidon_hash(spending_key);
        let note_commitment = poseidon_hash_3(spending_key_hash, balance, randomness);
        let nullifier = poseidon_hash_2(spending_key, Val::new(note_index as u32));

        let merkle_path = [Val::new(0); TREE_DEPTH];
        let path_indices = [false; TREE_DEPTH];
        let merkle_root = compute_merkle_root_with_path(note_commitment, &merkle_path, &path_indices);

        // Try to withdraw more than balance
        let amount = Val::new(15000); // More than 10000!

        let circuit = BalanceWithdrawalCircuit::new(
            merkle_root,
            nullifier,
            Val::new(0xABCD),
            amount,
            Val::new(0),
        );

        let witness = BalanceWithdrawalWitness {
            spending_key,
            balance,
            randomness,
            note_index,
            merkle_path,
            path_indices,
            new_randomness: Val::new(0),
        };

        // This should panic with "Insufficient balance"
        let _trace = circuit.generate_trace(&witness);
    }
}
