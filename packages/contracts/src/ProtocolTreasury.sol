// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Market} from "./Market.sol";
import {MarketFactory} from "./MarketFactory.sol";

/**
 * @title ProtocolTreasury
 * @notice Handles protocol-owned liquidity, fee collection, and market administration
 * @dev Separated from MarketFactory to reduce contract size
 */
contract ProtocolTreasury is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Reference to MarketFactory
    MarketFactory public factory;

    /// @notice Treasury address (receives protocol fees)
    address public treasury;

    /// @notice Total protocol fees collected across all markets
    uint256 public totalProtocolFeesCollected;

    // ─────────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────────

    event ProtocolLiquiditySeeded(address indexed market, uint256 amount);
    event ProtocolLiquidityWithdrawn(address indexed market, uint256 amount, address indexed to);
    event ProtocolFeeCollected(address indexed market, uint256 amount, address indexed to);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    // ─────────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────────

    error InvalidAddress();
    error NotMarket();

    // ─────────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Checks if caller is owner or admin on MarketFactory
     * @dev Allows both owner and MarketFactory admins to manage treasury
     */
    modifier onlyAdminOrOwner() {
        bool isOwner = msg.sender == owner();
        bool isAdmin = factory.hasRole(factory.DEFAULT_ADMIN_ROLE(), msg.sender);
        
        if (!isOwner && !isAdmin) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────────

    function initialize(address _factory, address _treasury) external initializer {
        if (_factory == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();

        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        factory = MarketFactory(_factory);
        treasury = _treasury;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Protocol Liquidity Management
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Seed protocol-owned liquidity in a market
     * @dev Can be called by owner or MarketFactory admins
     * @dev Calls MarketFactory which then calls Market (proper flow)
     */
    function seedMarketLiquidity(address market, uint256 amount) external onlyAdminOrOwner {
        if (!factory.isMarket(market)) revert NotMarket();
        
        IERC20 collateralToken = IERC20(Market(market).collateralToken());
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        collateralToken.approve(address(factory), amount);
        factory.seedMarketLiquidity(market, amount);

        emit ProtocolLiquiditySeeded(market, amount);
    }

    /**
     * @notice Withdraw protocol-owned liquidity from a market
     * @dev Can be called by owner or MarketFactory admins
     * @dev Calls MarketFactory which then calls Market (proper flow)
     */
    function withdrawProtocolLiquidity(address market, uint256 lpTokenAmount, address to) external onlyAdminOrOwner {
        if (!factory.isMarket(market)) revert NotMarket();
        if (to == address(0)) revert InvalidAddress();

        factory.withdrawProtocolLiquidity(market, lpTokenAmount, to);
        emit ProtocolLiquidityWithdrawn(market, lpTokenAmount, to);
    }

    /**
     * @notice Collect accumulated protocol fees from a market
     * @dev Can be called by owner or MarketFactory admins
     * @dev Calls MarketFactory which then calls Market (proper flow)
     */
    function collectProtocolFees(address market, address to) external onlyAdminOrOwner {
        if (!factory.isMarket(market)) revert NotMarket();
        if (to == address(0)) to = treasury;

        uint256 feesBefore = IERC20(Market(market).collateralToken()).balanceOf(to);
        factory.collectProtocolFees(market, to);
        uint256 feesAfter = IERC20(Market(market).collateralToken()).balanceOf(to);
        uint256 feesCollected = feesAfter - feesBefore;

        totalProtocolFeesCollected += feesCollected;
        emit ProtocolFeeCollected(market, feesCollected, to);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Market Administration
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Pause/unpause a market
     * @dev Can be called by owner or MarketFactory admins
     * @dev Calls MarketFactory which then calls Market (proper flow)
     */
    function pauseMarket(address market, bool paused) external onlyAdminOrOwner {
        if (!factory.isMarket(market)) revert NotMarket();
        factory.pauseMarket(market, paused);
    }

    /**
     * @notice Close a market (disable trading)
     * @dev Can be called by owner or MarketFactory admins
     * @dev Calls MarketFactory which then calls Market (proper flow)
     */
    function closeMarket(address market) external onlyAdminOrOwner {
        if (!factory.isMarket(market)) revert NotMarket();
        factory.closeMarket(market);
    }

    /**
     * @notice Cancel a market
     * @dev Can be called by owner or MarketFactory admins
     * @dev Calls MarketFactory which then calls Market (proper flow)
     */
    function cancelMarket(address market, string calldata reason) external onlyAdminOrOwner {
        if (!factory.isMarket(market)) revert NotMarket();
        factory.cancelMarket(market, reason);
    }

    /**
     * @notice Resolve a market with winning outcome
     * @dev Can be called by owner or MarketFactory admins
     * @dev Calls MarketFactory which then calls Market (proper flow)
     */
    function resolveMarket(address market, uint256 winningOutcome) external onlyAdminOrOwner {
        if (!factory.isMarket(market)) revert NotMarket();
        factory.resolveMarket(market, winningOutcome);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update MarketFactory address
     * @param newFactory New MarketFactory contract address (use PROXY address!)
     * @dev Only owner can update this to fix deployment mistakes
     */
    function setMarketFactory(address newFactory) external onlyOwner {
        if (newFactory == address(0)) revert InvalidAddress();
        address oldFactory = address(factory);
        factory = MarketFactory(newFactory);
        emit FactoryUpdated(oldFactory, newFactory);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UUPS Upgrade Authorization
    // ─────────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

