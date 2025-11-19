# SDK Package

TypeScript SDK and contract bindings for YesNo.Win prediction markets.

## 📋 Overview

This package automatically generates TypeScript bindings from Solidity contract ABIs, making it easy to interact with YesNo.Win contracts from your frontend or Node.js applications.

## 🚀 Quick Start

### Generate Types

```bash
# From monorepo root
pnpm build:sdk

# Or from this directory
pnpm generate
```

This will:
1. Read compiled contract ABIs from `packages/contracts/out/`
2. Generate TypeScript bindings in `src/contracts.ts`
3. Export typed contract ABIs and utility functions

### Build Package

```bash
# From this directory
pnpm build
```

Builds the SDK package with tsup (generates ESM and CJS outputs).

## 📦 Usage

### Import Contract ABIs

```typescript
import {
  MarketABI,
  MarketFactoryABI,
  OutcomeTokenABI,
  OracleAdapterABI,
  getContract,
  getABI,
} from '@yesno-win/sdk';

// Get a specific contract
const marketContract = getContract('Market');
console.log(marketContract.abi); // Full ABI
console.log(marketContract.bytecode); // Deployment bytecode

// Get just the ABI
const factoryABI = getABI('MarketFactory');
```

### Use with Thirdweb SDK v5

```typescript
import { createThirdwebClient, getContract as getThirdwebContract } from 'thirdweb';
import { MarketABI } from '@yesno-win/sdk';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

const marketContract = getThirdwebContract({
  client,
  chain: baseSepolia,
  address: '0x...', // Your market address
  abi: MarketABI,
});

// Read contract data
const prices = await marketContract.read('getAllPrices', []);

// Write to contract
const tx = await marketContract.write('buy', [
  0, // outcomeIndex
  BigInt(100_000_000), // 100 USDC (6 decimals)
  BigInt(1), // minOutcomeTokens
]);
```

### Use with Viem

```typescript
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { MarketABI } from '@yesno-win/sdk';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const prices = await client.readContract({
  address: '0x...', // Your market address
  abi: MarketABI,
  functionName: 'getAllPrices',
});

console.log('Outcome prices:', prices);
```

### Type-Safe Contract Interactions

The generated types provide full IntelliSense and type checking:

```typescript
import { MarketABI } from '@yesno-win/sdk';

// TypeScript knows all available functions
const abi = MarketABI;
// abi contains: buy, sell, addLiquidity, removeLiquidity, resolve, claim, etc.

// All function signatures are typed
// Parameters and return types are inferred
```

## 🛠️ Scripts

### `pnpm generate`
Generate TypeScript bindings from contract ABIs.

**Requirements:**
- Contracts must be built first (`pnpm build:contracts`)
- Creates `src/contracts.ts` with all contract ABIs

**Output:**
```typescript
// src/contracts.ts
export const MarketABI = [...] as const;
export const MarketFactoryABI = [...] as const;
export const contracts = { ... };
export function getContract(name: ContractName): ContractData;
// ... more exports
```

### `pnpm build`
Build the SDK package (runs `generate` first, then compiles with tsup).

**Output:**
- `dist/index.js` - CommonJS build
- `dist/index.mjs` - ESM build
- `dist/index.d.ts` - TypeScript declarations

### `pnpm clean`
Remove generated files and build output.

## 🔬 Testing

### Smoke Test

```bash
# From monorepo root
pnpm test:integration
```

This runs a smoke test that verifies:
- ✅ Contracts are built
- ✅ Generated contracts file exists
- ✅ All expected contracts are present
- ✅ ABIs are valid JSON
- ✅ Contract functions are exported

