// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {console} from "forge-std/console.sol";
import {BaseMarketTest} from "./BaseMarketTest.sol";
import {Market} from "../src/Market.sol";
import {LPToken} from "../src/LPToken.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";

/**
 * @title TotalReservesTest
 * @notice Comprehensive tests for totalReserves consistency
 * @dev Tests the fixes for:
 *      1. Integer division remainder in _initializeReserves
 *      2. Rounding drift in _normalizePrices
 */
contract TotalReservesTest is BaseMarketTest {
    /**
     * @notice Test 1: Even initial liquidity (no remainder)
     */
    function testEvenInitialLiquidity() public {
        uint256 initialLiquidity = 200 * USDC; // 200 USDC (even split)
        
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";
        
        vm.prank(deployer);
        address marketAddr = factory.createMarket(
            "Test Market",
            outcomes,
            block.timestamp + 7 days,
            address(usdc),
            initialLiquidity,
            200 // 2% total fee
        );
        
        Market market = Market(marketAddr);
        
        // Check reserves
        uint256 reserve0 = market.reserves(0);
        uint256 reserve1 = market.reserves(1);
        uint256 totalReserves = market.totalReserves();
        
        console.log("Even Liquidity Test:");
        console.log("  Initial Liquidity:", initialLiquidity);
        console.log("  Reserve[0]:", reserve0);
        console.log("  Reserve[1]:", reserve1);
        console.log("  Sum of reserves:", reserve0 + reserve1);
        console.log("  totalReserves:", totalReserves);
        
        // Assert: sum of reserves equals totalReserves
        assertEq(reserve0 + reserve1, totalReserves, "Sum of reserves should equal totalReserves");
        assertEq(totalReserves, initialLiquidity, "totalReserves should equal initial liquidity");
    }
    
    /**
     * @notice Test 2: Odd initial liquidity (with remainder)
     */
    function testOddInitialLiquidity() public {
        uint256 initialLiquidity = 197 * USDC; // 197 USDC (odd, remainder = 1)
        
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";
        
        vm.prank(deployer);
        address marketAddr = factory.createMarket(
            "Test Market Odd",
            outcomes,
            block.timestamp + 7 days,
            address(usdc),
            initialLiquidity,
            200
        );
        
        Market market = Market(marketAddr);
        
        uint256 reserve0 = market.reserves(0);
        uint256 reserve1 = market.reserves(1);
        uint256 totalReserves = market.totalReserves();
        
        console.log("\nOdd Liquidity Test:");
        console.log("  Initial Liquidity:", initialLiquidity);
        console.log("  Reserve[0]:", reserve0);
        console.log("  Reserve[1]:", reserve1);
        console.log("  Sum of reserves:", reserve0 + reserve1);
        console.log("  totalReserves:", totalReserves);
        console.log("  Expected per outcome:", initialLiquidity / 2);
        console.log("  Remainder:", initialLiquidity % 2);
        
        // Assert: sum of reserves equals totalReserves (no loss from integer division)
        assertEq(reserve0 + reserve1, totalReserves, "Sum of reserves should equal totalReserves");
        assertEq(totalReserves, initialLiquidity, "totalReserves should equal initial liquidity");
        
        // Assert: reserve0 should have the remainder added
        assertEq(reserve0, (initialLiquidity / 2) + (initialLiquidity % 2), "Reserve[0] should include remainder");
        assertEq(reserve1, initialLiquidity / 2, "Reserve[1] should be base amount");
    }
    
    /**
     * @notice Test 3: Multiple trades and normalization
     */
    function testMultipleTradesWithNormalization() public {
        address marketAddr = createBinaryMarket();
        Market market = Market(marketAddr);
        
        console.log("\nMultiple Trades Test:");
        console.log("Initial state:");
        _logReserves(market);
        
        // Trade 1: Buy outcome 0
        vm.prank(userA);
        usdc.approve(address(factory), 10 * USDC);
        vm.prank(userA);
        factory.buyFor(marketAddr, 0, 10 * USDC, 0);
        
        console.log("\nAfter Trade 1 (Buy 10 USDC of outcome 0):");
        _logReserves(market);
        _assertReservesConsistency(market, "After Trade 1");
        
        // Trade 2: Buy outcome 1
        vm.prank(userB);
        usdc.approve(address(factory), 15 * USDC);
        vm.prank(userB);
        factory.buyFor(marketAddr, 1, 15 * USDC, 0);
        
        console.log("\nAfter Trade 2 (Buy 15 USDC of outcome 1):");
        _logReserves(market);
        _assertReservesConsistency(market, "After Trade 2");
        
        // Trade 3: Buy outcome 0 again
        vm.prank(userA);
        usdc.approve(address(factory), 20 * USDC);
        vm.prank(userA);
        factory.buyFor(marketAddr, 0, 20 * USDC, 0);
        
        console.log("\nAfter Trade 3 (Buy 20 USDC of outcome 0):");
        _logReserves(market);
        _assertReservesConsistency(market, "After Trade 3");
        
        // Trade 4: Sell some outcome 0 tokens
        OutcomeToken outcome0 = market.outcomeTokens(0);
        uint256 outcome0Balance = outcome0.balanceOf(userA);
        vm.prank(userA);
        market.sell(0, outcome0Balance / 2, 0);
        
        console.log("\nAfter Trade 4 (Sell half of outcome 0 tokens):");
        _logReserves(market);
        _assertReservesConsistency(market, "After Trade 4");
    }
    
    /**
     * @notice Test 4: Add and remove liquidity
     */
    function testLiquidityOperations() public {
        address marketAddr = createBinaryMarket();
        Market market = Market(marketAddr);
        
        console.log("\nLiquidity Operations Test:");
        console.log("Initial state:");
        _logReserves(market);
        
        // Add liquidity
        vm.prank(userC);
        usdc.approve(address(factory), 100 * USDC);
        vm.prank(userC);
        factory.addLiquidityFor(marketAddr, 100 * USDC);
        
        console.log("\nAfter adding 100 USDC liquidity:");
        _logReserves(market);
        _assertReservesConsistency(market, "After Add Liquidity");
        
        // Do some trades
        vm.prank(userA);
        usdc.approve(address(factory), 30 * USDC);
        vm.prank(userA);
        factory.buyFor(marketAddr, 0, 30 * USDC, 0);
        
        console.log("\nAfter trade:");
        _logReserves(market);
        _assertReservesConsistency(market, "After Trade");
        
        // Remove some liquidity
        LPToken lpToken = market.lpToken();
        uint256 lpBalance = lpToken.balanceOf(userC);
        
        vm.prank(userC);
        market.removeLiquidity(lpBalance / 2);
        
        console.log("\nAfter removing half LP tokens:");
        _logReserves(market);
        _assertReservesConsistency(market, "After Remove Liquidity");
    }
    
    /**
     * @notice Test 5: Stress test with many small trades
     */
    function testManySmallTrades() public {
        uint256 initialLiquidity = 1000 * USDC;
        
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";
        
        vm.prank(deployer);
        address marketAddr = factory.createMarket(
            "Test Market Stress",
            outcomes,
            block.timestamp + 7 days,
            address(usdc),
            initialLiquidity,
            200
        );
        
        Market market = Market(marketAddr);
        
        console.log("\nStress Test (50 small trades):");
        console.log("Initial state:");
        _logReserves(market);
        
        // Execute 50 small trades alternating between outcomes
        for (uint256 i = 0; i < 50; i++) {
            address trader = i % 2 == 0 ? userA : userB;
            uint256 outcome = i % 2;
            uint256 amount = 1 * USDC; // 1 USDC
            
            vm.prank(trader);
            usdc.approve(address(factory), amount);
            vm.prank(trader);
            factory.buyFor(marketAddr, outcome, amount, 0);
        }
        
        console.log("\nAfter 50 trades:");
        _logReserves(market);
        _assertReservesConsistency(market, "After 50 trades");
        
        // Check that drift is minimal (should be 0 with our fix)
        uint256 reserve0 = market.reserves(0);
        uint256 reserve1 = market.reserves(1);
        uint256 totalReserves = market.totalReserves();
        uint256 sumReserves = reserve0 + reserve1;
        
        if (sumReserves != totalReserves) {
            uint256 drift = sumReserves > totalReserves ? sumReserves - totalReserves : totalReserves - sumReserves;
            console.log("  Drift detected:", drift);
            assertLt(drift, 100, "Drift should be less than 100 (0.0001 USDC)");
        }
    }
    
    /**
     * @notice Test 6: Edge case - Prime number liquidity
     */
    function testPrimeNumberLiquidity() public {
        uint256 initialLiquidity = 199 * USDC; // 199 is prime
        
        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";
        
        vm.prank(deployer);
        address marketAddr = factory.createMarket(
            "Test Market Prime",
            outcomes,
            block.timestamp + 7 days,
            address(usdc),
            initialLiquidity,
            200
        );
        
        Market market = Market(marketAddr);
        
        console.log("\nPrime Number Liquidity Test:");
        console.log("  Initial Liquidity:", initialLiquidity);
        _logReserves(market);
        _assertReservesConsistency(market, "Prime liquidity");
    }
    
    /**
     * @notice Test 7: After market resolution
     */
    function testAfterResolution() public {
        address marketAddr = createBinaryMarket();
        Market market = Market(marketAddr);
        
        // Do some trades
        vm.prank(userA);
        usdc.approve(address(factory), 50 * USDC);
        vm.prank(userA);
        factory.buyFor(marketAddr, 0, 50 * USDC, 0);
        
        console.log("\nResolution Test:");
        console.log("Before resolution:");
        _logReserves(market);
        _assertReservesConsistency(market, "Before resolution");
        
        // Fast forward past end time (market ends in 30 days from createBinaryMarket)
        vm.warp(block.timestamp + 31 days);
        
        // Resolve market (using oracle adapter, not factory)
        vm.prank(address(oracle));
        market.resolve(0);
        
        console.log("\nAfter resolution:");
        _logReserves(market);
        _assertReservesConsistency(market, "After resolution");
    }
    
    // ─────────────────────────────────────────────────────────────────────────────
    // Helper Functions
    // ─────────────────────────────────────────────────────────────────────────────
    
    function _logReserves(Market market) internal view {
        uint256 reserve0 = market.reserves(0);
        uint256 reserve1 = market.reserves(1);
        uint256 totalReserves = market.totalReserves();
        uint256 accumulatedFees = market.accumulatedFees();
        
        console.log("  Reserve[0]:", reserve0);
        console.log("  Reserve[1]:", reserve1);
        console.log("  Sum:", reserve0 + reserve1);
        console.log("  totalReserves:", totalReserves);
        console.log("  accumulatedFees:", accumulatedFees);
        console.log("  Difference:", reserve0 + reserve1 > totalReserves ? 
            reserve0 + reserve1 - totalReserves : 
            totalReserves - (reserve0 + reserve1));
    }
    
    function _assertReservesConsistency(Market market, string memory context) internal view {
        uint256 reserve0 = market.reserves(0);
        uint256 reserve1 = market.reserves(1);
        uint256 totalReserves = market.totalReserves();
        
        assertEq(
            reserve0 + reserve1, 
            totalReserves, 
            string(abi.encodePacked(context, ": Sum of reserves should equal totalReserves"))
        );
    }
}
