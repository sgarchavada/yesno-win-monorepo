# DECIMAL REFERENCE - READ THIS BEFORE ANY FORMATTING CHANGES

## 🔴 CRITICAL: Token Decimal Standards

### PMT Token (Mock USDC Collateral)
- **Decimals**: 6
- **Contract**: `0x2FBEEb9529Ef323991df894B1fCff4c5DECCf50B` (Base Sepolia)
- **Why**: Matches real USDC standard (6 decimals on all chains)

### Outcome Tokens
- **Decimals**: 18
- **Why**: Standard ERC20 (OpenZeppelin default)

### LP Tokens  
- **Decimals**: 18
- **Why**: Standard ERC20 (OpenZeppelin default)
- **⚠️ CRITICAL**: When minting LP tokens, we scale from 6-decimal collateral to 18-decimal LP tokens by multiplying by `1e12`

---

## 💡 LP Token Minting - Decimal Scaling

When users add liquidity, the contract receives collateral (6 decimals) but mints LP tokens (18 decimals).

**Example:**
- User adds 200 PMT (200,000,000 in 6 decimals)
- Contract mints 200,000,000,000,000,000,000 LP tokens (200 * 1e18)
- User sees: `formatTokens(200e18) = 200.00 LP tokens` ✅

**Contract implementation:**
```solidity
// First liquidity provider
lpTokensToMint = collateralAmount * 1e12;  // Scale from 6 to 18 decimals

// Subsequent liquidity providers  
lpTokensToMint = (collateralAmount * totalLpSupply) / totalReserves;  // Proportional
```

This ensures LP tokens display correctly and maintain proportional ownership.

---

## 📊 Market.sol Storage Variables

### ✅ 6 DECIMALS (Collateral-based)
All these store PMT/USDC amounts:

```solidity
uint256 public totalReserves;              // Total collateral in AMM
mapping(uint256 => uint256) public reserves;  // Collateral per outcome
uint256 public accumulatedFees;            // LP fees accumulated
uint256 public accumulatedProtocolFees;    // Protocol fees accumulated
mapping(uint256 => uint256) public volumePerOutcome;  // Trading volume per outcome
uint256 public totalVolume;                // Total trading volume
```

### ✅ 18 DECIMALS (Token-based)
Only token balances:

```solidity
OutcomeToken.balanceOf(user)  // Outcome token balance (18 decimals)
LPToken.balanceOf(user)        // LP token balance (18 decimals)
```

---

## 🎯 Frontend Formatting Rules

### Use `formatPMT(amount)` - Divides by 1e6
For **ALL collateral-related values**:
- ✅ `market.totalReserves`
- ✅ `market.reserves[i]`
- ✅ `market.accumulatedFees`
- ✅ `market.accumulatedProtocolFees`
- ✅ `market.volumes[i]`
- ✅ `market.totalVolume`
- ✅ Market creation fee
- ✅ User input for collateral (after parseUSDC)

### Use `formatTokens(amount)` - Divides by 1e18
For **ALL token balances**:
- ✅ Outcome token balances
- ✅ LP token balances
- ✅ User positions (outcome tokens)

### Use `parseUSDC(input)` - Multiplies by 1e6
For **user input** when creating markets or trading:
- ✅ Initial liquidity input
- ✅ Trade amount input
- ✅ Any PMT/USDC amount from user

---

## ❌ DO NOT USE `formatUSDC`

`formatUSDC` divides by 1e18 and should NOT be used for PMT/collateral.

**WRONG:**
```typescript
formatUSDC(market.totalReserves)  // ❌ Divides by 1e18, shows $0.00
```

**CORRECT:**
```typescript
formatPMT(market.totalReserves)   // ✅ Divides by 1e6, shows $200.00
```

---

## 🔍 Quick Check: "Is this collateral or tokens?"

```
┌─────────────────────────────────────┐
│ Is it stored in Market.sol as       │
│ "collateral" or "reserves"?         │
└─────────────────────────────────────┘
           │
    ┌──────┴───────┐
   YES            NO
    │              │
    ▼              ▼
formatPMT      formatTokens
(6 decimals)   (18 decimals)
```

---

## 📝 Contract-to-Frontend Mapping

| Contract Variable | Type | Decimals | Format Function |
|------------------|------|----------|-----------------|
| `totalReserves` | Collateral | 6 | `formatPMT` |
| `reserves[i]` | Collateral | 6 | `formatPMT` |
| `accumulatedFees` | Collateral | 6 | `formatPMT` |
| `accumulatedProtocolFees` | Collateral | 6 | `formatPMT` |
| `volumePerOutcome[i]` | Collateral | 6 | `formatPMT` |
| `totalVolume` | Collateral | 6 | `formatPMT` |
| `OutcomeToken.balanceOf()` | Token | 18 | `formatTokens` |
| `LPToken.balanceOf()` | Token | 18 | `formatTokens` |

---

## 🚨 Before Making ANY Formatting Change:

1. ✅ Check this document
2. ✅ Identify if the value is collateral (6 decimals) or tokens (18 decimals)
3. ✅ Use the correct formatter
4. ✅ Test with a new market (old markets may have corrupted data)

---

## 💡 Why This Matters

**Wrong formatter = Wrong decimal division = Incorrect display**

Example with 200 PMT:
```
Stored: 200,000,000 (200 * 1e6)

formatPMT: 200,000,000 / 1,000,000 = 200 ✅
formatUSDC: 200,000,000 / 1,000,000,000,000,000,000 = 0.0000002 ❌
```

---

## 📌 GOLDEN RULE

**If it's related to money/collateral/PMT/USDC → Use `formatPMT` (6 decimals)**  
**If it's a token balance (Outcome or LP) → Use `formatTokens` (18 decimals)**

**NEVER use `formatUSDC` for anything in this project.**

