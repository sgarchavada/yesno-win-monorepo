/**
 * Automated Deployment Script for YesNo.Win
 * 
 * This script automates the entire deployment process:
 * 1. Deploy all implementation contracts
 * 2. Deploy all proxy contracts
 * 3. Initialize all proxies
 * 4. Grant necessary roles
 * 5. Generate deployment records
 * 6. Update .env files
 * 
 * Usage:
 *   npx ts-node script/deploy-all.ts
 * 
 * Requirements:
 *   - DEPLOYER_PRIVATE_KEY in .env
 *   - THIRDWEB_SECRET_KEY in .env (optional, for dashboard integration)
 */

import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { deployPublishedContract, deployContract } from "thirdweb/deploys";
import { privateKeyToAccount } from "thirdweb/wallets";
import { readContract } from "thirdweb/contract";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const FRONTEND_WALLET = process.env.FRONTEND_WALLET_ADDRESS || process.env.ADMIN_FRONTEND_WALLET; // Optional: Your frontend wallet to grant admin roles

if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY not found in .env");
}

// Initialize client and account
const client = createThirdwebClient({
  secretKey: THIRDWEB_SECRET_KEY || "dummy-key-for-deployment",
});

const account = privateKeyToAccount({
  client,
  privateKey: PRIVATE_KEY,
});

const chain = baseSepolia;

// PMT Token (already deployed)
const PMT_TOKEN_ADDRESS = "0x2FBEEb9529Ef323991df894B1fCff4c5DECCf50B";

// Store deployed addresses
const deployedAddresses: Record<string, string> = {
  PMT: PMT_TOKEN_ADDRESS,
};

// Helper function to wait for user confirmation
async function confirmStep(message: string): Promise<void> {
  console.log(`\n⚠️  ${message}`);
  console.log("Press Enter to continue...");
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });
}

// Helper function to deploy a contract
async function deployImpl(contractName: string, contractPath: string): Promise<string> {
  console.log(`\n📦 Deploying ${contractName} implementation...`);
  
  try {
    const address = await deployContract({
      client,
      chain,
      account,
      bytecode: require(`../out/${contractPath}.sol/${contractName}.json`).bytecode.object,
      constructorParams: [],
    });
    
    console.log(`✅ ${contractName} deployed at: ${address}`);
    return address;
  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error);
    throw error;
  }
}

// Helper function to deploy a proxy
async function deployProxy(implAddress: string, name: string): Promise<string> {
  console.log(`\n🔗 Deploying ${name} proxy...`);
  
  // Deploy ERC1967Proxy with empty initialization data
  const proxyAddress = await deployContract({
    client,
    chain,
    account,
    bytecode: "0x608060405234801561001057600080fd5b5060405161043e38038061043e83398101604081905261002f91610254565b61003c8282600061004f565b5050610331565b610058816100e7565b6100b75760405162461bcd60e51b815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201526c1bdd08184818dbdb9d1c9858dd609a1b60648201526084015b60405180910390fd5b806100d36000805160206103ee8339815191525490565b6100dc8161016d565b505050565b6000813f806100ef81610196565b1591505090565b80516100f781610196565b919050565b600080600060608486031215610111578283fd5b835160208501519094506001600160a01b0381168114610111578283fd5b6000825160005b8181101561015157602081860181015185830152016101375b50919091019291505056fea2646970667358221220e0c80e3e0e3e0e3e0e3e0e3e0e3e0e3e0e3e0e3e0e3e0e3e0e3e0e3e0e3e64736f6c63430008160033",
    constructorParams: [implAddress, "0x"], // Empty initialization data
  });
  
  console.log(`✅ ${name} proxy deployed at: ${proxyAddress}`);
  return proxyAddress;
}

