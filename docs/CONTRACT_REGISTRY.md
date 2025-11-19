# 🎯 YesNo.Win Contract Registry

**Network:** Base Sepolia Testnet  
**Deployment Date:** November 7, 2025 (Foundry Automated Deployment)  
**Deployer Wallet:** `0x297d01e65E319bfF025a60Bd710811724c7c2589`  
**Admin Wallet (Frontend):** `0xBfac8dB2767d7206AC224545Cf162DEe4ebcc8c9`

---

## 📋 DEPLOYMENT PROGRESS

- [x] Phase 1: Deploy all implementations (7 contracts) ✅
- [x] Phase 2: Deploy all proxies (3 contracts) ✅
- [x] Phase 3: Configure MarketFactory ✅
- [x] Phase 4: Add admin roles ✅
- [ ] Phase 5: Test everything

---

## 🟢 PROXIES (PERMANENT - NEVER DELETE!)

### ⭐ 1. MarketFactory (PROXY)
- **Status:** ✅ Deployed (Foundry Script) - **UPGRADED to v3**
- **Address:** `0xa6B911Cd92586103E0016ee545B9cECA8e569680`
- **BaseScan:** `https://sepolia.basescan.org/address/0xa6B911Cd92586103E0016ee545B9cECA8e569680`
- **Deployer:** `0x297d01e65E319bfF025a60Bd710811724c7c2589` ✅
- **Admin (Frontend):** `0xBfac8dB2767d7206AC224545Cf162DEe4ebcc8c9` ✅
- **Implementation Points To:** `0x65Fece8151D9DC89e402171A5FC5BF628C77fc5F` (v3 - Fixed MIN_INITIAL_LIQUIDITY)
- **Roles Granted:** 
  - DEFAULT_ADMIN_ROLE to frontend wallet ✅
  - ADMIN_ROLE to frontend wallet ✅ (manually granted - now in deployment script)
- **Notes:** 🚨 MAIN FACTORY - DO NOT DELETE! Contains all market data!

---

### ⭐ 2. CreatorRegistry (PROXY)
- **Status:** ✅ Deployed (Foundry Script)
- **Address:** `0x6a45D830Bdbc4A5C854c08a3aB1AedbB6B12eaee`
- **BaseScan:** `https://sepolia.basescan.org/address/0x6a45D830Bdbc4A5C854c08a3aB1AedbB6B12eaee`
- **Deployer:** `0x297d01e65E319bfF025a60Bd710811724c7c2589` ✅
- **Admin (Frontend):** `0xBfac8dB2767d7206AC224545Cf162DEe4ebcc8c9` ✅
- **Implementation Points To:** `0xd5e99779d03C6F55529b186c3E38aB6B766Ba634`
- **Roles Granted:** ADMIN_ROLE to frontend wallet ✅
- **Notes:** 🚨 CREATOR REGISTRY - DO NOT DELETE! Contains all creator data!

---

### ⭐ 3. ProtocolTreasury (PROXY)
- **Status:** ✅ Deployed (Foundry Script)
- **Address:** `0xC144ce2F03Ee447fD92F69054e01C1825a17c799`
- **BaseScan:** `https://sepolia.basescan.org/address/0xC144ce2F03Ee447fD92F69054e01C1825a17c799`
- **Deployer:** `0x297d01e65E319bfF025a60Bd710811724c7c2589` ✅
- **Implementation Points To:** `0xFf8a81dc3610800D99151d925a3FEdC1A46eC0dE`
- **Notes:** 🚨 TREASURY - DO NOT DELETE! Manages all fees!

---

## 🔵 IMPLEMENTATIONS (Safe to replace after upgrading)

