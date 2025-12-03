// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/NoctisHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

contract DeployHookCreate2Script is Script {
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant NOCTIS_TOKEN = 0xf863f3A311743fb4B51d289EeDf5F8a61190eA48;
    address constant TAX_RECEIVER = 0x8a1134c40193bAc50A4bEB416292B22a5479f68c;
    uint256 constant SALT = 15779;

    function run() external {
        vm.startBroadcast();

        // Deploy with CREATE2 using mined salt
        NoctisHook hook = new NoctisHook{salt: bytes32(SALT)}(
            IPoolManager(POOL_MANAGER),
            NOCTIS_TOKEN,
            TAX_RECEIVER
        );

        console.log("\n=== Hook Deployed ===");
        console.log("NoctisHook:", address(hook));
        console.log("Expected:   0x27Fd872c204f6040d853c3a773d372Aeb518e0cC");

        vm.stopBroadcast();
    }
}
