// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title VerifyAll
 * @notice Automated verification script for all deployed contracts
 * @dev Verifies all implementations and proxies on BaseScan
 * 
 * Usage:
 *   forge script script/VerifyAll.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --verify
 * 
 * Prerequisites:
 *   - .env file with BASESCAN_API_KEY
 *   - Contracts already deployed (addresses in .env)
 * 
 * Note: This script doesn't deploy anything, it just prints verification commands
 */
contract VerifyAll is Script {
    function run() external view {
        console.log("\n=====================================");
        console.log("YesNo.Win Contract Verification");
        console.log("=====================================\n");
        
        console.log("Run these commands to verify all contracts:\n");
        
        // Get addresses from environment
        address marketFactoryProxy = vm.envAddress("NEXT_PUBLIC_MARKET_FACTORY_ADDRESS");
        address creatorRegistryProxy = vm.envAddress("NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS");
        address protocolTreasuryProxy = vm.envAddress("NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS");
        address oracleAdapterImpl = vm.envAddress("NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS");
        
        address marketImpl = vm.envAddress("MARKET_IMPL");
        address marketFactoryImpl = vm.envAddress("MARKET_FACTORY_IMPL");
        address creatorRegistryImpl = vm.envAddress("CREATOR_REGISTRY_IMPL");
        address protocolTreasuryImpl = vm.envAddress("PROTOCOL_TREASURY_IMPL");
        address outcomeTokenImpl = vm.envAddress("OUTCOME_TOKEN_IMPL");
        address lpTokenImpl = vm.envAddress("LP_TOKEN_IMPL");
        
        console.log("=====================================");
        console.log("STEP 1: Verify Implementation Contracts");
        console.log("=====================================\n");
        
        console.log("# 1. Market Implementation");
        console.log("forge verify-contract \\");
        console.log("  %s \\", marketImpl);
        console.log("  src/Market.sol:Market \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch\n");
        
        console.log("# 2. MarketFactory Implementation");
        console.log("forge verify-contract \\");
        console.log("  %s \\", marketFactoryImpl);
        console.log("  src/MarketFactory.sol:MarketFactory \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch\n");
        
        console.log("# 3. CreatorRegistry Implementation");
        console.log("forge verify-contract \\");
        console.log("  %s \\", creatorRegistryImpl);
        console.log("  src/CreatorRegistry.sol:CreatorRegistry \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch\n");
        
        console.log("# 4. ProtocolTreasury Implementation");
        console.log("forge verify-contract \\");
        console.log("  %s \\", protocolTreasuryImpl);
        console.log("  src/ProtocolTreasury.sol:ProtocolTreasury \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch\n");
        
        console.log("# 5. OutcomeToken Implementation");
        console.log("forge verify-contract \\");
        console.log("  %s \\", outcomeTokenImpl);
        console.log("  src/OutcomeToken.sol:OutcomeToken \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch\n");
        
        console.log("# 6. LPToken Implementation");
        console.log("forge verify-contract \\");
        console.log("  %s \\", lpTokenImpl);
        console.log("  src/LPToken.sol:LPToken \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch\n");
        
        console.log("# 7. OracleAdapter Implementation");
        console.log("forge verify-contract \\");
        console.log("  %s \\", oracleAdapterImpl);
        console.log("  src/OracleAdapter.sol:OracleAdapter \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch\n");
        
        console.log("\n=====================================");
        console.log("STEP 2: Verify Proxy Contracts");
        console.log("=====================================\n");
        
        console.log("# 1. MarketFactory Proxy");
        console.log("forge verify-contract \\");
        console.log("  %s \\", marketFactoryProxy);
        console.log("  lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch \\");
        console.log("  --constructor-args $(cast abi-encode \"constructor(address,bytes)\" %s 0x)\n", marketFactoryImpl);
        
        console.log("# 2. CreatorRegistry Proxy");
        console.log("forge verify-contract \\");
        console.log("  %s \\", creatorRegistryProxy);
        console.log("  lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch \\");
        console.log("  --constructor-args $(cast abi-encode \"constructor(address,bytes)\" %s 0x8129fc1c)\n", creatorRegistryImpl);
        
        console.log("# 3. ProtocolTreasury Proxy");
        console.log("forge verify-contract \\");
        console.log("  %s \\", protocolTreasuryProxy);
        console.log("  lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \\");
        console.log("  --chain base-sepolia \\");
        console.log("  --watch \\");
        console.log("  --constructor-args $(cast abi-encode \"constructor(address,bytes)\" %s 0x8129fc1c)\n", protocolTreasuryImpl);
        
        console.log("\n=====================================");
        console.log("NOTES");
        console.log("=====================================");
        console.log("- Run these commands one by one");
        console.log("- Wait for each verification to complete before running the next");
        console.log("- If a contract is already verified, it will skip automatically");
        console.log("- Constructor args: 0x = no init data, 0x8129fc1c = initialize() selector");
        console.log("\n=====================================\n");
    }
}

