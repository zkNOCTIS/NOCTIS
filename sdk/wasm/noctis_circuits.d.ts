/* tslint:disable */
/* eslint-disable */

/**
 * Generate a commitment from a secret
 * Returns the commitment as a hex string
 */
export function generate_commitment(secret_hex: string): string;

/**
 * Generate a nullifier from a preimage
 * Returns the nullifier as a hex string
 */
export function generate_nullifier(nullifier_preimage_hex: string): string;

/**
 * Generate a withdrawal proof
 *
 * Arguments:
 * - secret_hex: The deposit secret (hex)
 * - nullifier_preimage_hex: Preimage for nullifier (hex)
 * - merkle_path_json: JSON array of sibling hashes
 * - path_indices_json: JSON array of booleans (left/right)
 * - recipient: Ethereum address (hex)
 * - denomination: Amount in wei (string)
 *
 * Returns the proof as bytes
 */
export function generate_proof(secret_hex: string, nullifier_preimage_hex: string, merkle_path_json: string, path_indices_json: string, recipient: string, denomination: string): Uint8Array;

/**
 * Get public inputs for a withdrawal
 * Returns JSON object with merkle_root, nullifier, recipient, denomination
 */
export function get_public_inputs(secret_hex: string, nullifier_preimage_hex: string, merkle_path_json: string, path_indices_json: string, recipient: string, denomination: string): string;

/**
 * Initialize panic hook for better error messages in browser console
 */
export function init(): void;

/**
 * Verify a merkle proof locally (for debugging)
 */
export function verify_merkle_path(commitment_hex: string, merkle_path_json: string, path_indices_json: string, expected_root_hex: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly generate_commitment: (a: number, b: number) => [number, number, number, number];
  readonly generate_nullifier: (a: number, b: number) => [number, number, number, number];
  readonly generate_proof: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number];
  readonly get_public_inputs: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number, number];
  readonly verify_merkle_path: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
  readonly init: () => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
