# 🚀 Automated Foundry Deployment

## Quick Start (2 minutes total!)

### 1. Check Your .env File

Make sure you have:
```bash
PRIVATE_KEY=your_private_key_here
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
FRONTEND_WALLET_ADDRESS=0xBfac8dB2767d7206AC224545Cf162DEe4ebcc8c9
```

### 2. Run Deployment

```bash
cd packages/contracts

# Deploy to Base Sepolia
forge script script/DeployAll.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --slow

# Takes ~30-60 seconds
```

### 3. Copy .env Output

The script will print:
```
Copy this to your .env and apps/web/.env.local:
-------------------------------------
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS=0x...
NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584
-------------------------------------
```

**Copy the block between dashes and paste into:**
- `.env` (root)
- `apps/web/.env.local`

### 4. Restart Frontend

```bash
cd apps/web
npm run dev
```

### 5. Test!

- Go to http://localhost:3000
- Login with your frontend wallet
- Go to `/yesno-admin` - should work!
- Create a test market

✅ **Done!** Total time: ~2 minutes

---

## What the Script Does

### Phase 1: Deploy Implementations (7 contracts)
- ✅ Market.sol
- ✅ OutcomeToken.sol
- ✅ LPToken.sol
- ✅ OracleAdapter.sol
- ✅ CreatorRegistry.sol
- ✅ MarketFactory.sol
- ✅ ProtocolTreasury.sol

### Phase 2: Deploy Proxies (3 contracts)
- ✅ CreatorRegistry Proxy
- ✅ MarketFactory Proxy
- ✅ ProtocolTreasury Proxy

### Phase 3: Initialize All Contracts
- ✅ MarketFactory (with all 11 parameters)
- ✅ CreatorRegistry (with MarketFactory address)
- ✅ ProtocolTreasury (with factory and treasury)

### Phase 4: Grant Roles
- ✅ MARKET_FACTORY_ROLE to MarketFactory
- ✅ DEFAULT_ADMIN_ROLE to your frontend wallet
- ✅ ADMIN_ROLE to your frontend wallet

### Phase 5: Print Summary
- ✅ All addresses in .env format
- ✅ BaseScan links
- ✅ Next steps

---

## Configuration

Edit `script/DeployAll.s.sol` to change:

```solidity
// USDC token (line 35)
address constant USDC_TOKEN = 0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584;

// Fee settings (lines 38-41)
uint256 constant DEFAULT_LP_FEE_BPS = 100;        // 1%
uint256 constant DEFAULT_PROTOCOL_FEE_BPS = 200;  // 2%
uint256 constant DEFAULT_PARLAY_FEE_BPS = 50;     // 0.5%
uint256 constant MIN_INITIAL_LIQUIDITY = 100 * 10**18; // 100 tokens
```

---

## Testing Locally (Optional)

Before deploying to testnet, test on local blockchain:

```bash
# Terminal 1: Start local blockchain
anvil

# Terminal 2: Deploy to local
forge script script/DeployAll.s.sol \
  --rpc-url http://localhost:8545 \
  --broadcast

# Update .env to use local addresses
# Test in your app connected to localhost:8545
```

---

## Verification (Optional)

Contracts work fine unverified, but if you want source code visible on BaseScan:

### Manual Verification (2 min per contract)

1. Go to https://sepolia.basescan.org/verifyContract
2. Enter contract address
3. Select "Solidity (Single file)"
4. Compiler: `v0.8.22+commit.4fc1097e`
5. Optimization: Yes, 200 runs
6. Paste flattened source code:

```bash
# Generate flattened files
forge flatten src/MarketFactory.sol > flattened/MarketFactory.sol
forge flatten src/CreatorRegistry.sol > flattened/CreatorRegistry.sol
forge flatten src/ProtocolTreasury.sol > flattened/ProtocolTreasury.sol
```

### Note about `via_ir`
If your contracts are compiled with `via_ir = true` in foundry.toml, you'll need to use "Standard JSON Input" verification instead of "Single file". See MANUAL_DEPLOYMENT_GUIDE.md for details.

---

## Troubleshooting

### "Insufficient funds"
- Your deployer wallet needs ETH on Base Sepolia
- Get from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### "Invalid nonce"
- Wait a few seconds between transactions
- Add `--slow` flag (already included)

### "FRONTEND_WALLET_ADDRESS not set"
- Add to .env: `FRONTEND_WALLET_ADDRESS=0xYourWallet`
- Or grant admin roles manually after deployment

### "Admin panel shows 'Unauthorized'"
- Frontend wallet doesn't have admin roles
- Check: Did script grant roles? (see Phase 4 output)
- Manually grant if needed (script prints instructions)

### Script output too fast to copy
```bash
# Save output to file
forge script script/DeployAll.s.sol --broadcast > deployment.log

# View .env section
grep -A 5 "Copy this to your .env" deployment.log
```

---

## Comparison: Manual vs Script

### Manual Thirdweb Deployment
- ⏱️ **30-45 minutes**
- 🖱️ Click through 50+ steps
- 📋 Copy-paste addresses 20+ times
- ❌ High chance of errors
- 😫 Tedious and error-prone

### Automated Foundry Script
- ⏱️ **2 minutes**
- 💻 One command
- 📋 Copy-paste once
- ✅ Consistent and reliable
- 😊 Fast and simple

---

## Advanced: Upgrade Existing Contracts

If you only want to upgrade implementations (not full redeploy):

```bash
# Deploy new implementation only
forge create src/MarketFactory.sol:MarketFactory \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Upgrade proxy to new implementation
cast send <PROXY_ADDRESS> \
  "upgradeToAndCall(address,bytes)" \
  <NEW_IMPL_ADDRESS> \
  0x \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

---

## Files Created

After deployment:
```
packages/contracts/
├── broadcast/
│   └── DeployAll.s.sol/
│       └── 84532/           ← Deployment receipts
│           └── run-latest.json
```

---

## Next Steps After Deployment

1. ✅ Update .env files (copy from script output)
2. ✅ Restart frontend
3. ✅ Test market creation
4. ✅ Verify contracts on BaseScan (optional)
5. ✅ Update CONTRACT_REGISTRY.md with new addresses
6. ✅ Test admin panel functionality
7. ✅ Create a real market with a new user

---

**Questions?** Check the script output - it includes helpful next steps and troubleshooting tips!

