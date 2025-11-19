/**
 * Formatting utilities
 */

/**
 * Format a number as currency (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number | bigint, decimals = 2): string {
  const value = typeof amount === "bigint" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number with K/M/B suffixes (e.g., "1.2K", "3.4M")
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Format a percentage (e.g., "65.4%")
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format token amount from wei/smallest unit
 */
export function formatTokenAmount(amount: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === 0n) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, "0");
  return `${whole}.${fractionStr}`;
}

/**
 * Parse token amount to wei/smallest unit
 */
export function parseTokenAmount(amount: string, decimals = 6): bigint {
  const [whole, fraction = ""] = amount.split(".");
  const fractionPadded = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + fractionPadded) * (10n ** BigInt(Math.max(0, decimals - fractionPadded.length)));
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);

  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;

  let value: number;
  let unit: string;

  if (absDiff < minute) {
    return diff > 0 ? "in a few seconds" : "just now";
  } else if (absDiff < hour) {
    value = Math.floor(absDiff / minute);
    unit = value === 1 ? "minute" : "minutes";
  } else if (absDiff < day) {
    value = Math.floor(absDiff / hour);
    unit = value === 1 ? "hour" : "hours";
  } else if (absDiff < week) {
    value = Math.floor(absDiff / day);
    unit = value === 1 ? "day" : "days";
  } else if (absDiff < month) {
    value = Math.floor(absDiff / week);
    unit = value === 1 ? "week" : "weeks";
  } else {
    value = Math.floor(absDiff / month);
    unit = value === 1 ? "month" : "months";
  }

  return diff > 0 ? `in ${value} ${unit}` : `${value} ${unit} ago`;
}

/**
 * Format address (e.g., "0x1234...5678")
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return "";
  if (address.length < startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format date to locale string
 */
export function formatDate(timestamp: number, includeTime = true): string {
  const date = new Date(timestamp * 1000);
  
  if (includeTime) {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

