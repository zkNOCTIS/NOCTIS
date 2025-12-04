// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/core/BalanceVaultV4.sol";

/**
 * @title DeployMainnet
 * @notice Deploy BalanceVaultV4 to Base Mainnet for NOCTIS token
 *
 * Run: forge script script/DeployMainnet.s.sol --rpc-url https://mainnet.base.org --broadcast --verify
 */
contract DeployMainnet is Script {
    // NOCTIS token on Base mainnet (deployed via Clanker)
    address constant TOKEN = 0xdb9446b980e6765B0f90f355eB761936BB466b07;

    // Verifier already deployed on Base mainnet
    address constant VERIFIER = 0x48f8aBbf907A378d39ADc3B54773dB57abba9e17;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Vault with NOCTIS token and existing verifier
        BalanceVaultV4 vault = new BalanceVaultV4(
            TOKEN,
            VERIFIER
        );

        vm.stopBroadcast();

        console.log("================== NOCTIS MAINNET DEPLOYMENT ==================");
        console.log("BalanceVaultV4 deployed at:", address(vault));
        console.log("Token (NOCTIS):", TOKEN);
        console.log("Verifier:", VERIFIER);
        console.log("Initial root:", vault.getCurrentRoot());
        console.log("================================================================");
    }
}