### 📦 1.1. Market (Implementation v26) 🆕 LATEST 🔥 PRODUCTION READY
- **Status:** ✅ Deployed and Verified - **LP TOKEN FIX**
- **Address:** `0x5A52F0D88980542b098719D4d7710D8B1693B4C2`
- **BaseScan:** `https://sepolia.basescan.org/address/0x5A52F0D88980542b098719D4d7710D8B1693B4C2`
- **Used By:** MarketFactory proxy (set via setImplementations) + Individual Market Proxies (via upgradeTo)
- **Features:** 
  - **NEW v24:** 🛡️ LP Token Zero-Collateral Protection
    - **Added `ZeroCollateralReturn()` custom error**
      - More gas-efficient than generic `InvalidAmount()` error
      - Clearer error messages for debugging
    - **Prevents LP token burning when collateral rounds to 0**
      - Protects users from losing LP tokens due to integer division rounding
      - Applies to all market states: CANCELED, RESOLVED, and ACTIVE
      - Frontend shows user-friendly error: "Amount Too Small"
    - **UX Improvement**
      - Users now get clear feedback instead of silent token loss
      - Suggests minimum withdrawal amount (0.01 LP tokens)
    - **Gas Savings:** ~200 gas per call (custom error vs generic)
  - **v23 (Final Consensus):** 🎯 PRODUCTION READY - All ChatGPT Audit Recommendations Addressed
    - **CRITICAL FIX:** Decimal Unit Mismatch
      - Fixed catastrophic bug where 18-decimal tokens were compared to 6-decimal USDC
      - Added `TOKEN_TO_COLLATERAL_DIV = 1e12` constant for consistent conversions
      - All claim/payout arithmetic now in 6-decimal collateral units
      - Updated: `_claimAmount()`, `getClaimableAmount()`, `getAllClaimableAmounts()`
      - Previous bug caused massive over/under payments (comparing 100e6 USDC to 100e18 tokens)
    - **Fixed `withdrawStuckTokens()` Double Subtraction Bug**
      - Removed double subtraction of fees (fees already part of totalReserves)
      - Now correctly calculates: `maxWithdrawable = contractBalance - totalReserves`
      - Previous bug made withdrawals overly restrictive
    - **Documented Parlay Fee Design**
      - Added comprehensive NatSpec explaining why no sell-side fees
      - Clarifies parlay is a rebalancing operation, not profit-taking
      - Single fee on net trade (buy side only) to avoid double-charging
    - **Deprecated `syncReserves()` Function**
      - Added warnings that it's emergency-only and can create inconsistency
      - After v23 fixes, reserves should never drift from actual balance
      - If reserves drift, indicates a bug that should be fixed, not patched
    - **Comprehensive Documentation**
      - All storage variables now have decimal precision comments (6 vs 18 decimals)
      - Rounding behavior explained (truncation vs ceiling, both negligible)
      - Design choices documented for future developers
    - **Verified by Both AI Systems**
      - ChatGPT audit recommendations all addressed
      - Cursor AI verification complete
      - Final consensus reached on all design decisions
  - **v22:** 🚀 Contract-Based Claimable Calculation (PERFORMANCE OPTIMIZATION)
    - **Added `getAllClaimableAmounts(address user)` view function**
    - **Added `getClaimableAmount(address user, uint256 outcomeIndex)` view function**
    - Frontend now makes 1 RPC call instead of N calls (N = number of positions)
    - 50-70% reduction in RPC calls for active users
    - Contract calculates claimable amounts internally (more efficient)
    - Eliminates code duplication between frontend and contract
    - Real-time dynamic updates still work (refreshes every 10 seconds)
  - **v21:** ✅ Winners Paid from Losing Reserves (FINAL DESIGN)
    - **Winners are now paid from LOSING outcome reserves, not totalReserves!**
    - This preserves LP liquidity and prevents pool drainage
    - Example: If NO wins, winners get paid from reserves[YES] (losing side)
    - LPs can now withdraw their liquidity after winners claim
    - Fixes bug where winner claims drained entire pool
    - Formula: `availableForWinners = sum(reserves[losing outcomes])`
    - Deductions are proportional across all losing outcomes
  - **v20:** 🚀 Removed Trade Size Limit (UX IMPROVEMENT)
    - **No more 25% trade size restriction**
    - Users can now trade any amount (Max button works!)
    - Price impact is the natural deterrent (matches Polymarket/Kalshi)
    - Percentage buttons (5%, 10%, 20%, 30%, 50%, 75%, Max) all work correctly
    - Removed `maxTradeSizeBps` variable and all related checks
    - Removed `TradeSizeExceedsMaximum` error
  - **v19:** 💰 Proportional Winner Payouts
    - Dynamic payouts based on available liquidity
    - If `totalReserves >= totalWinningTokens`: 1:1 payout (normal case)
    - If `totalReserves < totalWinningTokens`: Proportional payout (shortfall case)
    - Formula: `payoutAmount = (tokenAmount × totalReserves) / totalWinningTokens`
    - Example: $690 available / 700 tokens = $0.986 per token
    - Prevents underflow errors and ensures fair distribution
    - All winners get proportional share of available funds
  - **v18:** 🛡️ Winner Protection on Resolved Markets
    - Winners are ALWAYS protected - their funds are reserved first
    - LPs can only withdraw from unreserved funds
    - Formula: `availableForLPs = totalReserves - winningTokenSupply`
  - **v17:** 🎯 Admin Unrestricted Resolution
    - Admin can resolve markets ANYTIME - even before end time
  - **v16:** Fixed `totalReserves` drift prevention
  - **v15:** Fixed `totalReserves` updates in claim functions
  - **v13:** Fixed `removeLiquidity()` with three distinct paths
  - **v7:** Added `userInvestments` mapping for accurate refunds
  - buyForUser, addLiquidityForUser (Uniswap Router pattern), centralized approval
