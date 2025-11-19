// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Market.sol";
import "../src/MarketFactory.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title UpgradeMarket
 * @notice Deploys a new Market implementation and updates MarketFactory
 * @dev This script automatically updates the factory to use the new implementation for future markets
 */
contract UpgradeMarket is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Load existing addresses from environment
        address marketFactoryProxy = vm.envAddress("NEXT_PUBLIC_MARKET_FACTORY_ADDRESS");
        address outcomeTokenImpl = vm.envAddress("OUTCOME_TOKEN_IMPL");
        address lpTokenImpl = vm.envAddress("LP_TOKEN_IMPL");
        
        console.log("\n=== Market Implementation Upgrade ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Market Factory:", marketFactoryProxy);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new Market implementation
        console.log("\n1. Deploying new Market implementation...");
        Market newMarketImpl = new Market();
        console.log("   New Market Implementation:", address(newMarketImpl));
        
        // 2. Update MarketFactory to use new implementation for future markets
        console.log("\n2. Updating MarketFactory default implementation...");
        MarketFactory factory = MarketFactory(marketFactoryProxy);
        factory.setImplementations(
            address(newMarketImpl),
            outcomeTokenImpl,
            lpTokenImpl
        );
        console.log("   MarketFactory updated successfully!");
        console.log("   All NEW markets will now use v26");
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Complete ===");
        console.log("SUCCESS: MarketFactory now deploys v26 markets by default!");
        console.log("New Market Implementation:", address(newMarketImpl));
        
        console.log("\n=== For Existing Markets ===");
        console.log("To upgrade an existing market to v26, run:");
        console.log("cast send", marketFactoryProxy, "\\");
        console.log("  \"upgradeMarket(address,address)\" \\");
        console.log("  <MARKET_ADDRESS>", address(newMarketImpl), "\\");
        console.log("  --rpc-url $BASE_SEPOLIA_RPC_URL \\");
        console.log("  --private-key $PRIVATE_KEY");
        
        console.log("\n=== Update .env ===");
        console.log("Add this to your packages/contracts/.env:");
        console.log(string.concat("MARKET_IMPL=", vm.toString(address(newMarketImpl))));
        console.log("\nNext steps: run script/verify-contract.sh with the new implementation address to verify on Basescan.");
    }
}

