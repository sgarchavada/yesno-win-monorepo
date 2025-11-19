// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title CreatorRegistry
 * @notice Manages creator roles, requests, and activity tracking for YesNo.Win
 * @dev Separate contract to keep MarketFactory lean and focused
 * 
 * Features:
 * - Creator role requests (hybrid approval model)
 * - Admin approval/rejection workflow
 * - Creator activity tracking (markets created)
 * - Enable/disable creator requests
 * - Revoke creator access
 */
contract CreatorRegistry is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    AccessControlUpgradeable
{
    // ─────────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant MARKET_FACTORY_ROLE = keccak256("MARKET_FACTORY_ROLE");

    // ─────────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Array of pending creator requests
    address[] public pendingCreatorRequests;

    /// @notice Mapping to check if address has a pending request
    mapping(address => bool) public hasPendingRequest;

    /// @notice Mapping to get index of pending request
    mapping(address => uint256) public pendingRequestIndex;

    /// @notice Flag to enable/disable creator requests
    bool public creatorRequestsEnabled;

    /// @notice Mapping from market address to creator address
    mapping(address => address) public marketCreator;

    /// @notice Mapping from creator address to array of their markets
    mapping(address => address[]) public creatorMarkets;

    /// @notice Array of all markets (for tracking)
    address[] private allMarkets;

    /// @notice Array of all approved creators
    address[] private allCreators;

    /// @notice Mapping to track creator array index
    mapping(address => uint256) private creatorIndex;

    // ─────────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────────

    event CreatorRequested(address indexed user, uint256 timestamp);
    event CreatorApproved(address indexed user, address indexed approvedBy);
    event CreatorRevoked(address indexed user, address indexed revokedBy);
    event CreatorRequestRejected(address indexed user, address indexed rejectedBy);
    event CreatorRequestsToggled(bool enabled, address indexed toggledBy);
    event MarketTracked(address indexed market, address indexed creator);

    // ─────────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────────

    error InvalidAddress();
    error AlreadyCreator();
    error RequestAlreadyPending();
    error NoPendingRequest();
    error NotCreator();
    error RequestsDisabled();
    error Unauthorized();

    // ─────────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (owner() != _msgSender() && !hasRole(ADMIN_ROLE, _msgSender())) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyMarketFactory() {
        if (!hasRole(MARKET_FACTORY_ROLE, _msgSender())) {
            revert Unauthorized();
        }
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Initialize the CreatorRegistry
     * @param _marketFactory Address of the MarketFactory contract
     */
    function initialize(address _marketFactory) external initializer {
        if (_marketFactory == address(0)) revert InvalidAddress();

        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __AccessControl_init();
        
        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Grant MarketFactory role to factory contract
        _grantRole(MARKET_FACTORY_ROLE, _marketFactory);
        
        // Enable creator requests by default
        creatorRequestsEnabled = true;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Creator Request Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Request creator role (anyone can request)
     * @dev User submits request, admin reviews and approves/rejects
     */
    function requestCreatorRole() external {
        address requester = _msgSender();
        
        if (!creatorRequestsEnabled) revert RequestsDisabled();
        if (hasRole(CREATOR_ROLE, requester)) revert AlreadyCreator();
        if (hasPendingRequest[requester]) revert RequestAlreadyPending();
        
        // Add to pending requests
        pendingRequestIndex[requester] = pendingCreatorRequests.length;
        pendingCreatorRequests.push(requester);
        hasPendingRequest[requester] = true;
        
        emit CreatorRequested(requester, block.timestamp);
    }

    /**
     * @notice Approve a creator request
     * @param user Address to approve
     */
    function approveCreator(address user) external onlyAdmin {
        if (!hasPendingRequest[user]) revert NoPendingRequest();
        
        // Remove from pending
        _removePendingRequest(user);
        
        // Grant creator role
        _grantRole(CREATOR_ROLE, user);
        
        // Add to allCreators array
        creatorIndex[user] = allCreators.length;
        allCreators.push(user);
        
        emit CreatorApproved(user, _msgSender());
    }

    /**
     * @notice Reject a creator request
     * @param user Address to reject
     */
    function rejectCreatorRequest(address user) external onlyAdmin {
        if (!hasPendingRequest[user]) revert NoPendingRequest();
        
        // Remove from pending
        _removePendingRequest(user);
        
        emit CreatorRequestRejected(user, _msgSender());
    }

    /**
     * @notice Revoke creator role
     * @param user Address to revoke
     */
    function revokeCreator(address user) external onlyAdmin {
        if (!hasRole(CREATOR_ROLE, user)) revert NotCreator();
        
        _revokeRole(CREATOR_ROLE, user);
        
        // Remove from allCreators array (only if array is not empty and user is tracked)
        if (allCreators.length > 0 && creatorIndex[user] < allCreators.length) {
            uint256 index = creatorIndex[user];
            uint256 lastIndex = allCreators.length - 1;
            
            if (index != lastIndex) {
                address lastCreator = allCreators[lastIndex];
                allCreators[index] = lastCreator;
                creatorIndex[lastCreator] = index;
            }
            
            allCreators.pop();
            delete creatorIndex[user];
        }
        
        emit CreatorRevoked(user, _msgSender());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Market Tracking Functions (Called by MarketFactory)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Track a new market creation
     * @dev Can only be called by MarketFactory
     * @param market Address of the market
     * @param creator Address of the creator
     */
    function trackMarket(address market, address creator) external onlyMarketFactory {
        marketCreator[market] = creator;
        creatorMarkets[creator].push(market);
        allMarkets.push(market);
        
        emit MarketTracked(market, creator);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Check if address is a creator
     * @param account Address to check
     * @return True if account has CREATOR_ROLE
     */
    function isCreator(address account) external view returns (bool) {
        return hasRole(CREATOR_ROLE, account);
    }

    /**
     * @notice Check if address can create markets
     * @dev Only approved creators can create markets (including admins who were approved)
     * @param account Address to check
     * @return True if account has CREATOR_ROLE
     */
    function canCreateMarkets(address account) external view returns (bool) {
        return hasRole(CREATOR_ROLE, account);
    }

    /**
     * @notice Get all pending creator requests
     * @return Array of addresses with pending requests
     */
    function getPendingCreatorRequests() external view returns (address[] memory) {
        return pendingCreatorRequests;
    }

    /**
     * @notice Get count of pending requests
     * @return Number of pending requests
     */
    function getPendingRequestCount() external view returns (uint256) {
        return pendingCreatorRequests.length;
    }

    /**
     * @notice Get markets created by a specific creator
     * @param creator Address of the creator
     * @return Array of market addresses created by the creator
     */
    function getCreatorMarkets(address creator) external view returns (address[] memory) {
        return creatorMarkets[creator];
    }

    /**
     * @notice Get market count for a specific creator
     * @param creator Address of the creator
     * @return Number of markets created by the creator
     */
    function getCreatorMarketCount(address creator) external view returns (uint256) {
        return creatorMarkets[creator].length;
    }

    /**
     * @notice Get all creators with CREATOR_ROLE
     * @dev This is a helper for frontend - note it can be gas-intensive
     * @return Array of all addresses with CREATOR_ROLE
     */
    function getAllCreators() external view returns (address[] memory) {
        return allCreators;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @notice Toggle creator requests on/off
     * @dev Only admins can toggle this setting
     * @param enabled True to enable requests, false to disable
     */
    function setCreatorRequestsEnabled(bool enabled) external onlyAdmin {
        creatorRequestsEnabled = enabled;
        emit CreatorRequestsToggled(enabled, _msgSender());
    }

    /**
     * @notice Add an admin
     * @param account Address to grant admin role
     */
    function addAdmin(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(ADMIN_ROLE, account);
    }

    /**
     * @notice Remove an admin
     * @param account Address to revoke admin role
     */
    function removeAdmin(address account) external onlyOwner {
        _revokeRole(ADMIN_ROLE, account);
    }

    /**
     * @notice Check if address is an admin
     * @param account Address to check
     * @return True if account has ADMIN_ROLE
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Internal Functions
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * @dev Internal function to remove pending request
     */
    function _removePendingRequest(address user) internal {
        uint256 index = pendingRequestIndex[user];
        uint256 lastIndex = pendingCreatorRequests.length - 1;
        
        if (index != lastIndex) {
            address lastUser = pendingCreatorRequests[lastIndex];
            pendingCreatorRequests[index] = lastUser;
            pendingRequestIndex[lastUser] = index;
        }
        
        pendingCreatorRequests.pop();
        delete hasPendingRequest[user];
        delete pendingRequestIndex[user];
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UUPS Upgrade Authorization
    // ─────────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

