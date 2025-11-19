// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SimplePredictionMarket (Upgradeable binary prediction market)
 * @notice Binary A/B market with manual resolution, payouts, cancellation + refunds, and admin controls.
 *         Fee charged only on winnings at claim time.
 * @dev Upgradeable contract using UUPS pattern. Deployable on Polygon/Ethereum/Arbitrum.
 *      Built to be extended (multi-outcome, oracle, presale).
 */
contract SimplePredictionMarket is 
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────────
    // Types & Storage
    // ─────────────────────────────────────────────────────────────────────────────

    enum MarketOutcome {
        UNRESOLVED,
        OPTION_A,
        OPTION_B
    }

    enum MarketStatus {
        ACTIVE,
        CLOSED,
        RESOLVED,
        CANCELED
    }

    enum ResolutionType {
        MANUAL,
        ORACLE
    }

    struct Market {
        // immutable market config
        string question;
        string optionA;
        string optionB;
        uint256 startTime; // optional: 0 means start immediately
        uint256 endTime; // trading deadline
        // state
        MarketStatus status;
        MarketOutcome outcome;
        ResolutionType resolutionType;
        bool resolved;
        // pools
        uint256 totalOptionAShares;
        uint256 totalOptionBShares;
        // user balances
        mapping(address => uint256) optionASharesBalance;
        mapping(address => uint256) optionBSharesBalance;
        // claims
        mapping(address => bool) hasClaimedWinnings;
        mapping(address => bool) hasClaimedRefund;
    }

    IERC20 public stakingToken; // token used to buy "shares"
    address public treasury; // where platform fees are sent on withdraw
    uint256 public marketCount;
    mapping(uint256 => Market) internal markets;

    // fees
    uint256 public platformFeesCollected; // accumulated fees in stakingToken
    uint256 public platformFeeBps; // default 3% (set in initializer)
    uint256 public constant MAX_FEE_BPS = 1000; // hard cap 10%

    // safety
    bool public paused; // emergency pause for buy/claim paths

    // ─────────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────────

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        uint256 startTime,
        uint256 endTime,
        string optionA,
        string optionB,
        ResolutionType resolutionType
    );

    event SharesPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isOptionA,
        uint256 amountAfterFee,
        uint256 fee
    );

    event MarketClosed(uint256 indexed marketId);
    event MarketResolved(
        uint256 indexed marketId,
        MarketOutcome outcome,
        uint256 totalA,
        uint256 totalB
    );
    event MarketCanceled(uint256 indexed marketId);

    event ClaimedWinnings(
        uint256 indexed marketId,
        address indexed user,
        uint256 payout
    );
    event ClaimedRefund(
        uint256 indexed marketId,
        address indexed user,
        uint256 refundAmount
    );

    event PlatformFeeCollected(
        address indexed payer,
        uint256 indexed marketId,
        uint256 fee
    );
    event PlatformFeesWithdrawn(address indexed to, uint256 amount);

    event TreasuryUpdated(address indexed newTreasury);
    event PlatformFeeUpdated(uint256 newFeeBps);
    event Paused(bool isPaused);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Initializer (replaces constructor for upgradeable contracts)
    // ─────────────────────────────────────────────────────────────────────────────

    function initialize(
        address _stakingToken,
        address _treasury
    ) public initializer {
        require(_stakingToken != address(0), "Invalid token");
        
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        stakingToken = IERC20(_stakingToken);
        treasury = _treasury == address(0) ? msg.sender : _treasury;
        platformFeeBps = 300; // 3% default fee
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UUPS Upgrade Authorization
    // ─────────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ─────────────────────────────────────────────────────────────────────────────
    // Admin / Owner Controls
    // ─────────────────────────────────────────────────────────────────────────────

    function setPlatformFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = _feeBps;
        emit PlatformFeeUpdated(_feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid addr");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Recover any ERC20 accidentally sent here (but NOT the staking token's user funds)
    function recoverERC20(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(token != address(stakingToken), "Cannot recover staking token");
        IERC20(token).safeTransfer(to, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Market Lifecycle
    // ─────────────────────────────────────────────────────────────────────────────

    function createMarket(
        string memory _question,
        uint256 _startTime, // pass 0 to start immediately
        uint256 _endTime, // must be > block.timestamp
        string memory _optionA,
        string memory _optionB,
        ResolutionType _resolutionType
    ) external onlyOwner returns (uint256 marketId) {
        require(bytes(_question).length > 0, "Question required");
        require(
            bytes(_optionA).length > 0 && bytes(_optionB).length > 0,
            "Options required"
        );

        uint256 start = _startTime;
        if (_startTime == 0) {
            start = block.timestamp;
            require(
                _endTime > block.timestamp,
                "endTime must be in the future"
            );
        } else {
            require(_endTime > _startTime, "endTime must be after start");
        }

        marketId = marketCount++;
        Market storage m = markets[marketId];
        m.question = _question;
        m.optionA = _optionA;
        m.optionB = _optionB;
        m.startTime = start;
        m.endTime = _endTime;
        m.status = MarketStatus.ACTIVE;
        m.outcome = MarketOutcome.UNRESOLVED;
        m.resolutionType = _resolutionType;

        emit MarketCreated(
            marketId,
            _question,
            start,
            _endTime,
            _optionA,
            _optionB,
            _resolutionType
        );
    }

    function closeMarket(uint256 _marketId) external onlyOwner {
        Market storage m = markets[_marketId];
        require(m.status == MarketStatus.ACTIVE, "Not active");
        require(block.timestamp >= m.endTime, "Trading not ended");
        m.status = MarketStatus.CLOSED;
        emit MarketClosed(_marketId);
    }

    /// @notice Manual resolution (MVP). In production, gate with oracle/verifier.
    function resolveMarket(
        uint256 _marketId,
        MarketOutcome _outcome
    ) external onlyOwner {
        Market storage m = markets[_marketId];

        // ✅ Allow resolve if market is ACTIVE or CLOSED
        require(
            m.status == MarketStatus.ACTIVE || m.status == MarketStatus.CLOSED,
            "Market not active or closed"
        );

        // ❌ Prevent re-resolving
        require(!m.resolved, "Already resolved");

        if (m.resolutionType == ResolutionType.ORACLE) {
            // Future: replace this block with oracle integration
            // Example: require(msg.sender == oracleAddress, "Only oracle can resolve");
            // autoResolveFromOracle(_marketId);
            revert("Oracle resolution not implemented yet");
        }

        // ✅ Validate input
        require(
            _outcome == MarketOutcome.OPTION_A ||
                _outcome == MarketOutcome.OPTION_B,
            "Invalid outcome"
        );

        // 🟢 Auto-close if still active
        if (m.status == MarketStatus.ACTIVE) {
            m.status = MarketStatus.CLOSED;
            emit MarketClosed(_marketId);
        }

        // ✅ Set outcome and finalize
        m.outcome = _outcome;
        m.resolved = true;
        m.status = MarketStatus.RESOLVED;

        emit MarketResolved(
            _marketId,
            _outcome,
            m.totalOptionAShares,
            m.totalOptionBShares
        );
    }

    /// @notice Cancel market and enable refunds (e.g., invalid question, oracle failure).
    function cancelMarket(uint256 _marketId) external onlyOwner {
        Market storage m = markets[_marketId];

        require(
            m.status == MarketStatus.ACTIVE || m.status == MarketStatus.CLOSED,
            "Not cancelable"
        );
        require(
            !m.resolved && m.status != MarketStatus.RESOLVED,
            "Already resolved"
        );

        // Mark as canceled + resolved, but no outcome
        m.status = MarketStatus.CANCELED;
        m.resolved = true;
        m.outcome = MarketOutcome.UNRESOLVED;

        emit MarketCanceled(_marketId);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Trading
    // ─────────────────────────────────────────────────────────────────────────────

    function buyShares(
        uint256 _marketId,
        bool _isOptionA,
        uint256 _amount
    ) external nonReentrant {
        require(!paused, "Paused");
        require(_amount > 0, "Amount > 0");

        Market storage m = markets[_marketId];
        require(m.status == MarketStatus.ACTIVE, "Not active");
        require(
            block.timestamp >= m.startTime && block.timestamp < m.endTime,
            "Outside window"
        );
        require(!m.resolved, "Resolved");

        // Pull tokens first (CEI: interactions happen after state effects are determined)
        // Full amount becomes shares (no fee on purchase)
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Effects
        if (_isOptionA) {
            m.totalOptionAShares += _amount;
            m.optionASharesBalance[msg.sender] += _amount;
        } else {
            m.totalOptionBShares += _amount;
            m.optionBSharesBalance[msg.sender] += _amount;
        }

        // Events
        emit SharesPurchased(_marketId, msg.sender, _isOptionA, _amount, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Claims
    // ─────────────────────────────────────────────────────────────────────────────

    function claimWinnings(uint256 _marketId) external nonReentrant {
        require(!paused, "Paused");
        Market storage m = markets[_marketId];
        require(
            m.status == MarketStatus.RESOLVED && m.resolved,
            "Not resolved"
        );
        require(!m.hasClaimedWinnings[msg.sender], "Already claimed");

        uint256 userShares;
        uint256 winningShares;
        uint256 losingShares;

        if (m.outcome == MarketOutcome.OPTION_A) {
            userShares = m.optionASharesBalance[msg.sender];
            winningShares = m.totalOptionAShares;
            losingShares = m.totalOptionBShares;
            // Effects: zero user balance first (CEI)
            m.optionASharesBalance[msg.sender] = 0;
        } else if (m.outcome == MarketOutcome.OPTION_B) {
            userShares = m.optionBSharesBalance[msg.sender];
            winningShares = m.totalOptionBShares;
            losingShares = m.totalOptionAShares;
            m.optionBSharesBalance[msg.sender] = 0;
        } else {
            revert("Invalid outcome");
        }

        require(userShares > 0, "No winning shares");
        require(winningShares > 0, "No winners");

        uint256 totalPool = winningShares + losingShares;
        uint256 grossPayout = (userShares * totalPool) / winningShares;

        // Deduct 3% platform fee from winners' payout
        uint256 fee = (grossPayout * platformFeeBps) / 10_000;
        uint256 netPayout = grossPayout - fee;

        // Effects
        platformFeesCollected += fee;
        m.hasClaimedWinnings[msg.sender] = true;

        // Interactions
        stakingToken.safeTransfer(msg.sender, netPayout);
        emit ClaimedWinnings(_marketId, msg.sender, netPayout);
    }

    /// @notice Refund in case of cancellation (user receives their contributed shares back).
    function claimRefund(uint256 _marketId) external nonReentrant {
        Market storage m = markets[_marketId];
        require(m.status == MarketStatus.CANCELED, "Not canceled");
        require(!m.hasClaimedRefund[msg.sender], "Refund claimed");

        uint256 a = m.optionASharesBalance[msg.sender];
        uint256 b = m.optionBSharesBalance[msg.sender];
        uint256 refund = a + b;
        require(refund > 0, "Nothing to refund");

        // Effects
        m.optionASharesBalance[msg.sender] = 0;
        m.optionBSharesBalance[msg.sender] = 0;
        m.hasClaimedRefund[msg.sender] = true;

        // Interactions
        stakingToken.safeTransfer(msg.sender, refund);
        emit ClaimedRefund(_marketId, msg.sender, refund);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Fees
    // ─────────────────────────────────────────────────────────────────────────────

    function withdrawPlatformFees() external onlyOwner {
        uint256 fees = platformFeesCollected;
        require(fees > 0, "No fees");
        require(
            fees <= stakingToken.balanceOf(address(this)),
            "Insufficient contract balance"
        );
        platformFeesCollected = 0;
        stakingToken.safeTransfer(treasury, fees);
        emit PlatformFeesWithdrawn(treasury, fees);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────────

    function getMarket(
        uint256 _marketId
    )
        external
        view
        returns (
            string memory question,
            uint256 startTime,
            uint256 endTime,
            MarketStatus status,
            MarketOutcome outcome,
            ResolutionType resolutionType,
            string memory optionA,
            string memory optionB,
            uint256 totalOptionAShares,
            uint256 totalOptionBShares,
            bool resolved
        )
    {
        Market storage m = markets[_marketId];
        return (
            m.question,
            m.startTime,
            m.endTime,
            m.status,
            m.outcome,
            m.resolutionType,
            m.optionA,
            m.optionB,
            m.totalOptionAShares,
            m.totalOptionBShares,
            m.resolved
        );
    }

    function getUserShares(
        uint256 _marketId,
        address _user
    )
        external
        view
        returns (
            uint256 optionAShares,
            uint256 optionBShares,
            bool claimedWin,
            bool claimedRefund
        )
    {
        Market storage m = markets[_marketId];
        return (
            m.optionASharesBalance[_user],
            m.optionBSharesBalance[_user],
            m.hasClaimedWinnings[_user],
            m.hasClaimedRefund[_user]
        );
    }

    function getSharesBalance(
        uint256 _marketId,
        address _user
    ) external view returns (uint256 optionAShares, uint256 optionBShares) {
        Market storage m = markets[_marketId];
        return (m.optionASharesBalance[_user], m.optionBSharesBalance[_user]);
    }

    function getMarketCount() external view returns (uint256) {
        return marketCount;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Safety: Reject ETH
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Reject direct ETH transfers
    receive() external payable {
        revert("No direct ETH");
    }

    /// @notice Reject fallback calls with ETH
    fallback() external payable {
        revert("No direct ETH");
    }
}
