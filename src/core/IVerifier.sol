// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVerifier
 * @notice Interface for ZK proof verification
 * @dev Can be implemented with Groth16, Plonky3, Risc0, SP1, etc.
 */
interface IVerifier {
    /**
     * @notice Verify a withdrawal proof
     * @param proof The ZK proof bytes
     * @param publicInputs Array of public inputs:
     *        [0] merkleRoot - The Merkle root of commitments
     *        [1] nullifierHash - Hash to prevent double-spending
     *        [2] recipient - Address receiving the withdrawal
     *        [3] denomination - Amount being withdrawn
     * @return bool True if proof is valid
     */
    function verifyProof(
        bytes calldata proof,
        uint256[4] calldata publicInputs
    ) external view returns (bool);
}
