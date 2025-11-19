/**
 * Shared constants
 */

export const MARKET_STATUS = {
  ACTIVE: 0,
  CLOSED: 1,
  RESOLVED: 2,
  CANCELED: 3,
} as const;

export const ORACLE_TYPE = {
  MANUAL: 0,
  CHAINLINK: 1,
  UMA: 2,
  API3: 3,
  CUSTOM: 4,
} as const;

// Token decimals
export const USDC_DECIMALS = 6;
export const ETH_DECIMALS = 18;

// Platform defaults
export const DEFAULT_PLATFORM_FEE_BPS = 300; // 3%
export const MAX_PLATFORM_FEE_BPS = 1000; // 10%

// Market limits
export const MIN_MARKET_DURATION = 3600; // 1 hour
export const MAX_MARKET_DURATION = 365 * 24 * 3600; // 1 year
export const MIN_OUTCOMES = 2;
export const MAX_OUTCOMES = 10;

// UI constants
export const ITEMS_PER_PAGE = 20;
export const DEBOUNCE_DELAY = 300; // ms

// Chain IDs
export const CHAIN_IDS = {
  BASE: 8453,
  BASE_SEPOLIA: 84532,
} as const;

// Contract addresses (Base Sepolia)
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

