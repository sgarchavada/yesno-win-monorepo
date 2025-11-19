# Implementation Overview

Complete Polymarket-style prediction market implementation with 9 major features.

---

## Features Implemented

### 1. Protocol-Owned Liquidity (PoL)
Factory can seed and withdraw liquidity to earn fees.

**Market.sol**:
- `seedProtocolLiquidity(uint256 amount)`
- `withdrawProtocolLiquidity(uint256 lpTokenAmount, address to)`

**MarketFactory.sol**:
- `seedMarketLiquidity(address market, uint256 amount)`
- `withdrawProtocolLiquidity(address market, uint256 lpTokenAmount, address to)`

### 2. LP Token (ERC20)
Liquidity provider shares as transferable ERC20 tokens.

**LPToken.sol**: New upgradeable ERC20 contract (18 decimals)

### 3. Ladder Parlay Trades
Leveraged positions (1x-5x) with automatic "No" selling.

**Market.sol**:
- `parlay(uint256 outcomeIndex, uint256 stake, uint256 leverage)`

### 4. Fee Routing
Split fees between LPs (stay in pool) and protocol (sent to treasury).

- `lpFeeBps` - Stays in pool
- `protocolFeeBps` - Sent to treasury
- `parlayFeeBps` - Charged on parlay trades

### 5. Partial Claims
Users can claim winnings incrementally.

**Market.sol**:
- `claim()` - Claim all
- `claim(uint256 amount)` - Claim partial

### 6. Oracle Automation Hooks
Chainlink/API3 ready resolution system.

**OracleAdapter.sol**:
- `requestResolution(address market, string question, bytes data)`
- `fulfillResolution(uint256 requestId, uint256 winningOutcome)`

**Market.sol**:
- `requestOracleResolution(bytes data)`
- `fulfillOracleResolution(uint256 winningOutcome)`

### 7. Negrisk Multi-Outcome Logic
Prices always sum to 100% across all outcomes.

Implemented in `_normalizeReserves()` after each trade.

### 8. Admin Functions
- `pauseMarket(bool)` - Emergency pause
- `setFeeParams()` - Update fee structure
- `withdrawStuckTokens()` - Recover stuck tokens

### 9. Constant Product AMM
Dynamic pricing using CPMM: `R_i * R_j = k`

---

## Contract Architecture

```
MarketFactory (UUPS)
├── Creates Market contracts
├── Manages protocol liquidity
├── Deploys LPToken per market
└── Routes protocol fees to treasury

Market (UUPS)
├── Holds collateral (USDC)
├── Manages outcome tokens
├── Implements CPMM AMM
├── Handles buy/sell/parlay
├── LP token management
└── Resolution & claims

OracleAdapter (UUPS)
├── Resolution requests
├── Oracle integration
└── Triggers market resolution

LPToken (UUPS)
├── ERC20 (18 decimals)
├── Transferable LP shares
└── Mint/burn by Market only

OutcomeToken (UUPS)
├── ERC20 per outcome
├── Mint on buy
└── Burn on sell/claim
```

---

## Key Functions

### Trading
```solidity
market.buy(uint256 outcomeIndex, uint256 collateralAmount, uint256 minOutcomeTokens)
market.sell(uint256 outcomeIndex, uint256 outcomeTokens, uint256 minCollateral)
market.parlay(uint256 outcomeIndex, uint256 stake, uint256 leverage)
```

### Liquidity
```solidity
market.addLiquidity(uint256 amount)
market.removeLiquidity(uint256 lpTokenAmount)
factory.seedMarketLiquidity(address market, uint256 amount)
```

### Resolution & Claims
```solidity
market.resolve(uint256 winningOutcome)
market.claim() // Claim all
market.claim(uint256 amount) // Partial claim
```

---

## Storage Layout

All new variables appended to maintain upgrade safety:
- `lpToken` (IERC20Upgradeable)
- `lpFeeBps`, `protocolFeeBps`, `parlayFeeBps`
- `protocolLiquidity`
- `paused`
- `oracleAdapter`
- `partialClaimAmounts` (mapping)
- `accumulatedProtocolFees`

---

## Events

Key events emitted:
- `MarketCreated`, `Trade`, `LiquidityAdded`, `LiquidityRemoved`
- `ParlayExecuted`, `MarketResolved`, `WinningsClaimed`
- `ProtocolLiquiditySeeded`, `ProtocolLiquidityWithdrawn`
- `OracleResolutionRequested`, `MarketPausedStatus`

---

## Gas Optimization

- Via-IR compilation enabled
- Storage reads cached
- SafeERC20 for transfers
- Efficient loop operations

---

## Security

- ✅ UUPS upgradeable pattern
- ✅ ReentrancyGuard on state changes
- ✅ Access control (onlyOwner, onlyFactory)
- ✅ Input validation
- ✅ SafeERC20 for all transfers
- ✅ Emergency pause functionality

---

For deployment instructions, see `TESTING.md`.

