/**
 * Market Utilities
 * Helper functions for interacting with prediction markets
 */

import { readContract } from "thirdweb";
import { getMarketFactory, getMarket } from "./contracts";

export interface Market {
  address: string;
  question: string;
  outcomes: string[];
  outcomeTokens: string[];
  endTime: bigint;
  resolved: boolean;
  winningOutcome: number;
  totalReserves: bigint;
  reserves: bigint[];
  prices: number[];
  lpFeeBps: bigint;
  protocolFeeBps: bigint;
  status: number;
  accumulatedProtocolFees: bigint;
  cancellationReason: string;
  hasTradingActivity: boolean;
  accumulatedFees: bigint; // LP fees
  volumes: bigint[]; // Volume per outcome
  totalVolume: bigint; // Total volume across all outcomes
}

export interface MarketPosition {
  marketAddress: string;
  outcomeIndex: number;
  balance: bigint;
  value: bigint;
}

/**
 * Get total market count
 */
export async function getMarketCount(): Promise<number> {
  try {
    const factory = getMarketFactory();
    const count = (await readContract({
      contract: factory,
      method: "function getMarketCount() view returns (uint256)",
      params: [],
    })) as bigint;
    return Number(count);
  } catch (error) {
    console.error("Error fetching market count:", error);
    return 0;
  }
}

/**
 * Fetch markets with pagination
 * @param start Starting index (0-based)
 * @param end Ending index (exclusive)
 */
