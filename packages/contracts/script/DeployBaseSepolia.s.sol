// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {Market} from "../src/Market.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {OracleAdapter} from "../src/OracleAdapter.sol";
import {LPToken} from "../src/LPToken.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployBaseSepolia
 * @notice Automated deployment script for YesNo.Win to Base Sepolia
 * @dev Deploys all contracts, creates JSON artifact, and outputs env vars
 * 
 * Usage:
 *   forge script script/DeployBaseSepolia.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BASESCAN_API_KEY
 * 
 * After deployment:
 *   node script/post-deploy.js
 */
contract DeployBaseSepolia is Script {
    // Base Sepolia USDC address (official testnet USDC)
    address public constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    
    // Fee Configuration (in basis points, 1 bp = 0.01%)
    uint256 public constant DEFAULT_LP_FEE_BPS = 150;        // 1.5% to LPs
    uint256 public constant DEFAULT_PROTOCOL_FEE_BPS = 50;   // 0.5% to protocol
    uint256 public constant DEFAULT_PARLAY_FEE_BPS = 100;    // 1.0% on parlay trades
    uint256 public constant MIN_INITIAL_LIQUIDITY = 100 * 1e6; // 100 USDC (6 decimals)
    
    // Deployment results (saved for JSON export)
    struct DeploymentResult {
        address marketImpl;
        address outcomeTokenImpl;
        address lpTokenImpl;
        address oracleAdapterImpl;
        address marketFactoryImpl;
        address oracleAdapterProxy;
        address marketFactoryProxy;
        address collateralToken;
        address deployer;
        uint256 chainId;
        uint256 deploymentTimestamp;
    }
    
    DeploymentResult public deployment;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        deployment.deployer = deployer;
        deployment.chainId = block.chainid;
        deployment.deploymentTimestamp = block.timestamp;
        deployment.collateralToken = USDC_BASE_SEPOLIA;

        _printHeader(deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy all contracts
        _deployImplementations();
        _deployProxies(deployer);
        _linkContracts();

        vm.stopBroadcast();

        // Print deployment summary
        _printSummary();
        _printEnvVars();
        _printVerificationCommands();
        _printNextSteps();
    }

    function _printHeader(address deployer) internal view {
        console2.log("");
        console2.log("========================================");
        console2.log("   YesNo.Win Deployment to Base Sepolia");
        console2.log("========================================");
        console2.log("");
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance / 1e18, "ETH");
        console2.log("Chain ID:", block.chainid);
        console2.log("Block Number:", block.number);
        console2.log("");
    }

    function _deployImplementations() internal {
        console2.log("----------------------------------------");
        console2.log("Step 1: Deploying Implementation Contracts");
        console2.log("----------------------------------------");
        console2.log("");

        console2.log("[1/5] Deploying Market implementation...");
        Market marketImpl = new Market();
        deployment.marketImpl = address(marketImpl);
        console2.log("      Market:", deployment.marketImpl);

        console2.log("[2/5] Deploying OutcomeToken implementation...");
        OutcomeToken outcomeTokenImpl = new OutcomeToken();
        deployment.outcomeTokenImpl = address(outcomeTokenImpl);
        console2.log("      OutcomeToken:", deployment.outcomeTokenImpl);

        console2.log("[3/5] Deploying LPToken implementation...");
        LPToken lpTokenImpl = new LPToken();
        deployment.lpTokenImpl = address(lpTokenImpl);
        console2.log("      LPToken:", deployment.lpTokenImpl);

        console2.log("[4/5] Deploying OracleAdapter implementation...");
        OracleAdapter oracleAdapterImpl = new OracleAdapter();
        deployment.oracleAdapterImpl = address(oracleAdapterImpl);
        console2.log("      OracleAdapter:", deployment.oracleAdapterImpl);

        console2.log("[5/5] Deploying MarketFactory implementation...");
        MarketFactory factoryImpl = new MarketFactory();
        deployment.marketFactoryImpl = address(factoryImpl);
        console2.log("      MarketFactory:", deployment.marketFactoryImpl);

        console2.log("");
        console2.log("All implementations deployed!");
        console2.log("");
    }

    function _deployProxies(address deployer) internal {
        console2.log("----------------------------------------");
        console2.log("Step 2: Deploying Proxy Contracts");
        console2.log("----------------------------------------");
        console2.log("");

        // Deploy OracleAdapter proxy first
        console2.log("[1/2] Deploying OracleAdapter proxy...");
        bytes memory oracleInitData = abi.encodeWithSelector(
            OracleAdapter.initialize.selector,
            deployer // Initialize with deployer, will set factory after
        );
        ERC1967Proxy oracleProxy = new ERC1967Proxy(
            deployment.oracleAdapterImpl,
            oracleInitData
        );
        deployment.oracleAdapterProxy = address(oracleProxy);
        console2.log("      OracleAdapter Proxy:", deployment.oracleAdapterProxy);

        // Deploy MarketFactory proxy
        console2.log("[2/2] Deploying MarketFactory proxy...");
        bytes memory factoryInitData = abi.encodeWithSelector(
            MarketFactory.initialize.selector,
            USDC_BASE_SEPOLIA,             // defaultCollateralToken
            deployer,                       // treasury (fee collector)
            deployment.oracleAdapterProxy, // oracleAdapter
            DEFAULT_LP_FEE_BPS,            // defaultLpFeeBps
            DEFAULT_PROTOCOL_FEE_BPS,      // defaultProtocolFeeBps
            DEFAULT_PARLAY_FEE_BPS,        // defaultParlayFeeBps
            MIN_INITIAL_LIQUIDITY          // minInitialLiquidity
        );
        ERC1967Proxy factoryProxy = new ERC1967Proxy(
            deployment.marketFactoryImpl,
            factoryInitData
        );
        deployment.marketFactoryProxy = address(factoryProxy);
        console2.log("      MarketFactory Proxy:", deployment.marketFactoryProxy);

        console2.log("");
        console2.log("All proxies deployed!");
        console2.log("");
    }

    function _linkContracts() internal {
        console2.log("----------------------------------------");
        console2.log("Step 3: Linking Contracts");
        console2.log("----------------------------------------");
        console2.log("");

        console2.log("Linking OracleAdapter to MarketFactory...");
        OracleAdapter oracleAdapter = OracleAdapter(deployment.oracleAdapterProxy);
        oracleAdapter.setFactory(deployment.marketFactoryProxy);
        console2.log("OracleAdapter.factory =", deployment.marketFactoryProxy);

        console2.log("");
        console2.log("All contracts linked!");
        console2.log("");
    }

    function _printSummary() internal view {
        console2.log("========================================");
        console2.log("   DEPLOYMENT SUMMARY");
        console2.log("========================================");
        console2.log("");
        console2.log("Implementation Contracts:");
        console2.log("  Market:        ", deployment.marketImpl);
        console2.log("  OutcomeToken:  ", deployment.outcomeTokenImpl);
        console2.log("  LPToken:       ", deployment.lpTokenImpl);
        console2.log("  OracleAdapter: ", deployment.oracleAdapterImpl);
        console2.log("  MarketFactory: ", deployment.marketFactoryImpl);
        console2.log("");
        console2.log("Proxy Contracts (USE THESE ADDRESSES):");
        console2.log("  MarketFactory: ", deployment.marketFactoryProxy);
        console2.log("  OracleAdapter: ", deployment.oracleAdapterProxy);
        console2.log("");
        console2.log("Configuration:");
        console2.log("  Collateral (USDC):      ", deployment.collateralToken);
        console2.log("  LP Fee:                 ", DEFAULT_LP_FEE_BPS, "bps");
        console2.log("  Protocol Fee:           ", DEFAULT_PROTOCOL_FEE_BPS, "bps");
        console2.log("  Parlay Fee:             ", DEFAULT_PARLAY_FEE_BPS, "bps");
        console2.log("  Min Initial Liquidity:   100 USDC");
        console2.log("  Treasury:               ", deployment.deployer);
        console2.log("");
    }

    function _printEnvVars() internal view {
        console2.log("========================================");
        console2.log("   ENVIRONMENT VARIABLES");
        console2.log("========================================");
        console2.log("");
        console2.log("Add these to your .env file:");
        console2.log("");
        console2.log("# Contract Addresses (Proxies)");
        console2.log("NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=", deployment.marketFactoryProxy);
        console2.log("NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=", deployment.oracleAdapterProxy);
        console2.log("");
        console2.log("# Implementation Addresses (for reference)");
        console2.log("NEXT_PUBLIC_MARKET_IMPLEMENTATION=", deployment.marketImpl);
        console2.log("NEXT_PUBLIC_OUTCOME_TOKEN_IMPLEMENTATION=", deployment.outcomeTokenImpl);
        console2.log("NEXT_PUBLIC_LPTOKEN_IMPLEMENTATION=", deployment.lpTokenImpl);
        console2.log("");
        console2.log("# Network Configuration");
        console2.log("NEXT_PUBLIC_USDC_ADDRESS=", deployment.collateralToken);
        console2.log("NEXT_PUBLIC_CHAIN_ID=84532");
        console2.log("NEXT_PUBLIC_NETWORK_NAME=base-sepolia");
        console2.log("");
    }

    function _printVerificationCommands() internal view {
        console2.log("========================================");
        console2.log("   VERIFICATION COMMANDS");
        console2.log("========================================");
        console2.log("");
        console2.log("Run these commands to verify contracts on Basescan:");
        console2.log("");
        console2.log("# Implementations");
        console2.log("forge verify-contract", deployment.marketImpl, "src/Market.sol:Market --chain base-sepolia");
        console2.log("forge verify-contract", deployment.outcomeTokenImpl, "src/OutcomeToken.sol:OutcomeToken --chain base-sepolia");
        console2.log("forge verify-contract", deployment.lpTokenImpl, "src/LPToken.sol:LPToken --chain base-sepolia");
        console2.log("forge verify-contract", deployment.oracleAdapterImpl, "src/OracleAdapter.sol:OracleAdapter --chain base-sepolia");
        console2.log("forge verify-contract", deployment.marketFactoryImpl, "src/MarketFactory.sol:MarketFactory --chain base-sepolia");
        console2.log("");
        console2.log("# Proxies (will auto-verify if implementations are verified)");
        console2.log("forge verify-contract", deployment.oracleAdapterProxy, "src/OracleAdapter.sol:OracleAdapter --chain base-sepolia");
        console2.log("forge verify-contract", deployment.marketFactoryProxy, "src/MarketFactory.sol:MarketFactory --chain base-sepolia");
        console2.log("");
    }

    function _printNextSteps() internal view {
        console2.log("========================================");
        console2.log("   NEXT STEPS");
        console2.log("========================================");
        console2.log("");
        console2.log("1. Run post-deployment script:");
        console2.log("   node script/post-deploy.js");
        console2.log("");
        console2.log("2. Update SDK:");
        console2.log("   pnpm build:sdk");
        console2.log("");
        console2.log("3. Test market creation:");
        console2.log("   - Get testnet USDC from faucet");
        console2.log("   - Approve USDC to MarketFactory");
        console2.log("   - Create your first market!");
        console2.log("");
        console2.log("4. View on BaseScan:");
        console2.log("   https://sepolia.basescan.org/address/", deployment.marketFactoryProxy);
        console2.log("");
        console2.log("========================================");
        console2.log("");
    }
}

