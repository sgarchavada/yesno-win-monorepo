# Migration Guide: Old Structure → Monorepo

This document explains what changed when migrating from the old structure to the new monorepo architecture.

## 📁 File Structure Changes

### Before (Old Structure)
```
yesno-win/
├── yesno-win-frontend/        # Next.js app
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
└── yesno-win-contract/        # Foundry contracts
    ├── src/
    ├── test/
    └── foundry.toml
```

### After (Monorepo)
```
yesno-win/
├── apps/
│   └── web/                   # ← yesno-win-frontend moved here
│       ├── app/client.ts      # Thirdweb client config
│       └── lib/chainUtils.ts  # Chain definitions
├── packages/
│   ├── contracts/             # ← yesno-win-contract moved here
│   ├── sdk/                   # ← NEW: TypeScript SDK
│   └── utils/                 # ← NEW: Shared utilities
├── pnpm-workspace.yaml        # ← NEW: Workspace config
└── package.json               # ← NEW: Root package.json
```

## 🔄 What Changed

### 1. Frontend (`yesno-win-frontend` → `apps/web`)

**Location**: All files moved to `apps/web/`

**package.json Changes**:
```diff
- "name": "yesno-win-frontend"
+ "name": "web"
+ "dependencies": {
+   "sdk": "workspace:*",
+   "utils": "workspace:*"
+ }
```

**Import Changes**:
```typescript
// OLD: Import from local files only
import { formatCurrency } from "@/lib/utils"

// NEW: Can import from monorepo packages
import { formatCurrency } from "utils"
import { MarketFactoryAbi } from "sdk"
```

**TypeScript Paths** (`tsconfig.json`):
```diff
  "paths": {
    "@/*": ["./*"],
+   "@sdk": ["../../packages/sdk/src"],
+   "@utils": ["../../packages/utils/src"]
  }
```

### 2. Contracts (`yesno-win-contract` → `packages/contracts`)

**Location**: All files moved to `packages/contracts/`

**New Files**:
- `src/MarketFactory.sol` - Factory for creating markets
- `src/Market.sol` - Individual market contract
- `src/OutcomeToken.sol` - ERC20 conditional tokens
- `src/OracleAdapter.sol` - Oracle integration
- `script/Deploy.s.sol` - Deployment script
- `script/DeployThirdweb.ts` - Thirdweb deployment

**Old File**: `SimplePredictionMarket.sol` remains for reference

**Package.json Added**:
```json
{
  "name": "contracts",
  "scripts": {
    "build": "forge build",
    "test": "forge test",
    "deploy:base-sepolia": "forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast",
    "deploy:thirdweb": "npx thirdweb deploy"
  }
}
```

### 3. New Packages

#### `packages/sdk/`
Auto-generates TypeScript bindings from contract ABIs.

**Usage**:
```typescript
import { MarketFactoryAbi, MarketStatus, calculatePayout } from "sdk";
```

**Build**: `pnpm build:sdk` (generates types from compiled contracts)

#### `packages/utils/`
Shared utilities for frontend and backend.

**Exports**:
- Formatting: `formatCurrency`, `formatTokenAmount`, `formatAddress`
- Validation: `isValidAddress`, `isValidMarketQuestion`
- Constants: `MARKET_STATUS`, `USDC_DECIMALS`, `CHAIN_IDS`

## 🚀 Command Changes

### Development

**Before**:
```bash
# Frontend
cd yesno-win-frontend
npm run dev

# Contracts
cd yesno-win-contract
forge test
```

**After**:
```bash
# All from root directory

# Frontend
pnpm dev
# or
pnpm --filter web dev

# Contracts
pnpm build:contracts
pnpm test:contracts

# Build everything
pnpm build
```

### Deployment

**Before**:
```bash
cd yesno-win-contract
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

**After**:
```bash
# From root
pnpm deploy:base-sepolia

# Or using Thirdweb
pnpm --filter contracts deploy:thirdweb
```

## 🔧 Environment Variables

**Before**: Multiple `.env` files in different directories

**After**: Single `.env` in root directory

```env
# Shared by all packages
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=
```

## 📦 Package Manager

**Before**: npm (per-package)

**After**: pnpm (workspace mode)

**Migration**:
```bash
# Remove old node_modules
rm -rf yesno-win-frontend/node_modules
rm -rf yesno-win-contract/node_modules
rm -rf node_modules

# Install with pnpm
pnpm install
```

## 🎯 Key Benefits

### 1. **Shared Code**
- Common utilities in `packages/utils`
- Type-safe contract bindings in `packages/sdk`
- No more copy-paste between frontend/backend

### 2. **Better Type Safety**
```typescript
// OLD: Manual ABI imports, no type safety
const abi = [...] // copy-pasted ABI

// NEW: Auto-generated types
import { MarketFactoryAbi } from "sdk"
// Full TypeScript autocomplete and type checking
```

### 3. **Simplified Commands**
```bash
# One command to build everything
pnpm build

# One command to test everything
pnpm test

# Consistent scripts across all packages
```

### 4. **Easier Deployment**
- Thirdweb integration at root level
- Consistent deployment scripts
- Shared configuration

### 5. **Better Developer Experience**
- TypeScript project references
- Path aliases work across packages
- Shared linting and formatting rules

## 🔄 Migration Checklist

If you're migrating your own work:

- [ ] Move frontend code to `apps/web/`
- [ ] Update imports to use `@sdk` and `@utils`
- [ ] Move contract code to `packages/contracts/`
- [ ] Update environment variables to root `.env`
- [ ] Run `pnpm install` from root
- [ ] Build contracts: `pnpm build:contracts`
- [ ] Generate SDK types: `pnpm build:sdk`
- [ ] Test frontend: `pnpm dev`
- [ ] Update deployment scripts to use new paths

## 📚 Additional Resources

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Foundry Book](https://book.getfoundry.sh/)
- [Thirdweb Documentation](https://portal.thirdweb.com/)

## ❓ Common Issues

### "Module not found: Can't resolve 'sdk'"

**Solution**: Build the SDK first
```bash
pnpm build:sdk
```

### "Contracts not found when generating types"

**Solution**: Build contracts first
```bash
pnpm build:contracts
pnpm build:sdk
```

### "pnpm command not found"

**Solution**: Install pnpm
```bash
npm install -g pnpm
```

---

✅ **Migration Complete!** The monorepo is now ready for production-grade development.

