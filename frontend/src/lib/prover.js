/**
 * NOCTIS ZK Prover - V5 with Groth16
 *
 * This module handles all cryptographic operations using BN254 Poseidon
 * and generates Groth16 proofs using snarkjs for the withdrawal circuit.
 */

import { groth16 } from 'snarkjs';

// BN254 field modulus
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Paths to circuit files
const WASM_PATH = '/circuits/withdrawal.wasm';
const ZKEY_PATH = '/circuits/withdrawal_final.zkey';

// Simple Poseidon implementation for BN254 (uses external library or API)
let poseidonHash = null;

/**
 * Initialize the prover - load Poseidon hash function
 */
export async function initProver() {
  if (poseidonHash) return;

  try {
    // Import circomlibjs for Poseidon
    const { buildPoseidon } = await import('circomlibjs');
    const poseidon = await buildPoseidon();

    poseidonHash = (inputs) => {
      const hash = poseidon(inputs.map(x => BigInt(x)));
      return poseidon.F.toString(hash);
    };

    console.log('NOCTIS V5 prover initialized (Groth16 + BN254 Poseidon)');
  } catch (err) {
    console.error('Failed to initialize prover:', err);
    throw err;
  }
}

/**
 * Check if prover is ready
 */
export function isProverReady() {
  return poseidonHash !== null;
}

/**
 * Generate a random BN254 field element
 */
export function randomFieldElement() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let value = 0n;
  for (let i = 0; i < 32; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value % FIELD_MODULUS;
}

/**
 * Generate a 32-byte random secret (for spending key)
 */
export function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert BigInt to hex string (padded to 64 chars)
 */
export function bigIntToHex(n) {
  return '0x' + n.toString(16).padStart(64, '0');
}

/**
 * Convert hex string to BigInt
 */
export function hexToBigInt(hex) {
  return BigInt(hex);
}

/**
 * Hash two values using BN254 Poseidon
 */
export async function hashPair(a, b) {
  await initProver();
  return poseidonHash([BigInt(a), BigInt(b)]);
}

/**
 * Compute spendingKeyHash = Poseidon(spendingKey, 0)
 */
export async function hashSpendingKey(spendingKey) {
  await initProver();
  return poseidonHash([BigInt(spendingKey), 0n]);
}

/**
 * Compute BN254 Poseidon commitment
 * commitment = Poseidon(spendingKeyHash, balance, randomness)
 */
export async function computeCommitment(spendingKey, balance, randomness) {
  await initProver();

  const spendingKeyHash = await hashSpendingKey(spendingKey);
  return poseidonHash([BigInt(spendingKeyHash), BigInt(balance), BigInt(randomness)]);
}

/**
 * Compute nullifier
 * nullifier = Poseidon(spendingKey, noteIndex)
 */
export async function computeNullifier(spendingKey, noteIndex) {
  await initProver();
  return poseidonHash([BigInt(spendingKey), BigInt(noteIndex)]);
}

/**
 * Compute Merkle root from leaf and path
 */
export async function computeMerkleRoot(leaf, pathElements, pathIndices) {
  await initProver();

  let current = BigInt(leaf);
  for (let i = 0; i < pathElements.length; i++) {
    const sibling = BigInt(pathElements[i]);
    if (pathIndices[i] === 0) {
      // Current is on the left
      current = BigInt(poseidonHash([current, sibling]));
    } else {
      // Current is on the right
      current = BigInt(poseidonHash([sibling, current]));
    }
  }
  return current.toString();
}

/**
 * Generate Groth16 withdrawal proof
 */
export async function generateProof(params) {
  const {
    spendingKey,
    noteIndex,
    balance,
    randomness,
    merklePath,
    pathIndices,
    recipient,
    amount,
    changeRandomness
  } = params;

  await initProver();

  // Compute derived values
  const spendingKeyBigInt = BigInt(spendingKey);
  const spendingKeyHash = await hashSpendingKey(spendingKey);
  const commitment = await computeCommitment(spendingKey, balance, randomness);
  const nullifier = await computeNullifier(spendingKey, noteIndex);
  const merkleRoot = await computeMerkleRoot(commitment, merklePath, pathIndices);

  // Compute change commitment if partial withdrawal
  let changeCommitment = '0';
  const changeAmount = BigInt(balance) - BigInt(amount);
  if (changeAmount > 0n && changeRandomness) {
    changeCommitment = await computeCommitment(spendingKey, changeAmount, changeRandomness);
  }

  // Prepare circuit inputs
  const circuitInputs = {
    // Public inputs
    merkleRoot: merkleRoot,
    nullifier: nullifier,
    recipient: BigInt(recipient).toString(),
    amount: BigInt(amount).toString(),

    // Private inputs
    spendingKey: spendingKeyBigInt.toString(),
    balance: BigInt(balance).toString(),
    randomness: BigInt(randomness).toString(),
    noteIndex: BigInt(noteIndex).toString(),
    pathElements: merklePath.map(p => BigInt(p).toString()),
    pathIndices: pathIndices.map(i => i.toString())
  };

  console.log('Generating Groth16 proof...');
  console.log('Circuit inputs:', {
    merkleRoot,
    nullifier,
    recipient,
    amount,
    noteIndex
  });

  // Generate Groth16 proof using snarkjs
  const { proof, publicSignals } = await groth16.fullProve(
    circuitInputs,
    WASM_PATH,
    ZKEY_PATH
  );

  console.log('Proof generated successfully');
  console.log('Public signals:', publicSignals);

  // Encode proof for Solidity verifier
  // The verifier expects: (uint[2] pA, uint[2][2] pB, uint[2] pC)
  const proofCalldata = [
    [proof.pi_a[0], proof.pi_a[1]],
    [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    [proof.pi_c[0], proof.pi_c[1]]
  ];

  // ABI encode the proof for the verifier contract
  const abiCoder = new (await import('ethers')).AbiCoder();
  const encodedProof = abiCoder.encode(
    ['uint256[2]', 'uint256[2][2]', 'uint256[2]'],
    proofCalldata
  );

  return {
    proof: encodedProof,
    proofComponents: proofCalldata,
    publicInputs: {
      merkleRoot,
      nullifier,
      recipient,
      amount: amount.toString(),
      changeCommitment
    },
    publicSignals
  };
}

/**
 * Verify a proof locally (for debugging)
 */
export async function verifyProofLocally(proof, publicSignals) {
  const vkResponse = await fetch('/circuits/verification_key.json');
  const vk = await vkResponse.json();

  return await groth16.verify(vk, publicSignals, proof);
}

/**
 * Get precomputed zeros for Merkle tree
 */
export async function getZeros(depth = 20) {
  await initProver();

  const zeros = [0n];
  for (let i = 1; i <= depth; i++) {
    zeros[i] = BigInt(poseidonHash([zeros[i-1], zeros[i-1]]));
  }
  return zeros.map(z => z.toString());
}

/**
 * Pack address into field element
 */
export function packAddress(address) {
  return BigInt(address);
}

/**
 * Pack amount into field element
 */
export function packAmount(amount) {
  return BigInt(amount);
}

/**
 * Get field modulus
 */
export function getFieldModulus() {
  return FIELD_MODULUS;
}
