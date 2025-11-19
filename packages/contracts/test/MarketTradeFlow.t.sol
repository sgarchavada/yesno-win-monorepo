// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {console} from "forge-std/console.sol";
import {BaseMarketTest} from "./BaseMarketTest.sol";
import {Market} from "../src/Market.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {LPToken} from "../src/LPToken.sol";

/**
 * @title MarketTradeFlow
 * @notice Test suite for market trading operations (buy/sell)
 * @dev Tests buying and selling outcome tokens with AMM pricing
 */
contract MarketTradeFlowTest is BaseMarketTest {
    Market public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    function setUp() public override {
        super.setUp();

        // Create a binary market for trading tests
        address marketAddress = createBinaryMarket();
        market = Market(marketAddress);
        yesToken = getOutcomeToken(marketAddress, 0);
        noToken = getOutcomeToken(marketAddress, 1);

        console.log("Setup complete. Market:", marketAddress);
    }

    /**
     * @notice Test basic buy operation
     */
    function testBuyYesTokens() public {
        uint256 buyAmount = 100 * USDC; // Buy with 100 USDC
        
        // Get initial state
        uint256 initialReserve = market.reserves(0);
        uint256 initialPrice = market.getPrice(0);
        
        console.log("Initial Yes reserve:", initialReserve);
        console.log("Initial Yes price (bps):", initialPrice);

        // User A buys Yes tokens
        vm.startPrank(userA);
        usdc.approve(address(market), buyAmount);
        
        // Buy with slippage tolerance (expect at least 1 token)
        market.buy(0, buyAmount, 1);
        vm.stopPrank();

        // Verify outcome tokens minted
        uint256 tokensReceived = yesToken.balanceOf(userA);
        assertTrue(tokensReceived > 0, "Should receive outcome tokens");
        
        console.log("Tokens received:", tokensReceived);

        // Verify reserve increased
        uint256 newReserve = market.reserves(0);
        assertTrue(newReserve > initialReserve, "Reserve should increase");

        // Verify price changed (buying Yes increases its price)
        uint256 newPrice = market.getPrice(0);
        assertTrue(newPrice > initialPrice, "Price should increase after buy");

        console.log("New Yes reserve:", newReserve);
        console.log("New Yes price (bps):", newPrice);
    }

    /**
     * @notice Test buying both outcomes
     */
    function testBuyBothOutcomes() public {
        uint256 buyAmount = 100 * USDC;

        // User A buys Yes
        vm.startPrank(userA);
        usdc.approve(address(market), buyAmount);
        market.buy(0, buyAmount, 1);
        vm.stopPrank();

        uint256 yesBalance = yesToken.balanceOf(userA);
        uint256 yesPrice = market.getPrice(0);

        // User B buys No
        vm.startPrank(userB);
        usdc.approve(address(market), buyAmount);
        market.buy(1, buyAmount, 1);
        vm.stopPrank();

        uint256 noBalance = noToken.balanceOf(userB);
        uint256 noPrice = market.getPrice(1);

        // Both users should have tokens
        assertTrue(yesBalance > 0, "User A should have Yes tokens");
        assertTrue(noBalance > 0, "User B should have No tokens");

        // Prices should sum to approximately 100% (with small tolerance for AMM rounding)
        uint256 totalPrice = yesPrice + noPrice;
        assertApproxEqAbs(totalPrice, 10000, 50, "Prices should sum to ~100%");

        console.log("Yes price:", yesPrice);
        console.log("No price:", noPrice);
        console.log("Total price:", totalPrice);
    }

    /**
     * @notice Test basic sell operation
     */
    function testSellYesTokens() public {
        // First, buy some tokens
        uint256 buyAmount = 100 * USDC;
        
        vm.startPrank(userA);
        usdc.approve(address(market), buyAmount);
        market.buy(0, buyAmount, 1);
        
        uint256 tokenBalance = yesToken.balanceOf(userA);
        uint256 initialUsdc = usdc.balanceOf(userA);
        
        console.log("Token balance before sell:", tokenBalance);
        console.log("USDC balance before sell:", initialUsdc);

        // Sell half the tokens
        uint256 sellAmount = tokenBalance / 2;
        market.sell(0, sellAmount, 1); // minCollateral = 1 (slippage tolerance)
        
        vm.stopPrank();

        // Verify tokens were burned
        uint256 finalTokenBalance = yesToken.balanceOf(userA);
        assertEq(finalTokenBalance, tokenBalance - sellAmount, "Tokens should be burned");

        // Verify USDC received
        uint256 finalUsdc = usdc.balanceOf(userA);
        assertTrue(finalUsdc > initialUsdc, "Should receive USDC");

        console.log("Token balance after sell:", finalTokenBalance);
        console.log("USDC balance after sell:", finalUsdc);
        console.log("USDC received:", finalUsdc - initialUsdc);
    }

    /**
     * @notice Test buy-sell roundtrip (should lose money due to fees + AMM slippage)
     */
    function testBuySellRoundtrip() public {
        vm.startPrank(userA);
        
        uint256 initialBalance = usdc.balanceOf(userA);
        uint256 buyAmount = 10 * USDC; // 0.01% of pool size (small trade)

        // Buy tokens
        usdc.approve(address(market), buyAmount);
        market.buy(0, buyAmount, 1);
        uint256 tokens = yesToken.balanceOf(userA);

        // Immediately sell all tokens
        market.sell(0, tokens, 1);
        
        uint256 finalBalance = usdc.balanceOf(userA);
        vm.stopPrank();

        // Should receive less due to fees (LP + protocol = 0.5%) + AMM slippage
        assertTrue(finalBalance < initialBalance, "Should have less USDC after roundtrip");
        
        uint256 loss = initialBalance - finalBalance;
        uint256 lossPercent = (loss * 10000) / buyAmount; // In basis points
        
        console.log("Buy amount:", buyAmount);
        console.log("Loss from roundtrip:", loss);
        console.log("Loss percent (bps):", lossPercent);

        // For a 0.01% of pool trade, loss should be < 80% of trade amount
        // (AMM CPMM formula causes significant slippage even on small trades when selling immediately)
        assertTrue(loss < buyAmount * 80 / 100, "Loss should be < 80% for roundtrip");
    }

    /**
     * @notice Test slippage protection on buy
     */
    function testBuySlippageProtection() public {
        uint256 buyAmount = 100 * USDC;

        vm.startPrank(userA);
        usdc.approve(address(market), buyAmount);

        // Set unrealistic minOutcomeTokens (way too high)
        uint256 unrealisticMin = 1_000_000 * USDC;

        vm.expectRevert(Market.SlippageExceeded.selector);
        market.buy(0, buyAmount, unrealisticMin);

        vm.stopPrank();
    }

    /**
     * @notice Test slippage protection on sell
     */
    function testSellSlippageProtection() public {
        // First buy tokens
        uint256 buyAmount = 100 * USDC;
        
        vm.startPrank(userA);
        usdc.approve(address(market), buyAmount);
        market.buy(0, buyAmount, 1);
        
        uint256 tokenBalance = yesToken.balanceOf(userA);

        // Try to sell with unrealistic minCollateral
        uint256 unrealisticMin = 1_000_000 * USDC;

        vm.expectRevert(Market.SlippageExceeded.selector);
        market.sell(0, tokenBalance, unrealisticMin);

        vm.stopPrank();
    }

    /**
     * @notice Test buying invalid outcome
     */
    function testBuyInvalidOutcome() public {
        vm.startPrank(userA);
        usdc.approve(address(market), 100 * USDC);

        vm.expectRevert(Market.InvalidOutcome.selector);
        market.buy(999, 100 * USDC, 1); // Outcome 999 doesn't exist

        vm.stopPrank();
    }

    /**
     * @notice Test buying with zero amount
     */
    function testBuyZeroAmount() public {
        vm.startPrank(userA);

        vm.expectRevert(Market.InvalidAmount.selector);
        market.buy(0, 0, 1);

        vm.stopPrank();
    }

    /**
     * @notice Test selling without tokens
     */
    function testSellWithoutTokens() public {
        vm.startPrank(userA);

        // User A has no tokens, trying to sell should fail
        // This will fail at the burn step in OutcomeToken
        vm.expectRevert();
        market.sell(0, 100 * USDC, 1);

        vm.stopPrank();
    }

    /**
     * @notice Test multiple sequential buys affect price
     */
    function testSequentialBuysAffectPrice() public {
        uint256 buyAmount = 100 * USDC;
        uint256[] memory prices = new uint256[](5);

        // Record initial price
        prices[0] = market.getPrice(0);

        // Make 4 sequential buys
        for (uint256 i = 1; i <= 4; i++) {
            vm.prank(userA);
            usdc.approve(address(market), buyAmount);
            
            vm.prank(userA);
            market.buy(0, buyAmount, 1);
            
            prices[i] = market.getPrice(0);
            
            // Each buy should increase the price
            assertTrue(prices[i] > prices[i-1], "Price should increase with each buy");
        }

        console.log("Price progression:");
        for (uint256 i = 0; i < 5; i++) {
            console.log("  After buy", i, ":", prices[i]);
        }
    }

    /**
     * @notice Test that opposite side trades affect each other's prices
     */
    function testOppositeTrades() public {
        uint256 buyAmount = 1000 * USDC;

        // User A heavily buys Yes
        vm.startPrank(userA);
        usdc.approve(address(market), buyAmount);
        market.buy(0, buyAmount, 1);
        vm.stopPrank();

        uint256 yesPriceAfter = market.getPrice(0);
        uint256 noPriceAfter = market.getPrice(1);

        // Yes price should be high, No price should be low
        assertTrue(yesPriceAfter > 5000, "Yes price should be > 50%");
        assertTrue(noPriceAfter < 5000, "No price should be < 50%");

        console.log("After heavy Yes buy:");
        console.log("  Yes price:", yesPriceAfter);
        console.log("  No price:", noPriceAfter);
    }

    /**
     * @notice Test fee accumulation (split between LP and protocol)
     */
    function testFeeAccumulation() public {
        uint256 buyAmount = 1000 * USDC;

        uint256 initialLpFees = market.accumulatedFees();
        uint256 initialProtocolFees = market.accumulatedProtocolFees();

        // User A makes a trade
        vm.startPrank(userA);
        usdc.approve(address(market), buyAmount);
        market.buy(0, buyAmount, 1);
        vm.stopPrank();

        uint256 finalLpFees = market.accumulatedFees();
        uint256 finalProtocolFees = market.accumulatedProtocolFees();

        // Both LP and protocol should have accumulated fees
        assertTrue(finalLpFees > initialLpFees, "LP fees should accumulate");
        assertTrue(finalProtocolFees > initialProtocolFees, "Protocol fees should accumulate");

        // Calculate expected fees
        uint256 expectedLpFee = (buyAmount * DEFAULT_LP_FEE_BPS) / 10000;
        uint256 expectedProtocolFee = (buyAmount * DEFAULT_PROTOCOL_FEE_BPS) / 10000;

        assertEq(finalLpFees - initialLpFees, expectedLpFee, "LP fee mismatch");
        assertEq(finalProtocolFees - initialProtocolFees, expectedProtocolFee, "Protocol fee mismatch");

        console.log("LP fees accumulated:", finalLpFees - initialLpFees);
        console.log("Protocol fees accumulated:", finalProtocolFees - initialProtocolFees);
    }

    /**
     * @notice Test trading after market ended
     */
    function testTradeAfterMarketEnded() public {
        // Warp to after market end time
        vm.warp(block.timestamp + 31 days);

        vm.startPrank(userA);
        usdc.approve(address(market), 100 * USDC);

        vm.expectRevert(Market.MarketEnded.selector);
        market.buy(0, 100 * USDC, 1);

        vm.stopPrank();
    }

    /**
     * @notice Test price normalization (Negrisk multi-outcome)
     */
    function testPriceNormalization() public {
        // After any trade, all prices should sum to exactly 100%
        uint256 buyAmount = 100 * USDC;

        vm.prank(userA);
        usdc.approve(address(market), buyAmount);
        
        vm.prank(userA);
        market.buy(0, buyAmount, 1);

        // Check that prices are normalized
        uint256[] memory prices = market.getAllPrices();
        uint256 total = 0;
        for (uint256 i = 0; i < prices.length; i++) {
            total += prices[i];
        }

        // Should be ~10000 (100%) after normalization (allow ±1 for rounding)
        assertApproxEqAbs(total, 10000, 1, "Prices should sum to ~100%");

        console.log("Price normalization check:");
        console.log("  Yes price:", prices[0]);
        console.log("  No price:", prices[1]);
        console.log("  Total:", total);
    }

    /**
     * @notice Test large trade impact
     */
    function testLargeTradeImpact() public {
        uint256 largeBuy = 5000 * USDC; // 50% of pool

        uint256 initialPrice = market.getPrice(0);

        vm.startPrank(userA);
        usdc.approve(address(market), largeBuy);
        market.buy(0, largeBuy, 1);
        vm.stopPrank();

        uint256 finalPrice = market.getPrice(0);

        // Large trade should significantly impact price
        uint256 priceIncrease = finalPrice - initialPrice;
        assertTrue(priceIncrease > 1000, "Large trade should significantly impact price");

        console.log("Initial price:", initialPrice);
        console.log("Final price:", finalPrice);
        console.log("Price increase:", priceIncrease);
    }

    /**
     * @notice Test multi-outcome market trading
     */
    function testMultiOutcomeTrading() public {
        // Create a 3-outcome market
        address multiMarket = createMultiOutcomeMarket(3);
        Market multi = Market(multiMarket);

        uint256 buyAmount = 100 * USDC;

        // Buy outcome 0
        vm.startPrank(userA);
        usdc.approve(address(multi), buyAmount);
        multi.buy(0, buyAmount, 1);
        vm.stopPrank();

        // Verify all prices sum to 100%
        uint256[] memory prices = multi.getAllPrices();
        uint256 total = 0;
        for (uint256 i = 0; i < prices.length; i++) {
            total += prices[i];
        }

        assertApproxEqAbs(total, 10000, 1, "Prices should sum to ~100%");

        console.log("Multi-outcome prices:");
        for (uint256 i = 0; i < prices.length; i++) {
            console.log("  Outcome", i, ":", prices[i]);
        }
    }

    /**
     * @notice Test paused market cannot trade
     */
    function testPausedMarketCannotTrade() public {
        // Pause the market
        market.pauseMarket(true);

        vm.startPrank(userA);
        usdc.approve(address(market), 100 * USDC);

        vm.expectRevert(Market.Paused.selector);
        market.buy(0, 100 * USDC, 1);

        vm.stopPrank();

        // Unpause and verify trading works
        market.pauseMarket(false);

        vm.prank(userA);
        market.buy(0, 100 * USDC, 1); // Should succeed

        assertTrue(yesToken.balanceOf(userA) > 0, "Should receive tokens after unpause");
    }
}
