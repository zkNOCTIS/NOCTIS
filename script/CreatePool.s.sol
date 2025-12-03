// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import "../src/core/NoctisToken.sol";

interface IPositionManager {
    struct MintParams {
        PoolKey poolKey;
        int24 tickLower;
        int24 tickUpper;
        uint256 liquidity;
        uint256 amount0Max;
        uint256 amount1Max;
        address owner;
        bytes hookData;
    }

    function mint(
        MintParams calldata params,
        uint256 deadline,
        address refundTo
    ) external payable returns (uint256 tokenId);

    function initializePool(
        PoolKey calldata key,
        uint160 sqrtPriceX96
    ) external payable returns (int24 tick);
}

contract CreatePoolScript is Script {
    using PoolIdLibrary for PoolKey;

    // Base Sepolia addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant POSITION_MANAGER = 0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80;
    address constant NOCTIS_TOKEN = 0xf863f3A311743fb4B51d289EeDf5F8a61190eA48;
    address constant NOCTIS_HOOK = 0x27Fd872c204f6040d853c3a773d372Aeb518e0cC;

    function run() external {
        vm.startBroadcast();

        console.log("\n=== Creating Uniswap V4 Pool with NoctisHook ===");

        // Sort tokens - currency0 must be < currency1
        // ETH (address(0)) is always currency0 when paired with a token
        Currency currency0 = Currency.wrap(address(0)); // ETH
        Currency currency1 = Currency.wrap(NOCTIS_TOKEN);

        // If token address < ETH address (0), swap them
        if (uint160(NOCTIS_TOKEN) < uint160(address(0))) {
            currency0 = Currency.wrap(NOCTIS_TOKEN);
            currency1 = Currency.wrap(address(0));
        }

        console.log("Currency0:", Currency.unwrap(currency0));
        console.log("Currency1:", Currency.unwrap(currency1));
        console.log("Hook:", NOCTIS_HOOK);

        // Create pool key
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000, // 0.3% fee tier
            tickSpacing: 60,
            hooks: IHooks(NOCTIS_HOOK)
        });

        bytes32 poolId = PoolId.unwrap(key.toId());
        console.log("Pool ID:");
        console.logBytes32(poolId);

        // Initial price: 1 ETH = 1,000,000 NOCTIS
        // sqrtPriceX96 = sqrt(1e6) * 2^96 = 1000 * 2^96
        // For ETH/TOKEN where TOKEN is currency1:
        // price = token1/token0 = NOCTIS/ETH = 1,000,000
        // sqrtPriceX96 = sqrt(1000000) * 2^96 ≈ 79228162514264337593543950336000
        uint160 sqrtPriceX96 = 79228162514264337593543950336 * 1000; // ~1M tokens per ETH

        console.log("Initializing pool with sqrtPriceX96:", sqrtPriceX96);

        // Initialize the pool
        IPositionManager positionManager = IPositionManager(POSITION_MANAGER);

        try positionManager.initializePool(key, sqrtPriceX96) returns (int24 tick) {
            console.log("Pool initialized at tick:", tick);
        } catch Error(string memory reason) {
            console.log("Failed to initialize pool:", reason);
        } catch {
            console.log("Failed to initialize pool (unknown error)");
        }

        vm.stopBroadcast();

        console.log("\n=== Pool Creation Complete ===");
        console.log("Next: Add liquidity and test swaps");
    }
}
