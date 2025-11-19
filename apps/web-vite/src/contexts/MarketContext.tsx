
import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { client } from "@/client";

// Market data interface
export interface MarketData {
  address: string;
  question: string;
  description: string;
  outcomes: string[];
  status: number;
  endTime: bigint;
  totalReserves: bigint;
  reserves: bigint[];
  accumulatedFees: bigint;
  accumulatedProtocolFees: bigint;
  winningOutcome?: number;
  totalVolume: bigint;
  lpFeeBps: number;
  protocolFeeBps: number;
  creator: string;
  // Add more fields as needed
}

interface MarketContextType {
  marketData: MarketData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export function MarketProvider({
  children,
  marketAddress,
}: {
  children: ReactNode;
  marketAddress: string;
}) {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const marketContract = getContract({
        client,
        address: marketAddress as `0x${string}`,
        chain: defineChain(84532),
      });

      console.log("🔄 Fetching market data from contract:", marketAddress);

      // Use getMarketInfo() to get core data in one call
      const marketInfo = await readContract({
        contract: marketContract,
        method: "function getMarketInfo() view returns (string question, string[] outcomeNames, uint256 endTime, uint8 status, bool resolved, uint256 winningOutcome)",
        params: [],
      });

      console.log("  ✅ Got market info");
      console.log("  Status:", Number(marketInfo[3]));
      console.log("  Resolved:", marketInfo[4]);
      console.log("  Winning Outcome:", Number(marketInfo[5]));

      // Fetch additional data in parallel
      const [
        totalReserves,
        reserves0,
        reserves1,
        accumulatedFees,
        accumulatedProtocolFees,
      ] = await Promise.all([
        readContract({
          contract: marketContract,
          method: "function totalReserves() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: marketContract,
          method: "function reserves(uint256) view returns (uint256)",
          params: [BigInt(0)],
        }),
        readContract({
          contract: marketContract,
          method: "function reserves(uint256) view returns (uint256)",
          params: [BigInt(1)],
        }),
        readContract({
          contract: marketContract,
          method: "function accumulatedFees() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: marketContract,
          method: "function accumulatedProtocolFees() view returns (uint256)",
          params: [],
        }),
      ]);

      console.log("  ✅ Got reserves and fees");
      console.log("  Total Reserves:", Number(totalReserves) / 1e6, "USDC");
      console.log("  Reserves[0]:", Number(reserves0) / 1e6, "USDC");
      console.log("  Reserves[1]:", Number(reserves1) / 1e6, "USDC");
      console.log("  Accumulated Fees:", Number(accumulatedFees) / 1e6, "USDC");

      const data: MarketData = {
        address: marketAddress,
        question: marketInfo[0] as string,
        description: "", // Not available in getMarketInfo
        outcomes: marketInfo[1] as string[],
        status: Number(marketInfo[3]),
        endTime: marketInfo[2] as bigint,
        totalReserves: totalReserves as bigint,
        reserves: [reserves0 as bigint, reserves1 as bigint],
        accumulatedFees: accumulatedFees as bigint,
        accumulatedProtocolFees: accumulatedProtocolFees as bigint,
        winningOutcome: marketInfo[4] ? Number(marketInfo[5]) : undefined,
        totalVolume: BigInt(0), // Not critical for LP calculation
        lpFeeBps: 0, // Not critical for LP calculation
        protocolFeeBps: 0, // Not critical for LP calculation
        creator: "", // Not critical for LP calculation
      };

      setMarketData(data);
      console.log("✅ Market data fetched successfully");
      console.log("  Reserves[0]:", Number(data.reserves[0]) / 1e6, "USDC");
      console.log("  Reserves[1]:", Number(data.reserves[1]) / 1e6, "USDC");
      console.log("  Accumulated Fees:", Number(data.accumulatedFees) / 1e6, "USDC");
    } catch (err: any) {
      console.error("❌ Error fetching market data:", err);
      console.error("  Error details:", err.message || err);
      setError(err instanceof Error ? err.message : "Failed to fetch market data");
      // Don't block the UI - let components fall back to legacy prop data
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMarketData();
  }, [marketAddress]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketData();
    }, 10000);

    return () => clearInterval(interval);
  }, [marketAddress]);

  return (
    <MarketContext.Provider
      value={{
        marketData,
        isLoading,
        error,
        refetch: fetchMarketData,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

// Custom hook to use market context
export function useMarket() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error("useMarket must be used within a MarketProvider");
  }
  return context;
}

