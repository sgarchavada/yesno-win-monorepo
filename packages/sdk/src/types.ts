/**
 * Type definitions for YesNo.Win SDK
 */

export enum MarketStatus {
  ACTIVE = 0,
  CLOSED = 1,
  RESOLVED = 2,
  CANCELED = 3,
}

export enum OracleType {
  MANUAL = 0,
  CHAINLINK = 1,
  UMA = 2,
  API3 = 3,
  CUSTOM = 4,
}

export interface Market {
  id: string;
  address: string;
  question: string;
  startTime: number;
  endTime: number;
  status: MarketStatus;
  outcomes: string[];
  totalShares: Record<number, bigint>;
  resolved: boolean;
  winningOutcome?: number;
}

export interface UserPosition {
  marketId: string;
  outcome: number;
  shares: bigint;
  invested: bigint;
  currentValue: bigint;
  claimable: bigint;
}

export interface MarketMetadata {
  question: string;
  description?: string;
  category?: string;
  tags?: string[];
  imageUrl?: string;
  resolutionSource?: string;
}

export interface CreateMarketParams {
  question: string;
  endTime: number;
  outcomes: string[];
  metadata?: MarketMetadata;
}

export interface BuySharesParams {
  marketId: string;
  outcome: number;
  amount: bigint;
}

export interface SellSharesParams {
  marketId: string;
  outcome: number;
  amount: bigint;
}

export interface ClaimWinningsParams {
  marketId: string;
}

