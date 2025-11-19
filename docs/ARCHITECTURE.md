# 🏗️ Architecture Overview

## Project Structure

```
yesno-win/
├── apps/
│   └── web/                          # Next.js Frontend
│       ├── app/
│       │   ├── client.ts             # Thirdweb client configuration
│       │   ├── layout.tsx            # Root layout
│       │   ├── page.tsx              # Home page (markets list)
│       │   ├── market/[id]/          # Market detail pages
│       │   └── admin/                # Admin dashboard
│       ├── components/               # React components
│       │   ├── Header.tsx
│       │   ├── MarketCard.tsx
│       │   ├── VoteBox.tsx
│       │   ├── CreateMarketForm.tsx
│       │   └── ui/                   # shadcn/ui components
│       ├── lib/
│       │   ├── chainUtils.ts         # Chain definitions & utilities
│       │   ├── config.ts             # App configuration
│       │   ├── fetchMarkets.ts       # Market data fetching
│       │   └── hooks/                # Custom React hooks
│       └── constants/
│           └── contracts.ts          # Contract addresses & instances
│
├── packages/
│   ├── contracts/                    # Smart Contracts (Foundry)
│   │   ├── src/
│   │   │   ├── MarketFactory.sol     # Factory for creating markets
│   │   │   ├── Market.sol            # Individual market (multi-outcome)
│   │   │   ├── OutcomeToken.sol      # ERC20 conditional tokens
│   │   │   ├── OracleAdapter.sol     # Oracle integration
│   │   │   └── SimplePredictionMarket.sol  # Legacy (reference)
│   │   ├── test/                     # Foundry tests
│   │   ├── script/                   # Deployment scripts
│   │   │   ├── Deploy.s.sol          # Foundry deployment
│   │   │   └── DeployThirdweb.ts     # Thirdweb deployment docs
│   │   └── foundry.toml              # Foundry configuration
│   │
│   ├── sdk/                          # TypeScript SDK
│   │   ├── src/
│   │   │   ├── types.ts              # Market & contract types
│   │   │   ├── utils.ts              # SDK utilities
│   │   │   └── index.ts              # Main exports
│   │   ├── typechain/                # Auto-generated ABIs
│   │   └── scripts/generate-types.js # ABI → TypeScript generator
│   │
│   └── utils/                        # Shared Utilities
│       └── src/
│           ├── format.ts             # Formatting (currency, dates, addresses)
│           ├── validation.ts         # Validation helpers
│           ├── constants.ts          # Shared constants
│           └── types.ts              # Shared types
│
├── scripts/
│   └── setup.sh                      # Monorepo setup automation
│
├── pnpm-workspace.yaml               # Workspace configuration
├── package.json                      # Root package with scripts
├── tsconfig.json                     # TypeScript project references
├── eslint.config.mjs                 # Shared ESLint config
└── .prettierrc                       # Prettier configuration
```

## 🔧 Configuration Files

### Frontend Configuration
- **apps/web/app/client.ts** - Thirdweb client (uses `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`)
- **apps/web/lib/chainUtils.ts** - Chain definitions (Base Sepolia: 84532)
- **apps/web/constants/contracts.ts** - Contract instances and addresses

### Chain Configuration
Frontend imports chains directly from `thirdweb/chains`:
```typescript
import { baseSepolia } from "thirdweb/chains";
```

Custom chain utilities in `lib/chainUtils.ts`:
```typescript
export const BASE_SEPOLIA_CHAIN = {
  id: 84532,
  name: "Base Sepolia",
  // ...
};
```

## 📊 Data Flow

### Market Creation Flow
```
User → CreateMarketForm 
  → MarketFactory.createMarket()
  → Market contract deployed
  → Frontend fetches via fetchMarkets()
```

### Trading Flow
```
User → VoteBox component
  → buyShares() hook
  → Market.buyShares()
  → Transfers collateral
  → Mints outcome tokens
```

### Resolution Flow
```
Admin → ResolveMarketModal
  → Market.resolve()
  → Sets winning outcome
  → Users can claim winnings
```

## 🔌 Key Integrations

### Thirdweb SDK v5
- Client: `apps/web/app/client.ts`
- Hooks: `useActiveAccount`, `useSendAndConfirmTransaction`
- Chains: Imported from `thirdweb/chains`

### Contract Interaction
```typescript
// Get contract instance
import { getPredictionContractByAddress } from "@/constants/contracts";
const contract = getPredictionContractByAddress(address);

// Read data
const market = await readContract({
  contract,
  method: "getMarket",
  params: [marketId]
});

// Write transaction
await sendAndConfirmTransaction({
  transaction: prepareContractCall({
    contract,
    method: "buyShares",
    params: [marketId, isOptionA, amount]
  })
});
```

### State Management
- React hooks for data fetching
- Zustand for global state (if needed)
- URL params for market ID routing

## 🎯 Contract Architecture

### Polymarket-Style Design

**MarketFactory** (Main Entry Point)
- Creates new markets
- Manages global settings
- Tracks all markets

**Market** (Individual Markets)
- Multi-outcome support (not just binary)
- Conditional token system
- Resolution mechanism
- Payout calculations

**OutcomeToken** (ERC20)
- Represents shares in an outcome
- Minted when buying shares
- Burned when claiming or selling

**OracleAdapter** (Resolution)
- Unified oracle interface
- Supports: Manual, Chainlink, UMA, API3
- Decentralized resolution

## 🔐 Security Features

- **Upgradeable Contracts**: UUPS proxy pattern
- **Reentrancy Guards**: ReentrancyGuardUpgradeable
- **Access Control**: OwnableUpgradeable
- **Safe Token Transfers**: SafeERC20

## 📡 API Integration

### Market Data Fetching
```typescript
// lib/fetchMarkets.ts
export async function fetchMarkets(
  contract: ThirdwebContract,
  cursor: number,
  limit: number
) {
  // Fetches market data from blockchain
  // Returns formatted market objects
}
```

### Real-time Updates
- Events from contracts
- Polling for market status changes
- Optimistic UI updates

## 🚀 Deployment Strategy

### Contracts (Base Sepolia)
1. Deploy OutcomeToken implementation
2. Deploy OracleAdapter (with proxy)
3. Deploy MarketFactory (with proxy)
4. Update frontend with addresses

### Frontend (Vercel/Netlify)
1. Build: `pnpm build:web`
2. Environment variables set
3. Deploy to hosting platform
4. Verify on testnet

## 📈 Future Enhancements

- **AMM Trading**: Automated market maker for shares
- **Liquidity Pools**: Incentivize market liquidity
- **Oracle Integration**: Chainlink/UMA for automated resolution
- **Multi-chain**: Deploy on Polygon, Arbitrum, etc.
- **Mobile App**: React Native version

---

**Last Updated**: November 2025  
**Architecture Version**: 2.0 (Monorepo + Polymarket-style)

