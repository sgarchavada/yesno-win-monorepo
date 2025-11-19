// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Market} from "./Market.sol";
import {OutcomeToken} from "./OutcomeToken.sol";
import {LPToken} from "./LPToken.sol";
import {CreatorRegistry} from "./CreatorRegistry.sol";

/**
 * @title MarketFactory
 * @notice Factory contract for creating and managing Polymarket-style prediction markets
 * @dev Entry point for the entire prediction market system
 * 
 * Responsibilities:
 * - Deploy new Market contracts (with UUPS proxies)
 * - Deploy OutcomeToken and LPToken contracts for each market
 * - Maintain registry of all markets
 * - Manage platform fees (LP fees + protocol fees + parlay fees)
 * - Collect protocol fees and route to treasury
 * - Seed and manage protocol-owned liquidity (PoL)
 * - Manage oracle adapter
 * - Emergency controls (pause, cancel markets)
 * 
 * Architecture:
 * - Uses UUPS proxy pattern for upgradeability
 * - Each Market is deployed as a proxy to a single implementation
 * - Outcome tokens and LP tokens are deployed as proxies
 * - Factory retains control for resolution and emergency actions
 */
contract MarketFactory is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    AccessControlUpgradeable
{
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    using SafeERC20 for IERC20;
    
    // Modifier to check if caller is owner OR admin
    modifier onlyAdmin() {
        require(
            owner() == _msgSender() || hasRole(ADMIN_ROLE, _msgSender()),
            "MarketFactory: caller is not owner or admin"
        );
        _;
    }

    // Modifier to check if caller can create markets (delegates to CreatorRegistry)
    modifier onlyCreator() {
        require(
            address(creatorRegistry) != address(0) && creatorRegistry.canCreateMarkets(_msgSender()),
            "MarketFactory: caller is not authorized to create markets"
        );
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v1 - Original variables)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Array of all created markets
    address[] public allMarkets;

    /// @notice Mapping from market address to market index
    mapping(address => uint256) public marketIndex;

    /// @notice Mapping to check if address is a valid market
    mapping(address => bool) public isMarket;

    /// @notice DEPRECATED: Default platform fee (use defaultLpFeeBps + defaultProtocolFeeBps)
    uint256 public defaultFeeBps;

    /// @notice DEPRECATED: Fee collector address (use treasury instead)
    address public feeCollector;

    /// @notice Oracle adapter for market resolution
    address public oracleAdapter;

    /// @notice Creator registry for creator management
    CreatorRegistry public creatorRegistry;

    /// @notice Default collateral token (e.g., USDC)
    address public defaultCollateralToken;

    /// @notice Market implementation contract (for UUPS proxies)
    address public marketImplementation;

    /// @notice OutcomeToken implementation contract (for UUPS proxies)
    address public outcomeTokenImplementation;

    /// @notice Minimum initial liquidity required
    uint256 public minInitialLiquidity;

    /// @notice Maximum number of outcomes allowed
    uint256 public maxOutcomes;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v2 - New variables, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Treasury address (receives protocol fees)
    address public treasury;

    /// @notice Default LP fee in basis points (stays in pool for LPs)
    uint256 public defaultLpFeeBps;

    /// @notice Default protocol fee in basis points (routed to treasury)
    uint256 public defaultProtocolFeeBps;

    /// @notice Default parlay fee in basis points (charged on parlay trades)
    uint256 public defaultParlayFeeBps;

    /// @notice LPToken implementation contract (for UUPS proxies)
    address public lpTokenImplementation;

    /// @notice Total protocol fees collected across all markets
    uint256 public totalProtocolFeesCollected;

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage (v3 - Market creation fee, APPENDED for upgrade safety)
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Fee charged for creating a market (in collateral tokens, e.g., 5 USDC)
    /// @dev Set to 0 to disable creation fees
    uint256 public marketCreationFee;

    /// @notice Total creation fees collected
    uint256 public totalCreationFeesCollected;

    // ─────────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────────

    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed lpToken,
        string question,
        string[] outcomes,
        uint256 endTime,
        address collateralToken,
        uint256 initialLiquidity
    );

    event MarketResolved(
        address indexed market,
        uint256 indexed winningOutcome
    );

    event MarketPaused(
        address indexed market,
        bool paused
    );

    event ProtocolLiquiditySeeded(
        address indexed market,
        uint256 amount
    );

    event ProtocolLiquidityWithdrawn(
        address indexed market,
        uint256 amount,
        address indexed to
    );

    event ProtocolFeeCollected(
        address indexed market,
        uint256 amount,
        address indexed to
    );

    event ParlayFeeCollected(
        address indexed market,
        uint256 amount
    );

    event FeeParamsUpdated(
        uint256 lpFeeBps,
        uint256 protocolFeeBps,
        uint256 parlayFeeBps
    );

    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );

    event ImplementationsUpdated(address marketImpl, address outcomeTokenImpl, address lpTokenImpl);
    event OracleAdapterUpdated(address indexed oldOracle, address indexed newOracle);
    event DefaultCollateralUpdated(address indexed oldToken, address indexed newToken);
    event DefaultFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event MarketCreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event CreationFeeCollected(address indexed creator, uint256 amount);
    event CreatorRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event MarketUpgraded(address indexed market, address indexed newImplementation);
    event BatchMarketUpgrade(uint256 startIndex, uint256 endIndex, uint256 upgraded);

    // ─────────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────────

    error InvalidAddress();
    error InvalidFee();
    error InvalidOutcomeCount();
    error InvalidEndTime();
    error InsufficientLiquidity();
    error MarketNotFound();
    error NotMarket();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────────

    function initialize(
        address _defaultCollateralToken,
        address _treasury,
        address _oracleAdapter,
        address _creatorRegistry,
        uint256 _defaultLpFeeBps,
        uint256 _defaultProtocolFeeBps,
        uint256 _defaultParlayFeeBps,
        uint256 _minInitialLiquidity,
        address _marketImpl,
        address _outcomeTokenImpl,
        address _lpTokenImpl
    ) external initializer {
        if (_defaultCollateralToken == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();
        if (_oracleAdapter == address(0)) revert InvalidAddress();
        if (_creatorRegistry == address(0)) revert InvalidAddress();
        if (_marketImpl == address(0)) revert InvalidAddress();
        if (_outcomeTokenImpl == address(0)) revert InvalidAddress();
        if (_lpTokenImpl == address(0)) revert InvalidAddress();
        if (_defaultLpFeeBps + _defaultProtocolFeeBps > 1000) revert InvalidFee();
        if (_defaultParlayFeeBps > 1000) revert InvalidFee();

        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __AccessControl_init();
        
        // Grant admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        defaultCollateralToken = _defaultCollateralToken;
        treasury = _treasury;
        feeCollector = _treasury;
        oracleAdapter = _oracleAdapter;
        creatorRegistry = CreatorRegistry(_creatorRegistry);
        defaultLpFeeBps = _defaultLpFeeBps;
        defaultProtocolFeeBps = _defaultProtocolFeeBps;
        defaultParlayFeeBps = _defaultParlayFeeBps;
        defaultFeeBps = _defaultLpFeeBps + _defaultProtocolFeeBps;
        minInitialLiquidity = _minInitialLiquidity;
        maxOutcomes = 20;
        marketImplementation = _marketImpl;
        outcomeTokenImplementation = _outcomeTokenImpl;
        lpTokenImplementation = _lpTokenImpl;
        
        // Set default market creation fee (5 USDC with 6 decimals)
        marketCreationFee = 5 * 10**6; // 5 USDC

        emit ImplementationsUpdated(_marketImpl, _outcomeTokenImpl, _lpTokenImpl);
    }

    /**
     * @notice Setup AccessControl roles after contract upgrade
     * @dev This function can only be called by the owner and only once
     *      Used to initialize AccessControl after upgrading from a version without it
     * @param admin Address to grant ADMIN_ROLE to (typically the owner)
     */
    function setupAccessControl(address admin) external onlyOwner {
        require(admin != address(0), "MarketFactory: invalid admin address");
        require(!hasRole(DEFAULT_ADMIN_ROLE, owner()), "MarketFactory: AccessControl already setup");
        
        // Grant DEFAULT_ADMIN_ROLE to the owner
        _grantRole(DEFAULT_ADMIN_ROLE, owner());
        
        // Grant ADMIN_ROLE to the specified admin
        _grantRole(ADMIN_ROLE, admin);
        
        emit AdminAdded(admin);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Market Creation
    // ─────────────────────────────────────────────────────────────────────────────

    function createMarket(
        string memory question,
        string[] memory outcomes,
        uint256 endTime,
        address collateralToken,
        uint256 initialLiquidity,
        uint256 lpFeeBps,
        uint256 protocolFeeBps,
        uint256 parlayFeeBps
    ) external onlyCreator returns (address market) {
        return _createMarketInternal(question, outcomes, endTime, collateralToken, initialLiquidity, lpFeeBps, protocolFeeBps, parlayFeeBps);
    }

    function createMarket(
        string memory question,
        string[] memory outcomes,
        uint256 endTime,
        address collateralToken,
        uint256 initialLiquidity,
        uint256 feeBps
    ) external onlyCreator returns (address market) {
        return _createMarketInternal(question, outcomes, endTime, collateralToken, initialLiquidity, feeBps / 2, feeBps - (feeBps / 2), defaultParlayFeeBps);
    }


    /**
     * @dev Internal market creation logic (shared between both signatures)
     */
    function _createMarketInternal(
        string memory question,
        string[] memory outcomes,
        uint256 endTime,
        address collateralToken,
        uint256 initialLiquidity,
        uint256 lpFeeBps,
        uint256 protocolFeeBps,
        uint256 parlayFeeBps
    ) private returns (address market) {
        // Validations
        if (outcomes.length < 2 || outcomes.length > maxOutcomes) {
            revert InvalidOutcomeCount();
        }
        
        // Validate no duplicate outcome names
        for (uint256 i = 0; i < outcomes.length; i++) {
            // Check for empty outcome names
            if (bytes(outcomes[i]).length == 0) {
                revert InvalidOutcomeCount(); // Reusing error for empty names
            }
            
            // Check for duplicates
            for (uint256 j = i + 1; j < outcomes.length; j++) {
                if (keccak256(bytes(outcomes[i])) == keccak256(bytes(outcomes[j]))) {
                    revert InvalidOutcomeCount(); // Reusing error for duplicates
                }
            }
        }
        
        if (endTime <= block.timestamp) revert InvalidEndTime();
        if (initialLiquidity < minInitialLiquidity) revert InsufficientLiquidity();
        
        // Charge market creation fee (if enabled)
        if (marketCreationFee > 0) {
            // Use collateralToken (default or specified)
            address feeToken = collateralToken == address(0) ? defaultCollateralToken : collateralToken;
            
            // Transfer creation fee from creator to treasury
            IERC20(feeToken).safeTransferFrom(msg.sender, treasury, marketCreationFee);
            
            // Track total creation fees
            totalCreationFeesCollected += marketCreationFee;
            
            emit CreationFeeCollected(msg.sender, marketCreationFee);
        }
        
        // Use defaults if not specified
        if (collateralToken == address(0)) {
            collateralToken = defaultCollateralToken;
        }
        if (lpFeeBps == 0 && protocolFeeBps == 0) {
            lpFeeBps = defaultLpFeeBps;
            protocolFeeBps = defaultProtocolFeeBps;
        }
        if (parlayFeeBps == 0) {
            parlayFeeBps = defaultParlayFeeBps;
        }

        // Validate fees
        if (lpFeeBps + protocolFeeBps > 1000) revert InvalidFee();
        if (parlayFeeBps > 1000) revert InvalidFee();

        // Transfer initial liquidity from creator
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), initialLiquidity);

        // Deploy LPToken
        address lpToken = address(new ERC1967Proxy(lpTokenImplementation, ""));

        // Deploy outcome tokens
        address[] memory outcomeTokenAddresses = new address[](outcomes.length);
        for (uint256 i = 0; i < outcomes.length; i++) {
            outcomeTokenAddresses[i] = address(new ERC1967Proxy(outcomeTokenImplementation, ""));
        }

        // Deploy market
        bytes memory marketInitData = abi.encodeWithSelector(
            Market.initialize.selector,
            address(this),
            msg.sender,
            collateralToken,
            lpToken,
            question,
            outcomes,
            outcomeTokenAddresses,
            endTime,
            lpFeeBps,
            protocolFeeBps,
            parlayFeeBps,
            initialLiquidity
        );
        market = address(new ERC1967Proxy(marketImplementation, marketInitData));

        // Initialize LP token
        LPToken(lpToken).initialize(market, string(abi.encodePacked("LP-", question)), "YNLP");

        // Initialize outcome tokens
        for (uint256 i = 0; i < outcomeTokenAddresses.length; i++) {
            OutcomeToken(outcomeTokenAddresses[i]).initialize(
                market,
                i,
                outcomes[i],
                string(abi.encodePacked("Outcome ", _toString(i), ": ", outcomes[i]))
            );
        }

        // Transfer initial liquidity to market
        IERC20(collateralToken).safeTransfer(market, initialLiquidity);

        // Complete LP initialization
        Market(market).completeLPInitialization(msg.sender, initialLiquidity);

        // Register market
        allMarkets.push(market);
        marketIndex[market] = allMarkets.length - 1;
        isMarket[market] = true;
        
        // Track creator in CreatorRegistry
        creatorRegistry.trackMarket(market, msg.sender);

        emit MarketCreated(
            market,
            msg.sender,
            lpToken,
            question,
            outcomes,
            endTime,
            collateralToken,
            initialLiquidity
        );
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }


    // ─────────────────────────────────────────────────────────────────────────────
    // Protocol Liquidity Management
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Seed protocol-owned liquidity in a market
     * @param market Market address
     * @param amount Amount of collateral to seed
     */
    function seedMarketLiquidity(address market, uint256 amount) external onlyAdmin {
        if (!isMarket[market]) revert NotMarket();
        
        // Get market's collateral token
        IERC20 collateralToken = IERC20(Market(market).collateralToken());
        
        // Transfer collateral from owner to factory
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve market to spend collateral
        collateralToken.approve(market, amount);
        
        // Call market's seedProtocolLiquidity function
        Market(market).seedProtocolLiquidity(amount);

        emit ProtocolLiquiditySeeded(market, amount);
    }

    /**
     * @notice Withdraw protocol-owned liquidity from a market
     * @param market Market address
     * @param lpTokenAmount Amount of LP tokens to burn
     * @param to Address to send withdrawn collateral to
     */
    function withdrawProtocolLiquidity(
        address market,
        uint256 lpTokenAmount,
        address to
    ) external onlyOwner {
        if (!isMarket[market]) revert NotMarket();
        if (to == address(0)) revert InvalidAddress();

        // Call market's withdrawProtocolLiquidity function
        Market(market).withdrawProtocolLiquidity(lpTokenAmount, to);

        emit ProtocolLiquidityWithdrawn(market, lpTokenAmount, to);
    }

    /**
     * @notice Collect accumulated protocol fees from a market
     * @param market Market address
     * @param to Address to send fees to (typically treasury)
     */
    function collectProtocolFees(address market, address to) external onlyAdmin {
        if (!isMarket[market]) revert NotMarket();
        if (to == address(0)) to = treasury;

        uint256 feesBefore = IERC20(Market(market).collateralToken()).balanceOf(to);
        
        // Call market's collectProtocolFee function
        Market(market).collectProtocolFee(to);

        uint256 feesAfter = IERC20(Market(market).collateralToken()).balanceOf(to);
        uint256 feesCollected = feesAfter - feesBefore;

        totalProtocolFeesCollected += feesCollected;

        emit ProtocolFeeCollected(market, feesCollected, to);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Market Management
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Resolve a market with winning outcome
     * @param market Address of the market to resolve
     * @param winningOutcome Index of the winning outcome
     */
    function resolveMarket(address market, uint256 winningOutcome) external onlyAdmin {
        if (!isMarket[market]) revert NotMarket();

        Market(market).resolve(winningOutcome);

        emit MarketResolved(market, winningOutcome);
    }

    /**
     * @notice Pause/unpause a market
     * @param market Address of the market
     * @param paused New paused state
     */
    function pauseMarket(address market, bool paused) external onlyAdmin {
        if (!isMarket[market]) revert NotMarket();
        
        Market(market).pauseMarket(paused);

        emit MarketPaused(market, paused);
    }

    /**
     * @notice Close a market (disable trading)
     * @param market Address of the market to close
     */
    function closeMarket(address market) external onlyAdmin {
        if (!isMarket[market]) revert NotMarket();
        Market(market).close();
    }

    /**
     * @notice Cancel a market
     * @param market Address of the market to cancel
     * @param reason Explanation for why the market is being canceled
     */
    function cancelMarket(address market, string calldata reason) external onlyAdmin {
        if (!isMarket[market]) revert NotMarket();
        Market(market).cancel(reason);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Market Upgrades
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Upgrade a single market to a new implementation
     * @param market Address of the market to upgrade
     * @param newImplementation Address of the new Market implementation
     * @dev Only admin can upgrade markets. This allows fixing bugs in existing markets.
     */
    function upgradeMarket(address market, address newImplementation) external onlyAdmin {
        if (!isMarket[market]) revert NotMarket();
        if (newImplementation == address(0)) revert InvalidAddress();
        
        // Market contract is owned by this factory, so we can upgrade it
        Market(market).upgradeToAndCall(newImplementation, "");
        
        emit MarketUpgraded(market, newImplementation);
    }

    /**
     * @notice Upgrade all markets to the current marketImplementation
     * @dev This is a batch operation that upgrades all existing markets.
     *      Gas intensive - may need to be called multiple times for large numbers of markets.
     * @param startIndex Starting index in the markets array
     * @param count Number of markets to upgrade (0 = upgrade all remaining)
     */
    function upgradeAllMarkets(uint256 startIndex, uint256 count) external onlyAdmin {
        uint256 totalMarkets = allMarkets.length;
        
        if (startIndex >= totalMarkets) revert("Start index out of bounds");
        
        uint256 endIndex = count == 0 
            ? totalMarkets 
            : (startIndex + count > totalMarkets ? totalMarkets : startIndex + count);
        
        uint256 upgraded = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            address market = allMarkets[i];
            
            // Skip if market is already on latest implementation
            try Market(market).proxiableUUID() returns (bytes32) {
                // Market is upgradeable, proceed with upgrade
                Market(market).upgradeToAndCall(marketImplementation, "");
                upgraded++;
                emit MarketUpgraded(market, marketImplementation);
            } catch {
                // Skip markets that can't be upgraded
                continue;
            }
        }
        
        emit BatchMarketUpgrade(startIndex, endIndex, upgraded);
    }

    /**
     * @notice Check if a market needs upgrading
     * @param market Address of the market
     * @return needsUpgrade True if the market is not on the latest implementation
     */
    function marketNeedsUpgrade(address market) external view returns (bool needsUpgrade) {
        if (!isMarket[market]) revert NotMarket();
        
        // Try to get the proxiableUUID - if it fails, market might need upgrade
        try Market(market).proxiableUUID() returns (bytes32) {
            // Market is upgradeable and responds
            // Note: We can't directly compare implementations without a getter
            // This just checks if the market is upgradeable
            needsUpgrade = false;
        } catch {
            // Market doesn't respond to proxiableUUID
            needsUpgrade = true;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update treasury address
     */
    function setTreasury(address newTreasury) external onlyAdmin {
        if (newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        feeCollector = newTreasury; // Backward compatibility
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update default fee parameters
     */
    function setFeeParams(
        uint256 _lpFeeBps,
        uint256 _protocolFeeBps,
        uint256 _parlayFeeBps
    ) external onlyAdmin {
        if (_lpFeeBps + _protocolFeeBps > 1000) revert InvalidFee();
        if (_parlayFeeBps > 1000) revert InvalidFee();

        defaultLpFeeBps = _lpFeeBps;
        defaultProtocolFeeBps = _protocolFeeBps;
        defaultParlayFeeBps = _parlayFeeBps;
        defaultFeeBps = _lpFeeBps + _protocolFeeBps; // Backward compatibility

        emit FeeParamsUpdated(_lpFeeBps, _protocolFeeBps, _parlayFeeBps);
    }


    /**
     * @notice Update oracle adapter
     */
    function setOracleAdapter(address newOracle) external onlyAdmin {
        if (newOracle == address(0)) revert InvalidAddress();
        address oldOracle = oracleAdapter;
        oracleAdapter = newOracle;
        emit OracleAdapterUpdated(oldOracle, newOracle);
    }

    /**
     * @notice Update default collateral token
     */
    function setDefaultCollateral(address newToken) external onlyAdmin {
        if (newToken == address(0)) revert InvalidAddress();
        address oldToken = defaultCollateralToken;
        defaultCollateralToken = newToken;
        emit DefaultCollateralUpdated(oldToken, newToken);
    }

    /**
     * @notice Update default platform fee (backward compatibility)
     */
    function setDefaultFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidFee();
        uint256 oldFee = defaultFeeBps;
        defaultLpFeeBps = newFeeBps / 2;
        defaultProtocolFeeBps = newFeeBps - defaultLpFeeBps;
        defaultFeeBps = newFeeBps;
        emit DefaultFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Update fee collector address (backward compatibility)
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        if (newCollector == address(0)) revert InvalidAddress();
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        treasury = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    /**
     * @notice Update implementation contracts
     */
    function setImplementations(
        address newMarketImpl,
        address newOutcomeTokenImpl,
        address newLPTokenImpl
    ) external onlyOwner {
        if (newMarketImpl == address(0) || newOutcomeTokenImpl == address(0) || newLPTokenImpl == address(0)) {
            revert InvalidAddress();
        }
        marketImplementation = newMarketImpl;
        outcomeTokenImplementation = newOutcomeTokenImpl;
        lpTokenImplementation = newLPTokenImpl;
        emit ImplementationsUpdated(newMarketImpl, newOutcomeTokenImpl, newLPTokenImpl);
    }

    /**
     * @notice Update implementation contracts (legacy - 2 params)
     */
    function setImplementations(
        address newMarketImpl,
        address newOutcomeTokenImpl
    ) external onlyOwner {
        if (newMarketImpl == address(0) || newOutcomeTokenImpl == address(0)) {
            revert InvalidAddress();
        }
        marketImplementation = newMarketImpl;
        outcomeTokenImplementation = newOutcomeTokenImpl;
        emit ImplementationsUpdated(newMarketImpl, newOutcomeTokenImpl, lpTokenImplementation);
    }


    /**
     * @notice Update minimum initial liquidity
     */
    function setMinInitialLiquidity(uint256 newMin) external onlyAdmin {
        minInitialLiquidity = newMin;
    }

    /**
     * @notice Update maximum outcomes
     */
    function setMaxOutcomes(uint256 newMax) external onlyAdmin {
        maxOutcomes = newMax;
    }

    /**
     * @notice Update market creation fee
     * @param newFee New creation fee in collateral token units (e.g., 5 * 10**6 for 5 USDC)
     * @dev Set to 0 to disable creation fees
     */
    function setMarketCreationFee(uint256 newFee) external onlyAdmin {
        uint256 oldFee = marketCreationFee;
        marketCreationFee = newFee;
        emit MarketCreationFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice Update CreatorRegistry address
     * @param newRegistry New CreatorRegistry contract address (use PROXY address!)
     * @dev Only admin can update this to fix deployment mistakes
     */
    function setCreatorRegistry(address newRegistry) external onlyAdmin {
        if (newRegistry == address(0)) revert InvalidAddress();
        address oldRegistry = address(creatorRegistry);
        creatorRegistry = CreatorRegistry(newRegistry);
        emit CreatorRegistryUpdated(oldRegistry, newRegistry);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Get total number of markets
     */
    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    /**
     * @notice Get market at index
     */
    function getMarket(uint256 index) external view returns (address) {
        return allMarkets[index];
    }

    /**
     * @notice Get all markets
     */
    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }

    /**
     * @notice Get markets in range
     */
    function getMarkets(uint256 start, uint256 end) external view returns (address[] memory) {
        if (end > allMarkets.length) {
            end = allMarkets.length;
        }
        if (start >= end) {
            return new address[](0);
        }

        address[] memory markets = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            markets[i - start] = allMarkets[i];
        }
        return markets;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Admin Management Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Grant admin role to an address (only owner can do this)
     * @param account Address to grant admin role to
     */
    function addAdmin(address account) external onlyOwner {
        require(account != address(0), "MarketFactory: invalid address");
        grantRole(ADMIN_ROLE, account);
        emit AdminAdded(account);
    }

    /**
     * @notice Revoke admin role from an address (only owner can do this)
     * @param account Address to revoke admin role from
     */
    function removeAdmin(address account) external onlyOwner {
        revokeRole(ADMIN_ROLE, account);
        emit AdminRemoved(account);
    }

    /**
     * @notice Check if an address has admin role
     * @param account Address to check
     * @return bool True if address has admin role
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Trading Helper Functions (Gas-Optimized Single Approval)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Buy outcome tokens on behalf of user (user approves factory once)
     * @param market Address of the market
     * @param outcomeIndex Index of the outcome to buy
     * @param collateralAmount Amount of collateral to spend
     * @param minOutcomeTokens Minimum outcome tokens expected (slippage protection)
     * @dev User must approve MarketFactory to spend their USDC
     * @dev Uses Uniswap Router pattern: market transfers directly from user (no intermediate transfer)
     */
    function buyFor(
        address market,
        uint256 outcomeIndex,
        uint256 collateralAmount,
        uint256 minOutcomeTokens
    ) external {
        require(isMarket[market], "MarketFactory: market not found");
        
        IERC20 collateralToken = IERC20(defaultCollateralToken);
        
        // Transfer collateral from user to market directly (user approved factory, factory transfers on their behalf)
        collateralToken.safeTransferFrom(msg.sender, market, collateralAmount);
        
        // Call market's buyForUser function (collateral already transferred)
        Market(market).buyForUser(msg.sender, outcomeIndex, collateralAmount, minOutcomeTokens);
    }

    /**
     * @notice Add liquidity on behalf of user (user approves factory once)
     * @param market Address of the market
     * @param collateralAmount Amount of collateral to add
     * @dev User must approve MarketFactory to spend their USDC
     * @dev Uses Uniswap Router pattern: market transfers directly from user (no intermediate transfer)
     */
    function addLiquidityFor(
        address market,
        uint256 collateralAmount
    ) external returns (uint256) {
        require(isMarket[market], "MarketFactory: market not found");
        
        IERC20 collateralToken = IERC20(defaultCollateralToken);
        
        // Transfer collateral from user to market directly (user approved factory, factory transfers on their behalf)
        collateralToken.safeTransferFrom(msg.sender, market, collateralAmount);
        
        // Call market's addLiquidityForUser function (collateral already transferred)
        return Market(market).addLiquidityForUser(msg.sender, collateralAmount);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UUPS Upgrade Authorization
    // ─────────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
