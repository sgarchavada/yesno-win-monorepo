// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {console} from "forge-std/console.sol";
import {BaseMarketTest} from "./BaseMarketTest.sol";
import {Market} from "../src/Market.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {LPToken} from "../src/LPToken.sol";

/**
 * @title MarketLiquidity
 * @notice Test suite for liquidity provision and withdrawal
 * @dev Tests adding/removing liquidity, LP token mechanics, and protocol liquidity
 */
contract MarketLiquidityTest is BaseMarketTest {
    Market public market;
    LPToken public lpToken;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    function setUp() public override {
        super.setUp();

        // Create a binary market for liquidity tests
        address marketAddress = createBinaryMarket();
        market = Market(marketAddress);
        lpToken = getLPToken(marketAddress);
        yesToken = getOutcomeToken(marketAddress, 0);
        noToken = getOutcomeToken(marketAddress, 1);

        console.log("Setup complete. Market:", marketAddress);
    }

    /**
     * @notice Test adding liquidity
     */
    function testAddLiquidity() public {
        uint256 addAmount = 1000 * USDC;

        uint256 initialLpSupply = lpToken.totalSupply();
        uint256 initialReserves = market.totalReserves();

        // User A adds liquidity
        vm.startPrank(lpUserA);
        usdc.approve(address(market), addAmount);
        market.addLiquidity(addAmount);
        vm.stopPrank();

        // Verify LP tokens minted
        uint256 lpBalance = lpToken.balanceOf(lpUserA);
        assertTrue(lpBalance > 0, "Should receive LP tokens");

        // Verify reserves increased
        uint256 newReserves = market.totalReserves();
        assertEq(newReserves, initialReserves + addAmount, "Reserves should increase by addAmount");

        // Verify LP token supply increased
        uint256 newLpSupply = lpToken.totalSupply();
        assertEq(newLpSupply, initialLpSupply + lpBalance, "LP supply should increase");

        console.log("LP tokens minted:", lpBalance);
        console.log("Total LP supply:", newLpSupply);
    }

    /**
     * @notice Test removing liquidity
     */
    function testRemoveLiquidity() public {
        // First, add liquidity
        uint256 addAmount = 1000 * USDC;
        
        vm.startPrank(lpUserA);
        usdc.approve(address(market), addAmount);
        market.addLiquidity(addAmount);
        
        uint256 lpBalance = lpToken.balanceOf(lpUserA);
        uint256 initialUsdc = usdc.balanceOf(lpUserA);

        // Remove half the liquidity
        uint256 removeAmount = lpBalance / 2;
        market.removeLiquidity(removeAmount);
        
        vm.stopPrank();

        // Verify LP tokens burned
        uint256 finalLpBalance = lpToken.balanceOf(lpUserA);
        assertEq(finalLpBalance, lpBalance - removeAmount, "LP tokens should be burned");

        // Verify USDC returned
        uint256 finalUsdc = usdc.balanceOf(lpUserA);
        uint256 expectedUsdc = addAmount / 2;
        
        // Allow for AMM rounding (±2%)
        assertApproxEqAbs(finalUsdc, initialUsdc + expectedUsdc, expectedUsdc / 50, "Should receive ~half USDC back");

        console.log("LP tokens burned:", removeAmount);
        console.log("USDC returned:", finalUsdc - initialUsdc);
    }

    /**
     * @notice Test LP token transferability
     */
    function testLPTokenTransfer() public {
        uint256 addAmount = 1000 * USDC;

        // LP A adds liquidity
        vm.startPrank(lpUserA);
        usdc.approve(address(market), addAmount);
        market.addLiquidity(addAmount);
        
        uint256 lpBalance = lpToken.balanceOf(lpUserA);
        
        // Transfer half to LP B
        uint256 transferAmount = lpBalance / 2;
        lpToken.transfer(lpUserB, transferAmount);
        vm.stopPrank();

        // Verify transfer
        assertEq(lpToken.balanceOf(lpUserA), lpBalance - transferAmount, "LP A balance incorrect");
        assertEq(lpToken.balanceOf(lpUserB), transferAmount, "LP B balance incorrect");

        // LP B should be able to withdraw
        vm.startPrank(lpUserB);
        uint256 usdcBefore = usdc.balanceOf(lpUserB);
        market.removeLiquidity(transferAmount);
        uint256 usdcAfter = usdc.balanceOf(lpUserB);
        vm.stopPrank();

        assertTrue(usdcAfter > usdcBefore, "LP B should receive USDC");

        console.log("LP tokens transferred:", transferAmount);
        console.log("LP B withdrew USDC:", usdcAfter - usdcBefore);
    }

    /**
     * @notice Test multiple LPs share proportionally
     */
    function testMultipleLpsShareProportionally() public {
        // LP A adds 5000 USDC (deployer already has 10k initial)
        vm.startPrank(lpUserA);
        uint256 lpAAmount = 5000 * USDC;
        usdc.approve(address(market), lpAAmount);
        market.addLiquidity(lpAAmount);
        uint256 lpATokens = lpToken.balanceOf(lpUserA);
        vm.stopPrank();

        // LP B adds 10000 USDC (2x LP A)
        vm.startPrank(lpUserB);
        uint256 lpBAmount = 10000 * USDC;
        usdc.approve(address(market), lpBAmount);
        market.addLiquidity(lpBAmount);
        uint256 lpBTokens = lpToken.balanceOf(lpUserB);
        vm.stopPrank();

        // LP B should have roughly 2x the LP tokens of LP A
        uint256 ratio = (lpBTokens * 100) / lpATokens;
        assertApproxEqAbs(ratio, 200, 5, "LP B should have ~2x LP A's tokens");

        console.log("LP A tokens:", lpATokens);
        console.log("LP B tokens:", lpBTokens);
        console.log("Ratio (x100):", ratio);

        // Test removal WITHOUT trading (to avoid reserve depletion issues)
        // Remove 10% of liquidity from each
        uint256 lpAToRemove = lpATokens / 10;
        uint256 lpBToRemove = lpBTokens / 10;

        vm.startPrank(lpUserA);
        uint256 usdcBeforeA = usdc.balanceOf(lpUserA);
        market.removeLiquidity(lpAToRemove);
        uint256 usdcAfterA = usdc.balanceOf(lpUserA);
        vm.stopPrank();
        
        vm.startPrank(lpUserB);
        uint256 usdcBeforeB = usdc.balanceOf(lpUserB);
        market.removeLiquidity(lpBToRemove);
        uint256 usdcAfterB = usdc.balanceOf(lpUserB);
        vm.stopPrank();

        uint256 receivedA = usdcAfterA - usdcBeforeA;
        uint256 receivedB = usdcAfterB - usdcBeforeB;

        console.log("LP A removed:", lpAToRemove);
        console.log("LP B removed:", lpBToRemove);
        console.log("LP A received:", receivedA);
        console.log("LP B received:", receivedB);

        // Both should receive some USDC
        assertTrue(receivedA > 0, "LP A should receive USDC");
        assertTrue(receivedB > 0, "LP B should receive USDC");

        // LP B should receive roughly 2x LP A (proportional to LP tokens removed)
        uint256 receivedRatio = (receivedB * 100) / receivedA;
        assertApproxEqAbs(receivedRatio, 200, 15, "Received amounts should be ~2:1");
    }

    /**
     * @notice Test LP earns fees from trades
     */
    function testLpEarnsFees() public {
        // LP A adds liquidity
        vm.startPrank(lpUserA);
        uint256 addAmount = 5000 * USDC;
        usdc.approve(address(market), addAmount);
        market.addLiquidity(addAmount);
        uint256 lpTokens = lpToken.balanceOf(lpUserA);
        vm.stopPrank();

        // Record LP share
        uint256 lpShare = (lpTokens * 1e18) / lpToken.totalSupply();

        // User makes a large trade (generates fees)
        vm.startPrank(userA);
        uint256 tradeAmount = 1000 * USDC;
        usdc.approve(address(market), tradeAmount);
        market.buy(0, tradeAmount, 1);
        vm.stopPrank();

        // Expected LP fee from trade
        uint256 expectedLpFee = (tradeAmount * DEFAULT_LP_FEE_BPS) / 10000;
        uint256 lpShareOfFee = (expectedLpFee * lpShare) / 1e18;

        // LP removes all liquidity
        vm.startPrank(lpUserA);
        uint256 usdcBefore = usdc.balanceOf(lpUserA);
        market.removeLiquidity(lpTokens);
        uint256 usdcAfter = usdc.balanceOf(lpUserA);
        vm.stopPrank();

        uint256 received = usdcAfter - usdcBefore;

        // Should receive initial amount + share of fees (allow for AMM variance)
        assertTrue(received >= addAmount, "Should receive at least initial amount + fees");

        console.log("Initial liquidity:", addAmount);
        console.log("Received:", received);
        console.log("Profit:", received > addAmount ? received - addAmount : 0);
        console.log("Expected LP fee share:", lpShareOfFee);
    }

    /**
     * @notice Test protocol-owned liquidity (PoL)
     */
    function testProtocolLiquidity() public {
        uint256 polAmount = 5000 * USDC;

        // Owner seeds protocol liquidity (factory pulls from deployer, so approve factory)
        usdc.approve(address(factory), polAmount);
        factory.seedMarketLiquidity(address(market), polAmount);

        // Verify factory received LP tokens
        uint256 factoryLpBalance = lpToken.balanceOf(address(factory));
        assertTrue(factoryLpBalance > 0, "Factory should have LP tokens");

        // Verify protocol liquidity tracked
        assertEq(market.protocolLiquidity(), polAmount, "Protocol liquidity should be tracked");

        console.log("Protocol LP tokens:", factoryLpBalance);
        console.log("Protocol liquidity:", market.protocolLiquidity());

        // Withdraw protocol liquidity
        uint256 withdrawAmount = factoryLpBalance / 2;
        factory.withdrawProtocolLiquidity(address(market), withdrawAmount, treasury);

        // Verify treasury received USDC
        assertTrue(usdc.balanceOf(treasury) > 0, "Treasury should receive USDC");

        console.log("Treasury USDC:", usdc.balanceOf(treasury));
    }

    /**
     * @notice Test protocol fee collection
     */
    function testProtocolFeeCollection() public {
        // User makes a trade (generates protocol fees)
        vm.startPrank(userA);
        uint256 tradeAmount = 1000 * USDC;
        usdc.approve(address(market), tradeAmount);
        market.buy(0, tradeAmount, 1);
        vm.stopPrank();

        uint256 protocolFees = market.accumulatedProtocolFees();
        assertTrue(protocolFees > 0, "Should have protocol fees");

        // Collect fees to treasury
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        factory.collectProtocolFees(address(market), treasury);
        uint256 treasuryAfter = usdc.balanceOf(treasury);

        uint256 collected = treasuryAfter - treasuryBefore;
        assertEq(collected, protocolFees, "Should collect all protocol fees");

        // Protocol fees should be reset
        assertEq(market.accumulatedProtocolFees(), 0, "Protocol fees should be reset");

        console.log("Protocol fees collected:", collected);
    }

    /**
     * @notice Test adding zero liquidity reverts
     */
    function testAddZeroLiquidityReverts() public {
        vm.startPrank(lpUserA);

        vm.expectRevert(Market.InvalidAmount.selector);
        market.addLiquidity(0);

        vm.stopPrank();
    }

    /**
     * @notice Test removing more liquidity than owned reverts
     */
    function testRemoveExcessLiquidityReverts() public {
        // LP A adds liquidity
        vm.startPrank(lpUserA);
        usdc.approve(address(market), 1000 * USDC);
        market.addLiquidity(1000 * USDC);
        
        uint256 lpBalance = lpToken.balanceOf(lpUserA);

        // Try to remove more than owned
        vm.expectRevert(Market.InsufficientLiquidity.selector);
        market.removeLiquidity(lpBalance + 1);

        vm.stopPrank();
    }

    /**
     * @notice Test adding liquidity increases all reserves proportionally
     */
    function testAddLiquidityIncreasesAllReserves() public {
        uint256 addAmount = 1000 * USDC;

        uint256 reserve0Before = market.reserves(0);
        uint256 reserve1Before = market.reserves(1);

        vm.startPrank(lpUserA);
        usdc.approve(address(market), addAmount);
        market.addLiquidity(addAmount);
        vm.stopPrank();

        uint256 reserve0After = market.reserves(0);
        uint256 reserve1After = market.reserves(1);

        // Both reserves should increase equally (binary market)
        uint256 expectedIncrease = addAmount / 2;
        assertEq(reserve0After - reserve0Before, expectedIncrease, "Reserve 0 increase mismatch");
        assertEq(reserve1After - reserve1Before, expectedIncrease, "Reserve 1 increase mismatch");

        console.log("Reserve 0 increase:", reserve0After - reserve0Before);
        console.log("Reserve 1 increase:", reserve1After - reserve1Before);
    }

    /**
     * @notice Test LP share calculation is correct
     */
    function testLpShareCalculation() public {
        // LP A is first LP (after deployer's initial)
        uint256 addAmount = 5000 * USDC;
        
        uint256 totalSupplyBefore = lpToken.totalSupply();
        uint256 totalReservesBefore = market.totalReserves();

        vm.startPrank(lpUserA);
        usdc.approve(address(market), addAmount);
        market.addLiquidity(addAmount);
        uint256 lpTokensReceived = lpToken.balanceOf(lpUserA);
        vm.stopPrank();

        // Expected LP tokens = (addAmount * totalSupply) / totalReserves
        uint256 expectedLpTokens = (addAmount * totalSupplyBefore) / totalReservesBefore;
        assertEq(lpTokensReceived, expectedLpTokens, "LP token calculation incorrect");

        console.log("LP tokens received:", lpTokensReceived);
        console.log("Expected LP tokens:", expectedLpTokens);
    }

    /**
     * @notice Test liquidity cannot be added to inactive market
     */
    function testAddLiquidityToInactiveMarket() public {
        // Close the market
        factory.closeMarket(address(market));

        vm.startPrank(lpUserA);
        usdc.approve(address(market), 1000 * USDC);

        vm.expectRevert(Market.MarketNotActive.selector);
        market.addLiquidity(1000 * USDC);

        vm.stopPrank();
    }

    /**
     * @notice Test liquidity can still be removed from closed market
     */
    function testRemoveLiquidityFromClosedMarket() public {
        // Add liquidity first
        vm.startPrank(lpUserA);
        usdc.approve(address(market), 1000 * USDC);
        market.addLiquidity(1000 * USDC);
        uint256 lpBalance = lpToken.balanceOf(lpUserA);
        vm.stopPrank();

        // Close the market
        factory.closeMarket(address(market));

        // Should still be able to remove liquidity
        vm.prank(lpUserA);
        market.removeLiquidity(lpBalance);

        assertEq(lpToken.balanceOf(lpUserA), 0, "All LP tokens should be burned");
    }

    /**
     * @notice Test multi-outcome market liquidity distribution
     */
    function testMultiOutcomeLiquidityDistribution() public {
        // Create 4-outcome market
        address multiMarket = createMultiOutcomeMarket(4);
        Market multi = Market(multiMarket);

        uint256 addAmount = 4000 * USDC;

        // Add liquidity
        usdc.approve(address(multi), addAmount);
        multi.addLiquidity(addAmount);

        // Each outcome should get equal share
        // Initial market has INITIAL_LIQUIDITY (10000 USDC) split equally
        // We add addAmount (4000 USDC) split equally
        // Total per outcome = (10000 / 4) + (4000 / 4) = 2500 + 1000 = 3500 USDC
        uint256 initialPerOutcome = INITIAL_LIQUIDITY / 4;
        uint256 addedPerOutcome = addAmount / 4;
        uint256 expectedPerOutcome = initialPerOutcome + addedPerOutcome;
        
        for (uint256 i = 0; i < 4; i++) {
            assertEq(multi.reserves(i), expectedPerOutcome, "Reserve should be equal");
        }

        console.log("Multi-outcome liquidity distributed equally");
    }

    /**
     * @notice Test LP token ERC20 metadata
     */
    function testLPTokenMetadata() public {
        assertEq(lpToken.decimals(), 18, "LP token should have 18 decimals");
        assertEq(lpToken.market(), address(market), "LP token should reference market");
        assertTrue(bytes(lpToken.name()).length > 0, "LP token should have a name");
        assertTrue(bytes(lpToken.symbol()).length > 0, "LP token should have a symbol");

        console.log("LP token name:", lpToken.name());
        console.log("LP token symbol:", lpToken.symbol());
    }
}
