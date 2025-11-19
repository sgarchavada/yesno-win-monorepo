#!/bin/bash

# Script to help consolidate .env files from old folders
# This will show you what's in each file so you can merge them

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           .ENV FILE CONSOLIDATION HELPER                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if files exist
FRONTEND_ENV="yesno-win-frontend/.env"
CONTRACT_ENV="yesno-win-contract/.env"
ROOT_ENV=".env"

echo "📁 Found .env files:"
echo "   - $FRONTEND_ENV ($(wc -c < "$FRONTEND_ENV" 2>/dev/null || echo 0) bytes)"
echo "   - $CONTRACT_ENV ($(wc -c < "$CONTRACT_ENV" 2>/dev/null || echo 0) bytes)"
echo "   - $ROOT_ENV ($(wc -c < "$ROOT_ENV" 2>/dev/null || echo 0) bytes)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show frontend .env
if [ -f "$FRONTEND_ENV" ]; then
    echo "📱 FRONTEND .env contents:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$FRONTEND_ENV"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
else
    echo "⚠️  Frontend .env not found"
    echo ""
fi

# Show contract .env
if [ -f "$CONTRACT_ENV" ]; then
    echo "📜 CONTRACT .env contents:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$CONTRACT_ENV"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
else
    echo "⚠️  Contract .env not found"
    echo ""
fi

# Show current root .env
if [ -f "$ROOT_ENV" ]; then
    echo "🔧 CURRENT ROOT .env contents:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$ROOT_ENV"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
fi

echo ""
echo "📝 RECOMMENDED ROOT .env STRUCTURE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat << 'EOF'
# ============================================
# BLOCKCHAIN CONFIGURATION
# ============================================
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here

# ============================================
# THIRDWEB
# ============================================
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id_here

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
# OPTIONAL: BaseScan API Key (for verification)
# ============================================
BASESCAN_API_KEY=

EOF
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ ACTION ITEMS:"
echo "   1. Copy values from above .env files"
echo "   2. Paste into root .env file"
echo "   3. Make sure all NEXT_PUBLIC_ vars are included"
echo "   4. Keep your PRIVATE_KEY secure!"
echo ""
echo "💡 TIP: You can edit .env with:"
echo "   nano .env"
echo "   or"
echo "   code .env"
echo ""

