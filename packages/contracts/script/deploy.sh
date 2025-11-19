#!/bin/bash

###############################################################################
# YesNo.Win Deployment Script for Base Sepolia
# 
# Usage:
#   ./script/deploy.sh [--verify]
#
# Requirements:
#   - .env file with PRIVATE_KEY, BASE_SEPOLIA_RPC_URL
#   - Optional: BASESCAN_API_KEY for verification
###############################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Flags
VERIFY_FLAG=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --verify) VERIFY_FLAG="--verify"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
done

echo -e "${BLUE}"
echo "========================================="
echo "   YesNo.Win Deployment Automation"
echo "========================================="
echo -e "${NC}"

# Check environment
echo -e "${YELLOW}Checking environment...${NC}"

if [ ! -f "../../.env" ]; then
    echo -e "${RED}Error: .env file not found in root directory${NC}"
    exit 1
fi

# Load environment variables
source ../../.env

if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set in .env${NC}"
    exit 1
fi

if [ -z "$BASE_SEPOLIA_RPC_URL" ]; then
    echo -e "${RED}Error: BASE_SEPOLIA_RPC_URL not set in .env${NC}"
    exit 1
fi

if [ -n "$VERIFY_FLAG" ] && [ -z "$BASESCAN_API_KEY" ]; then
    echo -e "${YELLOW}Warning: BASESCAN_API_KEY not set, verification will be skipped${NC}"
    VERIFY_FLAG=""
fi

echo -e "${GREEN}✓ Environment variables loaded${NC}"
echo ""

# Build contracts
echo -e "${BLUE}Building contracts...${NC}"
forge build --force
echo -e "${GREEN}✓ Contracts built${NC}"
echo ""

# Run deployment
echo -e "${BLUE}Deploying contracts to Base Sepolia...${NC}"

# Export variables for Foundry
export PRIVATE_KEY
export BASE_SEPOLIA_RPC_URL
export BASESCAN_API_KEY

if [ -n "$VERIFY_FLAG" ]; then
    forge script script/DeployBaseSepolia.s.sol \
        --rpc-url "$BASE_SEPOLIA_RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --broadcast \
        --verify \
        --etherscan-api-key "$BASESCAN_API_KEY" \
        -vvvv
else
    forge script script/DeployBaseSepolia.s.sol \
        --rpc-url "$BASE_SEPOLIA_RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --broadcast \
        -vvvv
fi

echo ""
echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# Run post-deployment automation
echo -e "${BLUE}Running post-deployment automation...${NC}"
node script/post-deploy.js

echo ""
echo -e "${GREEN}"
echo "========================================="
echo "   🎉 DEPLOYMENT SUCCESSFUL! 🎉"
echo "========================================="
echo -e "${NC}"
echo ""
echo -e "${BLUE}What's next:${NC}"
echo "  1. Check deployments/base-sepolia.json for addresses"
echo "  2. .env has been updated automatically"
echo "  3. SDK has been rebuilt"
echo "  4. Start the frontend: pnpm dev -F web"
echo ""

if [ -z "$VERIFY_FLAG" ]; then
    echo -e "${YELLOW}Note: Contracts were not verified. Run with --verify flag to verify on Basescan.${NC}"
    echo ""
fi

