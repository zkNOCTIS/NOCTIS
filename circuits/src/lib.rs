//! Noctis Privacy Vault - Plonky3 Circuits
//!
//! This library implements the ZK circuits for the Noctis privacy vault.
//!
//! Two circuit types:
//! 1. WithdrawalCircuit - Original Tornado-style fixed denomination
//! 2. BalanceWithdrawalCircuit - Flexible amounts with range proofs
//!
//! The balance-based circuit proves:
//! 1. Knowledge of spending_key for a note in the Merkle tree
//! 2. Note balance >= withdrawal amount (range proof)
//! 3. Correct change commitment derivation
//! 4. Valid nullifier to prevent double-spend
//!
//! V4 uses BN254 Poseidon for EVM compatibility (poseidon_bn254 module)

pub mod poseidon;
pub mod poseidon_bn254;
pub mod merkle;
pub mod withdrawal;
pub mod balance_withdrawal;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

#[cfg(target_arch = "wasm32")]
pub mod wasm_bn254;

pub use withdrawal::WithdrawalCircuit;
pub use balance_withdrawal::{BalanceWithdrawalCircuit, BalanceWithdrawalWitness, BalanceWithdrawalProof};