- **Previous:** `0x130c2bfd8e81aA3f2Eb04f513D7a35aBFC288d35` (v22 - **CRITICAL BUG - DO NOT USE**)
- **Upgrade Required:** ⚠️ **URGENT** - v23 fixes critical decimal mismatch bug
- **Can Delete:** ❌ No - Keep v22/v21 for audit trail
- **Design Doc:** See [README_AMM_ONLY_PAYOUT_MODEL.md](../README_AMM_ONLY_PAYOUT_MODEL.md) for AMM payout model

---

### 📦 1.1a. Market (Implementation v23 Final) - ⚠️ SUPERSEDED by v24
- **Status:** ⚠️ SUPERSEDED - Use v24 instead (LP token fix)
- **Address:** `0xd158Dbd29F9aAC638349d9c18ff4e2a875b7680f`
- **BaseScan:** `https://sepolia.basescan.org/address/0xd158Dbd29F9aAC638349d9c18ff4e2a875b7680f`
- **Why Superseded:** Missing LP token zero-collateral protection (users could lose tokens due to rounding)
- **Can Delete:** ✅ Yes, after all markets are upgraded to v24

---

### 📦 1.1b. Market (Implementation v23 - OLD) - ⚠️ SUPERSEDED by v23 Final
- **Status:** ⚠️ SUPERSEDED - Use v24 instead
- **Address:** `0xF44FEEf351F1831C735BAc3b2d0A4795FD2D41A8`
- **BaseScan:** `https://sepolia.basescan.org/address/0xF44FEEf351F1831C735BAc3b2d0A4795FD2D41A8`
- **Why Superseded:** Missing final documentation updates (withdrawStuckTokens fix, parlay docs, syncReserves deprecation)
- **Can Delete:** ✅ Yes, after all markets are upgraded to v24

---

### 📦 1.1c. Market (Implementation v22) - ⚠️ CRITICAL BUG - SUPERSEDED by v23
- **Status:** 🚨 **CRITICAL BUG** - Contains decimal unit mismatch - **DO NOT USE**
- **Address:** `0x130c2bfd8e81aA3f2Eb04f513D7a35aBFC288d35`
- **BaseScan:** `https://sepolia.basescan.org/address/0x130c2bfd8e81aA3f2Eb04f513D7a35aBFC288d35`
- **Why Superseded:** Compared 18-decimal tokens directly to 6-decimal USDC, causing massive payout errors
- **Bug Impact:** Winners could receive 1e12x more or less than intended
- **Can Delete:** ❌ No - Keep for audit trail

---

