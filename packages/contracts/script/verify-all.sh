#!/bin/bash

# YesNo.Win - Automated Contract Verification Script
# Verifies all implementation and proxy contracts on BaseScan

set -e  # Exit on error

echo ""
echo "====================================="
echo "YesNo.Win Contract Verification"
echo "====================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please ensure .env exists with all contract addresses"
    exit 1
fi

# Source .env to get addresses
source .env

# Check if BASESCAN_API_KEY is set
if [ -z "$BASESCAN_API_KEY" ]; then
    echo "❌ Error: BASESCAN_API_KEY not set in .env"
    exit 1
fi

echo "✅ Found .env with contract addresses"
echo ""

# Counter for verified contracts
VERIFIED=0
SKIPPED=0
FAILED=0

# Function to verify a contract
verify_contract() {
    local name=$1
    local address=$2
    local contract_path=$3
    local constructor_args=$4
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 Verifying: $name"
    echo "   Address: $address"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ -z "$constructor_args" ]; then
        # No constructor args
        if forge verify-contract \
            "$address" \
            "$contract_path" \
            --chain base-sepolia \
            --watch 2>&1 | tee /tmp/verify_output.txt; then
            
            if grep -q "already verified" /tmp/verify_output.txt; then
                echo "⏭️  Already verified, skipping..."
                ((SKIPPED++))
            else
                echo "✅ Verified successfully!"
                ((VERIFIED++))
            fi
        else
            echo "❌ Verification failed!"
            ((FAILED++))
        fi
    else
        # With constructor args
        if forge verify-contract \
            "$address" \
            "$contract_path" \
            --chain base-sepolia \
            --watch \
            --constructor-args "$constructor_args" 2>&1 | tee /tmp/verify_output.txt; then
            
            if grep -q "already verified" /tmp/verify_output.txt; then
                echo "⏭️  Already verified, skipping..."
                ((SKIPPED++))
            else
                echo "✅ Verified successfully!"
                ((VERIFIED++))
            fi
        else
            echo "❌ Verification failed!"
            ((FAILED++))
        fi
    fi
    
    echo ""
}

echo "====================================="
echo "STEP 1: Verifying Implementation Contracts"
echo "====================================="
echo ""

# Verify implementations (no constructor args needed)
verify_contract \
    "Market Implementation" \
    "$MARKET_IMPL" \
    "src/Market.sol:Market"

verify_contract \
    "MarketFactory Implementation" \
    "$MARKET_FACTORY_IMPL" \
    "src/MarketFactory.sol:MarketFactory"

verify_contract \
    "CreatorRegistry Implementation" \
    "$CREATOR_REGISTRY_IMPL" \
    "src/CreatorRegistry.sol:CreatorRegistry"

verify_contract \
    "ProtocolTreasury Implementation" \
    "$PROTOCOL_TREASURY_IMPL" \
    "src/ProtocolTreasury.sol:ProtocolTreasury"

verify_contract \
    "OutcomeToken Implementation" \
    "$OUTCOME_TOKEN_IMPL" \
    "src/OutcomeToken.sol:OutcomeToken"

verify_contract \
    "LPToken Implementation" \
    "$LP_TOKEN_IMPL" \
    "src/LPToken.sol:LPToken"

verify_contract \
    "OracleAdapter Implementation" \
    "$NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS" \
    "src/OracleAdapter.sol:OracleAdapter"

echo "====================================="
echo "STEP 2: Verifying Proxy Contracts"
echo "====================================="
echo ""

# Verify proxies (with constructor args)
PROXY_PATH="lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"

# MarketFactory Proxy (no init data)
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,bytes)" "$MARKET_FACTORY_IMPL" 0x)
verify_contract \
    "MarketFactory Proxy" \
    "$NEXT_PUBLIC_MARKET_FACTORY_ADDRESS" \
    "$PROXY_PATH" \
    "$CONSTRUCTOR_ARGS"

# CreatorRegistry Proxy (with initialize() selector)
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,bytes)" "$CREATOR_REGISTRY_IMPL" 0x8129fc1c)
verify_contract \
    "CreatorRegistry Proxy" \
    "$NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS" \
    "$PROXY_PATH" \
    "$CONSTRUCTOR_ARGS"

# ProtocolTreasury Proxy (with initialize() selector)
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,bytes)" "$PROTOCOL_TREASURY_IMPL" 0x8129fc1c)
verify_contract \
    "ProtocolTreasury Proxy" \
    "$NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS" \
    "$PROXY_PATH" \
    "$CONSTRUCTOR_ARGS"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VERIFICATION COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "   ✅ Newly Verified: $VERIFIED"
echo "   ⏭️  Already Verified: $SKIPPED"
echo "   ❌ Failed: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "⚠️  Some verifications failed. Check the output above for details."
    exit 1
else
    echo "🎉 All contracts verified successfully!"
    echo ""
    echo "View on BaseScan:"
    echo "  MarketFactory:    https://sepolia.basescan.org/address/$NEXT_PUBLIC_MARKET_FACTORY_ADDRESS"
    echo "  CreatorRegistry:  https://sepolia.basescan.org/address/$NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS"
    echo "  ProtocolTreasury: https://sepolia.basescan.org/address/$NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS"
    echo ""
fi

