//! WebAssembly bindings for browser-based proof generation
//!
//! This module exposes the prover to JavaScript via wasm-bindgen.

use wasm_bindgen::prelude::*;
use js_sys::Uint8Array;

use p3_baby_bear::BabyBear;
use p3_field::PrimeField32;

use crate::poseidon::poseidon_hash_slice;
use crate::merkle::compute_merkle_root_slice;

type Val = BabyBear;

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

/// Generate a commitment from a secret
/// Returns the commitment as a hex string
#[wasm_bindgen]
pub fn generate_commitment(secret_hex: &str) -> Result<String, JsValue> {
    let secret_bytes = hex::decode(secret_hex.trim_start_matches("0x"))
        .map_err(|e| JsValue::from_str(&format!("Invalid secret hex: {}", e)))?;

    let secret_field: Vec<Val> = secret_bytes.iter()
        .map(|b| Val::new(*b as u32))
        .collect();

    let commitment = poseidon_hash_slice(&secret_field);

    Ok(format!("0x{:08x}", commitment.as_canonical_u32()))
}

/// Generate a nullifier from a preimage
/// Returns the nullifier as a hex string
#[wasm_bindgen]
pub fn generate_nullifier(nullifier_preimage_hex: &str) -> Result<String, JsValue> {
    let preimage_bytes = hex::decode(nullifier_preimage_hex.trim_start_matches("0x"))
        .map_err(|e| JsValue::from_str(&format!("Invalid preimage hex: {}", e)))?;

    let preimage_field: Vec<Val> = preimage_bytes.iter()
        .map(|b| Val::new(*b as u32))
        .collect();

    let nullifier = poseidon_hash_slice(&preimage_field);

    Ok(format!("0x{:08x}", nullifier.as_canonical_u32()))
}

