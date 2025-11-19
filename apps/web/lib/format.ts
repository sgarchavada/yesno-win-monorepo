/**
 * Formatting Utilities
 * UI formatting helpers for numbers, dates, addresses, etc.
 */

/**
 * Format token amount (18 decimals) - PMT token
 */
export function formatUSDC(amount: bigint | number): string {
  const value = typeof amount === "bigint" ? Number(amount) / 1e18 : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format PMT token amount (6 decimals) - for collateral/USDC
 * PMT token uses 6 decimals like real USDC
 */
export function formatPMT(amount: bigint | number): string {
  const value = typeof amount === "bigint" ? Number(amount) / 1e6 : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format outcome tokens (18 decimals - standard ERC20)
 */
export function formatTokens(amount: bigint | number): string {
  const value = typeof amount === "bigint" ? Number(amount) / 1e18 : amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage (0-100)
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format price as percentage with color
 */
export function formatPrice(price: number): { text: string; color: string } {
  const text = formatPercent(price);
  const color = price > 50 ? "text-green-400" : "text-blue-400";
  return { text, color };
}

/**
 * Shorten address (0x1234...5678)
 */
export function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(endTime: bigint): string {
  const now = Date.now() / 1000;
  const end = Number(endTime);
  const diff = end - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format date
 */
export function formatDate(timestamp: bigint | number): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format large numbers (1.2K, 1.5M)
 */
export function formatCompact(value: number): string {
  if (value < 1000) return value.toFixed(0);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/**
 * Calculate price impact
 */
export function calculatePriceImpact(
  oldPrice: number,
  newPrice: number
): { value: number; color: string } {
  const impact = Math.abs(newPrice - oldPrice);
  const color = impact > 5 ? "text-red-400" : impact > 2 ? "text-yellow-400" : "text-green-400";
  return { value: impact, color };
}

/**
 * Format basis points to percentage
 */
export function formatBps(bps: bigint): string {
  return `${Number(bps) / 100}%`;
}

/**
 * Parse input to collateral amount (6 decimals) - USDC/PMT token
 */
export function parseUSDC(value: string): bigint {
  try {
    const num = parseFloat(value);
    if (isNaN(num)) return BigInt(0);
    return BigInt(Math.floor(num * 1e6));
  } catch {
    return BigInt(0);
  }
}

/**
 * Parse a string value to 18-decimal token amount (for LP tokens, Outcome tokens)
 */
export function parseTokens(value: string): bigint {
  try {
    const num = parseFloat(value);
    if (isNaN(num)) return BigInt(0);
    return BigInt(Math.floor(num * 1e18));
  } catch {
    return BigInt(0);
  }
}

/**
 * Format wei to readable number (default 18 decimals for standard ERC20)
 */
export function fromWei(value: bigint, decimals: number = 18): number {
  return Number(value) / Math.pow(10, decimals);
}

/**
 * Convert number to wei (default 18 decimals for standard ERC20)
 */
export function toWei(value: number, decimals: number = 18): bigint {
  return BigInt(Math.floor(value * Math.pow(10, decimals)));
}

