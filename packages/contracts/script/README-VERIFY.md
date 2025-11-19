# Contract Verification Guide

This directory contains scripts to automatically verify all deployed contracts on BaseScan.

---

## 🚀 Quick Start

After deploying contracts with `DeployAll.s.sol`, verify them with:

```bash
cd packages/contracts
./script/verify-all.sh
```

That's it! The script will automatically verify all 10 contracts (7 implementations + 3 proxies).

---

## 📋 What Gets Verified

### Implementation Contracts (7)
1. **Market** - Core market logic with buyForUser/addLiquidityForUser
2. **MarketFactory** - Factory with buyFor/addLiquidityFor router functions
3. **CreatorRegistry** - Creator management and permissions
4. **ProtocolTreasury** - Fee collection and market resolution
5. **OutcomeToken** - ERC20 tokens for market outcomes
6. **LPToken** - ERC20 tokens for liquidity providers
7. **OracleAdapter** - Automated market resolution

### Proxy Contracts (3)
1. **MarketFactory Proxy** - Main factory proxy
2. **CreatorRegistry Proxy** - Creator registry proxy
3. **ProtocolTreasury Proxy** - Treasury proxy

---

## 📝 Prerequisites

### 1. Environment Variables

Ensure your `.env` file has:

```bash
# API Key
BASESCAN_API_KEY=your_api_key_here

# Proxy Addresses
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS=0x...
NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS=0x...

# Implementation Addresses
MARKET_IMPL=0x...
MARKET_FACTORY_IMPL=0x...
CREATOR_REGISTRY_IMPL=0x...
PROTOCOL_TREASURY_IMPL=0x...
OUTCOME_TOKEN_IMPL=0x...
LP_TOKEN_IMPL=0x...
```

**Note:** These are automatically added by the `DeployAll.s.sol` script output.

### 2. Get BaseScan API Key

1. Go to https://basescan.org/myapikey
2. Sign in / Create account
3. Generate a new API key
4. Add it to your `.env` as `BASESCAN_API_KEY`

**Important:** BaseScan and Etherscan use the same API key system. Your Etherscan API key works for BaseScan too!

---

## 🎯 Usage

### Option 1: Automated Script (Recommended)

```bash
cd packages/contracts
./script/verify-all.sh
```

**Features:**
- ✅ Verifies all 10 contracts automatically
- ✅ Skips already-verified contracts
- ✅ Shows progress and summary
- ✅ Handles constructor arguments automatically
- ✅ Exits with error if any verification fails

**Output:**
```
===================================
YesNo.Win Contract Verification
===================================

✅ Found .env with contract addresses

===================================
STEP 1: Verifying Implementation Contracts
===================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Verifying: Market Implementation
   Address: 0xC636Db69cCAfB92dDc7100d2165450E95932F78b
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Verified successfully!

... (continues for all contracts)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VERIFICATION COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
   ✅ Newly Verified: 10
   ⏭️  Already Verified: 0
   ❌ Failed: 0

🎉 All contracts verified successfully!
```

### Option 2: Manual Commands

If you prefer to verify contracts one by one, use the Solidity script:

```bash
forge script script/VerifyAll.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL
```

This will print all verification commands. Copy and run them individually.

---

## 🔧 Troubleshooting

### "Invalid API Key"

**Problem:** Your BASESCAN_API_KEY is not set or invalid.

**Solution:**
1. Check `.env` has `BASESCAN_API_KEY=your_key`
2. Verify the key is correct on https://basescan.org/myapikey
3. Try using your Etherscan API key (they're the same)

### "Contract already verified"

**Problem:** Contract was verified in a previous run.

**Solution:** This is not an error! The script will skip it and continue.

### "Failed to get standard json input"

**Problem:** OpenZeppelin contracts path is incorrect.

**Solution:** This should not happen with the automated script. If it does:
1. Ensure you're in the `packages/contracts` directory
2. Check that `lib/openzeppelin-contracts-upgradeable/` exists
3. Run `forge install` to reinstall dependencies

### "Bytecode mismatch"

**Problem:** The deployed bytecode doesn't match the source code.

**Solution:**
1. Ensure you're verifying the correct contract address
2. Check that the compiler settings match (optimizer, via_ir, etc.)
3. Verify you're using the same Solidity version (0.8.22)

### Script Crashes on macOS

**Problem:** `forge verify-contract` crashes with "NULL object" error.

**Solution:** This is a known Foundry bug on macOS. The bash script (`verify-all.sh`) works around this by capturing output. If it still fails:
1. Try verifying manually via BaseScan web UI
2. Use Docker/Linux environment
3. Wait for Foundry to fix the bug

---

## 📊 Verification Status

After running the script, check verification status on BaseScan:

- **MarketFactory:** https://sepolia.basescan.org/address/[YOUR_ADDRESS]
- **CreatorRegistry:** https://sepolia.basescan.org/address/[YOUR_ADDRESS]
- **ProtocolTreasury:** https://sepolia.basescan.org/address/[YOUR_ADDRESS]

**What to look for:**
- ✅ Contract name shows (not "UnknownContract")
- ✅ "Code" tab shows source code
- ✅ "Read Contract" / "Write Contract" tabs available
- ✅ "Read as Proxy" / "Write as Proxy" tabs for proxies

---

## 🎯 Why Verify Contracts?

### For Users
- **Transparency:** Users can see exactly what your contracts do
- **Trust:** Verified contracts build confidence
- **Interaction:** Can interact directly via BaseScan UI

### For Developers
- **Debugging:** Easier to debug transactions on BaseScan
- **Admin Functions:** Can call admin functions via BaseScan
- **Integration:** Other platforms can read your ABIs

### For Auditors
- **Source Code:** Can review actual deployed code
- **Compiler Settings:** Can verify optimization settings
- **Constructor Args:** Can see initialization parameters

---

## 📝 Technical Details

### Constructor Arguments

**Implementations:** No constructor args (all use `initialize()` pattern)

**Proxies:** Require constructor args:
- `address implementation` - Address of implementation contract
- `bytes data` - Initialization data
  - `0x` = No initialization
  - `0x8129fc1c` = `initialize()` function selector

### Proxy Path

The script uses the full physical path to ERC1967Proxy:
```
lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy
```

This is necessary because Foundry's remapping system doesn't work with `forge verify-contract`.

### Compiler Settings

All contracts are compiled with:
- **Solidity Version:** 0.8.22
- **Optimizer:** Enabled (200 runs)
- **EVM Version:** Shanghai
- **Via IR:** Enabled

These settings are automatically applied from `foundry.toml`.

---

## 🚀 Next Steps

After verification:

1. **Check BaseScan** - Verify all contracts show as verified
2. **Test Admin Panel** - Ensure admin functions work
3. **Update Documentation** - Mark verification as complete
4. **Deploy to Production** - When ready for mainnet

---

## 📚 Related Documentation

- [Deployment Guide](./README-DEPLOY.md)
- [Contract Registry](../../docs/CONTRACT_REGISTRY.md)
- [BaseScan API Docs](https://docs.basescan.org/api-endpoints/contracts)
- [Foundry Verification](https://book.getfoundry.sh/reference/forge/forge-verify-contract)

---

**Last Updated:** November 7, 2025  
**Script Version:** 1.0.0  
**Status:** ✅ Tested & Working

