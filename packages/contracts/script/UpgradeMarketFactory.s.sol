// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {MarketFactory} from "../src/MarketFactory.sol";

/**
 * @title UpgradeMarketFactory
 * @notice Script to upgrade MarketFactory implementation and update minInitialLiquidity
 * @dev This script:
 *      1. Deploys new MarketFactory implementation
 *      2. Upgrades the proxy to the new implementation
 *      3. Updates minInitialLiquidity to 100 * 10**6 (100 USDC with 6 decimals)
 * 
 * Usage:
 *   forge script script/UpgradeMarketFactory.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --slow
 * 
 * Prerequisites:
 *   - .env file with PRIVATE_KEY, NEXT_PUBLIC_MARKET_FACTORY_ADDRESS
 *   - Deployer wallet must be owner/admin of MarketFactory proxy
 */
contract UpgradeMarketFactory is Script {
    // New minimum liquidity value (100 USDC with 6 decimals)
    uint256 constant NEW_MIN_LIQUIDITY = 100 * 10**6;  // 100 USDC (6 decimals - collateral)
    
    function run() external {
        // Get deployer info
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get existing proxy address
        address marketFactoryProxy = vm.envAddress("NEXT_PUBLIC_MARKET_FACTORY_ADDRESS");
        
        console.log("\n=====================================");
        console.log("MarketFactory Upgrade Script");
        console.log("=====================================");
        console.log("Deployer:        ", deployer);
        console.log("Proxy Address:   ", marketFactoryProxy);
        console.log("Network:         ", block.chainid);
        console.log("=====================================\n");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Deploy new MarketFactory implementation
        console.log("Step 1: Deploying new MarketFactory implementation...");
        MarketFactory newImplementation = new MarketFactory();
        console.log("  New Implementation:", address(newImplementation));
        
        // Step 2: Upgrade proxy to new implementation
        console.log("\nStep 2: Upgrading proxy to new implementation...");
        MarketFactory factory = MarketFactory(marketFactoryProxy);
        factory.upgradeToAndCall(address(newImplementation), "");
        console.log("  Proxy upgraded successfully!");
        
        // Step 3: Update minInitialLiquidity
        console.log("\nStep 3: Updating minInitialLiquidity...");
        console.log("  Old value:", factory.minInitialLiquidity());
        factory.setMinInitialLiquidity(NEW_MIN_LIQUIDITY);
        console.log("  New value:", factory.minInitialLiquidity());
        console.log("  Updated successfully!");
        
        vm.stopBroadcast();
        
        // Print summary
        printSummary(marketFactoryProxy, address(newImplementation));
    }
    
    function printSummary(address proxy, address implementation) internal view {
        console.log("\n\n");
        console.log("=====================================");
        console.log("UPGRADE COMPLETE!");
        console.log("=====================================\n");
        
        console.log("MarketFactory Proxy:    ", proxy);
        console.log("New Implementation:     ", implementation);
        console.log("New Min Liquidity:      ", NEW_MIN_LIQUIDITY, "(100 USDC with 6 decimals)");
        
        console.log("\nUpdate your .env:");
        console.log("-------------------------------------");
        console.log("MARKET_FACTORY_IMPL=%s", implementation);
        console.log("-------------------------------------\n");
        
        console.log("Next Steps:");
        console.log("1. Update MARKET_FACTORY_IMPL in .env");
        console.log("2. Verify new implementation:");
        console.log("   forge verify-contract \\");
        console.log("     %s \\", implementation);
        console.log("     src/MarketFactory.sol:MarketFactory \\");
        console.log("     --chain base-sepolia \\");
        console.log("     --watch");
        console.log("3. Restart frontend: cd apps/web && npm run dev");
        console.log("4. Test: Create a market - should show 100.00 PMT minimum\n");
        
        console.log("BaseScan Links:");
        console.log("Proxy:          https://sepolia.basescan.org/address/%s", proxy);
        console.log("Implementation: https://sepolia.basescan.org/address/%s", implementation);
        
        console.log("\n=====================================\n");
    }
}