// Main deployment function
async function main() {
  console.log("\n🚀 YesNo.Win Automated Deployment");
  console.log("=====================================");
  console.log(`Deployer: ${account.address}`);
  console.log(`Network: Base Sepolia (${chain.id})`);
  console.log(`PMT Token: ${PMT_TOKEN_ADDRESS}`);
  
  await confirmStep("Ready to start deployment?");
  
  // ========================================
  // PHASE 1: Deploy Implementation Contracts
  // ========================================
  console.log("\n\n📦 PHASE 1: DEPLOYING IMPLEMENTATIONS");
  console.log("=====================================");
  
  deployedAddresses.MarketImpl = await deployImpl("Market", "Market");
  deployedAddresses.OutcomeTokenImpl = await deployImpl("OutcomeToken", "OutcomeToken");
  deployedAddresses.LPTokenImpl = await deployImpl("LPToken", "LPToken");
  deployedAddresses.OracleAdapterImpl = await deployImpl("OracleAdapter", "OracleAdapter");
  deployedAddresses.CreatorRegistryImpl = await deployImpl("CreatorRegistry", "CreatorRegistry");
  deployedAddresses.MarketFactoryImpl = await deployImpl("MarketFactory", "MarketFactory");
  deployedAddresses.ProtocolTreasuryImpl = await deployImpl("ProtocolTreasury", "ProtocolTreasury");
  
  console.log("\n✅ All implementations deployed!");
  
  // ========================================
  // PHASE 2: Deploy Proxy Contracts
  // ========================================
  console.log("\n\n🔗 PHASE 2: DEPLOYING PROXIES");
  console.log("=====================================");
  
  // Deploy CreatorRegistry proxy (don't initialize yet)
  deployedAddresses.CreatorRegistryProxy = await deployProxy(
    deployedAddresses.CreatorRegistryImpl,
    "CreatorRegistry"
  );
  
  // Deploy MarketFactory proxy (don't initialize yet)
  deployedAddresses.MarketFactoryProxy = await deployProxy(
    deployedAddresses.MarketFactoryImpl,
    "MarketFactory"
  );
  
  // Deploy ProtocolTreasury proxy (don't initialize yet)
  deployedAddresses.ProtocolTreasuryProxy = await deployProxy(
    deployedAddresses.ProtocolTreasuryImpl,
    "ProtocolTreasury"
  );
  
  console.log("\n✅ All proxies deployed!");
  
  // ========================================
  // PHASE 3: Initialize Contracts
  // ========================================
  console.log("\n\n⚙️  PHASE 3: INITIALIZING CONTRACTS");
  console.log("=====================================");
  
  // Initialize MarketFactory
  console.log("\n📝 Initializing MarketFactory...");
  const marketFactory = getContract({
    client,
    chain,
    address: deployedAddresses.MarketFactoryProxy,
  });
  
  const initFactoryTx = prepareContractCall({
    contract: marketFactory,
    method: "function initialize(address,address,address,address,uint256,uint256,uint256,uint256,address,address,address)",
    params: [
      PMT_TOKEN_ADDRESS, // _defaultCollateralToken
      account.address, // _treasury (your wallet)
      deployedAddresses.OracleAdapterImpl, // _oracleAdapter
      deployedAddresses.CreatorRegistryProxy, // _creatorRegistry
      100, // _defaultLpFeeBps (1%)
      200, // _defaultProtocolFeeBps (2%)
      50, // _defaultParlayFeeBps (0.5%)
      BigInt(100 * 1e18), // _minInitialLiquidity (100 tokens)
      deployedAddresses.MarketImpl, // _marketImpl
      deployedAddresses.OutcomeTokenImpl, // _outcomeTokenImpl
      deployedAddresses.LPTokenImpl, // _lpTokenImpl
    ],
  });
  
  await sendTransaction({ transaction: initFactoryTx, account });
  console.log("✅ MarketFactory initialized!");
  
  // Initialize CreatorRegistry
  console.log("\n📝 Initializing CreatorRegistry...");
  const creatorRegistry = getContract({
    client,
    chain,
    address: deployedAddresses.CreatorRegistryProxy,
  });
  
  const initRegistryTx = prepareContractCall({
    contract: creatorRegistry,
    method: "function initialize(address)",
    params: [deployedAddresses.MarketFactoryProxy],
  });
  
  await sendTransaction({ transaction: initRegistryTx, account });
  console.log("✅ CreatorRegistry initialized!");
  
  // Initialize ProtocolTreasury
  console.log("\n📝 Initializing ProtocolTreasury...");
  const protocolTreasury = getContract({
    client,
    chain,
    address: deployedAddresses.ProtocolTreasuryProxy,
  });
  
  const initTreasuryTx = prepareContractCall({
    contract: protocolTreasury,
    method: "function initialize(address,address)",
    params: [
      deployedAddresses.MarketFactoryProxy,
      account.address, // treasury address
    ],
  });
  
  await sendTransaction({ transaction: initTreasuryTx, account });
  console.log("✅ ProtocolTreasury initialized!");
  
  // ========================================
  // PHASE 4: Grant Roles
  // ========================================
  console.log("\n\n🔐 PHASE 4: GRANTING ROLES");
  console.log("=====================================");
  
  // Get MARKET_FACTORY_ROLE value
  console.log("\n📖 Reading MARKET_FACTORY_ROLE...");
  const marketFactoryRole = await readContract({
    contract: creatorRegistry,
    method: "function MARKET_FACTORY_ROLE() view returns (bytes32)",
    params: [],
  });
  console.log(`MARKET_FACTORY_ROLE: ${marketFactoryRole}`);
  
  // Grant MARKET_FACTORY_ROLE to MarketFactory
  console.log("\n🔑 Granting MARKET_FACTORY_ROLE to MarketFactory...");
  const grantFactoryRoleTx = prepareContractCall({
    contract: creatorRegistry,
    method: "function grantRole(bytes32,address)",
    params: [marketFactoryRole as `0x${string}`, deployedAddresses.MarketFactoryProxy],
  });
  
  await sendTransaction({ transaction: grantFactoryRoleTx, account });
  console.log("✅ MARKET_FACTORY_ROLE granted!");
  
  // Grant ADMIN_ROLE to frontend wallet (if provided)
  if (FRONTEND_WALLET) {
    console.log(`\n🔑 Granting ADMIN_ROLE to frontend wallet: ${FRONTEND_WALLET}`);
    
    // Get ADMIN_ROLE value
    const adminRole = await readContract({
      contract: creatorRegistry,
      method: "function ADMIN_ROLE() view returns (bytes32)",
      params: [],
    });
    
    // Grant on MarketFactory
    const grantAdminFactory = prepareContractCall({
      contract: marketFactory,
      method: "function grantRole(bytes32,address)",
      params: ["0x0000000000000000000000000000000000000000000000000000000000000000", FRONTEND_WALLET], // DEFAULT_ADMIN_ROLE
    });
    await sendTransaction({ transaction: grantAdminFactory, account });
    console.log("✅ Admin role granted on MarketFactory");
    
    // Grant on CreatorRegistry
    const grantAdminRegistry = prepareContractCall({
      contract: creatorRegistry,
      method: "function grantRole(bytes32,address)",
      params: [adminRole as `0x${string}`, FRONTEND_WALLET],
    });
    await sendTransaction({ transaction: grantAdminRegistry, account });
    console.log("✅ Admin role granted on CreatorRegistry");
  }
  
  // ========================================
  // PHASE 5: Generate Deployment Records
  // ========================================
  console.log("\n\n📝 PHASE 5: GENERATING DEPLOYMENT RECORDS");
  console.log("=====================================");
  
  // Create deployment JSON
  const deploymentRecord = {
    network: "base-sepolia",
    chainId: 84532,
    timestamp: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      implementations: {
        Market: deployedAddresses.MarketImpl,
        OutcomeToken: deployedAddresses.OutcomeTokenImpl,
        LPToken: deployedAddresses.LPTokenImpl,
        OracleAdapter: deployedAddresses.OracleAdapterImpl,
        CreatorRegistry: deployedAddresses.CreatorRegistryImpl,
        MarketFactory: deployedAddresses.MarketFactoryImpl,
        ProtocolTreasury: deployedAddresses.ProtocolTreasuryImpl,
      },
      proxies: {
        MarketFactory: deployedAddresses.MarketFactoryProxy,
        CreatorRegistry: deployedAddresses.CreatorRegistryProxy,
        ProtocolTreasury: deployedAddresses.ProtocolTreasuryProxy,
      },
      tokens: {
        PMT: PMT_TOKEN_ADDRESS,
      },
    },
  };
  
  // Save deployment record
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentsDir, "base-sepolia.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentRecord, null, 2));
  console.log(`✅ Deployment record saved: ${deploymentFile}`);
  
  // Generate .env content
  const envContent = `
# YesNo.Win Contract Addresses - Base Sepolia
# Generated: ${new Date().toISOString()}

# Proxy Addresses (USE THESE IN FRONTEND)
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=${deployedAddresses.MarketFactoryProxy}
NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS=${deployedAddresses.CreatorRegistryProxy}
NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS=${deployedAddresses.ProtocolTreasuryProxy}
NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=${deployedAddresses.OracleAdapterImpl}
NEXT_PUBLIC_USDC_ADDRESS=${PMT_TOKEN_ADDRESS}

# Implementation Addresses (For upgrades only)
MARKET_IMPL=${deployedAddresses.MarketImpl}
OUTCOME_TOKEN_IMPL=${deployedAddresses.OutcomeTokenImpl}
LP_TOKEN_IMPL=${deployedAddresses.LPTokenImpl}
ORACLE_ADAPTER_IMPL=${deployedAddresses.OracleAdapterImpl}
CREATOR_REGISTRY_IMPL=${deployedAddresses.CreatorRegistryImpl}
MARKET_FACTORY_IMPL=${deployedAddresses.MarketFactoryImpl}
PROTOCOL_TREASURY_IMPL=${deployedAddresses.ProtocolTreasuryImpl}
`;
  
  const envFile = path.join(__dirname, "../../.env.deployment");
  fs.writeFileSync(envFile, envContent.trim());
  console.log(`✅ .env template saved: ${envFile}`);
  
  // ========================================
  // DEPLOYMENT COMPLETE
  // ========================================
  console.log("\n\n🎉 DEPLOYMENT COMPLETE!");
  console.log("=====================================");
  console.log("\n📋 DEPLOYED ADDRESSES:");
  console.log("\nProxies (USE THESE):");
  console.log(`  MarketFactory:     ${deployedAddresses.MarketFactoryProxy}`);
  console.log(`  CreatorRegistry:   ${deployedAddresses.CreatorRegistryProxy}`);
  console.log(`  ProtocolTreasury:  ${deployedAddresses.ProtocolTreasuryProxy}`);
  console.log(`\nTokens:`);
  console.log(`  PMT (USDC):        ${PMT_TOKEN_ADDRESS}`);
  
  console.log("\n\n🔗 THIRDWEB DASHBOARD LINKS:");
  console.log(`\nMarketFactory: https://thirdweb.com/base-sepolia-testnet/${deployedAddresses.MarketFactoryProxy}`);
  console.log(`CreatorRegistry: https://thirdweb.com/base-sepolia-testnet/${deployedAddresses.CreatorRegistryProxy}`);
  console.log(`ProtocolTreasury: https://thirdweb.com/base-sepolia-testnet/${deployedAddresses.ProtocolTreasuryProxy}`);
  
  console.log("\n\n📝 NEXT STEPS:");
  console.log("1. Copy addresses from .env.deployment to your .env and apps/web/.env.local");
  console.log("2. Import contracts to Thirdweb dashboard using the links above");
  console.log("3. Restart your dev server: cd apps/web && npm run dev");
  console.log("4. Login to your app and copy your frontend wallet address");
  console.log("5. If not done automatically, grant admin roles to your frontend wallet");
  console.log("6. Start testing!");
  
  console.log("\n✅ All done! Happy testing! 🚀\n");
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

