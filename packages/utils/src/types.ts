/**
 * Shared type definitions
 */

export type MarketStatus = 0 | 1 | 2 | 3; // ACTIVE | CLOSED | RESOLVED | CANCELED
export type OracleType = 0 | 1 | 2 | 3 | 4; // MANUAL | CHAINLINK | UMA | API3 | CUSTOM

export type Address = `0x${string}`;

export interface BaseMarket {
  id: string;
  question: string;
  startTime: number;
  endTime: number;
  status: MarketStatus;
  resolved: boolean;
}

export interface MarketOutcome {
  index: number;
  name: string;
  shares: bigint;
  probability?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  field: string;
  order: "asc" | "desc";
}

export interface FilterParams {
  status?: MarketStatus;
  category?: string;
  search?: string;
}

