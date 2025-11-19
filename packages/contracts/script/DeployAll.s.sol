// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {Market} from "../src/Market.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {LPToken} from "../src/LPToken.sol";
import {OracleAdapter} from "../src/OracleAdapter.sol";
import {CreatorRegistry} from "../src/CreatorRegistry.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {ProtocolTreasury} from "../src/ProtocolTreasury.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployAll
 * @notice Automated deployment script for entire YesNo.Win platform
 * @dev Deploys all implementations, proxies, initializes contracts, and grants roles
 * 
 * Usage:
 *   forge script script/DeployAll.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --slow
 * 
 * Prerequisites:
 *   - .env file with PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, FRONTEND_WALLET_ADDRESS
 *   - Deployer wallet has ETH for gas
 */
contract DeployAll is Script {
    // Configuration
    address constant USDC_TOKEN = 0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584;
    
    // Fee configuration (in basis points)
    uint256 constant DEFAULT_LP_FEE_BPS = 100;        // 1%
    uint256 constant DEFAULT_PROTOCOL_FEE_BPS = 200;  // 2%
    uint256 constant DEFAULT_PARLAY_FEE_BPS = 50;     // 0.5%
    uint256 constant MIN_INITIAL_LIQUIDITY = 100 * 10**6;  // 100 USDC (6 decimals - collateral)
    
    // Deployed addresses
    address public marketImpl;
    address public outcomeTokenImpl;
    address public lpTokenImpl;
    address public oracleAdapterImpl;
    address public creatorRegistryImpl;
    address public marketFactoryImpl;
    address public protocolTreasuryImpl;
    
    address public creatorRegistryProxy;
    address public marketFactoryProxy;
    address public protocolTreasuryProxy;
    
    // Deployer info
    address public deployer;
    address public treasury;
    address public frontendWallet;
    
    function run() external {
        // Get deployer info
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        treasury = deployer; // Treasury = deployer wallet
        
        // Get frontend wallet for admin grants (optional)
        try vm.envAddress("FRONTEND_WALLET_ADDRESS") returns (address wallet) {
            frontendWallet = wallet;
        } catch {
            frontendWallet = address(0);
            console.log("Warning: FRONTEND_WALLET_ADDRESS not set - admin roles won't be auto-granted");
        }
        
        console.log("\n=====================================");
        console.log("YesNo.Win Deployment Script");
        console.log("=====================================");
        console.log("Deployer:        ", deployer);
        console.log("Treasury:        ", treasury);
        console.log("Frontend Wallet: ", frontendWallet);
        console.log("USDC Token:      ", USDC_TOKEN);
        console.log("Network:         ", block.chainid);
        console.log("=====================================\n");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // PHASE 1: Deploy implementations
        console.log("PHASE 1: Deploying Implementations...");
        deployImplementations();
        
        // PHASE 2: Deploy proxies
        console.log("\nPHASE 2: Deploying Proxies...");
        deployProxies();
        
        // PHASE 3: Initialize contracts
        console.log("\nPHASE 3: Initializing Contracts...");
        initializeContracts();
        
        // PHASE 4: Grant roles
        console.log("\nPHASE 4: Granting Roles...");
        grantRoles();
        
        vm.stopBroadcast();
        
        // PHASE 5: Print summary
        printSummary();
    }
    
    function deployImplementations() internal {
        console.log("  1/7 Deploying Market...");
        marketImpl = address(new Market());
        console.log("      Market:           ", marketImpl);
        
        console.log("  2/7 Deploying OutcomeToken...");
        outcomeTokenImpl = address(new OutcomeToken());
        console.log("      OutcomeToken:     ", outcomeTokenImpl);
        
        console.log("  3/7 Deploying LPToken...");
        lpTokenImpl = address(new LPToken());
        console.log("      LPToken:          ", lpTokenImpl);
        
        console.log("  4/7 Deploying OracleAdapter...");
        oracleAdapterImpl = address(new OracleAdapter());
        console.log("      OracleAdapter:    ", oracleAdapterImpl);
        
        console.log("  5/7 Deploying CreatorRegistry...");
        creatorRegistryImpl = address(new CreatorRegistry());
        console.log("      CreatorRegistry:  ", creatorRegistryImpl);
        
        console.log("  6/7 Deploying MarketFactory...");
        marketFactoryImpl = address(new MarketFactory());
        console.log("      MarketFactory:    ", marketFactoryImpl);
        
        console.log("  7/7 Deploying ProtocolTreasury...");
        protocolTreasuryImpl = address(new ProtocolTreasury());
        console.log("      ProtocolTreasury: ", protocolTreasuryImpl);
    }
    
    function deployProxies() internal {
        console.log("  1/3 Deploying CreatorRegistry Proxy...");
        creatorRegistryProxy = address(new ERC1967Proxy(
            creatorRegistryImpl,
            "" // Don't initialize yet (chicken-egg with MarketFactory)
        ));
        console.log("      CreatorRegistry Proxy: ", creatorRegistryProxy);
        
        console.log("  2/3 Deploying MarketFactory Proxy...");
        marketFactoryProxy = address(new ERC1967Proxy(
            marketFactoryImpl,
            "" // Initialize after proxy deployment
        ));
        console.log("      MarketFactory Proxy:   ", marketFactoryProxy);
        
        console.log("  3/3 Deploying ProtocolTreasury Proxy...");
        protocolTreasuryProxy = address(new ERC1967Proxy(
            protocolTreasuryImpl,
            "" // Initialize after proxy deployment
        ));
        console.log("      ProtocolTreasury Proxy:", protocolTreasuryProxy);
    }
    
    function initializeContracts() internal {
        // Initialize MarketFactory first
        console.log("  1/3 Initializing MarketFactory...");
        MarketFactory(marketFactoryProxy).initialize(
            USDC_TOKEN,                    // defaultCollateralToken
            treasury,                      // treasury
            oracleAdapterImpl,            // oracleAdapter
            creatorRegistryProxy,         // creatorRegistry (proxy!)
            DEFAULT_LP_FEE_BPS,           // defaultLpFeeBps
            DEFAULT_PROTOCOL_FEE_BPS,     // defaultProtocolFeeBps
            DEFAULT_PARLAY_FEE_BPS,       // defaultParlayFeeBps
            MIN_INITIAL_LIQUIDITY,        // minInitialLiquidity
            marketImpl,                    // marketImpl
            outcomeTokenImpl,             // outcomeTokenImpl
            lpTokenImpl                    // lpTokenImpl
        );
        console.log("      MarketFactory initialized");
        
        // Now initialize CreatorRegistry
        console.log("  2/3 Initializing CreatorRegistry...");
        CreatorRegistry(creatorRegistryProxy).initialize(marketFactoryProxy);
        console.log("      CreatorRegistry initialized");
        
        // Initialize ProtocolTreasury
        console.log("  3/3 Initializing ProtocolTreasury...");
        ProtocolTreasury(protocolTreasuryProxy).initialize(
            marketFactoryProxy,
            treasury
        );
        console.log("      ProtocolTreasury initialized");
    }
    
    function grantRoles() internal {
        // Grant MARKET_FACTORY_ROLE on CreatorRegistry
        console.log("  1/5 Granting MARKET_FACTORY_ROLE...");
        bytes32 MARKET_FACTORY_ROLE = CreatorRegistry(creatorRegistryProxy).MARKET_FACTORY_ROLE();
        CreatorRegistry(creatorRegistryProxy).grantRole(MARKET_FACTORY_ROLE, marketFactoryProxy);
        console.log("      MARKET_FACTORY_ROLE granted to MarketFactory");
        
        // Grant ADMIN_ROLE to ProtocolTreasury on MarketFactory (so it can call cancelMarket, etc.)
        console.log("  2/5 Granting ADMIN_ROLE to ProtocolTreasury on MarketFactory...");
        bytes32 ADMIN_ROLE = MarketFactory(marketFactoryProxy).ADMIN_ROLE();
        MarketFactory(marketFactoryProxy).grantRole(ADMIN_ROLE, protocolTreasuryProxy);
        console.log("      ADMIN_ROLE granted to ProtocolTreasury");
        
        // Grant admin roles to frontend wallet (if provided)
        if (frontendWallet != address(0)) {
            console.log("  3/5 Granting DEFAULT_ADMIN_ROLE on MarketFactory...");
            bytes32 DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;
            MarketFactory(marketFactoryProxy).grantRole(DEFAULT_ADMIN_ROLE, frontendWallet);
            console.log("      DEFAULT_ADMIN_ROLE granted to ", frontendWallet);
            
            console.log("  4/5 Granting ADMIN_ROLE on MarketFactory...");
            MarketFactory(marketFactoryProxy).grantRole(ADMIN_ROLE, frontendWallet);
            console.log("      ADMIN_ROLE granted to ", frontendWallet);
            
            console.log("  5/5 Granting ADMIN_ROLE on CreatorRegistry...");
            bytes32 CREATOR_ADMIN_ROLE = CreatorRegistry(creatorRegistryProxy).ADMIN_ROLE();
            CreatorRegistry(creatorRegistryProxy).grantRole(CREATOR_ADMIN_ROLE, frontendWallet);
            console.log("      ADMIN_ROLE granted to ", frontendWallet);
        } else {
            console.log("  3/5 Skipping admin role grants (no frontend wallet provided)");
            console.log("  4/5 You'll need to grant these manually later:");
            console.log("      - MarketFactory.grantRole(DEFAULT_ADMIN_ROLE, yourWallet)");
            console.log("      - MarketFactory.grantRole(ADMIN_ROLE, yourWallet)");
            console.log("      - CreatorRegistry.grantRole(ADMIN_ROLE, yourWallet)");
        }
    }
    
    function printSummary() internal view {
        console.log("\n\n");
        console.log("=====================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("=====================================\n");
        
        console.log("Copy this to your .env and apps/web/.env.local:");
        console.log("-------------------------------------");
        console.log("NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=%s", marketFactoryProxy);
        console.log("NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS=%s", creatorRegistryProxy);
        console.log("NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS=%s", protocolTreasuryProxy);
        console.log("NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=%s", oracleAdapterImpl);
        console.log("NEXT_PUBLIC_USDC_ADDRESS=%s", USDC_TOKEN);
        console.log("-------------------------------------\n");
        
        console.log("Implementation Addresses (for upgrades):");
        console.log("-------------------------------------");
        console.log("MARKET_IMPL=%s", marketImpl);
        console.log("OUTCOME_TOKEN_IMPL=%s", outcomeTokenImpl);
        console.log("LP_TOKEN_IMPL=%s", lpTokenImpl);
        console.log("ORACLE_ADAPTER_IMPL=%s", oracleAdapterImpl);
        console.log("CREATOR_REGISTRY_IMPL=%s", creatorRegistryImpl);
        console.log("MARKET_FACTORY_IMPL=%s", marketFactoryImpl);
        console.log("PROTOCOL_TREASURY_IMPL=%s", protocolTreasuryImpl);
        console.log("-------------------------------------\n");
        
        console.log("Next Steps:");
        console.log("1. Copy the .env block above to .env and apps/web/.env.local");
        console.log("2. Verify contracts: cd packages/contracts && ./script/verify-all.sh");
        console.log("3. Restart your frontend: cd apps/web && npm run dev");
        console.log("4. Test: Create a market at http://localhost:3000/create");
        
        if (frontendWallet == address(0)) {
            console.log("5. Grant admin roles manually (see phase 4 output above)");
        }
        
        console.log("\nBaseScan Links:");
        console.log("MarketFactory:    https://sepolia.basescan.org/address/%s", marketFactoryProxy);
        console.log("CreatorRegistry:  https://sepolia.basescan.org/address/%s", creatorRegistryProxy);
        console.log("ProtocolTreasury: https://sepolia.basescan.org/address/%s", protocolTreasuryProxy);
        
        console.log("\n=====================================\n");
    }
}

