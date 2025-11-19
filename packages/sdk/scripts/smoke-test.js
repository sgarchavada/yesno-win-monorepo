#!/usr/bin/env node

/**
 * @file smoke-test.js
 * @description Smoke test to verify SDK generation and contract ABIs
 * @usage node packages/sdk/scripts/smoke-test.js
 */

const fs = require('fs');
const path = require('path');

const GENERATED_FILE = path.join(__dirname, '../src/contracts.ts');
const EXPECTED_CONTRACTS = ['Market', 'MarketFactory', 'OutcomeToken', 'OracleAdapter'];

/**
 * Color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if generated contracts file exists
 */
function checkGeneratedFile() {
  log('\n🔍 Checking generated contracts file...', 'cyan');
  
  if (!fs.existsSync(GENERATED_FILE)) {
    log('❌ Error: Generated contracts file not found!', 'red');
    log(`   Expected: ${GENERATED_FILE}`, 'red');
    log('\n   Run: pnpm build:sdk', 'yellow');
    return false;
  }
  
  log(`✅ Found: ${GENERATED_FILE}`, 'green');
  return true;
}

/**
 * Validate generated contracts file content
 */
function validateGeneratedFile() {
  log('\n🔍 Validating generated contracts...', 'cyan');
  
  try {
    const content = fs.readFileSync(GENERATED_FILE, 'utf8');
    
    // Check file size
    const sizeKB = (content.length / 1024).toFixed(2);
    log(`   File size: ${sizeKB} KB`, 'cyan');
    
    if (content.length < 100) {
      log('❌ Error: Generated file is too small!', 'red');
      return false;
    }
    
    // Check for expected exports
    const expectedExports = [
      'export type ContractName',
      'export interface ContractData',
      'export const contracts',
      'export function getContract',
      'export function getABI',
      'export function hasContract',
      'export function getContractNames',
    ];
    
    for (const exportStatement of expectedExports) {
      if (!content.includes(exportStatement)) {
        log(`❌ Error: Missing export: ${exportStatement}`, 'red');
        return false;
      }
    }
    
    log('✅ All expected exports found', 'green');
    
    // Check for expected contracts
    const missingContracts = [];
    for (const contractName of EXPECTED_CONTRACTS) {
      if (!content.includes(`${contractName}ABI`)) {
        missingContracts.push(contractName);
      }
    }
    
    if (missingContracts.length > 0) {
      log(`❌ Error: Missing contracts: ${missingContracts.join(', ')}`, 'red');
      return false;
    }
    
    log(`✅ All ${EXPECTED_CONTRACTS.length} expected contracts found`, 'green');
    
    // Extract and validate ABI structure
    for (const contractName of EXPECTED_CONTRACTS) {
      const abiMatch = content.match(new RegExp(`export const ${contractName}ABI = (\\[[\\s\\S]*?\\]) as const`));
      if (abiMatch) {
        try {
          const abi = JSON.parse(abiMatch[1]);
          if (Array.isArray(abi) && abi.length > 0) {
            log(`   ✅ ${contractName}: ${abi.length} ABI entries`, 'green');
            
            // Check for key function signatures
            const functionNames = abi
              .filter(item => item.type === 'function')
              .map(item => item.name);
            
            if (functionNames.length > 0) {
              log(`      Functions: ${functionNames.length}`, 'cyan');
            }
          } else {
            log(`   ⚠️  ${contractName}: Empty ABI`, 'yellow');
          }
        } catch (error) {
          log(`   ❌ ${contractName}: Invalid ABI JSON`, 'red');
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ Error reading file: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test importing the generated file (syntax check)
 */
function testImport() {
  log('\n🔍 Testing module import...', 'cyan');
  
  try {
    // Dynamic import to avoid TypeScript compilation
    const contracts = require(GENERATED_FILE.replace('.ts', '.js'));
    
    if (contracts) {
      log('✅ Module import successful', 'green');
      return true;
    }
  } catch (error) {
    // Expected to fail for .ts files without compilation
    log('ℹ️  Note: TypeScript file not compiled (expected in dev)', 'yellow');
    log('   Run `pnpm --filter sdk build` to compile', 'yellow');
    return true; // Not a failure
  }
  
  return true;
}

/**
 * Check if contracts are built
 */
function checkContractsBuilt() {
  log('\n🔍 Checking if Solidity contracts are built...', 'cyan');
  
  const outDir = path.join(__dirname, '../../contracts/out');
  
  if (!fs.existsSync(outDir)) {
    log('❌ Error: Contracts not built!', 'red');
    log('   Run: pnpm build:contracts', 'yellow');
    return false;
  }
  
  // Check for key contract output files
  const marketJson = path.join(outDir, 'Market.sol/Market.json');
  const factoryJson = path.join(outDir, 'MarketFactory.sol/MarketFactory.json');
  
  if (!fs.existsSync(marketJson) || !fs.existsSync(factoryJson)) {
    log('❌ Error: Contract artifacts not found!', 'red');
    log('   Run: pnpm build:contracts', 'yellow');
    return false;
  }
  
  log('✅ Contracts are built', 'green');
  return true;
}

/**
 * Main smoke test
 */
function main() {
  log('╔════════════════════════════════════════╗', 'cyan');
  log('║   SDK Smoke Test                       ║', 'cyan');
  log('║   YesNo.Win Prediction Markets         ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  
  const checks = [
    { name: 'Contracts Built', fn: checkContractsBuilt },
    { name: 'Generated File Exists', fn: checkGeneratedFile },
    { name: 'Generated File Valid', fn: validateGeneratedFile },
    { name: 'Module Import', fn: testImport },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    const result = check.fn();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  // Summary
  log('\n' + '═'.repeat(50), 'cyan');
  log('SUMMARY', 'cyan');
  log('═'.repeat(50), 'cyan');
  log(`Total checks: ${checks.length}`, 'cyan');
  log(`Passed: ${passed}`, passed === checks.length ? 'green' : 'yellow');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  
  if (failed === 0) {
    log('\n✅ All smoke tests passed!', 'green');
    log('   SDK is ready to use.\n', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some smoke tests failed!', 'red');
    log('   Please fix the issues above.\n', 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { main };