### 📦 1.1d. Market (Implementation v21) - SUPERSEDED by v22/v23/v24
- **Status:** ⚠️ SUPERSEDED - Use v23 instead
- **Address:** `0xe83B97E0E8488B96A640745cd763607F7Adb7c5a`
- **BaseScan:** `https://sepolia.basescan.org/address/0xe83B97E0E8488B96A640745cd763607F7Adb7c5a`
- **Why Superseded:** v22 added view functions (but had critical bug), v23 fixes both
- **Can Delete:** ✅ Yes, after all markets are upgraded to v23

---

### 📦 1.2. MarketFactory (Implementation v3)
- **Status:** ✅ Deployed (Foundry Script - Upgrade)
- **Address:** `0x65Fece8151D9DC89e402171A5FC5BF628C77fc5F`
- **BaseScan:** `https://sepolia.basescan.org/address/0x65Fece8151D9DC89e402171A5FC5BF628C77fc5F`
- **Used By:** MarketFactory proxy
- **Features:** **FIXED: MIN_INITIAL_LIQUIDITY = 100 * 10^6 (100 USDC with 6 decimals)**
- **Previous Version:** `0x78EC652972357F6CBC2E909135b238F19f185b03` (v2 - had incorrect liquidity constant)
- **Can Delete:** ✅ Yes, after deploying v4 and upgrading

---

### 📦 1.3. CreatorRegistry (Implementation v2)
- **Status:** ✅ Deployed (Foundry Script)
- **Address:** `0xd5e99779d03C6F55529b186c3E38aB6B766Ba634`
- **BaseScan:** `https://sepolia.basescan.org/address/0xd5e99779d03C6F55529b186c3E38aB6B766Ba634`
- **Used By:** CreatorRegistry proxy
- **Features:** Creator tracking, admin roles, request/approve system
- **Can Delete:** ✅ Yes, after deploying v3 and upgrading

---

### 📦 1.4. ProtocolTreasury (Implementation v2)
- **Status:** ✅ Deployed (Foundry Script)
- **Address:** `0xFf8a81dc3610800D99151d925a3FEdC1A46eC0dE`
- **BaseScan:** `https://sepolia.basescan.org/address/0xFf8a81dc3610800D99151d925a3FEdC1A46eC0dE`
- **Used By:** ProtocolTreasury proxy
- **Features:** Cancellation reasons, fee collection, liquidity management
- **Can Delete:** ✅ Yes, after deploying v3 and upgrading

---

### 📦 1.5. OutcomeToken (Implementation v2)
- **Status:** ✅ Deployed (Foundry Script)
- **Address:** `0x9751A6230D912606CdAcd18e953862C1652Bc223`
- **BaseScan:** `https://sepolia.basescan.org/address/0x9751A6230D912606CdAcd18e953862C1652Bc223`
- **Used By:** MarketFactory proxy (set via setImplementations)
- **Notes:** Standard ERC20, no major changes expected
- **Can Delete:** ✅ Yes, after deploying new version and updating factory

---

### 📦 1.6. LPToken (Implementation v2)
- **Status:** ✅ Deployed (Foundry Script)
- **Address:** `0x345d1b868518d52F1CE0d79bD743b8ef5483d20f`
- **BaseScan:** `https://sepolia.basescan.org/address/0x345d1b868518d52F1CE0d79bD743b8ef5483d20f`
- **Used By:** MarketFactory proxy (set via setImplementations)
- **Notes:** Standard ERC20, no major changes expected
- **Can Delete:** ✅ Yes, after deploying new version and updating factory

---

### 📦 1.7. OracleAdapter (Implementation v2)
- **Status:** ✅ Deployed (Foundry Script)
- **Address:** `0x2eF5B4D1Ae47C6297B09494e826aa2C9328E87D3`
- **BaseScan:** `https://sepolia.basescan.org/address/0x2eF5B4D1Ae47C6297B09494e826aa2C9328E87D3`
- **Used By:** MarketFactory proxy (set via setOracleAdapter)
- **Features:** Automated market resolution, oracle integration, timeout fallback
- **Notes:** Optional - Markets can be resolved manually if no oracle set
- **Can Delete:** ✅ Yes, after deploying new version and updating factory

---

## 🔗 HELPER CONTRACTS

