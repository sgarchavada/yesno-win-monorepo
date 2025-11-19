// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title OracleAdapter
 * @notice Generic oracle interface for resolving prediction markets
 * @dev Supports both manual (admin) and automated (Chainlink/API3) resolution modes
 * 
 * Architecture:
 * - Manual Mode: Admin resolves market directly
 * - Automated Mode: External oracle fulfills resolution request
 * - Stores resolution data for each market
 * - Can be upgraded to support multiple oracle providers
 * 
 * Integration Points:
 * - MarketFactory requests resolution
 * - Market contract queries resolution status
 * - External oracles (Chainlink, API3, UMA) fulfill requests
 * 
 * TODO: Integrate Chainlink Functions for automated resolution
 * TODO: Support UMA Optimistic Oracle for dispute resolution
 * TODO: Add multiple oracle providers with consensus mechanism
 */
contract OracleAdapter is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    // ─────────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────────

    enum ResolutionStatus {
        NONE,           // No resolution requested
        REQUESTED,      // Resolution requested, awaiting fulfillment
        FULFILLED,      // Resolution fulfilled
        DISPUTED,       // Resolution disputed (future feature)
        CANCELED        // Resolution canceled
    }

    struct ResolutionRequest {
        address market;
        string question;
        uint256 requestTime;
        uint256 fulfillTime;
        ResolutionStatus status;
        uint256 winningOutcome;
        address requester;
        address fulfiller;
        bytes data; // Additional data (e.g., API URL, conditions)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Counter for resolution request IDs
    uint256 public nextRequestId;

    /// @notice Mapping from request ID to resolution request
    mapping(uint256 => ResolutionRequest) public requests;

    /// @notice Mapping from market address to request ID
    mapping(address => uint256) public marketToRequestId;

    /// @notice Mapping from market address to resolution data
    mapping(address => ResolutionData) public resolutions;

    /// @notice Authorized oracle providers (for automated resolution)
    mapping(address => bool) public authorizedOracles;

    /// @notice Factory contract (only factory can request resolution)
    address public factory;

    struct ResolutionData {
        bool resolved;
        uint256 winningOutcome;
        uint256 resolvedAt;
        uint256 requestId;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────────

    event ResolutionRequested(
        uint256 indexed requestId,
        address indexed market,
        string question,
        address requester
    );

    event ResolutionFulfilled(
        uint256 indexed requestId,
        address indexed market,
        uint256 indexed winningOutcome,
        address fulfiller
    );

    event ResolutionCanceled(
        uint256 indexed requestId,
        address indexed market
    );

    event OracleAuthorized(address indexed oracle, bool authorized);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event MarketResolved(address indexed market, uint256 indexed winningOutcome);

    // ─────────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────────

    error InvalidAddress();
    error Unauthorized();
    error InvalidRequest();
    error AlreadyRequested();
    error AlreadyResolved();
    error RequestNotFound();
    error RequestNotPending();
    error NotResolved();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Initialize the oracle adapter
     * @param _factory Factory contract address
     */
    function initialize(address _factory) external initializer {
        if (_factory == address(0)) revert InvalidAddress();

        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        factory = _factory;
        nextRequestId = 1;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Resolution Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Request resolution for a market
     * @param market Address of the market to resolve
     * @param question Market question
     * @param data Additional data for resolution (e.g., API URL, conditions)
     * @return requestId ID of the resolution request
     */
    function requestResolution(
        address market,
        string calldata question,
        bytes calldata data
    ) external returns (uint256 requestId) {
        // Only factory or owner can request resolution
        if (msg.sender != factory && msg.sender != owner()) revert Unauthorized();
        if (market == address(0)) revert InvalidAddress();
        if (marketToRequestId[market] != 0) revert AlreadyRequested();

        requestId = nextRequestId++;

        requests[requestId] = ResolutionRequest({
            market: market,
            question: question,
            requestTime: block.timestamp,
            fulfillTime: 0,
            status: ResolutionStatus.REQUESTED,
            winningOutcome: 0,
            requester: msg.sender,
            fulfiller: address(0),
            data: data
        });

        marketToRequestId[market] = requestId;

        emit ResolutionRequested(requestId, market, question, msg.sender);
    }

    /**
     * @notice Fulfill a resolution request (manual or automated)
     * @param requestId ID of the resolution request
     * @param winningOutcome Index of the winning outcome
     */
    function fulfillResolution(
        uint256 requestId,
        uint256 winningOutcome
    ) external {
        ResolutionRequest storage request = requests[requestId];

        if (request.market == address(0)) revert RequestNotFound();
        if (request.status != ResolutionStatus.REQUESTED) revert RequestNotPending();

        // Authorization check:
        // - Owner can always fulfill
        // - Authorized oracles can fulfill
        // - Factory can fulfill
        if (
            msg.sender != owner() &&
            !authorizedOracles[msg.sender] &&
            msg.sender != factory
        ) {
            revert Unauthorized();
        }

        // Update request
        request.status = ResolutionStatus.FULFILLED;
        request.winningOutcome = winningOutcome;
        request.fulfillTime = block.timestamp;
        request.fulfiller = msg.sender;

        // Store resolution data
        resolutions[request.market] = ResolutionData({
            resolved: true,
            winningOutcome: winningOutcome,
            resolvedAt: block.timestamp,
            requestId: requestId
        });

        // Resolve the market contract
        (bool success,) = request.market.call(
            abi.encodeWithSignature("resolve(uint256)", winningOutcome)
        );
        require(success, "Market resolution failed");

        emit ResolutionFulfilled(requestId, request.market, winningOutcome, msg.sender);
        emit MarketResolved(request.market, winningOutcome);
    }

    /**
     * @notice Cancel a resolution request
     * @param requestId ID of the resolution request
     */
    function cancelResolution(uint256 requestId) external {
        if (msg.sender != owner() && msg.sender != factory) revert Unauthorized();

        ResolutionRequest storage request = requests[requestId];
        if (request.market == address(0)) revert RequestNotFound();
        if (request.status != ResolutionStatus.REQUESTED) revert RequestNotPending();

        request.status = ResolutionStatus.CANCELED;

        emit ResolutionCanceled(requestId, request.market);
    }

    /**
     * @notice Direct resolution (for manual/emergency use)
     * @param market Address of the market
     * @param winningOutcome Index of the winning outcome
     */
    function resolveDirectly(
        address market,
        uint256 winningOutcome
    ) external {
        if (msg.sender != owner() && msg.sender != factory) revert Unauthorized();
        if (market == address(0)) revert InvalidAddress();
        if (resolutions[market].resolved) revert AlreadyResolved();

        uint256 requestId = marketToRequestId[market];

        // Create request if it doesn't exist
        if (requestId == 0) {
            requestId = nextRequestId++;
            requests[requestId] = ResolutionRequest({
                market: market,
                question: "",
                requestTime: block.timestamp,
                fulfillTime: block.timestamp,
                status: ResolutionStatus.FULFILLED,
                winningOutcome: winningOutcome,
                requester: msg.sender,
                fulfiller: msg.sender,
                data: ""
            });
            marketToRequestId[market] = requestId;
        } else {
            // Update existing request
            ResolutionRequest storage request = requests[requestId];
            request.status = ResolutionStatus.FULFILLED;
            request.winningOutcome = winningOutcome;
            request.fulfillTime = block.timestamp;
            request.fulfiller = msg.sender;
        }

        // Store resolution
        resolutions[market] = ResolutionData({
            resolved: true,
            winningOutcome: winningOutcome,
            resolvedAt: block.timestamp,
            requestId: requestId
        });

        // Resolve the market contract
        (bool success,) = market.call(
            abi.encodeWithSignature("resolve(uint256)", winningOutcome)
        );
        require(success, "Market resolution failed");

        emit ResolutionFulfilled(requestId, market, winningOutcome, msg.sender);
        emit MarketResolved(market, winningOutcome);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Authorize or deauthorize an oracle provider
     * @param oracle Address of the oracle provider
     * @param authorized Whether to authorize or deauthorize
     */
    function setOracleAuthorization(address oracle, bool authorized) external onlyOwner {
        if (oracle == address(0)) revert InvalidAddress();
        authorizedOracles[oracle] = authorized;
        emit OracleAuthorized(oracle, authorized);
    }

    /**
     * @notice Update factory address
     * @param newFactory New factory address
     */
    function setFactory(address newFactory) external onlyOwner {
        if (newFactory == address(0)) revert InvalidAddress();
        address oldFactory = factory;
        factory = newFactory;
        emit FactoryUpdated(oldFactory, newFactory);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Get resolution outcome for a market
     * @param market Address of the market
     * @return winningOutcome Index of the winning outcome
     * @return resolved Whether the market is resolved
     */
    function getOutcome(address market) external view returns (uint256 winningOutcome, bool resolved) {
        ResolutionData memory data = resolutions[market];
        return (data.winningOutcome, data.resolved);
    }

    /**
     * @notice Check if a market is resolved
     * @param market Address of the market
     * @return resolved Whether the market is resolved
     */
    function isResolved(address market) external view returns (bool) {
        return resolutions[market].resolved;
    }

    /**
     * @notice Get resolution request by ID
     * @param requestId ID of the resolution request
     * @return request Resolution request data
     */
    function getRequest(uint256 requestId) external view returns (ResolutionRequest memory) {
        return requests[requestId];
    }

    /**
     * @notice Get resolution request ID for a market
     * @param market Address of the market
     * @return requestId ID of the resolution request
     */
    function getRequestIdForMarket(address market) external view returns (uint256) {
        return marketToRequestId[market];
    }

    /**
     * @notice Get resolution data for a market
     * @param market Address of the market
     * @return data Resolution data
     */
    function getResolution(address market) external view returns (ResolutionData memory) {
        return resolutions[market];
    }

    /**
     * @notice Check if an address is an authorized oracle
     * @param oracle Address to check
     * @return authorized Whether the address is authorized
     */
    function isAuthorizedOracle(address oracle) external view returns (bool) {
        return authorizedOracles[oracle];
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Chainlink Integration (Future)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @dev TODO: Implement Chainlink Functions integration
     * 
     * Example flow:
     * 1. requestResolution() creates Chainlink Functions request
     * 2. Chainlink DON fetches data from external API
     * 3. DON calls fulfillResolution() with result
     * 
     * Requirements:
     * - Install @chainlink/contracts
     * - Implement FunctionsClient
     * - Configure subscription and DON
     */

    /**
     * @dev TODO: Implement UMA Optimistic Oracle integration
     * 
     * Example flow:
     * 1. requestResolution() proposes answer via UMA
     * 2. Challenge period allows disputes
     * 3. After liveness, fulfillResolution() is called
     * 
     * Benefits:
     * - Dispute resolution mechanism
     * - Economic security via bonds
     * - No trust assumptions
     */

    // ─────────────────────────────────────────────────────────────────────────────
    // UUPS Upgrade Authorization
    // ─────────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
