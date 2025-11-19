// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {console} from "forge-std/console.sol";
import {BaseMarketTest} from "./BaseMarketTest.sol";
import {Market} from "../src/Market.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {LPToken} from "../src/LPToken.sol";

/**
 * @title MarketResolutionAndClaim
 * @notice Test suite for market resolution and winner claims
 * @dev Tests resolution, claiming winnings, and partial claims
 */
contract MarketResolutionAndClaimTest is BaseMarketTest {
    Market public market;
    LPToken public lpToken;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    function setUp() public override {
        super.setUp();

        // Create a binary market
        address marketAddress = createBinaryMarket();
        market = Market(marketAddress);
        lpToken = getLPToken(marketAddress);
        yesToken = getOutcomeToken(marketAddress, 0);
        noToken = getOutcomeToken(marketAddress, 1);

        // Have users buy some tokens for testing
        vm.startPrank(userA);
        usdc.approve(address(market), 1000 * USDC);
        market.buy(0, 1000 * USDC, 1); // Buy Yes tokens
        uint256 yesBalance = yesToken.balanceOf(userA);
        console.log("User A Yes token balance after buy:", yesBalance);
        vm.stopPrank();

        vm.startPrank(userB);
        usdc.approve(address(market), 1000 * USDC);
        market.buy(1, 1000 * USDC, 1); // Buy No tokens
        uint256 noBalance = noToken.balanceOf(userB);
        console.log("User B No token balance after buy:", noBalance);
        vm.stopPrank();

        console.log("Setup complete. Market:", marketAddress);
    }

    /**
     * @notice Test resolving market to outcome 0 (Yes)
     */
    function testResolveMarketToYes() public {
        // Resolve to Yes (outcome 0)
        market.resolve(0);

        // Verify market resolved
        (,,,, bool resolved, uint256 winningOutcome) = market.getMarketInfo();
        assertTrue(resolved, "Market should be resolved");
        assertEq(winningOutcome, 0, "Winning outcome should be 0");

        console.log("Market resolved to Yes");
    }

    /**
     * @notice Test resolving via factory
     */
    function testResolveViaFactory() public {
        factory.resolveMarket(address(market), 1);

        (,,,, bool resolved, uint256 winningOutcome) = market.getMarketInfo();
        assertTrue(resolved, "Market should be resolved");
        assertEq(winningOutcome, 1, "Winning outcome should be 1");

        console.log("Market resolved via factory");
    }

    /**
     * @notice Test resolving via oracle adapter
     */
    function testResolveViaOracle() public {
        oracle.resolveDirectly(address(market), 0);

        (,,,, bool resolved,) = market.getMarketInfo();
        assertTrue(resolved, "Market should be resolved");

        console.log("Market resolved via oracle");
    }

    /**
     * @notice Test claiming winnings (full amount)
     */
    function testClaimWinnings() public {
        uint256 yesTokenBalance = yesToken.balanceOf(userA);
        assertTrue(yesTokenBalance > 0, "User A should have Yes tokens");

        // Resolve to Yes
        market.resolve(0);

        // User A claims
        uint256 usdcBefore = usdc.balanceOf(userA);
        
        vm.prank(userA);
        market.claim();

        uint256 usdcAfter = usdc.balanceOf(userA);

        // Should receive 1:1 (1 winning token = 1 USDC)
        assertEq(usdcAfter - usdcBefore, yesTokenBalance, "Should receive equal USDC");
        assertEq(yesToken.balanceOf(userA), 0, "Yes tokens should be burned");

        console.log("Claimed:", usdcAfter - usdcBefore);
    }

    /**
     * @notice Test partial claiming (new feature!)
     */
    function testPartialClaim() public {
        // Check balance before resolve
        uint256 balanceBeforeResolve = yesToken.balanceOf(userA);
        console.log("User A balance BEFORE resolve:", balanceBeforeResolve);
        
        // Resolve to Yes
        market.resolve(0);

        uint256 totalTokens = yesToken.balanceOf(userA);
        console.log("User A balance AFTER resolve:", totalTokens);
        
        (,,,, bool resolved, uint256 winningOutcome) = market.getMarketInfo();
        console.log("Market resolved:", resolved);
        console.log("Winning outcome:", winningOutcome);
        
        assertTrue(totalTokens > 0, "User A should have Yes tokens from setUp");
        
        uint256 claimAmount1 = totalTokens / 3;
        uint256 claimAmount2 = totalTokens / 3;

        // First partial claim
        vm.startPrank(userA);
        uint256 usdcBefore1 = usdc.balanceOf(userA);
        market.claim(claimAmount1);
        uint256 usdcAfter1 = usdc.balanceOf(userA);
        vm.stopPrank();

        assertEq(usdcAfter1 - usdcBefore1, claimAmount1, "First claim amount mismatch");
        assertEq(market.partialClaimAmounts(userA), claimAmount1, "Partial claim tracking mismatch");

        // Second partial claim
        vm.startPrank(userA);
        uint256 usdcBefore2 = usdc.balanceOf(userA);
        market.claim(claimAmount2);
        uint256 usdcAfter2 = usdc.balanceOf(userA);
        vm.stopPrank();

        assertEq(usdcAfter2 - usdcBefore2, claimAmount2, "Second claim amount mismatch");
        assertEq(market.partialClaimAmounts(userA), claimAmount1 + claimAmount2, "Total claimed tracking mismatch");

        // Can claim remaining
        uint256 remaining = yesToken.balanceOf(userA);
        vm.startPrank(userA);
        market.claim(remaining);
        vm.stopPrank();

        assertEq(yesToken.balanceOf(userA), 0, "All tokens should be claimed");
        assertEq(market.partialClaimAmounts(userA), totalTokens, "Total claimed should match initial balance");

        console.log("Partial claims completed successfully");
    }

    /**
     * @notice Test losers cannot claim
     */
    function testLoserCannotClaim() public {
        // Resolve to Yes
        market.resolve(0);

        // User B holds No tokens (losing outcome)
        uint256 noTokenBalance = noToken.balanceOf(userB);
        assertTrue(noTokenBalance > 0, "User B should have No tokens");

        // User B tries to claim
        vm.prank(userB);
        vm.expectRevert(Market.NoWinningTokens.selector);
        market.claim();

        console.log("Loser correctly cannot claim");
    }

    /**
     * @notice Test cannot claim before resolution
     */
    function testCannotClaimBeforeResolution() public {
        vm.prank(userA);
        vm.expectRevert(Market.MarketNotResolved.selector);
        market.claim();
    }

    /**
     * @notice Test cannot resolve twice
     */
    function testCannotResolveTwice() public {
        market.resolve(0);

        vm.expectRevert(Market.AlreadyResolved.selector);
        market.resolve(1);
    }

    /**
     * @notice Test resolving to invalid outcome
     */
    function testResolveInvalidOutcome() public {
        vm.expectRevert(Market.InvalidOutcome.selector);
        market.resolve(999); // Outcome 999 doesn't exist
    }

    /**
     * @notice Test multiple users claiming
     */
    function testMultipleUsersClaim() public {
        // User C also buys Yes tokens
        vm.startPrank(userC);
        usdc.approve(address(market), 500 * USDC);
        market.buy(0, 500 * USDC, 1);
        vm.stopPrank();

        uint256 userATokens = yesToken.balanceOf(userA);
        uint256 userCTokens = yesToken.balanceOf(userC);
        
        assertTrue(userATokens > 0, "User A should have Yes tokens");
        assertTrue(userCTokens > 0, "User C should have Yes tokens");

        // Resolve to Yes
        market.resolve(0);

        // Both users claim
        vm.startPrank(userA);
        uint256 usdcBeforeA = usdc.balanceOf(userA);
        market.claim();
        uint256 usdcAfterA = usdc.balanceOf(userA);
        vm.stopPrank();

        vm.startPrank(userC);
        uint256 usdcBeforeC = usdc.balanceOf(userC);
        market.claim();
        uint256 usdcAfterC = usdc.balanceOf(userC);
        vm.stopPrank();

        // Verify both received correct amounts
        assertEq(usdcAfterA - usdcBeforeA, userATokens, "User A claim mismatch");
        assertEq(usdcAfterC - usdcBeforeC, userCTokens, "User C claim mismatch");

        console.log("User A claimed:", usdcAfterA - usdcBeforeA);
        console.log("User C claimed:", usdcAfterC - usdcBeforeC);
    }

    /**
     * @notice Test claiming with zero winning tokens
     */
    function testClaimWithZeroTokens() public {
        market.resolve(0);

        // User who never bought tries to claim
        vm.prank(makeAddr("randomUser"));
        vm.expectRevert(Market.NoWinningTokens.selector);
        market.claim();
    }

    /**
     * @notice Test partial claim with zero amount reverts
     */
    function testPartialClaimZeroAmount() public {
        market.resolve(0);

        vm.prank(userA);
        vm.expectRevert(Market.InvalidAmount.selector);
        market.claim(0);
    }

    /**
     * @notice Test partial claim exceeds balance reverts
     */
    function testPartialClaimExceedsBalance() public {
        market.resolve(0);

        uint256 balance = yesToken.balanceOf(userA);

        vm.prank(userA);
        vm.expectRevert(Market.InsufficientBalance.selector);
        market.claim(balance + 1);
    }

    /**
     * @notice Test multi-outcome market resolution and claims
     */
    function testMultiOutcomeResolution() public {
        // Create 3-outcome market
        address multiMarket = createMultiOutcomeMarket(3);
        Market multi = Market(multiMarket);

        // Users buy different outcomes
        vm.startPrank(userA);
        usdc.approve(address(multi), 1000 * USDC);
        multi.buy(0, 1000 * USDC, 1);
        vm.stopPrank();

        vm.startPrank(userB);
        usdc.approve(address(multi), 1000 * USDC);
        multi.buy(1, 1000 * USDC, 1);
        vm.stopPrank();

        vm.startPrank(userC);
        usdc.approve(address(multi), 1000 * USDC);
        multi.buy(2, 1000 * USDC, 1);
        vm.stopPrank();

        // Verify users have tokens
        OutcomeToken outcome0 = OutcomeToken(multi.getOutcomeToken(0));
        OutcomeToken outcome1 = OutcomeToken(multi.getOutcomeToken(1));
        OutcomeToken outcome2 = OutcomeToken(multi.getOutcomeToken(2));
        
        assertTrue(outcome0.balanceOf(userA) > 0, "User A should have outcome 0 tokens");
        assertTrue(outcome1.balanceOf(userB) > 0, "User B should have outcome 1 tokens");
        assertTrue(outcome2.balanceOf(userC) > 0, "User C should have outcome 2 tokens");

        // Resolve to outcome 1
        multi.resolve(1);

        // Only User B (who bought outcome 1) can claim
        uint256 userBBalanceBefore = usdc.balanceOf(userB);
        
        vm.startPrank(userB);
        multi.claim();
        vm.stopPrank();
        
        uint256 userBBalanceAfter = usdc.balanceOf(userB);
        uint256 winnings = userBBalanceAfter - userBBalanceBefore;
        
        assertTrue(winnings > 0, "User B should receive winnings");
        console.log("User B winnings:", winnings);

        // User A and C cannot claim
        vm.startPrank(userA);
        vm.expectRevert(Market.NoWinningTokens.selector);
        multi.claim();
        vm.stopPrank();

        vm.startPrank(userC);
        vm.expectRevert(Market.NoWinningTokens.selector);
        multi.claim();
        vm.stopPrank();

        console.log("Multi-outcome resolution and claims work correctly");
    }

    /**
     * @notice Test resolution by authorized oracle
     */
    function testOracleResolution() public {
        // Authorize an oracle
        address authorizedOracle = makeAddr("authorizedOracle");
        oracle.setOracleAuthorization(authorizedOracle, true);

        // Oracle submits resolution
        oracle.requestResolution(address(market), "Will ETH reach $5000?", "");
        uint256 requestId = oracle.getRequestIdForMarket(address(market));

        vm.prank(authorizedOracle);
        oracle.fulfillResolution(requestId, 0);

        // Verify market resolved
        (,,,, bool resolved, uint256 winningOutcome) = market.getMarketInfo();
        assertTrue(resolved, "Market should be resolved");
        assertEq(winningOutcome, 0, "Winning outcome should be 0");

        console.log("Oracle resolution successful");
    }

    /**
     * @notice Test market status after resolution
     */
    function testMarketStatusAfterResolution() public {
        (,,, Market.MarketStatus statusBefore,,) = market.getMarketInfo();
        assertEq(uint8(statusBefore), uint8(Market.MarketStatus.ACTIVE), "Should be active");

        market.resolve(0);

        (,,, Market.MarketStatus statusAfter,,) = market.getMarketInfo();
        assertEq(uint8(statusAfter), uint8(Market.MarketStatus.RESOLVED), "Should be resolved");
    }

    /**
     * @notice Test claiming updates event emission
     */
    function testClaimEmitsEvent() public {
        market.resolve(0);

        uint256 claimAmount = yesToken.balanceOf(userA);

        vm.prank(userA);
        vm.expectEmit(true, false, false, true);
        emit Market.WinningsClaimed(userA, claimAmount, claimAmount);
        market.claim();
    }

    /**
     * @notice Test partial claim tracking persistence
     */
    function testPartialClaimPersistence() public {
        market.resolve(0);

        uint256 totalTokens = yesToken.balanceOf(userA);
        assertTrue(totalTokens > 0, "User A should have Yes tokens from setUp");
        
        uint256 firstClaim = totalTokens / 4;
        uint256 secondClaim = totalTokens / 4;
        uint256 thirdClaim = totalTokens / 4;

        // Make 3 partial claims
        vm.startPrank(userA);
        market.claim(firstClaim);
        market.claim(secondClaim);
        market.claim(thirdClaim);
        vm.stopPrank();

        // Check total claimed
        uint256 totalClaimed = market.partialClaimAmounts(userA);
        assertEq(totalClaimed, firstClaim + secondClaim + thirdClaim, "Total claimed mismatch");

        // Can still claim remaining
        uint256 remaining = yesToken.balanceOf(userA);
        assertTrue(remaining > 0, "Should have remaining tokens");

        vm.prank(userA);
        market.claim(remaining);

        assertEq(yesToken.balanceOf(userA), 0, "All tokens claimed");
        assertEq(market.partialClaimAmounts(userA), totalTokens, "Final total claimed mismatch");

        console.log("Partial claim persistence verified");
    }

    /**
     * @notice Test canceling market allows refunds (future feature)
     */
    function testCanceledMarket() public {
        factory.cancelMarket(address(market), "Test cancellation for refund scenario");

        (,,, Market.MarketStatus status,,) = market.getMarketInfo();
        assertEq(uint8(status), uint8(Market.MarketStatus.CANCELED), "Should be canceled");

        // TODO: Implement refund logic for canceled markets
        console.log("Market canceled successfully");
    }

    /**
     * @notice Test resolution after market end time
     */
    function testResolutionAfterEndTime() public {
        // Warp past end time
        vm.warp(block.timestamp + 31 days);

        // Should still be able to resolve
        market.resolve(0);

        (,,,, bool resolved,) = market.getMarketInfo();
        assertTrue(resolved, "Should be resolved after end time");
    }

    /**
     * @notice Test fulfill oracle resolution function
     */
    function testFulfillOracleResolution() public {
        // Call fulfillOracleResolution directly (as oracle adapter)
        vm.prank(address(oracle));
        market.fulfillOracleResolution(1);

        (,,,, bool resolved, uint256 winningOutcome) = market.getMarketInfo();
        assertTrue(resolved, "Market should be resolved");
        assertEq(winningOutcome, 1, "Winning outcome should be 1");

        console.log("Oracle fulfillment successful");
    }
}
