# YesNo.Win - Polymarket-style Prediction Markets

Production-ready prediction market platform on Base Sepolia with multi-outcome support, protocol-owned liquidity, and parlay trading.

**Status**: ✅ Deployed on Base Sepolia | ✅ All contracts verified | 🚀 Live & functional

## 🎉 **LATEST: Centralized Approval System!**

**YesNo.Win now features a gas-efficient, user-friendly approval system:**

- 🔥 **One-time approval** - Approve MarketFactory once, trade on all markets forever
- ⚡ **Uniswap Router pattern** - Factory handles all token transfers (saves gas)
- 🚀 **Automated deployment** - Foundry scripts for full deployment & upgrades
- ✅ **Contract verification** - All contracts verified on BaseScan

**📋 [See All Deployed Contracts](./docs/CONTRACT_REGISTRY.md)**

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
# - Copy .env.example to packages/contracts/.env
# - Add: PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, BASESCAN_API_KEY, FRONTEND_WALLET_ADDRESS

# 3. Deploy contracts (automated)
cd packages/contracts
forge script script/DeployAll.s.sol --rpc-url https://sepolia.base.org --broadcast --slow

# 4. Verify contracts
./script/verify-all.sh

# 5. Copy .env output to apps/web/.env.local
# (Script prints all addresses - just copy-paste)

# 6. Run frontend
cd ../../apps/web
npm run dev
```

**🎯 Your app will be live at:** `http://localhost:3000`

---

## Features

- ✅ **Multi-outcome markets** - Up to 20 outcomes per market
- ✅ **Constant Product AMM** - Dynamic pricing with CPMM
- ✅ **Protocol-owned liquidity** - Factory can seed/withdraw liquidity
- ✅ **LP tokens (ERC20)** - Transferable liquidity provider shares
- ✅ **Parlay trading** - Leveraged positions (1x-5x)
- ✅ **Partial claims** - Claim winnings incrementally
- ✅ **Oracle automation** - Chainlink/API3 ready
- ✅ **Fee routing** - Split between LPs and protocol
- ✅ **Emergency controls** - Pause, recovery functions

---

## Project Structure

```
yesno-win/
├── apps/
│   └── web/              # Next.js 16 frontend (React 19, TailwindCSS 4)
├── packages/
│   ├── contracts/        # Solidity smart contracts (Foundry)
│   ├── sdk/             # TypeScript SDK & type generation
│   └── utils/           # Shared utilities
└── scripts/             # Deployment & automation scripts
```

---

## Stack

- **Smart Contracts**: Solidity 0.8.22, Foundry, OpenZeppelin Upgradeable
- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS 4, shadcn/ui
- **Web3**: Thirdweb SDK v5, Wagmi, Viem
- **State**: Zustand
- **Network**: Base Sepolia testnet
- **Monorepo**: pnpm workspaces

---

## Core Contracts

| Contract | Description |
|----------|-------------|
| **MarketFactory** | Creates markets, manages protocol liquidity, routes fees |
| **Market** | Holds collateral, implements AMM, handles trading & claims |
| **OracleAdapter** | Resolution system with oracle integration |
| **LPToken** | ERC20 liquidity provider tokens |
| **OutcomeToken** | ERC20 tokens per outcome |

All contracts are **UUPS upgradeable** and **fully tested**.

---

## Development

### Contracts

```bash
cd packages/contracts

# Build
forge build

# Test
forge test

# Test with gas report
forge test --gas-report

# Coverage
forge coverage

# Deploy all contracts (automated)
forge script script/DeployAll.s.sol --rpc-url https://sepolia.base.org --broadcast --slow

# Upgrade Market implementation (IMPORTANT: Also updates MarketFactory!)
forge script script/UpgradeMarket.s.sol --rpc-url https://sepolia.base.org --broadcast --legacy -vvv

# Upgrade specific contract (e.g., MarketFactory)
forge script script/UpgradeMarketFactory.s.sol --rpc-url https://sepolia.base.org --broadcast --slow

# Verify all contracts
cd packages/contracts && ./script/verify-all.sh
```