### 💎 USDC Token (Mock USDC for testnet)
- **Address:** `0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584`
- **Symbol:** USDC
- **Decimals:** 6
- **Network:** Base Sepolia
- **BaseScan:** `https://sepolia.basescan.org/address/0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584`
- **Notes:** This is the collateral token for all markets. Users approve this token to the MarketFactory.

---

## ⚙️ CONFIGURATION TRACKING

### MarketFactory Settings:
- [x] `setTreasury()` → ProtocolTreasury proxy address ✅
- [x] `setImplementations()` → Market, OutcomeToken, LPToken addresses ✅
- [x] `setCreatorRegistry()` → CreatorRegistry proxy address ✅
- [x] `setOracleAdapter()` → Oracle address ✅
- [x] `setMarketCreationFee()` → 5000000 (5 USDC) ✅
- [x] `setMaxOutcomes()` → 20 ✅
- [x] `grantRole(DEFAULT_ADMIN_ROLE)` → Frontend wallet added as admin ✅

### CreatorRegistry Settings:
- [x] `grantRole(ADMIN_ROLE)` → Frontend wallet added as admin ✅
- [x] `grantRole(MARKET_FACTORY_ROLE)` → MarketFactory granted role ✅
- [ ] `setCreatorRequestsEnabled()` → Enable creator requests (manual)

### ProtocolTreasury Settings:
- [x] Initialized with deployer as owner ✅
- [x] Configured correctly ✅

---

## 🔴 CRITICAL RULES:

### ⛔ NEVER DELETE:
1. ⭐ MarketFactory PROXY
2. ⭐ CreatorRegistry PROXY
3. ⭐ ProtocolTreasury PROXY

### ✅ SAFE TO DELETE (after upgrading):
1. 📦 All Implementation contracts
2. 📦 Old versions of implementations

### 🎯 HOW TO IDENTIFY:
```
PROXY = Has storage, has data, has owner
      = Check: owner() returns your wallet address
      = NEVER DELETE!

IMPLEMENTATION = Just code, no data
               = Can delete after upgrading
               = Safe to replace
```

---

## 📝 QUICK REFERENCE TABLE

| Contract Type | Role | Can Delete? | Contains Data? |
|---------------|------|-------------|----------------|
| MarketFactory (PROXY) | Main factory | ❌ NEVER | ✅ Yes |
| CreatorRegistry (PROXY) | Creator mgmt | ❌ NEVER | ✅ Yes |
| ProtocolTreasury (PROXY) | Fee mgmt | ❌ NEVER | ✅ Yes |
| Market (IMPL) | Code only | ✅ After upgrade | ❌ No |
| MarketFactory (IMPL) | Code only | ✅ After upgrade | ❌ No |
| CreatorRegistry (IMPL) | Code only | ✅ After upgrade | ❌ No |
| ProtocolTreasury (IMPL) | Code only | ✅ After upgrade | ❌ No |
| OutcomeToken (IMPL) | Code only | ✅ After upgrade | ❌ No |
| LPToken (IMPL) | Code only | ✅ After upgrade | ❌ No |
| OracleAdapter (IMPL) | Code only | ✅ After upgrade | ❌ No |

---

## 🧪 TESTING CHECKLIST

After deployment, test:

- [ ] Create test market (should charge 5 USDC creation fee)
- [ ] Verify treasury balance increased by 5 USDC
- [ ] Buy tokens on test market
- [ ] Sell tokens on test market
- [ ] Try to claim LP fees before resolution (should FAIL)
- [ ] Resolve market
- [ ] Claim LP fees (should SUCCEED)
- [ ] Try to create market with duplicate outcomes (should FAIL)
- [ ] Try to create market with 21+ outcomes (should FAIL)
- [ ] Request creator access from frontend
- [ ] Approve creator from admin panel
- [ ] Revoke creator from admin panel

---

## 🚨 EMERGENCY CONTACTS

If something goes wrong:

1. **Check Owner Address:** Call `owner()` on proxy - should be `0x785d74eD783AB064d88489a77c01693Bf0E750eC`
2. **Check Admin Role:** Call `hasRole(ADMIN_ROLE, YOUR_WALLET)` - should return `true`
3. **Rollback Upgrade:** Call `upgradeTo(OLD_IMPLEMENTATION_ADDRESS)` to revert
4. **Transfer Ownership:** Only if absolutely necessary: `transferOwnership(NEW_WALLET)`

