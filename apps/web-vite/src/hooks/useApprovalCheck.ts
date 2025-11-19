"use client";

/**
 * useApprovalCheck Hook
 * Checks if user has approved USDC spending for a contract
 * Shows EnableTradingModal if not approved
 */

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { readContract } from "thirdweb";
import { getUSDC } from "@/lib/contracts";

interface UseApprovalCheckOptions {
  targetContract: string;
  requiredAmount?: bigint; // Minimum required allowance (default: check for > 1M USDC)
  autoCheck?: boolean; // Auto-check on mount (default: true)
}

export function useApprovalCheck({
  targetContract,
  requiredAmount = BigInt(1e12), // 1M USDC (6 decimals)
  autoCheck = true,
}: UseApprovalCheckOptions) {
  const account = useActiveAccount();
  const [isApproved, setIsApproved] = useState<boolean | null>(null); // null = checking
  const [currentAllowance, setCurrentAllowance] = useState<bigint>(BigInt(0));
  const [isChecking, setIsChecking] = useState(false);

  const checkApproval = async () => {
    if (!account) {
      setIsApproved(false);
      return false;
    }

    setIsChecking(true);
    try {
      const usdcContract = getUSDC();
      const allowance = await readContract({
        contract: usdcContract,
        method: "function allowance(address owner, address spender) view returns (uint256)",
        params: [account.address, targetContract],
      }) as bigint;

      setCurrentAllowance(allowance);
      const approved = allowance >= requiredAmount;
      setIsApproved(approved);
      return approved;
    } catch (err) {
      console.error("Error checking approval:", err);
      setIsApproved(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check on mount and when account/contract changes
  useEffect(() => {
    if (autoCheck) {
      checkApproval();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, targetContract, autoCheck]);

  return {
    isApproved,
    currentAllowance,
    isChecking,
    checkApproval, // Manual check function
    needsApproval: isApproved === false,
  };
}

