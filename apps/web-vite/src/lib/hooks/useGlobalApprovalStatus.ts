"use client";

/**
 * useGlobalApprovalStatus Hook
 * Checks approval status for multiple markets at once
 * Useful for showing global approval status in header/profile
 */

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { readContract } from "thirdweb";
import { getUSDC } from "@/lib/contracts";

interface MarketApprovalStatus {
  marketAddress: string;
  isApproved: boolean;
  allowance: bigint;
}

export function useGlobalApprovalStatus(marketAddresses: string[]) {
  const account = useActiveAccount();
  const [approvalStatuses, setApprovalStatuses] = useState<Map<string, MarketApprovalStatus>>(new Map());
  const [isChecking, setIsChecking] = useState(false);

  const checkAllApprovals = async () => {
    if (!account || marketAddresses.length === 0) {
      setApprovalStatuses(new Map());
      return;
    }

    setIsChecking(true);
    try {
      const usdcContract = getUSDC();
      const statuses = new Map<string, MarketApprovalStatus>();

      // Check all markets in parallel
      const results = await Promise.all(
        marketAddresses.map(async (marketAddress) => {
          try {
            const allowance = await readContract({
              contract: usdcContract,
              method: "function allowance(address owner, address spender) view returns (uint256)",
              params: [account.address, marketAddress],
            }) as bigint;

            return {
              marketAddress,
              isApproved: allowance > BigInt(1e12), // > 1M USDC
              allowance,
            };
          } catch (err) {
            console.error(`Error checking approval for ${marketAddress}:`, err);
            return {
              marketAddress,
              isApproved: false,
              allowance: BigInt(0),
            };
          }
        })
      );

      results.forEach(status => {
        statuses.set(status.marketAddress, status);
      });

      setApprovalStatuses(statuses);
    } catch (err) {
      console.error("Error checking approvals:", err);
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check when account or markets change
  useEffect(() => {
    checkAllApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, marketAddresses.join(",")]);

  // Helper functions
  const isMarketApproved = (marketAddress: string): boolean => {
    return approvalStatuses.get(marketAddress)?.isApproved ?? false;
  };

  const getMarketAllowance = (marketAddress: string): bigint => {
    return approvalStatuses.get(marketAddress)?.allowance ?? BigInt(0);
  };

  const approvedMarketsCount = Array.from(approvalStatuses.values()).filter(
    status => status.isApproved
  ).length;

  const totalMarketsCount = marketAddresses.length;

  return {
    approvalStatuses,
    isChecking,
    checkAllApprovals,
    isMarketApproved,
    getMarketAllowance,
    approvedMarketsCount,
    totalMarketsCount,
    allApproved: approvedMarketsCount === totalMarketsCount && totalMarketsCount > 0,
  };
}

