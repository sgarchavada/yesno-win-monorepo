// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BaseMarketTest.sol";

/**
 * @title MarketAMMPricing Test
 * @notice Tests for the fixed AMM pricing formula
 * @dev Verifies: price = reserve / totalReserves, tokens = collateral / price
 */
contract MarketAMMPricingTest is BaseMarketTest {
    address market;
    
    function setUp() public override {
        super.setUp();
        
        // Create test market with 100 USDC liquidity
        string[] memory outcomes = new string[](2);
        outcomes[0] = "YES";
        outcomes[1] = "NO";
        
        uint256 liquidity = 100 * USDC;
        usdc.approve(address(factory), liquidity);
        
        market = factory.createMarket(
            "Pricing Test",
            outcomes,
            block.timestamp + 7 days,
            address(usdc),
            liquidity,
            DEFAULT_LP_FEE_BPS,
            DEFAULT_PROTOCOL_FEE_BPS,
            DEFAULT_PARLAY_FEE_BPS
        );
        
        vm.prank(deployer);
        Market(market).completeLPInitialization(deployer, liquidity);
    }

    /**
     * @notice CRITICAL TEST: Verify 10 USDC at 50% gives ~19.6 tokens (not 4.9!)
     * This was the bug we fixed!
     */
    function testRegression_10USDC_GivesCorrectTokens() public view {
        uint256 buyAmount = 10 * USDC;
        uint256 tokensExpected = Market(market).calculateBuyPrice(0, buyAmount);
        
        // At 50% probability with 2% fee:
        // After fee: 10 * 0.98 = 9.8 USDC
        // Price per token: 0.5 USDC (50%)
        // Tokens: 9.8 / 0.5 = 19.6 tokens
        
        // Should get approximately 19.6 * USDC (in 6 decimals)
        uint256 expected = (196 * USDC) / 10; // 19.6 USDC
        
        // Allow 1% variance for rounding
        assertApproxEqRel(tokensExpected, expected, 1e16, "Should get ~19.6 tokens");
        
        // MUST NOT be the old buggy value of 4.9 tokens
        assertGt(tokensExpected, 15 * USDC, "MUST be > 15 tokens (old bug was 4.9)");
    }

    /**
     * @notice Verify initial 50/50 pricing
     */
    function testInitialPricing_50_50() public view {
        uint256 yesPrice = Market(market).getPrice(0);
        uint256 noPrice = Market(market).getPrice(1);
        
        assertEq(yesPrice, 5000, "YES should be 50% (5000 bps)");
        assertEq(noPrice, 5000, "NO should be 50% (5000 bps)");
        
        // Reserves should be equal
        assertEq(Market(market).reserves(0), 50 * USDC, "YES reserve");
        assertEq(Market(market).reserves(1), 50 * USDC, "NO reserve");
    }

    /**
     * @notice Verify price formula: price = reserve / totalReserves
     */
    function testPriceFormula() public view {
        uint256 reserve = Market(market).reserves(0);
        uint256 total = Market(market).totalReserves();
        
        uint256 calculatedPrice = (reserve * 10000) / total;
        uint256 contractPrice = Market(market).getPrice(0);
        
        assertEq(calculatedPrice, contractPrice, "Price formula should match");
    }

    /**
     * @notice Verify calculateBuyPrice matches actual execution
     */
    function testCalculateBuyPrice_MatchesActual() public {
        uint256 buyAmount = 15 * USDC;
        
        // Get calculated amount
        uint256 calculated = Market(market).calculateBuyPrice(0, buyAmount);
        
        // Execute actual buy
        usdc.mint(userB, buyAmount);
        vm.startPrank(userB);
        usdc.approve(market, buyAmount);
        Market(market).buy(0, buyAmount, 0);
        vm.stopPrank();
        
        // Check balance
        address yesToken = Market(market).getOutcomeToken(0);
        uint256 actual = OutcomeToken(yesToken).balanceOf(userB);
        
        assertEq(calculated, actual, "Calculated should match actual");
    }

    /**
     * @notice Verify symmetric pricing (YES and NO cost same at 50%)
     */
    function testSymmetric_Pricing() public view {
        uint256 yesTokens = Market(market).calculateBuyPrice(0, 10 * USDC);
        uint256 noTokens = Market(market).calculateBuyPrice(1, 10 * USDC);
        
        assertEq(yesTokens, noTokens, "YES and NO should cost same at 50%");
    }

    /**
     * @notice Verify prices sum to 100%
     */
    function testPrices_SumTo100() public view {
        uint256 yesPrice = Market(market).getPrice(0);
        uint256 noPrice = Market(market).getPrice(1);
        
        assertEq(yesPrice + noPrice, 10000, "Prices should sum to 10000 bps (100%)");
    }

    /**
     * @notice Verify buying moves price correctly
     */
    function testBuy_MovesPrice() public {
        uint256 initialPrice = Market(market).getPrice(0);
        
        // Buy YES
        usdc.mint(userB, 10 * USDC);
        vm.startPrank(userB);
        usdc.approve(market, 10 * USDC);
        Market(market).buy(0, 10 * USDC, 0);
        vm.stopPrank();
        
        uint256 newPrice = Market(market).getPrice(0);
        
        assertGt(newPrice, initialPrice, "Price should increase after buy");
    }

    /**
     * @notice Verify user doesn't pay $2 per token at 50% (the old bug!)
     */
    function testRegression_TokenPrice_NotTooHigh() public view {
        uint256 buyAmount = 10 * USDC;
        uint256 tokensReceived = Market(market).calculateBuyPrice(0, buyAmount);
        
        // Effective price per token (in USDC per token)
        // If tokens use 6 decimals: price = buyAmount / tokensReceived
        uint256 pricePerToken = (buyAmount * 1e18) / tokensReceived;
        
        // At 50%, should pay ~$0.51 per token (0.5 + 2% fees)
        // Should NEVER pay more than $1 per token at 50%
        assertLt(pricePerToken, 1e18, "Should NEVER pay > $1 per token at 50%");
        
        // OLD BUG: Was paying ~$2.04 per token (10 USDC / 4.9 tokens)
        // This verifies the bug is fixed!
    }

    /**
     * @notice Verify calculateSellPrice works correctly
     */
    function testCalculateSellPrice() public {
        // Buy some tokens first
        usdc.mint(userB, 20 * USDC);
        vm.startPrank(userB);
        usdc.approve(market, 20 * USDC);
        Market(market).buy(0, 20 * USDC, 0);
        
        address yesToken = Market(market).getOutcomeToken(0);
        uint256 tokenBalance = OutcomeToken(yesToken).balanceOf(userB);
        
        // Calculate sell for half the tokens
        uint256 tokensToSell = tokenBalance / 2;
        uint256 calculated = Market(market).calculateSellPrice(0, tokensToSell);
        
        // Execute sell
        OutcomeToken(yesToken).approve(market, tokensToSell);
        Market(market).sell(0, tokensToSell, 0);
        vm.stopPrank();
        
        // Check USDC received
        uint256 usdcReceived = usdc.balanceOf(userB);
        
        assertEq(calculated, usdcReceived, "Calculated sell should match actual");
    }

    /**
     * @notice Test edge case: Very small amount
     */
    function testSmallAmount() public view {
        uint256 smallAmount = USDC / 100; // 0.01 USDC
        uint256 tokens = Market(market).calculateBuyPrice(0, smallAmount);
        
        assertGt(tokens, 0, "Should get some tokens even for small amount");
    }

    /**
     * @notice Test edge case: Large amount (equal to liquidity)
     */
    function testLargeAmount() public view {
        uint256 largeAmount = 100 * USDC;
        uint256 tokens = Market(market).calculateBuyPrice(0, largeAmount);
        
        assertGt(tokens, 0, "Should get tokens for large amount");
        
        // Price should move significantly
        // This is just checking it doesn't revert - actual price movement
        // would be checked after execution in a real scenario
    }
}
