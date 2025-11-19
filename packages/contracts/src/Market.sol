// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {OutcomeToken} from "./OutcomeToken.sol";
import {LPToken} from "./LPToken.sol";
import {IMarketFactory} from "./interfaces/IMarketFactory.sol";

/**
 * @title Market
 * @notice Polymarket-style AMM for multi-outcome prediction markets
 * @dev Implements Constant Product Market Maker (CPMM) for outcome tokens
 * 
 * Core Features:
 * - Multi-outcome support (not just binary)
 * - Dynamic pricing via CPMM: price_i = totalReserves / reserve_i
 * - Buy/sell outcome tokens with slippage protection
 * - Liquidity provision with ERC20 LP tokens
 * - Protocol-owned liquidity (PoL)
 * - Ladder parlay trades with leverage
 * - Fee routing (LP fees vs protocol fees)
 * - Resolution via oracle
 * - Partial winner redemption
 * - Negrisk multi-outcome price normalization
 * 
 * Economic Model:
 * - Collateral: USDC or other ERC20
 * - Each outcome token represents claim on 1 unit of collateral if that outcome wins
 * - AMM maintains reserves for each outcome
 * - Price adjusts dynamically based on supply/demand
 * - LPs earn trading fees via ERC20 LP tokens
 * - Protocol earns separate protocol fees routed to treasury
 */
