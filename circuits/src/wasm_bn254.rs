//! WebAssembly bindings for BN254 Poseidon (V4 vault compatibility)
//!
//! This module exposes BN254-based cryptographic operations to JavaScript
//! for use with BalanceVaultV4 which uses poseidon-solidity.

use wasm_bindgen::prelude::*;

use crate::poseidon_bn254::{Bn254Field, hash_pair, hash_3, compute_merkle_root};

/// BN254 field modulus as hex string
pub const BN254_MODULUS_HEX: &str = "0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001";

/// Initialize panic hook for better error messages
#[wasm_bindgen]
pub fn init_bn254() {
    console_error_panic_hook::set_once();
}

/// Generate a commitment using BN254 Poseidon
/// commitment = PoseidonT4(spendingKeyHash, balance, randomness)
#[wasm_bindgen]
pub fn bn254_compute_commitment(
    spending_key_hash_hex: &str,
    balance_hex: &str,
    randomness_hex: &str,
) -> Result<String, JsValue> {
    let skh = Bn254Field::from_hex(spending_key_hash_hex);
    let bal = Bn254Field::from_hex(balance_hex);
    let rand = Bn254Field::from_hex(randomness_hex);

    let commitment = hash_3(skh, bal, rand);
    Ok(commitment.to_hex())
}

/// Hash a single value (for spending key hash)
/// spendingKeyHash = PoseidonT3(spendingKey, 0)
#[wasm_bindgen]
pub fn bn254_hash(input_hex: &str) -> Result<String, JsValue> {
    let input = Bn254Field::from_hex(input_hex);
    let result = hash_pair(input, Bn254Field::ZERO);
    Ok(result.to_hex())
}

/// Hash two values using BN254 Poseidon (for Merkle tree)
#[wasm_bindgen]
pub fn bn254_hash_pair(left_hex: &str, right_hex: &str) -> Result<String, JsValue> {
    let left = Bn254Field::from_hex(left_hex);
    let right = Bn254Field::from_hex(right_hex);
    let result = hash_pair(left, right);
    Ok(result.to_hex())
}

/// Compute nullifier using BN254 Poseidon
/// nullifier = PoseidonT3(spendingKey, noteIndex)
#[wasm_bindgen]
pub fn bn254_compute_nullifier(
    spending_key_hex: &str,
    note_index: u64,
) -> Result<String, JsValue> {
    let sk = Bn254Field::from_hex(spending_key_hex);
    let idx = Bn254Field::new(note_index);
    let nullifier = hash_pair(sk, idx);
    Ok(nullifier.to_hex())
}

/// Compute Merkle root from leaf and path
/// Returns the computed root as hex string
#[wasm_bindgen]
pub fn bn254_compute_merkle_root(
    leaf_hex: &str,
    path_json: &str,
    indices_json: &str,
) -> Result<String, JsValue> {
    let leaf = Bn254Field::from_hex(leaf_hex);

    let path_strs: Vec<String> = serde_json::from_str(path_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid path JSON: {}", e)))?;

    let indices: Vec<bool> = serde_json::from_str(indices_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid indices JSON: {}", e)))?;

    let path: Vec<Bn254Field> = path_strs
        .iter()
        .map(|s| Bn254Field::from_hex(s))
        .collect();

    let root = compute_merkle_root(leaf, &path, &indices);
    Ok(root.to_hex())
}

/// Verify a Merkle proof
#[wasm_bindgen]
pub fn bn254_verify_merkle_proof(
    leaf_hex: &str,
    path_json: &str,
    indices_json: &str,
    expected_root_hex: &str,
) -> Result<bool, JsValue> {
    let computed = bn254_compute_merkle_root(leaf_hex, path_json, indices_json)?;
    let expected = expected_root_hex.to_lowercase();
    let computed_lower = computed.to_lowercase();

    Ok(computed_lower == expected)
}

/// Generate a random BN254 field element (for secrets/randomness)
#[wasm_bindgen]
pub fn bn254_random_field_element() -> String {
    use js_sys::Math;

    // Generate 4 random u64 limbs
    let mut limbs = [0u64; 4];
    for limb in &mut limbs {
        // Use Math.random() * 2^32 twice to get 64 bits
        let low = (Math::random() * (u32::MAX as f64)) as u64;
        let high = (Math::random() * (u32::MAX as f64)) as u64;
        *limb = (high << 32) | low;
    }

    // Reduce modulo BN254 modulus
    let field = Bn254Field::from_limbs(limbs);
    field.to_hex()
}

/// Generate a 32-byte random secret as hex
#[wasm_bindgen]
pub fn bn254_random_secret() -> String {
    bn254_random_field_element()
}

/// Get the BN254 field modulus as hex string
#[wasm_bindgen]
pub fn bn254_get_modulus() -> String {
    BN254_MODULUS_HEX.to_string()
}

/// Convert a decimal string to hex (for amounts)
#[wasm_bindgen]
pub fn bn254_decimal_to_hex(decimal: &str) -> Result<String, JsValue> {
    let value: u128 = decimal.parse()
        .map_err(|e| JsValue::from_str(&format!("Invalid decimal: {}", e)))?;

    Ok(format!("0x{:x}", value))
}

/// Convert hex to decimal string
#[wasm_bindgen]
pub fn bn254_hex_to_decimal(hex: &str) -> Result<String, JsValue> {
    let field = Bn254Field::from_hex(hex);
    Ok(field.to_decimal_string())
}

/// Get precomputed zeros for BN254 Poseidon Merkle tree
/// Returns JSON array of zero values for each level
#[wasm_bindgen]
pub fn bn254_get_zeros(depth: usize) -> String {
    let mut zeros = Vec::new();
    let mut current = Bn254Field::ZERO;

    for _ in 0..=depth {
        zeros.push(current.to_hex());
        current = hash_pair(current, current);
    }

    serde_json::to_string(&zeros).unwrap_or_else(|_| "[]".to_string())
}
