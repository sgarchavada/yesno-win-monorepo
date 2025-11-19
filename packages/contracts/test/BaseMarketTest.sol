// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {Market} from "../src/Market.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {LPToken} from "../src/LPToken.sol";
import {OracleAdapter} from "../src/OracleAdapter.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {ProtocolTreasury} from "../src/ProtocolTreasury.sol";
import {MockUSDC} from "../src/test/mocks/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title BaseMarketTest
 * @notice Base test contract with common setup for all market tests
 * @dev Provides initialized contracts and helper functions
 */
abstract contract BaseMarketTest is Test {
    // Constants
    uint256 constant USDC = 1e6; // USDC has 6 decimals
    uint256 constant INITIAL_BALANCE = 1_000_000 * USDC; // 1M USDC per test account
    uint256 constant INITIAL_LIQUIDITY = 10_000 * USDC; // 10,000 USDC (increased for better testing)
    uint256 constant DEFAULT_LP_FEE_BPS = 30; // 0.3% LP fee
    uint256 constant DEFAULT_PROTOCOL_FEE_BPS = 20; // 0.2% protocol fee
    uint256 constant DEFAULT_PARLAY_FEE_BPS = 100; // 1% parlay fee
    uint256 constant MIN_LIQUIDITY = 100 * USDC;

    // Contracts
    MockUSDC public usdc;
    MarketFactory public factory;
    OracleAdapter public oracle;
    CreatorRegistry public registry;
    ProtocolTreasury public protocolTreasury;
    Market public marketImpl;
    OutcomeToken public outcomeTokenImpl;
    LPToken public lpTokenImpl;

    // Test accounts
    address public deployer;
    address public treasury;
    address public userA;
    address public userB;
    address public userC;
    address public lpUserA;
    address public lpUserB;

    function setUp() public virtual {
        // Setup test accounts
        deployer = address(this);
        treasury = makeAddr("treasury");
        userA = makeAddr("userA");
        userB = makeAddr("userB");
        userC = makeAddr("userC");
        lpUserA = makeAddr("lpUserA");
        lpUserB = makeAddr("lpUserB");

        // Deploy MockUSDC
        usdc = new MockUSDC();

        // Mint USDC to test accounts
        usdc.mint(deployer, INITIAL_BALANCE);
        usdc.mint(treasury, INITIAL_BALANCE);
        usdc.mint(userA, INITIAL_BALANCE);
        usdc.mint(userB, INITIAL_BALANCE);
        usdc.mint(userC, INITIAL_BALANCE);
        usdc.mint(lpUserA, INITIAL_BALANCE);
        usdc.mint(lpUserB, INITIAL_BALANCE);

        // Deploy implementation contracts
        marketImpl = new Market();
        outcomeTokenImpl = new OutcomeToken();
        lpTokenImpl = new LPToken();
        OracleAdapter oracleImpl = new OracleAdapter();
        CreatorRegistry registryImpl = new CreatorRegistry();
        ProtocolTreasury treasuryImpl = new ProtocolTreasury();
        MarketFactory factoryImpl = new MarketFactory();

        // Deploy CreatorRegistry proxy
        bytes memory registryInitData = abi.encodeWithSelector(
            CreatorRegistry.initialize.selector,
            deployer
        );
        ERC1967Proxy registryProxy = new ERC1967Proxy(address(registryImpl), registryInitData);
        registry = CreatorRegistry(address(registryProxy));

        // Deploy ProtocolTreasury proxy (will be initialized after factory)
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(address(treasuryImpl), "");
        protocolTreasury = ProtocolTreasury(address(treasuryProxy));

        // Deploy OracleAdapter proxy
        bytes memory oracleInitData = abi.encodeWithSelector(
            OracleAdapter.initialize.selector,
            deployer
        );
        ERC1967Proxy oracleProxy = new ERC1967Proxy(address(oracleImpl), oracleInitData);
        oracle = OracleAdapter(address(oracleProxy));

        // Deploy MarketFactory proxy with correct signature
        bytes memory factoryInitData = abi.encodeWithSelector(
            MarketFactory.initialize.selector,
            address(usdc),              // defaultCollateralToken
            address(protocolTreasury),  // treasury
            address(oracle),            // oracleAdapter
            address(registry),          // creatorRegistry
            DEFAULT_LP_FEE_BPS,         // defaultLpFeeBps
            DEFAULT_PROTOCOL_FEE_BPS,   // defaultProtocolFeeBps
            DEFAULT_PARLAY_FEE_BPS,     // defaultParlayFeeBps
            MIN_LIQUIDITY,              // minInitialLiquidity
            address(marketImpl),        // marketImplementation
            address(outcomeTokenImpl),  // outcomeTokenImplementation
            address(lpTokenImpl)        // lpTokenImplementation
        );
        ERC1967Proxy factoryProxy = new ERC1967Proxy(address(factoryImpl), factoryInitData);
        factory = MarketFactory(address(factoryProxy));

        // Initialize ProtocolTreasury
        protocolTreasury.initialize(address(factory), deployer);

        // Link oracle to factory
        oracle.setFactory(address(factory));

        // Grant MARKET_FACTORY_ROLE to factory in CreatorRegistry
        bytes32 MARKET_FACTORY_ROLE = keccak256("MARKET_FACTORY_ROLE");
        registry.grantRole(MARKET_FACTORY_ROLE, address(factory));

        // Approve all test users as creators
        // First, users must request creator role
        registry.requestCreatorRole(); // deployer
        vm.prank(userA);
        registry.requestCreatorRole();
        vm.prank(userB);
        registry.requestCreatorRole();
        vm.prank(userC);
        registry.requestCreatorRole();
        vm.prank(lpUserA);
        registry.requestCreatorRole();
        vm.prank(lpUserB);
        registry.requestCreatorRole();
        
        // Then admin approves them
        registry.approveCreator(deployer);
        registry.approveCreator(userA);
        registry.approveCreator(userB);
        registry.approveCreator(userC);
        registry.approveCreator(lpUserA);
        registry.approveCreator(lpUserB);

        // Approve factory for all users
        usdc.approve(address(factory), type(uint256).max);
        vm.prank(userA);
        usdc.approve(address(factory), type(uint256).max);
        vm.prank(userB);
        usdc.approve(address(factory), type(uint256).max);
        vm.prank(userC);
        usdc.approve(address(factory), type(uint256).max);
        vm.prank(lpUserA);
        usdc.approve(address(factory), type(uint256).max);
        vm.prank(lpUserB);
        usdc.approve(address(factory), type(uint256).max);
    }

    /**
     * @notice Helper function to create a binary market
     * @return market The created market address
     */
    function createBinaryMarket() internal returns (address market) {
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";

        uint256 endTime = block.timestamp + 30 days;

        // Note: Factory already has max approval from setUp, no need to re-approve

        // Create market with new signature (8 parameters)
        market = factory.createMarket(
            "Will ETH reach $5000?",
            outcomes,
            endTime,
            address(usdc),
            INITIAL_LIQUIDITY,
            DEFAULT_LP_FEE_BPS,
            DEFAULT_PROTOCOL_FEE_BPS,
            DEFAULT_PARLAY_FEE_BPS
        );
    }

    /**
     * @notice Helper function to create a multi-outcome market
     * @param numOutcomes Number of outcomes
     * @return market The created market address
     */
    function createMultiOutcomeMarket(uint256 numOutcomes) internal returns (address market) {
        require(numOutcomes >= 2 && numOutcomes <= 20, "Invalid outcome count");

        string[] memory outcomes = new string[](numOutcomes);
        for (uint256 i = 0; i < numOutcomes; i++) {
            outcomes[i] = string(abi.encodePacked("Outcome ", vm.toString(i)));
        }

        uint256 endTime = block.timestamp + 30 days;

        // Approve factory to spend USDC
        usdc.approve(address(factory), INITIAL_LIQUIDITY);

        // Create market
        market = factory.createMarket(
            "Multi-outcome market",
            outcomes,
            endTime,
            address(usdc),
            INITIAL_LIQUIDITY,
            DEFAULT_LP_FEE_BPS,
            DEFAULT_PROTOCOL_FEE_BPS,
            DEFAULT_PARLAY_FEE_BPS
        );
    }

    /**
     * @notice Helper to get LP token for a market
     */
    function getLPToken(address market) internal view returns (LPToken) {
        return LPToken(address(Market(market).lpToken()));
    }

    /**
     * @notice Helper to get outcome token for a market
     */
    function getOutcomeToken(address market, uint256 index) internal view returns (OutcomeToken) {
        return OutcomeToken(Market(market).getOutcomeToken(index));
    }
}

