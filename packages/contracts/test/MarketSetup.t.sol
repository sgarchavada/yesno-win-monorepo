// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {console} from "forge-std/console.sol";
import {BaseMarketTest} from "./BaseMarketTest.sol";
import {Market} from "../src/Market.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {LPToken} from "../src/LPToken.sol";
import {MockUSDC} from "../src/test/mocks/MockUSDC.sol";

/**
 * @title MarketSetup
 * @notice Test suite for market setup and initialization
 * @dev Tests deployment, market creation, and initial state verification
 */
contract MarketSetupTest is BaseMarketTest {
    /**
     * @notice Test basic market creation with binary outcomes
     */
    function testCreateBinaryMarket() public {
        // Prepare market parameters
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";

        uint256 endTime = block.timestamp + 30 days;

        // Approve USDC to factory
        usdc.approve(address(factory), INITIAL_LIQUIDITY);

        // Create market with new signature (8 parameters)
        address marketAddress = factory.createMarket(
            "Will ETH reach $5000 by end of year?",
            outcomes,
            endTime,
            address(0), // Use default collateral
            INITIAL_LIQUIDITY,
            0, // Use default LP fee
            0, // Use default protocol fee
            0  // Use default parlay fee
        );

        // Verify market was created
        assertTrue(marketAddress != address(0), "Market address should not be zero");
        assertTrue(factory.isMarket(marketAddress), "Factory should recognize market");

        // Get market instance
        Market market = Market(marketAddress);

        // Verify market configuration
        (
            string memory question,
            string[] memory marketOutcomes,
            uint256 marketEndTime,
            Market.MarketStatus status,
            bool resolved,
        ) = market.getMarketInfo();

        assertEq(question, "Will ETH reach $5000 by end of year?", "Question mismatch");
        assertEq(marketOutcomes.length, 2, "Should have 2 outcomes");
        assertEq(marketOutcomes[0], "Yes", "First outcome mismatch");
        assertEq(marketOutcomes[1], "No", "Second outcome mismatch");
        assertEq(marketEndTime, endTime, "End time mismatch");
        assertEq(uint8(status), uint8(Market.MarketStatus.ACTIVE), "Market should be active");
        assertFalse(resolved, "Market should not be resolved");

        // Verify outcome tokens
        assertEq(market.getOutcomeCount(), 2, "Should have 2 outcome tokens");
        
        address yesToken = market.getOutcomeToken(0);
        address noToken = market.getOutcomeToken(1);
        
        assertTrue(yesToken != address(0), "Yes token should exist");
        assertTrue(noToken != address(0), "No token should exist");
        assertTrue(yesToken != noToken, "Outcome tokens should be different");

        // Verify initial outcome token supply (should be 0 for non-LP users)
        OutcomeToken yesOutcome = OutcomeToken(yesToken);
        OutcomeToken noOutcome = OutcomeToken(noToken);

        assertEq(yesOutcome.balanceOf(userA), 0, "User A should have 0 Yes tokens");
        assertEq(noOutcome.balanceOf(userA), 0, "User A should have 0 No tokens");

        // Verify reserves initialized equally
        uint256 expectedReservePerOutcome = INITIAL_LIQUIDITY / 2;
        assertEq(market.reserves(0), expectedReservePerOutcome, "Yes reserve mismatch");
        assertEq(market.reserves(1), expectedReservePerOutcome, "No reserve mismatch");
        assertEq(market.totalReserves(), INITIAL_LIQUIDITY, "Total reserves mismatch");

        // Verify LP tokens (now ERC20!)
        LPToken lpToken = getLPToken(marketAddress);
        assertEq(lpToken.totalSupply(), INITIAL_LIQUIDITY, "Total LP tokens mismatch");
        assertEq(lpToken.balanceOf(deployer), INITIAL_LIQUIDITY, "Deployer LP balance mismatch");
        assertEq(address(lpToken.market()), marketAddress, "LP token market mismatch");

        console.log("Market created successfully at:", marketAddress);
        console.log("LP token:", address(lpToken));
        console.log("Yes token:", yesToken);
        console.log("No token:", noToken);
    }

    /**
     * @notice Test creating a multi-outcome market (more than binary)
     */
    function testCreateMultiOutcomeMarket() public {
        string[] memory outcomes = new string[](4);
        outcomes[0] = "Team A";
        outcomes[1] = "Team B";
        outcomes[2] = "Team C";
        outcomes[3] = "Draw";

        uint256 endTime = block.timestamp + 7 days;
        uint256 liquidity = 20_000 * USDC;

        usdc.approve(address(factory), liquidity);

        address marketAddress = factory.createMarket(
            "Who will win the championship?",
            outcomes,
            endTime,
            address(usdc),
            liquidity,
            DEFAULT_LP_FEE_BPS,
            DEFAULT_PROTOCOL_FEE_BPS,
            DEFAULT_PARLAY_FEE_BPS
        );

        Market market = Market(marketAddress);

        // Verify outcome count
        assertEq(market.getOutcomeCount(), 4, "Should have 4 outcomes");

        // Verify reserves distributed equally
        uint256 expectedReserve = liquidity / 4;
        for (uint256 i = 0; i < 4; i++) {
            assertEq(market.reserves(i), expectedReserve, "Reserve mismatch for outcome");
        }

        console.log("Multi-outcome market created with 4 outcomes");
    }

    /**
     * @notice Test market creation with custom collateral token
     */
    function testCreateMarketWithCustomCollateral() public {
        // Deploy another mock token
        MockUSDC customToken = new MockUSDC();
        customToken.mint(deployer, INITIAL_BALANCE);

        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";

        customToken.approve(address(factory), INITIAL_LIQUIDITY);

        address marketAddress = factory.createMarket(
            "Custom collateral market",
            outcomes,
            block.timestamp + 30 days,
            address(customToken), // Custom collateral
            INITIAL_LIQUIDITY,
            0,
            0,
            0
        );

        Market market = Market(marketAddress);
        assertEq(address(market.collateralToken()), address(customToken), "Collateral token mismatch");

        console.log("Market created with custom collateral token");
    }

    /**
     * @notice Test that market creation fails with insufficient liquidity
     */
    function testCreateMarketInsufficientLiquidity() public {
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";

        uint256 tooLowLiquidity = MIN_LIQUIDITY - 1;
        usdc.approve(address(factory), tooLowLiquidity);

        vm.expectRevert(MarketFactory.InsufficientLiquidity.selector);
        factory.createMarket(
            "Should fail",
            outcomes,
            block.timestamp + 30 days,
            address(0),
            tooLowLiquidity,
            0,
            0,
            0
        );
    }

    /**
     * @notice Test that market creation fails with invalid outcomes
     */
    function testCreateMarketInvalidOutcomes() public {
        // Test with only 1 outcome (minimum is 2)
        string[] memory outcomes = new string[](1);
        outcomes[0] = "Only one";

        usdc.approve(address(factory), INITIAL_LIQUIDITY);

        vm.expectRevert(MarketFactory.InvalidOutcomeCount.selector);
        factory.createMarket(
            "Should fail",
            outcomes,
            block.timestamp + 30 days,
            address(0),
            INITIAL_LIQUIDITY,
            0,
            0,
            0
        );
    }

    /**
     * @notice Test that market creation fails with past end time
     */
    function testCreateMarketPastEndTime() public {
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";

        usdc.approve(address(factory), INITIAL_LIQUIDITY);

        vm.expectRevert(MarketFactory.InvalidEndTime.selector);
        factory.createMarket(
            "Should fail",
            outcomes,
            block.timestamp - 1, // Past end time
            address(0),
            INITIAL_LIQUIDITY,
            0,
            0,
            0
        );
    }

    /**
     * @notice Test factory configuration
     */
    function testFactoryConfiguration() public {
        assertEq(factory.defaultCollateralToken(), address(usdc), "Default collateral mismatch");
        assertEq(factory.treasury(), treasury, "Treasury mismatch");
        assertEq(factory.oracleAdapter(), address(oracle), "Oracle adapter mismatch");
        assertEq(factory.defaultLpFeeBps(), DEFAULT_LP_FEE_BPS, "Default LP fee mismatch");
        assertEq(factory.defaultProtocolFeeBps(), DEFAULT_PROTOCOL_FEE_BPS, "Default protocol fee mismatch");
        assertEq(factory.defaultParlayFeeBps(), DEFAULT_PARLAY_FEE_BPS, "Default parlay fee mismatch");
        assertEq(factory.minInitialLiquidity(), MIN_LIQUIDITY, "Min liquidity mismatch");
    }

    /**
     * @notice Test market registry
     */
    function testMarketRegistry() public {
        uint256 initialCount = factory.getMarketCount();

        // Create 3 markets
        for (uint256 i = 0; i < 3; i++) {
            string[] memory outcomes = new string[](2);
            outcomes[0] = "Yes";
            outcomes[1] = "No";

            usdc.approve(address(factory), INITIAL_LIQUIDITY);
            factory.createMarket(
                string(abi.encodePacked("Market ", vm.toString(i))),
                outcomes,
                block.timestamp + 30 days,
                address(0),
                INITIAL_LIQUIDITY,
                0,
                0,
                0
            );
        }

        assertEq(factory.getMarketCount(), initialCount + 3, "Market count mismatch");

        // Get all markets
        address[] memory allMarkets = factory.getAllMarkets();
        assertEq(allMarkets.length, initialCount + 3, "All markets length mismatch");

        console.log("Market registry working correctly");
    }

    /**
     * @notice Test LP token properties
     */
    function testLPTokenProperties() public {
        address marketAddress = createBinaryMarket();
        LPToken lpToken = getLPToken(marketAddress);

        // Verify LP token is ERC20
        assertEq(lpToken.decimals(), 18, "LP token should have 18 decimals");
        assertEq(lpToken.totalSupply(), INITIAL_LIQUIDITY, "LP token supply mismatch");
        assertEq(lpToken.market(), marketAddress, "LP token market mismatch");

        // Verify LP tokens are transferable
        // LP tokens are minted 1:1 with initial liquidity amount
        uint256 transferAmount = 1000 * USDC; // Transfer 1000 USDC worth of LP tokens
        lpToken.transfer(userA, transferAmount);
        assertEq(lpToken.balanceOf(userA), transferAmount, "LP token transfer failed");

        console.log("LP token properties verified");
    }

    /**
     * @notice Test backward compatibility with legacy createMarket signature
     */
    function testLegacyCreateMarketSignature() public {
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";

        usdc.approve(address(factory), INITIAL_LIQUIDITY);

        // Use legacy signature (6 parameters) - should split fee automatically
        address marketAddress = factory.createMarket(
            "Legacy market",
            outcomes,
            block.timestamp + 30 days,
            address(0),
            INITIAL_LIQUIDITY,
            100 // 1% total fee (will be split 50/50)
        );

        Market market = Market(marketAddress);
        
        // Fee should be split
        assertEq(market.lpFeeBps(), 50, "LP fee should be half");
        assertEq(market.protocolFeeBps(), 50, "Protocol fee should be half");

        console.log("Legacy createMarket signature works correctly");
    }
}
