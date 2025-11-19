#!/bin/bash

# Load environment variables
source ../../../.env

echo ""
echo "========================================"
echo "   🔍 VERIFY CONTRACT ON BASESCAN"
echo "========================================"
echo ""

# Verify the NEW implementation contract
echo "📝 Verifying MarketFactory Implementation..."
echo "   Address: 0x262d1eDC53d2F3b10e46E0cA036C27F5BCf0cD6d"
echo ""

cd ..

forge verify-contract \
  0x262d1eDC53d2F3b10e46E0cA036C27F5BCf0cD6d \
  src/MarketFactory.sol:MarketFactory \
  --chain base-sepolia \
  --verifier-url https://api-sepolia.basescan.org/api \
  --etherscan-api-key $BASESCAN_API_KEY \
  --watch

echo ""
echo "========================================"
echo "   ✅ VERIFICATION COMPLETE!"
echo "========================================"
echo ""
echo "View on BaseScan:"
echo "https://sepolia.basescan.org/address/0x262d1eDC53d2F3b10e46E0cA036C27F5BCf0cD6d#code"
echo ""
echo "🎯 Now you can import the PROXY address to Thirdweb:"
echo "   0x85212aC505cb9Ae8e89ECf47CE57166401eBf3F6"
echo ""

