/**
 * Utility functions for the SDK
 */

import { MarketStatus } from "./types";

/**
 * Check if a market is active for trading
 */
export function isMarketActive(status: MarketStatus, endTime: number): boolean {
  return status === MarketStatus.ACTIVE && Date.now() / 1000 < endTime;
}

/**
 * Check if a market is resolved
 */
export function isMarketResolved(status: MarketStatus): boolean {
  return status === MarketStatus.RESOLVED;
}

/**
 * Check if a market is canceled
 */
export function isMarketCanceled(status: MarketStatus): boolean {
  return status === MarketStatus.CANCELED;
}

/**
 * Calculate implied probability from total shares
 */
export function calculateImpliedProbability(
  outcomeShares: bigint,
  totalShares: bigint
): number {
  if (totalShares === 0n) return 0;
  return Number((outcomeShares * 10000n) / totalShares) / 100;
}

/**
 * Format market status to human-readable string
 */
export function formatMarketStatus(status: MarketStatus): string {
  switch (status) {
    case MarketStatus.ACTIVE:
      return "Active";
    case MarketStatus.CLOSED:
      return "Closed";
    case MarketStatus.RESOLVED:
      return "Resolved";
    case MarketStatus.CANCELED:
      return "Canceled";
    default:
      return "Unknown";
  }
}

/**
 * Calculate potential payout for winning shares
 */
export function calculatePayout(
  userShares: bigint,
  totalWinningShares: bigint,
  totalPool: bigint,
  platformFeeBps: number = 300
): bigint {
  if (totalWinningShares === 0n) return 0n;

  const grossPayout = (userShares * totalPool) / totalWinningShares;
  const fee = (grossPayout * BigInt(platformFeeBps)) / 10000n;
  return grossPayout - fee;
}

/**
 * Format timestamp to human-readable date
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Check if market has ended
 */
export function hasMarketEnded(endTime: number): boolean {
  return Date.now() / 1000 >= endTime;
}