### Frontend

```bash
cd apps/web

# Dev server
pnpm dev

# Build
pnpm build

# Type check
pnpm type-check

# Lint
pnpm lint
```

### SDK Generation

```bash
cd packages/sdk

# Generate types from contract ABIs
pnpm generate

# Build SDK
pnpm build
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[docs/CONTRACT_REGISTRY.md](./docs/CONTRACT_REGISTRY.md)** | 📋 All deployed contract addresses & status |
| **[docs/MANUAL_DEPLOYMENT_GUIDE.md](./docs/MANUAL_DEPLOYMENT_GUIDE.md)** | 🚀 Complete deployment guide |
| **[docs/DECIMAL_REFERENCE.md](./docs/DECIMAL_REFERENCE.md)** | 🔢 Decimal handling reference (6 vs 18 decimals) |
| **[packages/contracts/script/README-DEPLOY.md](./packages/contracts/script/README-DEPLOY.md)** | 🤖 Automated deployment script guide |
| **[packages/contracts/script/README-VERIFY.md](./packages/contracts/script/README-VERIFY.md)** | ✅ Contract verification guide |

---

## 🛡️ Admin Management

### Add/Remove Admins via BaseScan

**MarketFactory (Write as Proxy):**
```
https://sepolia.basescan.org/address/0xa6B911Cd92586103E0016ee545B9cECA8e569680#writeProxyContract
```

**Quick Actions:**

**Grant Admin Role:**
1. Go to "Write as Proxy" tab → Connect MetaMask (use deployer wallet with DEFAULT_ADMIN_ROLE)
2. Find `grantRole(bytes32 role, address account)` function
3. Enter role: `0x0000000000000000000000000000000000000000000000000000000000000000` (DEFAULT_ADMIN_ROLE)
4. Enter account address
5. Click "Write" → Confirm transaction

**Revoke Admin Role:**
1. Go to "Write as Proxy" tab
2. Find `revokeRole(bytes32 role, address account)` function
3. Enter role: `0x0000000000000000000000000000000000000000000000000000000000000000`
4. Enter account address
5. Click "Write" → Confirm transaction

**Check if Address has Admin Role:**
1. Go to "Read as Proxy" tab
2. Find `hasRole(bytes32 role, address account)` function
3. Enter role: `0x0000000000000000000000000000000000000000000000000000000000000000`
4. Enter account address → Click "Query"

**Frontend Admin Dashboard:**
```
http://localhost:3000/yesno-admin
```
- Access with any wallet that has DEFAULT_ADMIN_ROLE
- Manage markets, collect fees, configure settings
- Current admin: `0xBfac8dB2767d7206AC224545Cf162DEe4ebcc8c9` (granted by deployment script)

---

## Environment Variables

### For Contracts (`packages/contracts/.env`)

```env
# Network
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"

# Deployment
PRIVATE_KEY="your-deployer-private-key"

# Verification
BASESCAN_API_KEY="your-basescan-api-key"

# Admin wallet (gets DEFAULT_ADMIN_ROLE)
FRONTEND_WALLET_ADDRESS="0xYourFrontendWalletAddress"

# Deployed addresses (auto-generated by DeployAll.s.sol)
USDC_TOKEN="0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584"
MARKET_FACTORY_PROXY="0xa6B911Cd92586103E0016ee545B9cECA8e569680"
CREATOR_REGISTRY_PROXY="0x6a45D830Bdbc4A5C854c08a3aB1AedbB6B12eaee"
PROTOCOL_TREASURY_PROXY="0xC144ce2F03Ee447fD92F69054e01C1825a17c799"
# ... (more addresses printed by deployment script)
```

### For Frontend (`apps/web/.env.local`)

```env
# Thirdweb
NEXT_PUBLIC_THIRDWEB_CLIENT_ID="your-client-id"

