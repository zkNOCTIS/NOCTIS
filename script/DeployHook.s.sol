// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/NoctisHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

contract DeployHookScript is Script {
    // Base Sepolia PoolManager
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;

    // Already deployed token
    address constant NOCTIS_TOKEN = 0xf863f3A311743fb4B51d289EeDf5F8a61190eA48;

    function run() external {
        vm.startBroadcast();

        address deployer = msg.sender;

        // Calculate required hook flags
        // beforeInitialize, beforeSwap, afterSwap, beforeSwapReturnDelta, afterSwapReturnDelta
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG |
            Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG |
            Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        console.log("Required hook flags:", flags);
        console.log("Deployer:", deployer);
        console.log("Token:", NOCTIS_TOKEN);
        console.log("PoolManager:", POOL_MANAGER);

        // Deploy hook - note: in production you need to mine a salt
        // so the hook address has the correct flag bits
        NoctisHook hook = new NoctisHook(
            IPoolManager(POOL_MANAGER),
            NOCTIS_TOKEN,
            deployer  // taxReceiver
        );

        console.log("\n=== Hook Deployed ===");
        console.log("NoctisHook:", address(hook));
        console.log("\nIMPORTANT: Hook address must have correct flag bits!");
        console.log("If deployment fails on pool creation, you need to mine a salt");

        vm.stopBroadcast();
    }
}