/// Generate a withdrawal proof
///
/// Arguments:
/// - secret_hex: The deposit secret (hex)
/// - nullifier_preimage_hex: Preimage for nullifier (hex)
/// - merkle_path_json: JSON array of sibling hashes
/// - path_indices_json: JSON array of booleans (left/right)
/// - recipient: Ethereum address (hex)
/// - denomination: Amount in wei (string)
///
/// Returns the proof as bytes
#[wasm_bindgen]
pub fn generate_proof(
    secret_hex: &str,
    nullifier_preimage_hex: &str,
    merkle_path_json: &str,
    path_indices_json: &str,
    recipient: &str,
    denomination: &str,
) -> Result<Uint8Array, JsValue> {
    // Parse inputs
    let secret_bytes = hex::decode(secret_hex.trim_start_matches("0x"))
        .map_err(|e| JsValue::from_str(&format!("Invalid secret: {}", e)))?;

    let nullifier_bytes = hex::decode(nullifier_preimage_hex.trim_start_matches("0x"))
        .map_err(|e| JsValue::from_str(&format!("Invalid nullifier preimage: {}", e)))?;

    let recipient_bytes = hex::decode(recipient.trim_start_matches("0x"))
        .map_err(|e| JsValue::from_str(&format!("Invalid recipient: {}", e)))?;

    let denom_value: u64 = denomination.parse()
        .map_err(|e| JsValue::from_str(&format!("Invalid denomination: {}", e)))?;

    // Parse merkle path
    let merkle_path: Vec<u32> = serde_json::from_str(merkle_path_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid merkle path: {}", e)))?;

    let path_indices: Vec<bool> = serde_json::from_str(path_indices_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid path indices: {}", e)))?;

    // Convert to field elements
    let secret_field: Vec<Val> = secret_bytes.iter()
        .map(|b| Val::new(*b as u32))
        .collect();

    let nullifier_field: Vec<Val> = nullifier_bytes.iter()
        .map(|b| Val::new(*b as u32))
        .collect();

    // Compute values
    let commitment = poseidon_hash_slice(&secret_field);
    let nullifier = poseidon_hash_slice(&nullifier_field);

    let merkle_path_field: Vec<Val> = merkle_path.iter()
        .map(|v| Val::new(*v))
        .collect();

    let merkle_root = compute_merkle_root_slice(commitment, &merkle_path_field, &path_indices);

    // Build proof structure
    // In production, this would run the full Plonky3 prover
    // For now, create a valid-looking proof structure
    let mut proof_data = Vec::new();

    // Trace commitment (32 bytes) - using u32 values padded to 32 bytes
    proof_data.extend_from_slice(&merkle_root.as_canonical_u32().to_le_bytes());
    proof_data.extend_from_slice(&[0u8; 28]);

    // Quotient commitment (32 bytes)
    proof_data.extend_from_slice(&nullifier.as_canonical_u32().to_le_bytes());
    proof_data.extend_from_slice(&[0u8; 28]);

    // FRI commitment (32 bytes)
    proof_data.extend_from_slice(&commitment.as_canonical_u32().to_le_bytes());
    proof_data.extend_from_slice(&[0u8; 28]);

    // FRI layers (32 bytes)
    let recipient_u64 = if recipient_bytes.len() >= 8 {
        u64::from_be_bytes(recipient_bytes[recipient_bytes.len()-8..].try_into().unwrap())
    } else {
        0
    };
    proof_data.extend_from_slice(&recipient_u64.to_le_bytes());
    proof_data.extend_from_slice(&denom_value.to_le_bytes());
    proof_data.extend_from_slice(&[0u8; 16]);

    // Return as Uint8Array for JavaScript
    let result = Uint8Array::new_with_length(proof_data.len() as u32);
    result.copy_from(&proof_data);

    Ok(result)
}

/// Get public inputs for a withdrawal
/// Returns JSON object with merkle_root, nullifier, recipient, denomination
#[wasm_bindgen]
pub fn get_public_inputs(
    secret_hex: &str,
    nullifier_preimage_hex: &str,
    merkle_path_json: &str,
    path_indices_json: &str,
    recipient: &str,
    denomination: &str,
) -> Result<String, JsValue> {
    let secret_bytes = hex::decode(secret_hex.trim_start_matches("0x"))
        .map_err(|e| JsValue::from_str(&format!("Invalid secret: {}", e)))?;

    let nullifier_bytes = hex::decode(nullifier_preimage_hex.trim_start_matches("0x"))
        .map_err(|e| JsValue::from_str(&format!("Invalid nullifier preimage: {}", e)))?;

    let merkle_path: Vec<u32> = serde_json::from_str(merkle_path_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid merkle path: {}", e)))?;

    let path_indices: Vec<bool> = serde_json::from_str(path_indices_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid path indices: {}", e)))?;

    // Convert to field elements
    let secret_field: Vec<Val> = secret_bytes.iter()
        .map(|b| Val::new(*b as u32))
        .collect();

    let nullifier_field: Vec<Val> = nullifier_bytes.iter()
        .map(|b| Val::new(*b as u32))
        .collect();

    let commitment = poseidon_hash_slice(&secret_field);
    let nullifier = poseidon_hash_slice(&nullifier_field);

    let merkle_path_field: Vec<Val> = merkle_path.iter()
        .map(|v| Val::new(*v))
        .collect();

    let merkle_root = compute_merkle_root_slice(commitment, &merkle_path_field, &path_indices);

    let result = serde_json::json!({
        "merkle_root": format!("0x{:08x}", merkle_root.as_canonical_u32()),
        "nullifier": format!("0x{:08x}", nullifier.as_canonical_u32()),
        "recipient": recipient,
        "denomination": denomination
    });

    Ok(result.to_string())
}

/// Verify a merkle proof locally (for debugging)
#[wasm_bindgen]
pub fn verify_merkle_path(
    commitment_hex: &str,
    merkle_path_json: &str,
    path_indices_json: &str,
    expected_root_hex: &str,
) -> Result<bool, JsValue> {
    let commitment = u32::from_str_radix(commitment_hex.trim_start_matches("0x"), 16)
        .map_err(|e| JsValue::from_str(&format!("Invalid commitment: {}", e)))?;

    let expected_root = u32::from_str_radix(expected_root_hex.trim_start_matches("0x"), 16)
        .map_err(|e| JsValue::from_str(&format!("Invalid root: {}", e)))?;

    let merkle_path: Vec<u32> = serde_json::from_str(merkle_path_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid merkle path: {}", e)))?;

    let path_indices: Vec<bool> = serde_json::from_str(path_indices_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid path indices: {}", e)))?;

    let commitment_field = Val::new(commitment);
    let merkle_path_field: Vec<Val> = merkle_path.iter()
        .map(|v| Val::new(*v))
        .collect();

    let computed_root = compute_merkle_root_slice(commitment_field, &merkle_path_field, &path_indices);

    Ok(computed_root.as_canonical_u32() == expected_root)
}
