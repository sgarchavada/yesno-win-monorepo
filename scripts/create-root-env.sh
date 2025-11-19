#!/bin/bash

# Script to create consolidated root .env file

echo "Creating consolidated .env file..."

cat > .env << 'EOF'
# ============================================
# THIRDWEB CONFIGURATION
# ============================================
# Client ID (used in frontend - must have NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=24116dc7f1a52f51d50d6539ee1e6d80

# Secret Key (server-side only - DO NOT expose in frontend)
THIRDWEB_SECRET_KEY=N6hb55M67DK_Y7mRM0RsF8e1Da70auGHDxTeMXuBo5LNt5Lc_-QtDcsh-Iq-KS2c28pgFavkzgTyiclHuF557Q

# Wallet Address
THIRDWEB_WALLET_ID=0x57a195CF18ba3BB183263Bd71080146e8106C474

# ============================================
# BLOCKCHAIN CONFIGURATION
# ============================================
# Base Sepolia RPC URL
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Your deployer private key (KEEP THIS SECRET!)
# TODO: Uncomment and add your private key when deploying
# PRIVATE_KEY=your_private_key_here

# ============================================
# CONTRACT ADDRESSES (update after deployment)
# ============================================
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=
NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=

# ============================================
# FRONTEND CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# OPTIONAL: BaseScan API Key (for contract verification)
# ============================================
# BASESCAN_API_KEY=
EOF

echo "✅ Root .env file created!"
echo ""
echo "📝 What was consolidated:"
echo "   ✅ NEXT_PUBLIC_THIRDWEB_CLIENT_ID (from frontend)"
echo "   ✅ THIRDWEB_SECRET_KEY (from contract)"
echo "   ✅ THIRDWEB_WALLET_ID (from contract)"
echo ""
echo "⚠️  TODO: Add your PRIVATE_KEY for contract deployment"
echo ""
echo "You can now safely delete the old folders:"
echo "   rm -rf yesno-win-frontend yesno-win-contract"
echo ""

