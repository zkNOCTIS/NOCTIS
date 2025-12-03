// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {BaseHook} from "./BaseHook.sol";

interface INoctisToken {
    function taxReceiver() external view returns (address);
    function setMidSwap(bool value) external;
}

/**
 * @title NoctisHook
 * @notice Uniswap V4 hook for NOCTIS with anti-sniper protection
 * @dev 61% fee at launch, decays to 1% over 60 minutes (1% per minute)
 */
contract NoctisHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    uint256 public constant BASIS_POINTS = 10000;

    // Anti-sniper: 61% -> 1% over 60 minutes (1% per minute decay)
    uint128 public constant STARTING_FEE = 6100;      // 61%
    uint128 public constant FINAL_FEE = 100;          // 1% permanent after window
    uint128 public constant ANTI_SNIPER_WINDOW = 60 minutes;
    uint128 public constant DECAY_INTERVAL = 1 minutes;
    uint128 public constant DECAY_AMOUNT = 100;       // 1% per minute

    address public immutable noctisToken;
    address public immutable taxReceiver;

    mapping(bytes32 => uint256) public poolDeploymentTimestamp;

    event FeesCollected(bytes32 indexed poolId, uint256 amount, bool isBuy);
    event PoolInitialized(bytes32 indexed poolId, uint256 timestamp);

    constructor(
        IPoolManager _poolManager,
        address _noctisToken,
        address _taxReceiver
    ) BaseHook(_poolManager) {
        noctisToken = _noctisToken;
        taxReceiver = _taxReceiver;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) internal override returns (bytes4) {
        bytes32 poolId = PoolId.unwrap(key.toId());
        poolDeploymentTimestamp[poolId] = block.timestamp;
        emit PoolInitialized(poolId, block.timestamp);
        return BaseHook.beforeInitialize.selector;
    }

    /**
     * @notice Calculate current fee based on time since pool deployment
     * @dev Decays from 61% to 1% over 60 minutes (1% per minute)
     */
    function getCurrentFee(bytes32 poolId) public view returns (uint128) {
        uint256 deployedAt = poolDeploymentTimestamp[poolId];
        if (deployedAt == 0) return STARTING_FEE;

        uint256 elapsed = block.timestamp - deployedAt;
        if (elapsed >= ANTI_SNIPER_WINDOW) return FINAL_FEE;

        uint256 intervals = elapsed / DECAY_INTERVAL;
        uint256 reduction = intervals * DECAY_AMOUNT;

        if (reduction >= STARTING_FEE - FINAL_FEE) return FINAL_FEE;
        return uint128(STARTING_FEE - reduction);
    }

    /**
     * @notice Check if still in anti-sniper window
     */
    function isAntiSniperActive(bytes32 poolId) public view returns (bool) {
        uint256 deployedAt = poolDeploymentTimestamp[poolId];
        if (deployedAt == 0) return true;
        return block.timestamp - deployedAt < ANTI_SNIPER_WINDOW;
    }

    function _beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // Only apply to NOCTIS pools
        if (Currency.unwrap(key.currency0) != noctisToken &&
            Currency.unwrap(key.currency1) != noctisToken) {
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        // Allow transfers during swap
        INoctisToken(noctisToken).setMidSwap(true);

        // Check for ETH pair
        bool ethIsCurrency0 = Currency.unwrap(key.currency0) == address(0);
        bool ethIsCurrency1 = Currency.unwrap(key.currency1) == address(0);

        if (!ethIsCurrency0 && !ethIsCurrency1) {
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        bytes32 poolId = PoolId.unwrap(key.toId());
        uint128 fee = getCurrentFee(poolId);

        bool isBuy = _isBuyTransaction(key, params);
        bool specifiedIsCurrency0 = (params.amountSpecified < 0) == params.zeroForOne;

        // Take fee on ETH input for buys
        if (isBuy && ((ethIsCurrency0 && specifiedIsCurrency0) || (ethIsCurrency1 && !specifiedIsCurrency0))) {
            uint256 amount = params.amountSpecified < 0
                ? uint256(-params.amountSpecified)
                : uint256(params.amountSpecified);
            uint256 feeAmount = (amount * fee) / BASIS_POINTS;

            if (feeAmount > 0) {
                Currency ethCurrency = ethIsCurrency0 ? key.currency0 : key.currency1;
                poolManager.take(ethCurrency, taxReceiver, feeAmount);

                emit FeesCollected(poolId, feeAmount, true);
                return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(int128(int256(feeAmount)), 0), 0);
            }
        }

        return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
    }

    function _afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        // Reset midSwap flag for NOCTIS pools
        _resetMidSwap(key);

        // Calculate and collect sell fee
        int128 feeCollected = _collectSellFee(key, params, delta);

        return (BaseHook.afterSwap.selector, feeCollected);
    }

    function _resetMidSwap(PoolKey calldata key) internal {
        if (Currency.unwrap(key.currency0) == noctisToken ||
            Currency.unwrap(key.currency1) == noctisToken) {
            INoctisToken(noctisToken).setMidSwap(false);
        }
    }

    function _collectSellFee(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta
    ) internal returns (int128) {
        // Check for ETH pair
        bool ethIsCurrency0 = Currency.unwrap(key.currency0) == address(0);
        if (!ethIsCurrency0 && Currency.unwrap(key.currency1) != address(0)) {
            return 0;
        }

        // Get fee
        bytes32 poolId = PoolId.unwrap(key.toId());
        uint128 fee = getCurrentFee(poolId);

        // Only for sells
        if (_isBuyTransaction(key, params)) return 0;

        // Check unspecified is ETH
        bool specifiedIsCurrency0 = (params.amountSpecified < 0) == params.zeroForOne;
        if (ethIsCurrency0 == specifiedIsCurrency0) return 0;

        // Get ETH moved
        int128 ethDelta = ethIsCurrency0 ? delta.amount0() : delta.amount1();
        if (ethDelta == 0) return 0;

        uint256 ethMoved = ethDelta < 0 ? uint256(-int256(ethDelta)) : uint256(int256(ethDelta));
        uint256 feeAmount = (ethMoved * fee) / BASIS_POINTS;

        if (feeAmount > 0) {
            poolManager.take(ethIsCurrency0 ? key.currency0 : key.currency1, taxReceiver, feeAmount);
            emit FeesCollected(poolId, feeAmount, false);
            return int128(int256(feeAmount));
        }

        return 0;
    }

    function _isBuyTransaction(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params
    ) internal pure returns (bool) {
        bool ethIsCurrency0 = Currency.unwrap(key.currency0) == address(0);
        // Buy = ETH -> NOCTIS
        return ethIsCurrency0 ? params.zeroForOne : !params.zeroForOne;
    }

    receive() external payable {}
}
