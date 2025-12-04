// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/core/EthVaultV1.sol";

/**
 * @title DeployEthVault
 * @notice Deploy EthVaultV1 to Base Mainnet
 *
 * Run: forge script script/DeployEthVault.s.sol --rpc-url https://mainnet.base.org --broadcast --verify
 */
contract DeployEthVault is Script {
    // Verifier already deployed on Base mainnet
    address constant VERIFIER = 0x48f8aBbf907A378d39ADc3B54773dB57abba9e17;

    // Fee recipient address
    address constant FEE_RECIPIENT = 0x413e62A6FDFe4DaAf71b10d1B23D0a57BFb21330;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy EthVault with 0.5% fee on deposits
        EthVaultV1 vault = new EthVaultV1(
            VERIFIER,
            FEE_RECIPIENT
        );

        vm.stopBroadcast();

        console.log("================== ETH VAULT DEPLOYMENT ==================");
        console.log("EthVaultV1 deployed at:", address(vault));
        console.log("Verifier:", VERIFIER);
        console.log("Fee: 0.5% (50 bps) of ETH deposit");
        console.log("Fee recipient:", FEE_RECIPIENT);
        console.log("Initial root:", vault.getCurrentRoot());
        console.log("===========================================================");
    }
}
