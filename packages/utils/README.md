# Utils Package

Shared utilities for YesNo.Win frontend and backend.

## Overview

This package provides:
- **Formatting**: Currency, numbers, dates, addresses
- **Validation**: Address validation, market validation
- **Constants**: Market status, oracle types, token decimals
- **Types**: Shared type definitions

## Usage

```typescript
import { formatCurrency, formatTokenAmount, isValidAddress, MARKET_STATUS } from "utils";

// Format values
const display = formatCurrency(1234.56); // "$1,234.56"
const amount = formatTokenAmount(1000000n, 6); // "1.0"

// Validate
if (isValidAddress(address)) {
  // ...
}

// Use constants
if (market.status === MARKET_STATUS.ACTIVE) {
  // ...
}
```