contract Market is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────────

    enum MarketStatus {
        ACTIVE,      // Trading enabled
        CLOSED,      // Trading disabled, awaiting resolution
        RESOLVED,    // Resolved, claims enabled
        CANCELED     // Canceled, refunds enabled
    }

    struct MarketConfig {
        string question;
        uint256 endTime;
        uint256 feeBps;          // DEPRECATED: Use lpFeeBps + protocolFeeBps instead
        MarketStatus status;
        uint256 winningOutcome;
        bool resolved;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v1 - Original variables, MUST NOT REORDER)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Market configuration
    MarketConfig public config;

    /// @notice Factory contract address
    address public factory;

    /// @notice Oracle adapter address (for resolution)
    address public oracleAdapter;

    /// @notice Collateral token (e.g., USDC)
    IERC20 public collateralToken;

    /// @notice Array of outcome tokens
    OutcomeToken[] public outcomeTokens;

    /// @notice Outcome descriptions
    string[] public outcomes;

    /// @notice AMM reserves for each outcome (in collateral units)
    /// @dev reserves[i] = amount of collateral backing outcome i
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units, e.g. 100 USDC = 100_000_000)
    mapping(uint256 => uint256) public reserves;

    /// @notice Total collateral in the AMM
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    uint256 public totalReserves;

    /// @notice DEPRECATED: LP token balances (replaced by lpToken ERC20)
    mapping(address => uint256) public lpBalances;

    /// @notice DEPRECATED: Total LP tokens issued (use lpToken.totalSupply())
    uint256 public totalLpTokens;

    /// @notice Accumulated LP fees
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    uint256 public accumulatedFees;

    /// @notice DEPRECATED: User claims tracking (replaced by partialClaimAmounts)
    mapping(address => bool) public hasClaimed;

    /// @notice Constant for precision in calculations
    uint256 private constant PRECISION = 1e18;

    /// @notice Minimum liquidity (prevents division by zero)
    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v2 - New variables, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice ERC20 LP token for liquidity provider shares
    LPToken public lpToken;

    /// @notice LP fee in basis points (stays in pool for LPs)
    uint256 public lpFeeBps;

    /// @notice Protocol fee in basis points (routed to factory treasury)
    uint256 public protocolFeeBps;

    /// @notice Parlay fee in basis points (charged on parlay trades)
    uint256 public parlayFeeBps;

    /// @notice Protocol-owned liquidity amount
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    uint256 public protocolLiquidity;

    /// @notice Accumulated protocol fees (ready for collection by factory)
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    uint256 public accumulatedProtocolFees;

    /// @notice Market paused state (emergency)
    bool public paused;

    /// @notice Partial claim amounts per user (for incremental claiming)
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    /// @dev Tracks cumulative collateral (not tokens) claimed by each user
    mapping(address => uint256) public partialClaimAmounts;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v3 - Cancellation tracking, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Reason for market cancellation (if canceled)
    string public cancellationReason;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v4 - Trade limits, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Minimum liquidity lock (prevents removing all liquidity)
    uint256 public minimumLiquidityLock;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v5 - Parlay tracking & Oracle timeout, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Track parlay positions per user per outcome
    mapping(address => mapping(uint256 => uint256)) public parlayPositions;

    /// @notice Deadline for oracle resolution (after this, admin can override)
    uint256 public oracleResolutionDeadline;

    /// @notice Oracle timeout period in seconds (default: 7 days)
    uint256 public oracleTimeoutPeriod;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v6 - Volume tracking, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Track total volume (in collateral) traded per outcome
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    mapping(uint256 => uint256) public volumePerOutcome;

    /// @notice Total volume across all outcomes
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    uint256 public totalVolume;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v7 - User investment tracking for accurate refunds, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Track user investments (collateral spent) per outcome for accurate refunds
    /// @dev userInvestments[user][outcomeIndex] = total collateral spent on that outcome
    /// @dev DECIMAL PRECISION: 6 decimals (USDC collateral units)
    mapping(address => mapping(uint256 => uint256)) public userInvestments;

    // ─────────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────────

    event Trade(
        address indexed user,
        uint256 indexed outcomeIndex,
        bool isBuy,
        uint256 collateralAmount,
        uint256 outcomeTokenAmount,
        uint256 lpFee,
        uint256 protocolFee
    );

    event LiquidityAdded(
        address indexed provider,
        uint256 collateralAmount,
        uint256 lpTokensMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 lpTokensBurned,
        uint256 collateralAmount
    );

    event ProtocolLiquiditySeeded(
        uint256 amount,
        uint256 lpTokensMinted
    );

    event ProtocolLiquidityWithdrawn(
        uint256 lpTokensBurned,
        uint256 collateralAmount
    );

    event ParlayExecuted(
        address indexed user,
        uint256 indexed outcomeIndex,
        uint256 stake,
        uint256 leverage,
        uint256 parlayFee,
        uint256 outcomeTokensMinted
    );

    event MarketResolved(
        uint256 indexed winningOutcome,
        uint256 timestamp
    );

    event WinningsClaimed(
        address indexed user,
        uint256 amount,
        uint256 totalClaimed
    );

    event ProtocolFeeCollected(
        address indexed collector,
        uint256 amount
    );

    event MarketPaused(bool paused);
    event MarketClosed();
    event MarketCanceled(string reason);
    event ReserveSynced(uint256 newReserveAmount);
    event OracleResolutionRequested(bytes data);
    event RefundClaimed(address indexed user, uint256 amount);
    event LPFeesClaimed(address indexed user, uint256 amount);
    event MarketFinalized(uint256 unclaimedReservesDistributed);

    // ─────────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────────

    error InvalidOutcome();
    error InvalidAmount();
    error ZeroCollateralReturn();
    error MarketNotActive();
    error MarketEnded();
    error MarketNotResolved();
    error AlreadyResolved();
    error WinnersHaveNotClaimed();
    error NoUnclaimedReserves();
    error SlippageExceeded();
    error InsufficientLiquidity();
    error NoWinningTokens();
    error Unauthorized();
    error InvalidLeverage();
    error InsufficientBalance();
    error InvalidAddress();
    error FeeTooHigh();
    error Paused();
    error MarketNotCanceled();
    error NoTokensToRefund();
    error CanOnlyCollectOnResolvedMarkets();
    error NoLPTokens();
    error NoFeesToClaim();
    error OracleDeadlineNotReached();

    // ─────────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Initialize the market (v2 - with new fee parameters)
     * @param _factory Factory contract address
     * @param _creator Market creator (receives initial LP tokens)
     * @param _collateralToken Collateral token address (e.g., USDC)
     * @param _lpToken LP token address
     * @param _question Market question
     * @param _outcomes Array of outcome descriptions
     * @param _outcomeTokens Array of deployed outcome token addresses
     * @param _endTime Trading end timestamp
     * @param _lpFeeBps LP fee in basis points
     * @param _protocolFeeBps Protocol fee in basis points
     * @param _parlayFeeBps Parlay fee in basis points
     * @param _initialLiquidity Initial collateral to seed the AMM
     */
    function initialize(
        address _factory,
        address _creator,
        address _collateralToken,
        address _lpToken,
        string memory _question,
        string[] memory _outcomes,
        address[] memory _outcomeTokens,
        uint256 _endTime,
        uint256 _lpFeeBps,
        uint256 _protocolFeeBps,
        uint256 _parlayFeeBps,
        uint256 _initialLiquidity
    ) external initializer {
        require(_factory != address(0), "Invalid factory");
        require(_creator != address(0), "Invalid creator");
        require(_collateralToken != address(0), "Invalid collateral");
        require(_lpToken != address(0), "Invalid LP token");
        require(_outcomes.length >= 2, "Min 2 outcomes");
        require(_outcomes.length == _outcomeTokens.length, "Length mismatch");
        require(_endTime > block.timestamp, "Invalid end time");
        require(_lpFeeBps + _protocolFeeBps <= 1000, "Total fee too high"); // Max 10%
        require(_parlayFeeBps <= 1000, "Parlay fee too high");
        require(_initialLiquidity >= MINIMUM_LIQUIDITY, "Liquidity too low");

        // Factory owns the market so it can upgrade and manage it
        // Creator is stored separately for attribution
        __Ownable_init(_factory);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        factory = _factory;
        collateralToken = IERC20(_collateralToken);
        lpToken = LPToken(_lpToken);
        outcomes = _outcomes;
        
        // Get oracle adapter from factory
        oracleAdapter = IMarketFactory(factory).oracleAdapter();

        // Set fee parameters
        lpFeeBps = _lpFeeBps;
        protocolFeeBps = _protocolFeeBps;
        parlayFeeBps = _parlayFeeBps;

        config = MarketConfig({
            question: _question,
            endTime: _endTime,
            feeBps: _lpFeeBps + _protocolFeeBps, // Backward compatibility
            status: MarketStatus.ACTIVE,
            winningOutcome: 0,
            resolved: false
        });

        // Initialize outcome tokens
        for (uint256 i = 0; i < _outcomeTokens.length; i++) {
            outcomeTokens.push(OutcomeToken(_outcomeTokens[i]));
        }

        // Initialize reserves (LP token minting happens after LP token is initialized)
        _initializeReserves(_initialLiquidity, _creator);
        
        // Set default trade limits
        minimumLiquidityLock = _initialLiquidity / 10; // 10% of initial liquidity
        
        // Set oracle timeout (7 days after market ends)
        oracleTimeoutPeriod = 7 days;
        oracleResolutionDeadline = _endTime + oracleTimeoutPeriod;
    }

    /**
     * @notice Complete initialization by minting LP tokens (called by factory after LP token is ready)
     * @param creator Address to receive initial LP tokens
     * @param amount Initial liquidity amount
     */
    function completeLPInitialization(address creator, uint256 amount) external onlyFactory {
        require(totalReserves == amount, "Reserves already initialized");
        require(lpToken.totalSupply() == 0, "LP tokens already minted");
        
        // Mint initial LP tokens
        // Scale from 6 decimals (collateral) to 18 decimals (LP tokens)
        uint256 lpTokensToMint = amount * 1e12;
        lpToken.mint(creator, lpTokensToMint);

        emit LiquidityAdded(creator, amount, lpTokensToMint);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Trading Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Buy outcome tokens
     * @param outcomeIndex Index of the outcome to buy
     * @param collateralAmount Amount of collateral to spend
     * @param minOutcomeTokens Minimum outcome tokens expected (slippage protection)
     */
    function buy(
        uint256 outcomeIndex,
        uint256 collateralAmount,
        uint256 minOutcomeTokens
    ) external nonReentrant whenNotPaused {
        _buy(msg.sender, outcomeIndex, collateralAmount, minOutcomeTokens);
    }

    /**
     * @notice Buy outcome tokens on behalf of another user (called by factory)
     * @dev Factory-only function that transfers tokens directly from user to market
     * @param user Address of the user (who approved the factory)
     * @param outcomeIndex Index of the outcome to buy
     * @param collateralAmount Amount of collateral to spend
     * @param minOutcomeTokens Minimum outcome tokens expected (slippage protection)
     */
    function buyForUser(
        address user,
        uint256 outcomeIndex,
        uint256 collateralAmount,
        uint256 minOutcomeTokens
    ) external nonReentrant whenNotPaused {
        require(msg.sender == factory, "Market: only factory");
        
        if (config.status != MarketStatus.ACTIVE) revert MarketNotActive();
        if (block.timestamp >= config.endTime) revert MarketEnded();
        if (outcomeIndex >= outcomeTokens.length) revert InvalidOutcome();
        if (collateralAmount == 0) revert InvalidAmount();

        // Calculate fees (split between LP and protocol)
        uint256 lpFee = (collateralAmount * lpFeeBps) / 10000;
        uint256 protocolFee = (collateralAmount * protocolFeeBps) / 10000;
        uint256 totalFee = lpFee + protocolFee;
        uint256 collateralAfterFee = collateralAmount - totalFee;

        // Calculate outcome tokens to mint using CPMM
        uint256 outcomeTokensToMint = _calculateBuyAmount(outcomeIndex, collateralAfterFee);

        if (outcomeTokensToMint < minOutcomeTokens) revert SlippageExceeded();

        // Collateral already transferred by factory (user approved factory, factory transferred to market)
        // No transfer needed here

        // Update reserves
        reserves[outcomeIndex] += collateralAfterFee;
        totalReserves += collateralAfterFee;
        accumulatedFees += lpFee;
        accumulatedProtocolFees += protocolFee;

        // Track volume
        volumePerOutcome[outcomeIndex] += collateralAmount;
        totalVolume += collateralAmount;

        // Track user investment for accurate refunds (store full collateral amount including fees)
        userInvestments[user][outcomeIndex] += collateralAmount;

        // Mint outcome tokens to user
        outcomeTokens[outcomeIndex].mint(user, outcomeTokensToMint);

        // Normalize prices (Negrisk multi-outcome)
        _normalizePrices();

        emit Trade(user, outcomeIndex, true, collateralAmount, outcomeTokensToMint, lpFee, protocolFee);
    }

    /**
     * @notice Internal buy logic
     */
    function _buy(
        address recipient,
        uint256 outcomeIndex,
        uint256 collateralAmount,
        uint256 minOutcomeTokens
    ) internal {
        if (config.status != MarketStatus.ACTIVE) revert MarketNotActive();
        if (block.timestamp >= config.endTime) revert MarketEnded();
        if (outcomeIndex >= outcomeTokens.length) revert InvalidOutcome();
        if (collateralAmount == 0) revert InvalidAmount();

        // Calculate fees (split between LP and protocol)
        uint256 lpFee = (collateralAmount * lpFeeBps) / 10000;
        uint256 protocolFee = (collateralAmount * protocolFeeBps) / 10000;
        uint256 totalFee = lpFee + protocolFee;
        uint256 collateralAfterFee = collateralAmount - totalFee;

        // Calculate outcome tokens to mint using CPMM
        uint256 outcomeTokensToMint = _calculateBuyAmount(outcomeIndex, collateralAfterFee);

        if (outcomeTokensToMint < minOutcomeTokens) revert SlippageExceeded();

        // Transfer collateral from user
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Update reserves
        reserves[outcomeIndex] += collateralAfterFee;
        totalReserves += collateralAfterFee;
        accumulatedFees += lpFee;
        accumulatedProtocolFees += protocolFee;

        // Track volume
        volumePerOutcome[outcomeIndex] += collateralAmount;
        totalVolume += collateralAmount;

        // Track user investment for accurate refunds (store full collateral amount including fees)
        userInvestments[recipient][outcomeIndex] += collateralAmount;

        // Mint outcome tokens to recipient
        outcomeTokens[outcomeIndex].mint(recipient, outcomeTokensToMint);

        // Normalize prices (Negrisk multi-outcome)
        _normalizePrices();

        emit Trade(recipient, outcomeIndex, true, collateralAmount, outcomeTokensToMint, lpFee, protocolFee);
    }

    /**
     * @notice Sell outcome tokens
     * @param outcomeIndex Index of the outcome to sell
     * @param outcomeTokenAmount Amount of outcome tokens to sell
     * @param minCollateral Minimum collateral expected (slippage protection)
     */
    function sell(
        uint256 outcomeIndex,
        uint256 outcomeTokenAmount,
        uint256 minCollateral
    ) external nonReentrant whenNotPaused {
        if (config.status != MarketStatus.ACTIVE) revert MarketNotActive();
        if (block.timestamp >= config.endTime) revert MarketEnded();
        if (outcomeIndex >= outcomeTokens.length) revert InvalidOutcome();
        if (outcomeTokenAmount == 0) revert InvalidAmount();

        // Calculate collateral to return using CPMM
        uint256 collateralToReturn = _calculateSellAmount(outcomeIndex, outcomeTokenAmount);

        // Calculate fees (split between LP and protocol)
        uint256 lpFee = (collateralToReturn * lpFeeBps) / 10000;
        uint256 protocolFee = (collateralToReturn * protocolFeeBps) / 10000;
        uint256 totalFee = lpFee + protocolFee;
        uint256 collateralAfterFee = collateralToReturn - totalFee;

        if (collateralAfterFee < minCollateral) revert SlippageExceeded();

        // Burn outcome tokens from user
        outcomeTokens[outcomeIndex].burn(msg.sender, outcomeTokenAmount);

        // Update reserves
        reserves[outcomeIndex] -= collateralToReturn;
        totalReserves -= collateralToReturn;
        accumulatedFees += lpFee;
        accumulatedProtocolFees += protocolFee;

        // Track volume
        volumePerOutcome[outcomeIndex] += collateralToReturn;
        totalVolume += collateralToReturn;

        // Transfer collateral to user
        collateralToken.safeTransfer(msg.sender, collateralAfterFee);

        // Normalize prices (Negrisk multi-outcome)
        _normalizePrices();

        emit Trade(msg.sender, outcomeIndex, false, collateralAfterFee, outcomeTokenAmount, lpFee, protocolFee);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Parlay Trading
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Execute a ladder parlay trade (leveraged outcome exposure)
     * @dev Sells lower outcome tokens to fund higher outcome purchase
     * @param outcomeIndex Target outcome to buy
     * @param stake Initial collateral stake
     * @param leverage Leverage multiplier (in basis points, e.g., 20000 = 2x)
     * 
     * @dev FEE DESIGN:
     * - Sell side (Step 1): NO FEES charged when selling lower outcomes
     * - Buy side (Step 4): Parlay fee charged on leveraged amount
     * - Rationale: Parlay is a rebalancing operation, not a profit-taking exit
     * - Charging fees on both sides would double-charge and discourage position shifts
     * - Single fee on net trade is consistent with efficient AMM design
     */
    function parlay(
        uint256 outcomeIndex,
        uint256 stake,
        uint256 leverage
    ) external nonReentrant whenNotPaused {
        if (config.status != MarketStatus.ACTIVE) revert MarketNotActive();
        if (block.timestamp >= config.endTime) revert MarketEnded();
        if (outcomeIndex >= outcomeTokens.length) revert InvalidOutcome();
        if (stake == 0) revert InvalidAmount();
        if (leverage < 10000 || leverage > 50000) revert InvalidLeverage(); // 1x to 5x

        // Step 1: Sell "No" position on lower outcomes (if any)
        uint256 freedCollateral = 0;
        for (uint256 i = 0; i < outcomeIndex; i++) {
            uint256 outcomeBalance = outcomeTokens[i].balanceOf(msg.sender);
            if (outcomeBalance > 0) {
                // Sell these tokens
                uint256 collateral = _calculateSellAmount(i, outcomeBalance);
                outcomeTokens[i].burn(msg.sender, outcomeBalance);
                reserves[i] -= collateral;
                totalReserves -= collateral;
                freedCollateral += collateral;
            }
        }

        // Step 2: Add user's stake
        collateralToken.safeTransferFrom(msg.sender, address(this), stake);
        uint256 totalCollateral = stake + freedCollateral;

        // Step 3: Apply leverage (multiply exposure)
        uint256 leveragedAmount = (totalCollateral * leverage) / 10000;

        // Step 4: Charge parlay fee
        uint256 parlayFee = (leveragedAmount * parlayFeeBps) / 10000;
        uint256 collateralAfterFee = leveragedAmount - parlayFee;

        // Step 5: Buy target outcome with leveraged amount
        uint256 outcomeTokensToMint = _calculateBuyAmount(outcomeIndex, collateralAfterFee);

        // Update reserves
        reserves[outcomeIndex] += collateralAfterFee;
        totalReserves += collateralAfterFee;
        accumulatedProtocolFees += parlayFee; // Parlay fees go to protocol

        // Mint outcome tokens
        outcomeTokens[outcomeIndex].mint(msg.sender, outcomeTokensToMint);

        // Track parlay position
        parlayPositions[msg.sender][outcomeIndex] += outcomeTokensToMint;

        // Normalize prices
        _normalizePrices();

        emit ParlayExecuted(msg.sender, outcomeIndex, stake, leverage, parlayFee, outcomeTokensToMint);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Liquidity Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Add liquidity to the AMM (mints ERC20 LP tokens)
     * @param collateralAmount Amount of collateral to add
     */
    function addLiquidity(uint256 collateralAmount) external nonReentrant whenNotPaused returns (uint256) {
        return _addLiquidity(msg.sender, collateralAmount);
    }

    /**
     * @notice Add liquidity on behalf of another user (called by factory)
     * @dev Factory-only function that transfers tokens directly from user to market
     * @param user Address of the user (who approved the factory)
     * @param collateralAmount Amount of collateral to add
     * @return lpTokensToMint Amount of LP tokens minted
     */
    function addLiquidityForUser(address user, uint256 collateralAmount) external nonReentrant whenNotPaused returns (uint256) {
        require(msg.sender == factory, "Market: only factory");
        
        if (config.status != MarketStatus.ACTIVE) revert MarketNotActive();
        if (block.timestamp >= config.endTime) revert MarketEnded();
        if (collateralAmount == 0) revert InvalidAmount();

        uint256 lpTokensToMint;
        uint256 totalLpSupply = lpToken.totalSupply();

        if (totalLpSupply == 0) {
            // First liquidity provider
            // Scale from 6 decimals (collateral) to 18 decimals (LP tokens)
            lpTokensToMint = collateralAmount * 1e12;
        } else {
            // Proportional to existing liquidity
            lpTokensToMint = (collateralAmount * totalLpSupply) / totalReserves;
        }

        // Collateral already transferred by factory (user approved factory, factory transferred to market)
        // No transfer needed here

        // Distribute collateral equally across all outcome reserves
        uint256 perOutcome = collateralAmount / outcomeTokens.length;
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            reserves[i] += perOutcome;
        }
        totalReserves += collateralAmount;

        // Mint LP tokens to user
        lpToken.mint(user, lpTokensToMint);

        emit LiquidityAdded(user, collateralAmount, lpTokensToMint);
        
        return lpTokensToMint;
    }

    /**
     * @notice Internal add liquidity logic
     */
    function _addLiquidity(address recipient, uint256 collateralAmount) internal returns (uint256) {
        if (config.status != MarketStatus.ACTIVE) revert MarketNotActive();
        if (block.timestamp >= config.endTime) revert MarketEnded();
        if (collateralAmount == 0) revert InvalidAmount();

        uint256 lpTokensToMint;
        uint256 totalLpSupply = lpToken.totalSupply();

        if (totalLpSupply == 0) {
            // First liquidity provider
            // Scale from 6 decimals (collateral) to 18 decimals (LP tokens)
            lpTokensToMint = collateralAmount * 1e12;
        } else {
            // Proportional to existing liquidity
            lpTokensToMint = (collateralAmount * totalLpSupply) / totalReserves;
        }

        // Transfer collateral from user
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Distribute collateral equally across all outcome reserves
        uint256 perOutcome = collateralAmount / outcomeTokens.length;
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            reserves[i] += perOutcome;
        }
        totalReserves += collateralAmount;

        // Mint LP tokens to recipient
        lpToken.mint(recipient, lpTokensToMint);

        emit LiquidityAdded(recipient, collateralAmount, lpTokensToMint);
        
        return lpTokensToMint;
    }

    /**
     * @notice Remove liquidity from the AMM (burns ERC20 LP tokens)
     * @param lpTokenAmount Amount of LP tokens to burn
     */
    function removeLiquidity(uint256 lpTokenAmount) external nonReentrant {
        if (lpTokenAmount == 0) revert InvalidAmount();
        
        // Check user has enough LP tokens (critical safety check)
        uint256 userLpBalance = lpToken.balanceOf(msg.sender);
        if (lpTokenAmount > userLpBalance) revert InsufficientLiquidity();

        uint256 totalLpSupply = lpToken.totalSupply();
        
        // Additional safety: ensure amount doesn't exceed total supply
        if (lpTokenAmount > totalLpSupply) revert InsufficientLiquidity();
        
        uint256 collateralToReturn;

        // CANCELED MARKET PATH: Simple refund, no fees
        if (config.status == MarketStatus.CANCELED) {
            // Calculate collateral to return (proportional to LP share)
            collateralToReturn = (lpTokenAmount * totalReserves) / totalLpSupply;
            
            // CRITICAL FIX: Prevent burning LP tokens if collateral rounds to 0
            if (collateralToReturn == 0) revert ZeroCollateralReturn();
            
            // Safety cap: never return more than available reserves
            if (collateralToReturn > totalReserves) {
                collateralToReturn = totalReserves;
            }
            
            // Update total reserves (simple subtraction with underflow protection)
            if (collateralToReturn > totalReserves) {
                totalReserves = 0;
            } else {
                totalReserves -= collateralToReturn;
            }
            
            // Burn LP tokens and transfer collateral
            lpToken.burn(msg.sender, lpTokenAmount);
            collateralToken.safeTransfer(msg.sender, collateralToReturn);
            
            emit LiquidityRemoved(msg.sender, lpTokenAmount, collateralToReturn);
            return;
        }

        // RESOLVED MARKET PATH: LPs get winning outcome reserves + fees
        if (config.status == MarketStatus.RESOLVED) {
            // CRITICAL FIX: LPs should ONLY get reserves from the WINNING outcome + accumulated fees
            // Winners are paid from LOSING outcome reserves, so winning reserves belong to LPs
            uint256 winningReserve = reserves[config.winningOutcome];
            
            // Calculate LP's proportional share of WINNING outcome reserves
            uint256 lpShareOfWinningReserve = (lpTokenAmount * winningReserve) / totalLpSupply;
            
            // Add LP's proportional share of accumulated trading fees
            uint256 lpFeeShare = (lpTokenAmount * accumulatedFees) / totalLpSupply;
            
            // Total amount LP receives = winning reserves + fees
            collateralToReturn = lpShareOfWinningReserve + lpFeeShare;
            
            // CRITICAL FIX: Prevent burning LP tokens if collateral rounds to 0
            if (collateralToReturn == 0) revert ZeroCollateralReturn();
            
            // Update reserves: Deduct from winning outcome reserve
            if (lpShareOfWinningReserve > 0) {
                if (lpShareOfWinningReserve > reserves[config.winningOutcome]) {
                    reserves[config.winningOutcome] = 0; // Safety cap
                } else {
                    reserves[config.winningOutcome] -= lpShareOfWinningReserve;
                }
            }
            
            // Update totalReserves (only deduct the reserve share, NOT fees since they're tracked separately)
            if (lpShareOfWinningReserve > totalReserves) {
                totalReserves = 0; // Safety cap
            } else {
                totalReserves -= lpShareOfWinningReserve;
            }
            
            // Deduct fee share from accumulated fees (separate accounting)
            if (lpFeeShare > 0) {
                if (lpFeeShare > accumulatedFees) {
                    accumulatedFees = 0; // Safety cap
                } else {
                    accumulatedFees -= lpFeeShare;
                }
            }
            
            // Burn LP tokens and transfer collateral
            lpToken.burn(msg.sender, lpTokenAmount);
            
            // Only transfer if there's something to transfer
            if (collateralToReturn > 0) {
                collateralToken.safeTransfer(msg.sender, collateralToReturn);
            }
            
            emit LiquidityRemoved(msg.sender, lpTokenAmount, collateralToReturn);
            return;
        }

        // COMPLEX PATH: For active markets, apply fees and restrictions
        // Calculate collateral to return (proportional to LP share)
        collateralToReturn = (lpTokenAmount * totalReserves) / totalLpSupply;
        
        // CRITICAL FIX: Prevent burning LP tokens if collateral rounds to 0
        if (collateralToReturn == 0) revert ZeroCollateralReturn();
        
        // Apply early exit fee (1% fee)
        uint256 exitFee = (collateralToReturn * 100) / 10000; // 1% fee (100 basis points)
        collateralToReturn -= exitFee;
        
        // Distribute exit fee to remaining LPs (increases their share)
        accumulatedFees += exitFee;
        
        // Enforce minimum liquidity lock (prevent complete drain)
        if (minimumLiquidityLock > 0) {
            uint256 remainingReserves = totalReserves - collateralToReturn - exitFee;
            if (remainingReserves < minimumLiquidityLock) revert InsufficientLiquidity();
        }

        // Include pro-rata share of accumulated LP fees
        uint256 feeShare = (lpTokenAmount * accumulatedFees) / totalLpSupply;
        collateralToReturn += feeShare;

        // Calculate the amount to remove from reserves (before adding fee share)
        uint256 reserveDecrease = (lpTokenAmount * totalReserves) / totalLpSupply;

        // Update reserves proportionally
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            uint256 outcomeReserveDecrease = (lpTokenAmount * reserves[i]) / totalLpSupply;
            reserves[i] -= outcomeReserveDecrease;
        }
        
        // Update total reserves and accumulated fees
        totalReserves -= reserveDecrease;
        accumulatedFees -= feeShare;

        // Burn LP tokens from user
        lpToken.burn(msg.sender, lpTokenAmount);

        // Transfer collateral to user
        collateralToken.safeTransfer(msg.sender, collateralToReturn);

        emit LiquidityRemoved(msg.sender, lpTokenAmount, collateralToReturn);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Protocol Liquidity (PoL)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Seed protocol-owned liquidity (factory only)
     * @param amount Amount of collateral to seed
     */
    function seedProtocolLiquidity(uint256 amount) external onlyFactory nonReentrant {
        if (amount == 0) revert InvalidAmount();

        uint256 totalLpSupply = lpToken.totalSupply();
        uint256 lpTokensToMint;

        if (totalLpSupply == 0) {
            // Scale from 6 decimals (collateral) to 18 decimals (LP tokens)
            lpTokensToMint = amount * 1e12;
        } else {
            lpTokensToMint = (amount * totalLpSupply) / totalReserves;
        }

        // Transfer collateral from factory
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        // Distribute equally across outcomes
        uint256 perOutcome = amount / outcomeTokens.length;
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            reserves[i] += perOutcome;
        }
        totalReserves += amount;
        protocolLiquidity += amount;

        // Mint LP tokens to factory (protocol holds them)
        lpToken.mint(factory, lpTokensToMint);

        emit ProtocolLiquiditySeeded(amount, lpTokensToMint);
    }

    /**
     * @notice Withdraw protocol-owned liquidity (factory only)
     * @param lpTokenAmount Amount of LP tokens to burn
     * @param to Address to send collateral to
     */
    function withdrawProtocolLiquidity(uint256 lpTokenAmount, address to) external onlyFactory nonReentrant {
        if (lpTokenAmount == 0) revert InvalidAmount();
        if (to == address(0)) revert InvalidAddress();

        uint256 factoryLpBalance = lpToken.balanceOf(factory);
        if (factoryLpBalance < lpTokenAmount) revert InsufficientLiquidity();

        uint256 totalLpSupply = lpToken.totalSupply();

        // Calculate collateral to return
        uint256 collateralToReturn = (lpTokenAmount * totalReserves) / totalLpSupply;
        uint256 feeShare = (lpTokenAmount * accumulatedFees) / totalLpSupply;
        collateralToReturn += feeShare;

        // Update reserves proportionally
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            uint256 reserveDecrease = (lpTokenAmount * reserves[i]) / totalLpSupply;
            reserves[i] -= reserveDecrease;
        }
        totalReserves -= (collateralToReturn - feeShare);
        accumulatedFees -= feeShare;
        
        // Reduce protocol liquidity tracking
        if (protocolLiquidity > collateralToReturn) {
            protocolLiquidity -= collateralToReturn;
        } else {
            protocolLiquidity = 0;
        }

        // Burn LP tokens from factory
        lpToken.burn(factory, lpTokenAmount);

        // Transfer collateral to specified address
        collateralToken.safeTransfer(to, collateralToReturn);

        emit ProtocolLiquidityWithdrawn(lpTokenAmount, collateralToReturn);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Resolution & Claims
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Resolve the market with winning outcome
     * @param winningOutcome Index of the winning outcome
     * @dev Two resolution paths:
     *      1. Oracle (market creator) - Can resolve only after market end time
     *      2. Admin (platform admin) - Can resolve ANYTIME, even before end time
     *         Admin resolution immediately ends and resolves the market
     *         No restrictions for admin - allows early resolution for any reason
     */
    function resolve(uint256 winningOutcome) external {
        // Oracle resolution (market creator via oracle adapter)
        if (msg.sender == oracleAdapter) {
            // Oracle can only resolve after market has ended
            if (block.timestamp < config.endTime) revert MarketNotActive();
        }
        // Admin manual resolution (platform admin override)
        // Admin has NO restrictions - can resolve anytime, even before market end
        // This allows early resolution when results are known or for emergency situations
        else if (msg.sender == factory || msg.sender == owner()) {
            // Admin can resolve anytime - no checks needed
            // Resolving an active market effectively ends it early
        }
        // Unauthorized
        else {
            revert Unauthorized();
        }
        
        if (config.resolved) revert AlreadyResolved();
        if (winningOutcome >= outcomeTokens.length) revert InvalidOutcome();

        config.winningOutcome = winningOutcome;
        config.resolved = true;
        config.status = MarketStatus.RESOLVED;

        emit MarketResolved(winningOutcome, block.timestamp);
    }

    /**
     * @notice Claim all winnings after market resolution (backward compatibility)
     * @dev Convenience function that claims all available winnings
     */
    function claim() external nonReentrant {
        if (!config.resolved) revert MarketNotResolved();

        uint256 winningTokenBalance = outcomeTokens[config.winningOutcome].balanceOf(msg.sender);
        if (winningTokenBalance == 0) revert NoWinningTokens();

        // Claim all winning tokens
        _claimAmount(msg.sender, winningTokenBalance);
    }

    /**
     * @notice Claim partial winnings after market resolution
     * @param amount Amount of winning tokens to claim
     */
    function claim(uint256 amount) external nonReentrant {
        if (!config.resolved) revert MarketNotResolved();
        if (amount == 0) revert InvalidAmount();

        uint256 winningTokenBalance = outcomeTokens[config.winningOutcome].balanceOf(msg.sender);
        if (winningTokenBalance == 0) revert NoWinningTokens();
        if (amount > winningTokenBalance) revert InsufficientBalance();

        // Claim specified amount
        _claimAmount(msg.sender, amount);
    }

    // Conversion constant: 18-decimal tokens -> 6-decimal collateral
    uint256 private constant TOKEN_TO_COLLATERAL_DIV = 1e12;

    /**
     * @dev Internal claim logic with proportional payout
     * @notice CRITICAL: All arithmetic is done in collateral units (6 decimals) to avoid unit mismatch
     * @param user Address claiming winnings
     * @param tokenAmount Amount of winning tokens to claim (18 decimals)
     * 
     * @dev ROUNDING BEHAVIOR:
     * - Integer division truncates: tokenAmount / 1e12 rounds DOWN
     * - Amounts < 1e12 tokens (< 0.000001 USDC) will round to 0
     * - This is acceptable: loss is < $0.000001 USD (negligible)
     * - Ceiling rounding would give at most +0.000001 USDC (also negligible)
     * - Design choice: Truncation for simplicity and predictability
     */
    function _claimAmount(address user, uint256 tokenAmount) private {
        // Get total supply of winning tokens (18 decimals)
        uint256 totalWinningTokens = outcomeTokens[config.winningOutcome].totalSupply();
        if (totalWinningTokens == 0) revert NoWinningTokens();
        
        // Convert token quantities -> collateral units (6 decimals)
        // Note: Integer division truncates (rounds down) for safety
        uint256 totalWinningCollateral = totalWinningTokens / TOKEN_TO_COLLATERAL_DIV;
        uint256 userTokenCollateral = tokenAmount / TOKEN_TO_COLLATERAL_DIV;
        
        // Sum available collateral from all losing outcome reserves (already in 6 decimals)
        uint256 availableForWinners = 0;
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            if (i != config.winningOutcome) {
                availableForWinners += reserves[i];
            }
        }
        
        // Calculate payout in collateral units (6 decimals)
        uint256 payoutCollateral;
        if (availableForWinners >= totalWinningCollateral) {
            // Full 1:1: user gets their token amount expressed as collateral
            payoutCollateral = userTokenCollateral;
        } else {
            // Proportional payout based on collateral units
            if (totalWinningCollateral == 0) {
                payoutCollateral = 0;
            } else {
                payoutCollateral = (userTokenCollateral * availableForWinners) / totalWinningCollateral;
            }
        }
        
        // Burn winning tokens (tokenAmount is in 18-decimal token units)
        outcomeTokens[config.winningOutcome].burn(user, tokenAmount);

        // Track total claimed by user (store in collateral units, 6 decimals)
        partialClaimAmounts[user] += payoutCollateral;

        // Deduct payout from losing reserves proportionally (all in collateral units)
        uint256 remainingPayout = payoutCollateral;
        if (availableForWinners > 0 && payoutCollateral > 0) {
            for (uint256 i = 0; i < outcomeTokens.length && remainingPayout > 0; i++) {
                if (i == config.winningOutcome) continue;
                
                // Proportional deduction from this reserve
                uint256 deduction = (payoutCollateral * reserves[i]) / availableForWinners;
                
                // Safety caps
                if (deduction > reserves[i]) deduction = reserves[i];
                if (deduction > remainingPayout) deduction = remainingPayout;
                
                reserves[i] -= deduction;
                remainingPayout -= deduction;
            }
        }

        // Update totalReserves (deduct payoutCollateral, which is in 6 decimals)
        if (payoutCollateral >= totalReserves) {
            totalReserves = 0;
        } else {
            totalReserves -= payoutCollateral;
        }

        // Transfer collateral to user (collateral is 6-decimal USDC)
        if (payoutCollateral > 0) {
            collateralToken.safeTransfer(user, payoutCollateral);
        }

        emit WinningsClaimed(user, payoutCollateral, partialClaimAmounts[user]);
    }

    /**
     * @notice Cancel market and enable refunds
     * @param reason Explanation for why the market was canceled
     */
    function cancel(string calldata reason) external {
        if (msg.sender != factory && msg.sender != owner()) revert Unauthorized();
        if (config.resolved) revert AlreadyResolved();

        config.status = MarketStatus.CANCELED;
        cancellationReason = reason;
        emit MarketCanceled(reason);
    }

    /**
     * @notice Emergency function to sync totalReserves with actual USDC balance
     * @dev DEPRECATED: This function is kept for backward compatibility but should not be needed
     * @dev After v23 decimal fixes, reserves should never drift from actual balance
     * @dev If reserves are drifting, there's a bug in the contract logic that should be fixed
     * @dev Only callable by factory or owner
     * 
     * @dev WARNING: This function only updates totalReserves, not individual reserves[i]
     * @dev This can create inconsistency where sum(reserves[i]) != totalReserves
     * @dev Use with extreme caution and only as a last resort
     */
    function syncReserves() external {
        if (msg.sender != factory && msg.sender != owner()) revert Unauthorized();
        uint256 actualBalance = collateralToken.balanceOf(address(this));
        totalReserves = actualBalance;
        emit ReserveSynced(actualBalance);
    }

    /**
     * @notice Claim refund for canceled market
     * @dev Returns proportional share of collateral based on outcome tokens held
     *      Fees accumulated before cancellation are distributed proportionally
     *      Users get back 1:1 collateral for each outcome token they hold
     */
    function claimRefund() external nonReentrant {
        if (config.status != MarketStatus.CANCELED) revert MarketNotCanceled();
        
        uint256 totalRefund = 0;
        
        // User gets refund based on their actual investment (collateral spent)
        // This ensures fair refunds regardless of when they bought or at what price
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            uint256 tokenBalance = outcomeTokens[i].balanceOf(msg.sender);
            if (tokenBalance > 0) {
                // Burn the outcome tokens
                outcomeTokens[i].burn(msg.sender, tokenBalance);
                
                // Add user's investment for this outcome to refund
                // userInvestments is already in 6 decimals (collateral)
                totalRefund += userInvestments[msg.sender][i];
                
                // Clear the investment tracking
                userInvestments[msg.sender][i] = 0;
            }
        }
        
        if (totalRefund == 0) revert NoTokensToRefund();
        
        // Update total reserves (deduct the refund amount)
        if (totalRefund > totalReserves) {
            totalReserves = 0;
        } else {
            totalReserves -= totalRefund;
        }
        
        // Transfer refund in collateral decimals (6)
        collateralToken.safeTransfer(msg.sender, totalRefund);
        
        emit RefundClaimed(msg.sender, totalRefund);
    }

    /**
     * @notice Claim LP fee share based on LP token holdings
     * @dev LPs can claim their proportional share of accumulated trading fees
     *      CRITICAL: Can only claim on RESOLVED markets
     *      For canceled markets, fees remain in pool for proportional refunds
     */
    function claimLPFees() external nonReentrant {
        // CRITICAL: Only allow fee claims on resolved markets
        // Prevents LPs from draining fees before market ends
        // Ensures canceled markets have enough funds for refunds
        if (config.status != MarketStatus.RESOLVED) revert CanOnlyCollectOnResolvedMarkets();
        
        uint256 lpBalance = lpToken.balanceOf(msg.sender);
        if (lpBalance == 0) revert NoLPTokens();
        
        uint256 totalLPSupply = lpToken.totalSupply();
        if (totalLPSupply == 0) revert NoLPTokens();
        
        // Calculate proportional fee share
        uint256 feeShare = (accumulatedFees * lpBalance) / totalLPSupply;
        
        if (feeShare == 0) revert NoFeesToClaim();
        
        // Deduct from accumulated fees
        accumulatedFees -= feeShare;
        
        // Transfer fee share to LP
        collateralToken.safeTransfer(msg.sender, feeShare);
        
        emit LPFeesClaimed(msg.sender, feeShare);
    }

    /**
     * @notice Finalize market and distribute unclaimed losing reserves to LPs
     * @dev Can only be called after all winners have claimed OR claim period expired
     *      Moves unclaimed reserves to winning outcome so LPs can withdraw proportionally
     *      IMPORTANT: This doesn't give extra to any specific LP - it just makes reserves available
     *      Each LP gets their proportional share based on LP tokens held
     *      ADMIN ONLY: To ensure fair distribution, only admin can finalize after verification
     * @param claimDeadline Optional deadline after which unclaimed reserves can be distributed (0 = check supply only)
     */
    function finalizeMarket(uint256 claimDeadline) external nonReentrant {
        if (msg.sender != owner() && msg.sender != factory) revert Unauthorized();
        if (config.status != MarketStatus.RESOLVED) revert MarketNotResolved();
        
        // Check if all winners have claimed
        uint256 totalWinningTokens = outcomeTokens[config.winningOutcome].totalSupply();
        
        // Either all winners claimed OR claim deadline passed
        bool canFinalize = totalWinningTokens == 0 || 
                          (claimDeadline > 0 && block.timestamp > claimDeadline);
        
        if (!canFinalize) revert WinnersHaveNotClaimed();
        
        // Calculate total unclaimed reserves from losing outcomes
        uint256 unclaimedReserves = 0;
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            if (i != config.winningOutcome) {
                unclaimedReserves += reserves[i];
            }
        }
        
        if (unclaimedReserves == 0) revert NoUnclaimedReserves();
        
        // CRITICAL: Add unclaimed reserves to winning outcome reserves
        // This makes them available for ALL LPs to withdraw proportionally
        // Each LP's share is calculated as: (lpBalance / totalLpSupply) * reserves[winningOutcome]
        // So the distribution is automatically proportional!
        reserves[config.winningOutcome] += unclaimedReserves;
        
        // Zero out losing reserves
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            if (i != config.winningOutcome) {
                reserves[i] = 0;
            }
        }
        
        emit MarketFinalized(unclaimedReserves);
    }

    /**
     * @notice Close market (disable trading)
     */
    function close() external {
        if (msg.sender != factory && msg.sender != owner()) revert Unauthorized();
        if (config.status != MarketStatus.ACTIVE) revert MarketNotActive();

        config.status = MarketStatus.CLOSED;
        emit MarketClosed();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Oracle Integration
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Request oracle resolution (stub for Chainlink/API3 integration)
     * @param data Encoded data for oracle request
     */
    function requestOracleResolution(bytes calldata data) external {
        if (msg.sender != owner() && msg.sender != factory) revert Unauthorized();
        if (config.resolved) revert AlreadyResolved();

        // TODO: Implement Chainlink/API3 oracle request
        // This is a stub for future integration
        emit OracleResolutionRequested(data);
    }

    /**
     * @notice Fulfill oracle resolution (called by oracle adapter)
     * @param winningOutcome Index of winning outcome from oracle
     */
    function fulfillOracleResolution(uint256 winningOutcome) external {
        if (msg.sender != oracleAdapter) revert Unauthorized();
        if (config.resolved) revert AlreadyResolved();
        if (winningOutcome >= outcomeTokens.length) revert InvalidOutcome();

        config.winningOutcome = winningOutcome;
        config.resolved = true;
        config.status = MarketStatus.RESOLVED;

        emit MarketResolved(winningOutcome, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Pause/unpause market (emergency)
     * @param _paused New paused state
     */
    function pauseMarket(bool _paused) external {
        if (msg.sender != owner() && msg.sender != factory) revert Unauthorized();
        paused = _paused;
        emit MarketPaused(_paused);
    }

    /**
     * @notice Set LP token address (one-time setup if not done in initialize)
     * @param _lpToken LP token address
     */
    function setLPToken(address _lpToken) external onlyOwner {
        if (address(lpToken) != address(0)) revert Unauthorized(); // Can only set once
        if (_lpToken == address(0)) revert InvalidAddress();
        lpToken = LPToken(_lpToken);
    }

    /**
     * @notice Collect accumulated protocol fees (factory only)
     * @param to Address to send fees to
     * @dev Can only collect fees on RESOLVED markets
     *      For canceled markets, fees remain in pool for proportional refunds
     */
    function collectProtocolFee(address to) external onlyFactory {
        // CRITICAL: Only allow fee collection on resolved markets
        // Canceled markets: fees stay in pool for refunds
        // Active markets: fees locked until resolution
        if (config.status != MarketStatus.RESOLVED) revert CanOnlyCollectOnResolvedMarkets();
        
        if (to == address(0)) revert InvalidAddress();
        uint256 amount = accumulatedProtocolFees;
        if (amount == 0) revert InvalidAmount();

        accumulatedProtocolFees = 0;
        collateralToken.safeTransfer(to, amount);

        emit ProtocolFeeCollected(to, amount);
    }

    /**
     * @notice Update fee parameters (owner only)
     * @param _lpFeeBps New LP fee
     * @param _protocolFeeBps New protocol fee
     * @param _parlayFeeBps New parlay fee
     */
    function setFeeParams(
        uint256 _lpFeeBps,
        uint256 _protocolFeeBps,
        uint256 _parlayFeeBps
    ) external onlyOwner {
        if (_lpFeeBps + _protocolFeeBps > 1000) revert FeeTooHigh();
        if (_parlayFeeBps > 1000) revert FeeTooHigh();

        lpFeeBps = _lpFeeBps;
        protocolFeeBps = _protocolFeeBps;
        parlayFeeBps = _parlayFeeBps;
        
        // Update legacy feeBps for backward compatibility
        config.feeBps = _lpFeeBps + _protocolFeeBps;
    }

    /**
     * @notice Withdraw stuck tokens (emergency recovery)
     * @param token Token address to withdraw
     * @param to Address to send to
     * @param amount Amount to withdraw
     * @dev For collateral token, only allows withdrawal of funds beyond totalReserves
     * @dev accumulatedFees and accumulatedProtocolFees are already included in totalReserves
     */
    function withdrawStuckTokens(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (token == address(collateralToken)) {
            // For collateral token, ensure we don't withdraw reserves
            // Note: Fees are already part of totalReserves, so we only subtract totalReserves
            uint256 contractBalance = collateralToken.balanceOf(address(this));
            if (contractBalance <= totalReserves) revert InvalidAmount();
            uint256 maxWithdrawable = contractBalance - totalReserves;
            if (amount > maxWithdrawable) revert InvalidAmount();
        }
        
        IERC20(token).safeTransfer(to, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AMM Pricing Functions (CPMM Implementation)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @dev Calculate outcome tokens to mint when buying
     * Uses proper prediction market pricing: tokens = collateral / price
     * 
     * Formula: tokens_out = collateralIn / current_price
     * where current_price = reserve_i / totalReserves
     * 
     * This ensures:
     * - At 50% probability (reserve_i = totalReserves/2), each token costs ~$0.50
     * - At 80% probability (reserve_i = 0.8*totalReserves), each token costs ~$0.80
     * - Price reflects market probability
     * 
     * Example:
     * - Total reserves: 100 USDC
     * - YES reserve: 50 USDC (50% probability)
     * - Current price: 50/100 = 0.5 USDC per token
     * - User pays: 10 USDC
     * - Tokens out: 10 / 0.5 = 20 tokens ✅
     */
    function _calculateBuyAmount(
        uint256 outcomeIndex,
        uint256 collateralIn
    ) internal view returns (uint256) {
        if (totalReserves == 0) return 0;
        
        // Current price per token (in collateral terms)
        // price = reserve_i / totalReserves
        uint256 reserve = reserves[outcomeIndex];
        uint256 currentPrice = (reserve * PRECISION) / totalReserves;
        
        // Tokens out = collateral / price
        // Scale from collateral decimals (6) to outcome token decimals (18)
        // NOTE: Assumes USDC/stablecoin with 6 decimals (standard across all chains)
        // Multiply by 1e12 to convert from 6 decimals to 18 decimals
        uint256 tokensOut = (collateralIn * PRECISION * 1e12) / currentPrice;
        
        return tokensOut;
    }

    /**
     * @dev Calculate collateral to return when selling
     * Inverse of buy formula: collateral = tokens * price
     */
    function _calculateSellAmount(
        uint256 outcomeIndex,
        uint256 outcomeTokensIn
    ) internal view returns (uint256) {
        if (totalReserves == 0) return 0;
        
        // Current price per token
        uint256 reserve = reserves[outcomeIndex];
        uint256 currentPrice = (reserve * PRECISION) / totalReserves;
        
        // Collateral out = tokens * price
        // Scale from outcome token decimals (18) to collateral decimals (6)
        // NOTE: Assumes USDC/stablecoin with 6 decimals (standard across all chains)
        // Divide by 1e12 to convert from 18 decimals to 6 decimals
        uint256 collateralOut = (outcomeTokensIn * currentPrice) / PRECISION / 1e12;
        
        return collateralOut;
    }

    /**
     * @dev Normalize prices across all outcomes (Negrisk multi-outcome)
     * Ensures Σ prices = 1.0 (100%)
     */
    function _normalizePrices() internal {
        // Calculate total reserves
        uint256 total = 0;
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            total += reserves[i];
        }

        // Normalize each reserve proportionally
        // This ensures that selling one outcome rebalances all others
        if (total > 0 && total != totalReserves) {
            uint256 scaleFactor = (totalReserves * PRECISION) / total;
            for (uint256 i = 0; i < outcomeTokens.length; i++) {
                reserves[i] = (reserves[i] * scaleFactor) / PRECISION;
            }
            
            // CRITICAL: Recalculate totalReserves after normalization to prevent drift
            // This ensures totalReserves always equals the sum of reserves[]
            uint256 newTotal = 0;
            for (uint256 i = 0; i < outcomeTokens.length; i++) {
                newTotal += reserves[i];
            }
            totalReserves = newTotal;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Internal Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @dev Initialize reserves without minting LP tokens (called during initialization)
     * @param initialLiquidity Amount of initial liquidity
     * @param creator Address that will receive LP tokens later
     */
    function _initializeReserves(uint256 initialLiquidity, address creator) private {
        uint256 numOutcomes = outcomeTokens.length;
        uint256 perOutcome = initialLiquidity / numOutcomes;
        uint256 remainder = initialLiquidity % numOutcomes;

        for (uint256 i = 0; i < numOutcomes; i++) {
            reserves[i] = perOutcome;
            // Add remainder to first outcome to ensure sum equals totalReserves
            if (i == 0) {
                reserves[i] += remainder;
            }
        }

        totalReserves = initialLiquidity;
        // Note: LP tokens will be minted later via completeLPInitialization()
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Get current price for an outcome
     * @param outcomeIndex Index of the outcome
     * @return price Price in basis points (10000 = 100%)
     */
    function getPrice(uint256 outcomeIndex) external view returns (uint256 price) {
        if (totalReserves == 0) return 0;
        // Price = reserve / totalReserves (as percentage)
        price = (reserves[outcomeIndex] * 10000) / totalReserves;
    }

    /**
     * @notice Get all outcome prices
     * @return prices Array of prices in basis points
     */
    function getAllPrices() external view returns (uint256[] memory prices) {
        prices = new uint256[](outcomeTokens.length);
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            if (totalReserves > 0) {
                prices[i] = (reserves[i] * 10000) / totalReserves;
            }
        }
    }

    /**
     * @notice Get trading volume for all outcomes
     * @return volumes Array of volumes per outcome (in collateral units)
     */
    function getAllVolumes() external view returns (uint256[] memory volumes) {
        volumes = new uint256[](outcomeTokens.length);
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            volumes[i] = volumePerOutcome[i];
        }
    }

    /**
     * @notice Preview buy trade - calculate how many outcome tokens you'll receive
     * @dev Used by frontend to show estimated output and calculate price impact
     * @param outcomeIndex Index of the outcome to buy
     * @param collateralAmount Amount of collateral to spend
     * @return outcomeTokenAmount Estimated outcome tokens you'll receive (after fees)
     */
    function calculateBuyPrice(
        uint256 outcomeIndex,
        uint256 collateralAmount
    ) external view returns (uint256 outcomeTokenAmount) {
        if (outcomeIndex >= outcomeTokens.length) revert InvalidOutcome();
        if (collateralAmount == 0) return 0;
        
        // Calculate fees (same as buy() function)
        uint256 lpFee = (collateralAmount * lpFeeBps) / 10000;
        uint256 protocolFee = (collateralAmount * protocolFeeBps) / 10000;
        uint256 totalFee = lpFee + protocolFee;
        uint256 collateralAfterFee = collateralAmount - totalFee;
        
        // Calculate outcome tokens (same as buy() function)
        return _calculateBuyAmount(outcomeIndex, collateralAfterFee);
    }

    /**
     * @notice Preview sell trade - calculate how much collateral you'll receive
     * @dev Used by frontend to show estimated output and calculate price impact
     * @param outcomeIndex Index of the outcome to sell
     * @param outcomeTokenAmount Amount of outcome tokens to sell
     * @return collateralAmount Estimated collateral you'll receive (after fees)
     */
    function calculateSellPrice(
        uint256 outcomeIndex,
        uint256 outcomeTokenAmount
    ) external view returns (uint256 collateralAmount) {
        if (outcomeIndex >= outcomeTokens.length) revert InvalidOutcome();
        if (outcomeTokenAmount == 0) return 0;
        
        // Calculate collateral to return (same as sell() function)
        uint256 collateralToReturn = _calculateSellAmount(outcomeIndex, outcomeTokenAmount);
        
        // Calculate fees (same as sell() function)
        uint256 lpFee = (collateralToReturn * lpFeeBps) / 10000;
        uint256 protocolFee = (collateralToReturn * protocolFeeBps) / 10000;
        uint256 totalFee = lpFee + protocolFee;
        
        return collateralToReturn - totalFee;
    }

    /**
     * @notice Get market info
     */
    function getMarketInfo() external view returns (
        string memory question,
        string[] memory outcomeNames,
        uint256 endTime,
        MarketStatus status,
        bool resolved,
        uint256 winningOutcome
    ) {
        return (
            config.question,
            outcomes,
            config.endTime,
            config.status,
            config.resolved,
            config.winningOutcome
        );
    }

    /**
     * @notice Get outcome token address
     */
    function getOutcomeToken(uint256 index) external view returns (address) {
        return address(outcomeTokens[index]);
    }

    /**
     * @notice Get number of outcomes
     */
    function getOutcomeCount() external view returns (uint256) {
        return outcomeTokens.length;
    }

    /**
     * @notice Get total LP token supply
     */
    function getTotalLpTokens() external view returns (uint256) {
        return lpToken.totalSupply();
    }

    /**
     * @notice Get LP token balance of an address
     */
    function getLpBalance(address account) external view returns (uint256) {
        return lpToken.balanceOf(account);
    }

    /**
     * @notice Check if any trading activity occurred
     * @dev Returns false if only initial liquidity exists (no trades happened)
     *      Useful for admin to decide whether to cancel or resolve markets
     */
    function hasTradingActivity() external view returns (bool) {
        // Check if any outcome tokens were minted beyond initial reserves
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            if (outcomeTokens[i].totalSupply() > 0) {
                return true; // Tokens minted = trading happened
            }
        }
        
        // Check if protocol/LP fees accumulated (indicates trading)
        if (accumulatedFees > 0 || accumulatedProtocolFees > 0) {
            return true;
        }
        
        return false; // No trading activity
    }

    /**
     * @notice Get user's parlay position for a specific outcome
     * @param user User address
     * @param outcomeIndex Outcome index
     * @return amount Amount of outcome tokens in parlay position
     */
    function getParlayPosition(address user, uint256 outcomeIndex) external view returns (uint256) {
        return parlayPositions[user][outcomeIndex];
    }

    /**
     * @notice Get user's total parlay positions across all outcomes
     * @param user User address
     * @return positions Array of parlay positions for each outcome
     */
    function getAllParlayPositions(address user) external view returns (uint256[] memory positions) {
        positions = new uint256[](outcomeTokens.length);
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            positions[i] = parlayPositions[user][i];
        }
    }

    /**
     * @notice Get claimable amount for a user's position in a specific outcome
     * @dev Calculates what the user would receive if this outcome wins (based on current reserves)
     * @param user The user's address
     * @param outcomeIndex The outcome index to check
     * @return claimableAmount The amount of collateral (USDC, 6 decimals) the user can claim if this outcome wins
     */
    function getClaimableAmount(address user, uint256 outcomeIndex) external view returns (uint256 claimableAmount) {
        if (outcomeIndex >= outcomeTokens.length) revert InvalidOutcome();
        
        // Get user's balance of this outcome token (18 decimals)
        uint256 userBalance = outcomeTokens[outcomeIndex].balanceOf(user);
        if (userBalance == 0) return 0;

        // Get total supply of this outcome's tokens (18 decimals)
        uint256 totalSupply = outcomeTokens[outcomeIndex].totalSupply();
        if (totalSupply == 0) return 0;

        // Convert to collateral units (6 decimals)
        uint256 userBalanceCollateral = userBalance / TOKEN_TO_COLLATERAL_DIV;
        uint256 totalSupplyCollateral = totalSupply / TOKEN_TO_COLLATERAL_DIV;

        // Calculate losing reserves (sum of all OTHER outcomes, already in 6 decimals)
        uint256 losingReserves = 0;
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            if (i != outcomeIndex) {
                losingReserves += reserves[i];
            }
        }

        // Calculate proportional payout from losing reserves (in collateral units)
        if (losingReserves >= totalSupplyCollateral) {
            claimableAmount = userBalanceCollateral;
        } else {
            if (totalSupplyCollateral == 0) {
                claimableAmount = 0;
            } else {
                claimableAmount = (userBalanceCollateral * losingReserves) / totalSupplyCollateral;
            }
        }
    }

    /**
     * @notice Get claimable amounts for all outcomes for a user
     * @dev Returns an array showing what the user would get if each outcome wins
     * @param user The user's address
     * @return claimableAmounts Array of claimable amounts (one per outcome, in 6-decimal USDC)
     */
    function getAllClaimableAmounts(address user) external view returns (uint256[] memory claimableAmounts) {
        claimableAmounts = new uint256[](outcomeTokens.length);
        
        for (uint256 i = 0; i < outcomeTokens.length; i++) {
            // Get user's balance of this outcome token (18 decimals)
            uint256 userBalance = outcomeTokens[i].balanceOf(user);
            if (userBalance == 0) {
                claimableAmounts[i] = 0;
                continue;
            }

            // Get total supply of this outcome's tokens (18 decimals)
            uint256 totalSupply = outcomeTokens[i].totalSupply();
            if (totalSupply == 0) {
                claimableAmounts[i] = 0;
                continue;
            }

            // Convert to collateral units (6 decimals)
            uint256 userBalanceCollateral = userBalance / TOKEN_TO_COLLATERAL_DIV;
            uint256 totalSupplyCollateral = totalSupply / TOKEN_TO_COLLATERAL_DIV;

            // Calculate losing reserves (sum of all OTHER outcomes, already in 6 decimals)
            uint256 losingReserves = 0;
            for (uint256 j = 0; j < outcomeTokens.length; j++) {
                if (j != i) {
                    losingReserves += reserves[j];
                }
            }

            // Calculate proportional payout (in collateral units)
            if (losingReserves >= totalSupplyCollateral) {
                claimableAmounts[i] = userBalanceCollateral;
            } else {
                if (totalSupplyCollateral == 0) {
                    claimableAmounts[i] = 0;
                } else {
                    claimableAmounts[i] = (userBalanceCollateral * losingReserves) / totalSupplyCollateral;
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UUPS Upgrade Authorization
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @dev Authorize upgrade
     * Only the factory (owner) can upgrade markets
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
