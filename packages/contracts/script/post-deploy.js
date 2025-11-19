#!/usr/bin/env node

/**
 * Post-Deployment Script
 * Extracts deployment info from Foundry broadcast logs and:
 * 1. Creates deployments/base-sepolia.json
 * 2. Updates root .env file
 * 3. Triggers SDK rebuild
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function findLatestBroadcast() {
  const broadcastDir = path.join(__dirname, '..', 'broadcast', 'DeployBaseSepolia.s.sol');
  
  if (!fs.existsSync(broadcastDir)) {
    throw new Error('No broadcast directory found. Did the deployment run?');
  }

  const chainDirs = fs.readdirSync(broadcastDir);
  if (chainDirs.length === 0) {
    throw new Error('No chain directories found in broadcast folder');
  }

  // Use the first (should be 84532 for Base Sepolia)
  const chainDir = path.join(broadcastDir, chainDirs[0]);
  const runLatest = path.join(chainDir, 'run-latest.json');

  if (!fs.existsSync(runLatest)) {
    throw new Error('No run-latest.json found. Deployment may have failed.');
  }

  return runLatest;
}

function extractDeploymentInfo(broadcastPath) {
  log('\n📖 Reading deployment data...', colors.blue);
  
  const data = JSON.parse(fs.readFileSync(broadcastPath, 'utf8'));
  
  const deployment = {
    network: 'base-sepolia',
    chainId: 84532,
    deployedAt: new Date().toISOString(),
    deployer: null,
    contracts: {
      implementations: {},
      proxies: {},
    },
    configuration: {
      collateralToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      lpFeeBps: 150,
      protocolFeeBps: 50,
      parlayFeeBps: 100,
      minInitialLiquidity: '100000000', // 100 USDC (6 decimals)
    },
  };

  // Extract deployer
  if (data.transactions && data.transactions.length > 0) {
    deployment.deployer = data.transactions[0].transaction.from;
  }

  // Extract contract addresses from transactions
  for (const tx of data.transactions || []) {
    if (tx.transactionType === 'CREATE') {
      const contractAddress = tx.contractAddress;
      const contractName = tx.contractName;

      // Categorize by contract name
      if (contractName.includes('Market') && !contractName.includes('Factory')) {
        deployment.contracts.implementations.Market = contractAddress;
      } else if (contractName.includes('OutcomeToken')) {
        deployment.contracts.implementations.OutcomeToken = contractAddress;
      } else if (contractName.includes('LPToken')) {
        deployment.contracts.implementations.LPToken = contractAddress;
      } else if (contractName.includes('OracleAdapter')) {
        deployment.contracts.implementations.OracleAdapter = contractAddress;
      } else if (contractName.includes('MarketFactory')) {
        deployment.contracts.implementations.MarketFactory = contractAddress;
      } else if (contractName.includes('ERC1967Proxy')) {
        // Proxies - need to determine which proxy based on order
        if (!deployment.contracts.proxies.OracleAdapter) {
          deployment.contracts.proxies.OracleAdapter = contractAddress;
        } else if (!deployment.contracts.proxies.MarketFactory) {
          deployment.contracts.proxies.MarketFactory = contractAddress;
        }
      }
    }
  }

  log('✅ Deployment info extracted', colors.green);
  return deployment;
}

function saveDeploymentJSON(deployment) {
  log('\n💾 Saving deployment JSON...', colors.blue);
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const outputPath = path.join(deploymentsDir, 'base-sepolia.json');
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  
  log(`✅ Saved to: ${outputPath}`, colors.green);
}

function updateEnvFile(deployment) {
  log('\n🔧 Updating .env file...', colors.blue);
  
  const rootDir = path.join(__dirname, '../../..');
  const envPath = path.join(rootDir, '.env');
  
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Remove old deployment addresses (if any)
  envContent = envContent
    .split('\n')
    .filter(line => 
      !line.startsWith('NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=') &&
      !line.startsWith('NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=') &&
      !line.startsWith('NEXT_PUBLIC_MARKET_IMPLEMENTATION=') &&
      !line.startsWith('NEXT_PUBLIC_OUTCOME_TOKEN_IMPLEMENTATION=') &&
      !line.startsWith('NEXT_PUBLIC_LPTOKEN_IMPLEMENTATION=') &&
      !line.startsWith('NEXT_PUBLIC_USDC_ADDRESS=') &&
      !line.startsWith('NEXT_PUBLIC_CHAIN_ID=') &&
      !line.startsWith('NEXT_PUBLIC_NETWORK_NAME=')
    )
    .join('\n');

  // Add deployment section
  const deploymentVars = `
# ========================================
# Contract Addresses (Base Sepolia)
# Deployed: ${deployment.deployedAt}
# ========================================

# Main Contracts (Proxies - USE THESE)
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=${deployment.contracts.proxies.MarketFactory}
NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=${deployment.contracts.proxies.OracleAdapter}

# Implementation Addresses (for reference)
NEXT_PUBLIC_MARKET_IMPLEMENTATION=${deployment.contracts.implementations.Market}
NEXT_PUBLIC_OUTCOME_TOKEN_IMPLEMENTATION=${deployment.contracts.implementations.OutcomeToken}
NEXT_PUBLIC_LPTOKEN_IMPLEMENTATION=${deployment.contracts.implementations.LPToken}

# Network Configuration
NEXT_PUBLIC_USDC_ADDRESS=${deployment.configuration.collateralToken}
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_NETWORK_NAME=base-sepolia
`;

  envContent = envContent.trim() + '\n' + deploymentVars;
  
  fs.writeFileSync(envPath, envContent);
  log(`✅ Updated: ${envPath}`, colors.green);
}

function rebuildSDK() {
  log('\n🔨 Rebuilding SDK...', colors.blue);
  
  try {
    execSync('pnpm build:sdk', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..'),
    });
    log('✅ SDK rebuilt successfully', colors.green);
  } catch (error) {
    log('⚠️  SDK rebuild failed (you may need to run manually)', colors.yellow);
  }
}

function printSummary(deployment) {
  log('\n========================================', colors.bright);
  log('  🎉 POST-DEPLOYMENT COMPLETE 🎉', colors.bright);
  log('========================================', colors.bright);
  log('');
  log('📦 Deployment Artifact:', colors.blue);
  log(`   packages/contracts/deployments/base-sepolia.json`);
  log('');
  log('🔑 Main Addresses (Proxies):', colors.blue);
  log(`   MarketFactory: ${deployment.contracts.proxies.MarketFactory}`);
  log(`   OracleAdapter: ${deployment.contracts.proxies.OracleAdapter}`);
  log('');
  log('📝 Environment Variables:', colors.blue);
  log(`   Updated in root .env file`);
  log('');
  log('🔗 View on BaseScan:', colors.blue);
  log(`   https://sepolia.basescan.org/address/${deployment.contracts.proxies.MarketFactory}`);
  log('');
  log('✅ Next Steps:', colors.green);
  log('   1. Verify contracts: forge verify-contract ... --chain base-sepolia');
  log('   2. Test market creation on frontend');
  log('   3. Get testnet USDC from faucet if needed');
  log('');
  log('========================================', colors.bright);
}

// Main execution
try {
  log('\n🚀 Starting post-deployment automation...', colors.bright);
  
  const broadcastPath = findLatestBroadcast();
  const deployment = extractDeploymentInfo(broadcastPath);
  
  saveDeploymentJSON(deployment);
  updateEnvFile(deployment);
  rebuildSDK();
  
  printSummary(deployment);
  
  process.exit(0);
} catch (error) {
  log(`\n❌ Error: ${error.message}`, colors.red);
  log('\nPlease check the deployment and try again.', colors.yellow);
  process.exit(1);
}