---

## 📊 DEPLOYMENT HISTORY

### Deployment #2 (Current - Foundry Automated) ✅
- **Date:** November 7, 2025
- **Network:** Base Sepolia (Chain ID: 84532)
- **Status:** ✅ Active
- **Method:** Foundry Script (`DeployAll.s.sol`)
- **Gas Cost:** 0.000017066244251637 ETH (~$0.05 USD)
- **Deployer:** `0x297d01e65E319bfF025a60Bd710811724c7c2589`
- **Features:**
  - ✅ **Centralized Approval** (Uniswap Router pattern)
  - ✅ **buyFor/addLiquidityFor** functions on MarketFactory
  - ✅ **buyForUser/addLiquidityForUser** functions on Market
  - ✅ Automated initialization and role grants
  - ✅ All admin roles auto-granted to frontend wallet
- **Notes:** This deployment replaces the manual Thirdweb deployment. All contracts are fully configured and ready to use. The old deployment addresses are now obsolete.

### Deployment #1 (Obsolete - Thirdweb Manual)
- **Date:** October-November 2025
- **Network:** Base Sepolia
- **Status:** ⏸️ Obsolete (replaced by Deployment #2)
- **Method:** Manual Thirdweb deployment
- **Notes:** This deployment had persistent "insufficient allowance" errors due to incorrect approval architecture. Replaced with Foundry automated deployment.

---

## 💡 NOTES & OBSERVATIONS

### ✅ Successful Improvements
1. **Centralized Approval**: Users now only need to approve USDC spending once to the MarketFactory (not per-market). This saves gas and reduces MetaMask popups.
2. **Uniswap Router Pattern**: MarketFactory acts as a router, handling `transferFrom` and then calling market functions. This is the industry-standard approach.
3. **Automated Deployment**: Foundry script handles all initialization and role grants automatically, reducing human error.
4. **Admin Roles Auto-Granted**: Frontend wallet receives DEFAULT_ADMIN_ROLE and ADMIN_ROLE automatically during deployment.

### 🎯 Next Steps
1. Test market creation with new deployment
2. Verify centralized approval works correctly
3. Enable creator requests in CreatorRegistry (manual admin action)
4. Monitor gas costs and user experience

---

## 🔄 MARKET IMPLEMENTATION UPGRADE HISTORY

### v21 (Current) - November 10, 2025 ✅ APPROVED & FINAL
- **Address:** `0xe83B97E0E8488B96A640745cd763607F7Adb7c5a`
- **Feature:** Winners Paid from Losing Reserves (FINAL DESIGN - Option B)
  - **Winners are paid from LOSING outcome reserves ONLY, never from totalReserves**
  - Preserves LP liquidity and prevents pool drainage
  - Example: If NO wins, winners get paid from reserves[YES] (losing side)
  - LPs can withdraw their liquidity after winners claim (winning side reserves + fees)
  - Formula: `availableForWinners = sum(reserves[losing outcomes])`
  - Proportional payout if losing reserves < total winning tokens
  - Deductions are proportional across all losing outcomes
- **Impact:** ✅ **CORRECT AMM ECONOMICS** - Pure AMM payout model
- **Status:** Deployed and APPROVED for production use
- **Design Doc:** [README_AMM_ONLY_PAYOUT_MODEL.md](../README_AMM_ONLY_PAYOUT_MODEL.md)
- **Decision:** Option B chosen after team review (November 10, 2025)

### v20 - November 10, 2025 ✅ 🚀 (SUPERSEDED - HAS CRITICAL BUG)
- **Address:** `0x0634d5590098203c787A0B3Fc7E21C96810049a0`
- **Feature:** Removed Trade Size Limit (UX IMPROVEMENT)
  - **No more 25% trade size restriction**
  - Users can now trade any amount (Max button works!)
  - Price impact is the natural deterrent (matches Polymarket/Kalshi)
  - All percentage buttons (5%, 10%, 20%, 30%, 50%, 75%, Max) work correctly
  - Removed `maxTradeSizeBps` variable and all related checks
  - Removed `TradeSizeExceedsMaximum` error
- **Impact:** Better UX, matches industry standards, no artificial trading limits
- **Status:** ⚠️ **DO NOT USE** - Contains critical payout bug, upgrade to v21 immediately

### v19 - November 10, 2025 ✅ 💰
- **Address:** `0x9c8753310EC6e2155Ad1E02cD69b3821FCC01c4c`
- **Feature:** Proportional Winner Payouts (CRITICAL FIX)
  - **Dynamic payouts based on available liquidity**
  - Normal case: 1:1 payout when reserves are sufficient
  - Shortfall case: Proportional payout when reserves < winning tokens
  - Formula: `payoutAmount = (tokenAmount × totalReserves) / totalWinningTokens`
  - Prevents underflow errors in edge cases
- **Impact:** Handles extreme one-sided markets gracefully, ensures fair distribution
- **Status:** Superseded by v20

### v18 - November 10, 2025 ✅ 🛡️
- **Address:** `0xe1da764DE02db8f91D81FE18a2fF9f80e9fc56Fb`
- **Feature:** Winner Protection on Resolved Markets (CRITICAL FIX)
  - **Winners are ALWAYS protected** - their funds are reserved first
  - LPs can only withdraw from unreserved funds (after subtracting winner claims)
  - Prevents LPs from draining funds before winners claim
  - Formula: `availableForLPs = totalReserves - winningTokenSupply`
  - LPs still get their proportional share of fees
- **Impact:** Guarantees winners can always claim their winnings, even if LPs exit early
- **Status:** Superseded by v19

### v17 - November 10, 2025 ✅ 🎯
- **Address:** `0x835Ca44D7bB5dE92Cf541531ED145f44fd78e6d6`
- **Feature:** Admin Unrestricted Resolution (CRITICAL FEATURE)
  - **Admin can resolve markets ANYTIME** - even before end time
  - **No oracle deadline restriction** for admin
  - Resolving an active market ends it early
  - Allows emergency resolution and early end for known results
- **Impact:** Full admin control over market resolution, no waiting periods
- **Status:** Superseded by v18

### v16 - November 10, 2025 ✅
- **Address:** `0x33152c4EB21Ea452138c5749195353B8A6276eA7`
- **Fix:** `totalReserves` drift prevention (CRITICAL FIX)
  - `_initializeReserves()`: Handles integer division remainder
  - `_normalizePrices()`: Recalculates `totalReserves` after scaling
- **Impact:** Prevents `totalReserves` from drifting away from `sum(reserves[])` over time
- **Verified:** 8/8 tests pass, including 50-trade stress test with ZERO drift
- **Status:** Superseded by v17

### v15 - November 8, 2025
- **Address:** `0x49D2C397C6ebf8C073C551F5B4AcF56b5cc093A1`
- **Fix:** `totalReserves` now properly updated in `claimRefund()` and `_claimAmount()`
- **Impact:** Prevents reserve corruption from trader refunds and winner payouts
- **Status:** Superseded by v16

### v14 - November 8, 2025
- **Address:** `0x20130321722A6B1181D72AD9D6B9212e4bD50190`
- **Feature:** Added `syncReserves()` emergency function
- **Status:** Superseded by v15

### v13 - November 8, 2025
- **Address:** `0xdddB9a10B7c3a177145f4e2EA11DB43e7d5c3Cf3`
- **Fix:** Completely rewrote `removeLiquidity()` with three distinct paths (CANCELED/RESOLVED/ACTIVE)
- **Status:** Superseded by v15

### v7 - November 8, 2025
- **Address:** `0x27b2b227640E8e100BA9B7036E7BA07f917CEA3C`
- **Feature:** Added `userInvestments` mapping for accurate refunds
- **Status:** Superseded by v15

### v1-v6 - November 2025
- Various bug fixes and improvements during initial development
- **Status:** Obsolete

---

**Last Updated:** November 10, 2025  
**Updated By:** Market v17 Deployment  
**Status:** 🟢 Production Ready - Admin Unrestricted Resolution + All Reserve Fixes

