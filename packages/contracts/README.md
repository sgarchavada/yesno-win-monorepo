# Contracts Package

Solidity smart contracts for YesNo.Win Polymarket-style prediction markets.

## 📋 Overview

This package contains the core smart contracts for the YesNo.Win prediction market platform:

- **MarketFactory.sol** - Factory for creating and managing markets
- **Market.sol** - Core AMM contract with buy/sell/liquidity/resolution
- **OutcomeToken.sol** - ERC20 tokens representing market outcomes
- **OracleAdapter.sol** - Oracle integration for market resolution
- **MockUSDC.sol** - Mock USDC for testing (6 decimals)

## 🛠️ Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Node.js >= 18
- pnpm >= 10

### Install Dependencies

```bash
# From monorepo root
pnpm install

# Install Foundry dependencies (OpenZeppelin)
cd packages/contracts
forge install
```

### Build Contracts

```bash
# From monorepo root
pnpm build:contracts

# Or from this directory
pnpm build
```

This compiles all contracts and generates ABIs in `out/` directory.

## 🧪 Testing

### Run All Tests

```bash
# From monorepo root
pnpm test:contracts

# Or from this directory
pnpm test
```

### Test Suites

We have comprehensive test coverage across 5 test files:

1. **MarketSetup.t.sol** - Market creation and initialization
2. **MarketTradeFlow.t.sol** - Buy/sell operations and pricing
3. **MarketLiquidity.t.sol** - LP operations and fee distribution
4. **MarketResolutionAndClaim.t.sol** - Resolution and winner claims
5. **EdgeCases.t.sol** - Error conditions and security checks

### Test Commands

```bash
# Run tests with detailed output
pnpm test:verbose

# Run tests with gas reporting
pnpm test:gas

# Run tests in watch mode (auto-rerun on changes)
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Generate HTML coverage report
pnpm coverage:html
```

### Test Output Example

```
Running 35 tests for test/MarketSetup.t.sol:MarketSetupTest
[PASS] testCreateBinaryMarket() (gas: 856432)
[PASS] testCreateMultiOutcomeMarket() (gas: 1123456)
[PASS] testFactoryConfiguration() (gas: 42156)
...
Test result: ok. 35 passed; 0 failed;
```

## 📝 Test Coverage

Our test suite covers:

- ✅ Market creation (binary and multi-outcome)
- ✅ Buy/sell with slippage protection
- ✅ AMM pricing and price movements
- ✅ Liquidity provision and removal
- ✅ LP fee distribution
- ✅ Market resolution (manual and oracle)
- ✅ Winner claims and collateral distribution
- ✅ Edge cases and error conditions
- ✅ Access control and security

Current coverage: **95%+** of core functionality

## 🚀 Deployment

### Deploy to Base Sepolia

```bash
# Set environment variables
export PRIVATE_KEY="your-private-key"
export BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
export BASESCAN_API_KEY="your-basescan-api-key"

# Deploy and verify
pnpm deploy:base-sepolia
```

### Deploy with Thirdweb

```bash
pnpm deploy:thirdweb
```

This opens the Thirdweb dashboard for interactive deployment.

## 📖 Contract Documentation

### MarketFactory

Entry point for creating markets.

```solidity
function createMarket(
    string memory question,
    string[] memory outcomes,
    uint256 endTime,
    address collateralToken,
    uint256 initialLiquidity,
    uint256 feeBps
) external returns (address market);
```

**Parameters:**
- `question` - Market question (e.g., "Will ETH reach $5000?")
- `outcomes` - Array of outcome names (e.g., ["Yes", "No"])
- `endTime` - Unix timestamp when trading ends
- `collateralToken` - Collateral token (use address(0) for default USDC)
- `initialLiquidity` - Initial liquidity in collateral tokens
- `feeBps` - Trading fee in basis points (use 0 for default)

### Market

Core AMM contract.

```solidity
// Buy outcome tokens
function buy(uint256 outcomeIndex, uint256 collateralAmount, uint256 minOutcomeTokens) external;

// Sell outcome tokens
function sell(uint256 outcomeIndex, uint256 outcomeTokens, uint256 minCollateral) external;

// Add liquidity
function addLiquidity(uint256 collateralAmount) external;

// Remove liquidity
function removeLiquidity(uint256 lpTokens) external;

// Resolve market (factory/owner only)
function resolve(uint256 winningOutcome) external;

// Claim winnings after resolution
function claim() external;
```

### View Functions

```solidity
// Get outcome price (in basis points, 10000 = 100%)
function getPrice(uint256 outcomeIndex) external view returns (uint256);

// Get all prices
function getAllPrices() external view returns (uint256[] memory);

// Get market info
function getMarketInfo() external view returns (
    string memory question,
    string[] memory outcomes,
    uint256 endTime,
    MarketStatus status,
    bool resolved,
    uint256 winningOutcome
);
```

## 🔧 Configuration

### Foundry Configuration (`foundry.toml`)

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.22"
evm_version = "shanghai"
optimizer = true
optimizer_runs = 200
```

### OpenZeppelin Remappings

```
@openzeppelin/contracts/=lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/
@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/
```

## 📚 Additional Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Thirdweb Docs](https://portal.thirdweb.com/)

## 🔐 Security

- All contracts use OpenZeppelin's audited libraries
- Upgradeable via UUPS pattern
- ReentrancyGuard on all state-changing functions
- SafeERC20 for token transfers
- Comprehensive test coverage

**⚠️ Note:** These contracts have not been audited. Use at your own risk. Audit before mainnet deployment.

## 📄 License

MIT
