// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import "../src/core/NoctisToken.sol";

interface IPoolModifyLiquidityTest {
    function modifyLiquidity(
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external payable returns (int256 delta0, int256 delta1);
}

contract AddLiquidityScript is Script {
    // Base Sepolia addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant MODIFY_LIQUIDITY_TEST = 0x37429cD17Cb1454C34E7F50b09725202Fd533039;
    address constant NOCTIS_TOKEN = 0xf863f3A311743fb4B51d289EeDf5F8a61190eA48;
    address constant NOCTIS_HOOK = 0x27Fd872c204f6040d853c3a773d372Aeb518e0cC;

    function run() external {
        vm.startBroadcast();

        console.log("\n=== Adding Liquidity to Pool ===");

        NoctisToken token = NoctisToken(NOCTIS_TOKEN);

        // Approve tokens to the modify liquidity test contract
        token.approve(MODIFY_LIQUIDITY_TEST, type(uint256).max);
        console.log("Approved NOCTIS tokens");

        // Pool key (same as when we created it)
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(NOCTIS_TOKEN),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(NOCTIS_HOOK)
        });

        // Calculate tick range for concentrated liquidity
        // tickSpacing = 60, so ticks must be multiples of 60
        // Current tick from pool creation was 138162
        // Let's provide liquidity in a range around that
        int24 tickLower = 138000 - 600;  // 137400 (below current)
        int24 tickUpper = 138000 + 600;  // 138600 (above current)

        // Make sure they're multiples of tickSpacing
        tickLower = (tickLower / 60) * 60;
        tickUpper = (tickUpper / 60) * 60;

        console.log("Tick lower:", tickLower);
        console.log("Tick upper:", tickUpper);

        // Liquidity amount
        int256 liquidityDelta = 1e18; // Start with small amount

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: liquidityDelta,
            salt: bytes32(0)
        });

        // Add liquidity - need to send ETH
        uint256 ethAmount = 0.01 ether;
        console.log("Adding liquidity with", ethAmount / 1e18, "ETH");

        IPoolModifyLiquidityTest modifyLiquidity = IPoolModifyLiquidityTest(MODIFY_LIQUIDITY_TEST);

        try modifyLiquidity.modifyLiquidity{value: ethAmount}(key, params, "") returns (int256 delta0, int256 delta1) {
            console.log("Liquidity added!");
            console.log("Delta0 (ETH):", delta0);
            console.log("Delta1 (NOCTIS):", delta1);
        } catch Error(string memory reason) {
            console.log("Failed:", reason);
        } catch (bytes memory data) {
            console.log("Failed with data:");
            console.logBytes(data);
        }

        vm.stopBroadcast();
    }
}
