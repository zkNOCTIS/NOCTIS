// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/core/BalanceVaultV4.sol";

/**
 * @title DeployVaultV4
 * @notice Deploy BalanceVaultV4 with BN254 Poseidon (gas-efficient)
 * @dev V4 uses poseidon-solidity library (~13k gas per hash vs 200k+ for external calls)
 *
 * Run: forge script script/DeployV4.s.sol --rpc-url base_sepolia --broadcast --verify
 */
contract DeployVaultV4 is Script {
    // Base Sepolia addresses
    address constant TOKEN = 0xf863f3A311743fb4B51d289EeDf5F8a61190eA48;

    // Using MockVerifier for testing - replace with real verifier for production
    address constant VERIFIER = 0x2211bd47ED3FC47b61Cff98F56169676129A0f51;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        BalanceVaultV4 vault = new BalanceVaultV4(
            TOKEN,
            VERIFIER
        );

        vm.stopBroadcast();

        console.log("================== V4 DEPLOYMENT ==================");
        console.log("BalanceVaultV4 deployed at:", address(vault));
        console.log("Token:", TOKEN);
        console.log("Verifier:", VERIFIER);
        console.log("Initial root:", vault.getCurrentRoot());
        console.log("Field modulus: 21888242871839275222246405745257275088548364400416034343698204186575808495617");
        console.log("Tree depth:", vault.TREE_DEPTH());
        console.log("===================================================");

        // Log zeros for verification
        console.log("\nPrecomputed zeros (BN254 Poseidon):");
        for (uint i = 0; i <= 5; i++) {
            console.log("  ZEROS[%d] = %s", i, vault.getZero(i));
        }
    }
}