export async function getMarketsPaginated(start: number, end: number): Promise<string[]> {
  try {
    const factory = getMarketFactory();
    const markets = (await readContract({
      contract: factory,
      method: "function getMarkets(uint256, uint256) view returns (address[])",
      params: [BigInt(start), BigInt(end)],
    })) as string[];
    return markets;
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}

/**
 * Fetch all markets from MarketFactory (for backward compatibility)
 */
export async function getAllMarkets(): Promise<string[]> {
  try {
    const factory = getMarketFactory();
    const markets = (await readContract({
      contract: factory,
      method: "function getAllMarkets() view returns (address[])",
      params: [],
    })) as string[];
    return markets;
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}

/**
 * Fetch detailed market info
 */
export async function getMarketDetails(marketAddress: string): Promise<Market | null> {
  try {
    const market = getMarket(marketAddress);

    // Fetch market info using the getMarketInfo function
    const marketInfo = await readContract({
      contract: market,
      method: "function getMarketInfo() view returns (string, string[], uint256, uint8, bool, uint256)",
      params: [],
    }) as [string, string[], bigint, number, boolean, bigint];

    const [question, outcomes, endTime, status, resolved, winningOutcome] = marketInfo;

    // Fetch remaining data
    const [
      totalReserves,
      lpFeeBps,
      protocolFeeBps,
      allPrices,
      accumulatedProtocolFees,
      cancellationReason,
      hasTradingActivity,
      accumulatedFees,
    ] = await Promise.all([
      readContract({
        contract: market,
        method: "function totalReserves() view returns (uint256)",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function lpFeeBps() view returns (uint256)",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function protocolFeeBps() view returns (uint256)",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function getAllPrices() view returns (uint256[])",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function accumulatedProtocolFees() view returns (uint256)",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function cancellationReason() view returns (string)",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function hasTradingActivity() view returns (bool)",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function accumulatedFees() view returns (uint256)",
        params: [],
      }),
    ]);

    // Try to fetch volume data (only available in new Market implementation)
    let allVolumes: bigint[] = [];
    let totalVolume: bigint = BigInt(0);
    try {
      [allVolumes, totalVolume] = await Promise.all([
        readContract({
          contract: market,
          method: "function getAllVolumes() view returns (uint256[])",
          params: [],
        }) as Promise<bigint[]>,
        readContract({
          contract: market,
          method: "function totalVolume() view returns (uint256)",
          params: [],
        }) as Promise<bigint>,
      ]);
    } catch {
      // Volume tracking not available in old markets - use defaults
      allVolumes = new Array(outcomes.length).fill(BigInt(0));
      totalVolume = BigInt(0);
    }

    // Get outcome tokens
    const outcomeCount = outcomes.length;
    const outcomeTokenPromises = [];
    const reservePromises = [];
    
    for (let i = 0; i < outcomeCount; i++) {
      outcomeTokenPromises.push(
        readContract({
          contract: market,
          method: "function getOutcomeToken(uint256) view returns (address)",
          params: [BigInt(i)],
        })
      );
      reservePromises.push(
        readContract({
          contract: market,
          method: "function reserves(uint256) view returns (uint256)",
          params: [BigInt(i)],
        })
      );
    }

    const [outcomeTokens, reserves] = await Promise.all([
      Promise.all(outcomeTokenPromises),
      Promise.all(reservePromises),
    ]);

    // Convert prices from contract (basis points) to percentages
    const prices = (allPrices as bigint[]).map((p) => Number(p) / 100);

    return {
      address: marketAddress,
      question,
      outcomes,
      outcomeTokens: outcomeTokens as string[],
      endTime,
      resolved,
      winningOutcome: Number(winningOutcome),
      totalReserves: totalReserves as bigint,
      reserves: reserves as bigint[],
      prices,
      lpFeeBps: lpFeeBps as bigint,
      protocolFeeBps: protocolFeeBps as bigint,
      status,
      accumulatedProtocolFees: accumulatedProtocolFees as bigint,
      cancellationReason: cancellationReason as string,
      hasTradingActivity: hasTradingActivity as boolean,
      accumulatedFees: accumulatedFees as bigint,
      volumes: allVolumes as bigint[],
      totalVolume: totalVolume as bigint,
    };
  } catch (error) {
    console.error("Error fetching market details:", error);
    return null;
  }
}

/**
 * Calculate buy price for outcome tokens
 */
export async function calculateBuyPrice(
  marketAddress: string,
  outcomeIndex: number,
  collateralAmount: bigint
): Promise<bigint> {
  try {
    const market = getMarket(marketAddress);
    const tokens = (await readContract({
      contract: market,
      method: "function calculateBuyPrice(uint256, uint256) view returns (uint256)",
      params: [BigInt(outcomeIndex), collateralAmount],
    })) as bigint;
    return tokens;
  } catch (error) {
    console.error("Error calculating buy price:", error);
    return BigInt(0);
  }
}

/**
 * Calculate sell price for outcome tokens
 */
export async function calculateSellPrice(
  marketAddress: string,
  outcomeIndex: number,
  tokenAmount: bigint
): Promise<bigint> {
  try {
    const market = getMarket(marketAddress);
    const collateral = (await readContract({
      contract: market,
      method: "function calculateSellPrice(uint256, uint256) view returns (uint256)",
      params: [BigInt(outcomeIndex), tokenAmount],
    })) as bigint;
    return collateral;
  } catch (error) {
    console.error("Error calculating sell price:", error);
    return BigInt(0);
  }
}

/**
 * Get user's outcome token balance
 */
export async function getOutcomeBalance(
  outcomeTokenAddress: string,
  userAddress: string
): Promise<bigint> {
  try {
    const token = getMarket(outcomeTokenAddress); // Reuse getMarket for ERC20
    const balance = (await readContract({
      contract: token,
      method: "function balanceOf(address) view returns (uint256)",
      params: [userAddress],
    })) as bigint;
    return balance;
  } catch (error) {
    console.error("Error fetching outcome balance:", error);
    return BigInt(0);
  }
}

/**
 * Format market status
 */
export function getMarketStatus(market: Market): string {
  const now = Date.now() / 1000;
  const endTime = Number(market.endTime);

  if (market.resolved) return "Resolved";
  if (market.status === 2) return "Closed";
  if (market.status === 3) return "Canceled";
  if (now > endTime) return "Ended";
  return "Active";
}

/**
 * Check if market is tradeable
 */
export function isMarketTradeable(market: Market): boolean {
  const now = Date.now() / 1000;
  const endTime = Number(market.endTime);
  return market.status === 1 && !market.resolved && now < endTime;
}

/**
 * Get user's LP token balance
 */
export async function getLPBalance(
  marketAddress: string,
  userAddress: string
): Promise<bigint> {
  try {
    const market = getMarket(marketAddress);
    const balance = (await readContract({
      contract: market,
      method: "function getLpBalance(address) view returns (uint256)",
      params: [userAddress],
    })) as bigint;
    return balance;
  } catch (error) {
    console.error("Error fetching LP balance:", error);
    return BigInt(0);
  }
}

/**
 * Calculate user's claimable LP fees
 */
export async function calculateClaimableLPFees(
  marketAddress: string,
  userAddress: string
): Promise<bigint> {
  try {
    const market = getMarket(marketAddress);
    
    const [lpBalance, totalLPSupply, accumulatedFees] = await Promise.all([
      readContract({
        contract: market,
        method: "function getLpBalance(address) view returns (uint256)",
        params: [userAddress],
      }),
      readContract({
        contract: market,
        method: "function getTotalLpTokens() view returns (uint256)",
        params: [],
      }),
      readContract({
        contract: market,
        method: "function accumulatedFees() view returns (uint256)",
        params: [],
      }),
    ]);

    const lpBal = lpBalance as bigint;
    const totalSupply = totalLPSupply as bigint;
    const fees = accumulatedFees as bigint;

    if (totalSupply === BigInt(0) || lpBal === BigInt(0)) {
      return BigInt(0);
    }

    // Calculate proportional share: (accumulatedFees * lpBalance) / totalLPSupply
    return (fees * lpBal) / totalSupply;
  } catch (error) {
    console.error("Error calculating claimable LP fees:", error);
    return BigInt(0);
  }
}