Example output:
```
╔════════════════════════════════════════╗
║   SDK Smoke Test                       ║
║   YesNo.Win Prediction Markets         ║
╚════════════════════════════════════════╝

🔍 Checking if Solidity contracts are built...
✅ Contracts are built

🔍 Checking generated contracts file...
✅ Found: packages/sdk/src/contracts.ts

🔍 Validating generated contracts...
   ✅ Market: 45 ABI entries
   ✅ MarketFactory: 38 ABI entries
   ✅ OutcomeToken: 28 ABI entries
   ✅ OracleAdapter: 32 ABI entries
✅ All 4 expected contracts found

═══════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════
Total checks: 4
Passed: 4
Failed: 0

✅ All smoke tests passed!
   SDK is ready to use.
```

## 📖 Generated API

### Types

```typescript
// Contract name union type
type ContractName = 'Market' | 'MarketFactory' | 'OutcomeToken' | 'OracleAdapter' | 'MockUSDC';

// Contract data interface
interface ContractData {
  abi: any[];
  bytecode: string;
}
```

### Constants

```typescript
// Individual ABIs (as const for type inference)
export const MarketABI: readonly [...];
export const MarketFactoryABI: readonly [...];
export const OutcomeTokenABI: readonly [...];
export const OracleAdapterABI: readonly [...];

// Bytecode for deployment
export const MarketBytecode: string;
// ... etc
```

### Functions

```typescript
// Get full contract data (ABI + bytecode)
function getContract(name: ContractName): ContractData;

// Get just the ABI
function getABI(name: ContractName): any[];

// Check if contract exists
function hasContract(name: string): name is ContractName;

// Get all contract names
function getContractNames(): ContractName[];
```

## 🔄 Workflow

1. **Make contract changes** in `packages/contracts/src/`
2. **Build contracts**: `pnpm build:contracts`
3. **Generate SDK types**: `pnpm build:sdk`
4. **Verify**: `pnpm test:integration`
5. **Use in frontend**: Import from `@yesno-win/sdk`

## 📁 File Structure

```
packages/sdk/
├── scripts/
│   ├── generate-types.js   # ABI extraction and type generation
│   └── smoke-test.js        # Integration test
├── src/
│   ├── index.ts            # Main exports
│   ├── contracts.ts        # Generated contract bindings (auto-generated)
│   ├── types.ts            # Custom types
│   └── utils.ts            # Utility functions
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md (this file)
```

## 🎯 Example: Full Market Interaction

```typescript
import { createThirdwebClient, getContract, prepareContractCall } from 'thirdweb';
import { useSendTransaction, useReadContract } from 'thirdweb/react';
import { MarketABI, MarketFactoryABI } from '@yesno-win/sdk';
import { baseSepolia } from 'thirdweb/chains';

// Setup client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// Get factory contract
const factory = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS!,
  abi: MarketFactoryABI,
});

// React component
function CreateMarket() {
  const { mutate: createMarket } = useSendTransaction();

  const handleCreate = async () => {
    const tx = prepareContractCall({
      contract: factory,
      method: 'createMarket',
      params: [
        'Will ETH reach $5000?',
        ['Yes', 'No'],
        BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
        '0x0000000000000000000000000000000000000000', // Use default collateral
        BigInt(1000_000_000), // 1000 USDC
        0, // Use default fee
      ],
    });
    
    createMarket(tx);
  };

  return <button onClick={handleCreate}>Create Market</button>;
}

function MarketPrices({ marketAddress }: { marketAddress: string }) {
  const market = getContract({
    client,
    chain: baseSepolia,
    address: marketAddress,
    abi: MarketABI,
  });

  const { data: prices } = useReadContract({
    contract: market,
    method: 'getAllPrices',
  });

  return (
    <div>
      {prices?.map((price, i) => (
        <div key={i}>
          Outcome {i}: {Number(price) / 100}%
        </div>
      ))}
    </div>
  );
}
```

## 🔗 Dependencies

- `thirdweb` - Thirdweb SDK v5 for Web3 interactions
- `viem` - TypeScript interface for Ethereum

## 📚 Resources

- [Thirdweb SDK v5 Docs](https://portal.thirdweb.com/typescript/v5)
- [Viem Docs](https://viem.sh/)
- [Contract Documentation](../contracts/README.md)

## 📄 License

MIT
