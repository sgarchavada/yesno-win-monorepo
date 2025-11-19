// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title LPToken
 * @notice ERC20 token representing liquidity provider shares in a prediction market
 * @dev Upgradeable LP token with restricted minting (only market contract can mint/burn)
 * 
 * Features:
 * - Standard ERC20 with 18 decimals
 * - Only the market contract can mint/burn
 * - Transferable (LPs can trade their shares)
 * - Upgradeable via UUPS pattern
 */
contract LPToken is 
    Initializable,
    ERC20Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    // ─────────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Market contract that controls minting/burning
    address public market;

    // ─────────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────────

    error OnlyMarket();
    error InvalidAddress();

    // ─────────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────────

    modifier onlyMarket() {
        if (msg.sender != market) revert OnlyMarket();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the LP token
     * @param _market Address of the market contract
     * @param _name Token name
     * @param _symbol Token symbol
     */
    function initialize(
        address _market,
        string memory _name,
        string memory _symbol
    ) external initializer {
        if (_market == address(0)) revert InvalidAddress();

        __ERC20_init(_name, _symbol);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        market = _market;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Minting & Burning (Market Only)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint LP tokens to an address
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyMarket {
        _mint(to, amount);
    }

    /**
     * @notice Burn LP tokens from an address
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyMarket {
        _burn(from, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Authorize contract upgrades (UUPS)
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Get the decimals (18 for LP tokens)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

