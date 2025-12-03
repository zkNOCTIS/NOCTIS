// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NoctisToken
 * @notice Privacy-focused memecoin on Base with V4 hook support
 */
contract NoctisToken is ERC20, Ownable {

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B tokens

    bool public tradingEnabled;
    bool public midSwap; // Allows hook to bypass checks during swap

    address public hook;
    address public taxReceiver;

    mapping(address => bool) public isExcludedFromLimits;

    event TradingEnabled(uint256 timestamp);
    event ExclusionUpdated(address indexed account, bool excluded);
    event HookUpdated(address indexed hook);
    event TaxReceiverUpdated(address indexed receiver);

    constructor(address _taxReceiver) ERC20("Noctis", "NOCTIS") Ownable(msg.sender) {
        _mint(msg.sender, MAX_SUPPLY);
        isExcludedFromLimits[msg.sender] = true;
        isExcludedFromLimits[address(this)] = true;
        taxReceiver = _taxReceiver;
    }

    modifier onlyHook() {
        require(msg.sender == hook, "Only hook");
        _;
    }

    function enableTrading() external onlyOwner {
        require(!tradingEnabled, "Already enabled");
        tradingEnabled = true;
        emit TradingEnabled(block.timestamp);
    }

    function setExcludedFromLimits(address account, bool excluded) external onlyOwner {
        isExcludedFromLimits[account] = excluded;
        emit ExclusionUpdated(account, excluded);
    }

    function setHook(address _hook) external onlyOwner {
        hook = _hook;
        isExcludedFromLimits[_hook] = true;
        emit HookUpdated(_hook);
    }

    function setTaxReceiver(address _receiver) external onlyOwner {
        taxReceiver = _receiver;
        emit TaxReceiverUpdated(_receiver);
    }

    /**
     * @notice Called by hook during swaps to bypass trading checks
     */
    function setMidSwap(bool _midSwap) external onlyHook {
        midSwap = _midSwap;
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Allow minting/burning
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        // Check trading enabled (midSwap allows hook to operate)
        if (!tradingEnabled && !midSwap) {
            require(
                isExcludedFromLimits[from] || isExcludedFromLimits[to],
                "Trading not enabled"
            );
        }

        super._update(from, to, amount);
    }
}