# Contract addresses (copy from deployment script output)
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS="0xa6B911Cd92586103E0016ee545B9cECA8e569680"
NEXT_PUBLIC_CREATOR_REGISTRY_ADDRESS="0x6a45D830Bdbc4A5C854c08a3aB1AedbB6B12eaee"
NEXT_PUBLIC_PROTOCOL_TREASURY_ADDRESS="0xC144ce2F03Ee447fD92F69054e01C1825a17c799"
NEXT_PUBLIC_USDC_ADDRESS="0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584"
# ... (more addresses)
```

**📋 See [CONTRACT_REGISTRY.md](./docs/CONTRACT_REGISTRY.md) for all current addresses**

---

## Key Commands

```bash
# Root commands
pnpm install              # Install all dependencies
pnpm build:contracts      # Build contracts
pnpm build:sdk           # Generate SDK from ABIs
pnpm test:contracts      # Run contract tests
pnpm test:integration    # Integration tests
pnpm deploy:base-sepolia # Deploy to Base Sepolia
pnpm dev -F web          # Run frontend
pnpm lint                # Lint all packages
pnpm format              # Format code
```

---

## Testing

**Status**: ✅ **105/105 tests passing (100%)**

All features validated:
- Market creation & configuration
- Trading (buy/sell/parlay)
- Liquidity management
- Resolution & claims
- Edge cases & security

See [TESTING.md](./docs/TESTING.md) for details.

---

## Deployment

### Quick Deploy (Foundry Automated Script)

```bash
cd packages/contracts

# 1. Set up environment variables in packages/contracts/.env
# Required: PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, BASESCAN_API_KEY, FRONTEND_WALLET_ADDRESS

# 2. Deploy all contracts
forge script script/DeployAll.s.sol --rpc-url https://sepolia.base.org --broadcast --slow

# 3. Verify all contracts
./script/verify-all.sh

# 4. Copy .env output to apps/web/.env.local

# 5. Restart frontend
cd ../../apps/web && npm run dev
```

**What happens automatically**:
- ✅ Deploys all 7 implementations (Market, MarketFactory, CreatorRegistry, etc.)
- ✅ Deploys 3 proxies (MarketFactory, CreatorRegistry, ProtocolTreasury)
- ✅ Initializes all contracts with correct settings
- ✅ Grants admin roles to frontend wallet
- ✅ Prints `.env` output for easy copy-paste
- ✅ Provides verification commands

**For selective upgrades** (e.g., after bug fixes):
```bash
# Upgrade specific contract implementation
forge script script/UpgradeMarketFactory.s.sol --rpc-url https://sepolia.base.org --broadcast --slow
```

See [README-DEPLOY.md](./packages/contracts/script/README-DEPLOY.md) for detailed instructions.

---

## License

MIT

---

## Links

- **Base Sepolia**: https://sepolia.base.org
- **Thirdweb**: https://thirdweb.com
- **Foundry**: https://book.getfoundry.sh

---

## 💰 Transfer Test USDC

If you need to transfer USDC tokens to your frontend wallet for testing:

```bash
# Transfer 20,000 USDC (with 6 decimals = 20000000000)
# From deployer wallet to frontend wallet
cast send 0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584 \
  "transfer(address,uint256)" \
  0xBfac8dB2767d7206AC224545Cf162DEe4ebcc8c9 \
  20000000000 \
  --rpc-url https://sepolia.base.org \
  --private-key YOUR_DEPLOYER_PRIVATE_KEY
```

**What this does:**
- Transfers USDC from deployer wallet to frontend wallet
- Amount: 20,000 USDC (20000000000 with 6 decimals)
- USDC Token: `0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584`
- Frontend Wallet: `0xBfac8dB2767d7206AC224545Cf162DEe4ebcc8c9`

**⚠️ Security Note:** Replace `YOUR_DEPLOYER_PRIVATE_KEY` with your actual private key. Never commit private keys to git!

---

**Ready to deploy!** 🚀
