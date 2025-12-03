// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import "../src/core/NoctisToken.sol";
import "../src/core/NoctisHook.sol";

interface IPoolSwapTest {
    struct TestSettings {
        bool takeClaims;
        bool settleUsingBurn;
    }

    function swap(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        TestSettings calldata testSettings,
        bytes calldata hookData
    ) external payable returns (int256 delta0, int256 delta1);
}

contract TestSwapScript is Script {
    // Base Sepolia addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant SWAP_TEST = 0x8B5bcC363ddE2614281aD875bad385E0A785D3B9;
    address constant NOCTIS_TOKEN = 0xf863f3A311743fb4B51d289EeDf5F8a61190eA48;
    address constant NOCTIS_HOOK = 0x27Fd872c204f6040d853c3a773d372Aeb518e0cC;

    function run() external {
        vm.startBroadcast();

        console.log("\n=== Testing Swap with Anti-Sniper Hook ===");

        NoctisToken token = NoctisToken(NOCTIS_TOKEN);
        NoctisHook hook = NoctisHook(payable(NOCTIS_HOOK));

        // Check current fee
        bytes32 poolId = keccak256(abi.encode(
            address(0),
            NOCTIS_TOKEN,
            uint24(3000),
            int24(60),
            NOCTIS_HOOK
        ));

        // Pool ID from creation
        poolId = 0x9611163fe298080d6093cdbf215128ab2b2ae55ba9e7cb5448bbaf8461e54b99;

        uint128 currentFee = hook.getCurrentFee(poolId);
        console.log("Current anti-sniper fee:", currentFee, "basis points");
        console.log("(61% = 6100, 1% = 100)");

        uint256 poolDeployTime = hook.poolDeploymentTimestamp(poolId);
        console.log("Pool deployed at timestamp:", poolDeployTime);
        console.log("Current timestamp:", block.timestamp);
        console.log("Elapsed:", block.timestamp - poolDeployTime, "seconds");

        // Approve tokens
        token.approve(SWAP_TEST, type(uint256).max);
        console.log("\nApproved tokens");

        // Pool key
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(NOCTIS_TOKEN),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(NOCTIS_HOOK)
        });

        // Swap params - buy NOCTIS with ETH
        // zeroForOne = true means swap currency0 (ETH) for currency1 (NOCTIS)
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: -0.001 ether, // Negative = exact input
            sqrtPriceLimitX96: 4295128739 + 1 // Min price (almost 0)
        });

        IPoolSwapTest.TestSettings memory settings = IPoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        console.log("\nSwapping 0.001 ETH for NOCTIS...");
        console.log("Token balance before:", token.balanceOf(msg.sender) / 1e18, "NOCTIS");

        IPoolSwapTest swapTest = IPoolSwapTest(SWAP_TEST);

        try swapTest.swap{value: 0.001 ether}(key, params, settings, "") returns (int256 delta0, int256 delta1) {
            console.log("\nSwap executed!");
            console.log("Delta0 (ETH spent):", delta0);
            console.log("Delta1 (NOCTIS received):", delta1);
            console.log("Token balance after:", token.balanceOf(msg.sender) / 1e18, "NOCTIS");

            // Calculate effective fee
            // If we spent X ETH and got Y tokens, but fee took Z%
            // then without fee we would have gotten Y / (1 - Z/100) tokens
        } catch Error(string memory reason) {
            console.log("Swap failed:", reason);
        } catch (bytes memory data) {
            console.log("Swap failed with data:");
            console.logBytes(data);
        }

        vm.stopBroadcast();
    }
}
