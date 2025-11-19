"use client";

import { useState } from "react";
import { prepareContractCall } from "thirdweb";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { getPredictionMarketContract, getTokenContract, predictionContractAddress, getPredictionContractByAddress } from "@/constants/contracts";
import { useTokenData } from "./useTokenData";
import { useActiveAccount } from "thirdweb/react";

export function useBuyShares() {
  const account = useActiveAccount();
  const { tokenUnit, allowanceRaw, refetchAllowance } = useTokenData();
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();
  const [isProcessing, setIsProcessing] = useState(false);

  const buyShares = async (
    marketId: number,
    isOptionA: boolean,
    shareAmount: number,
    onSuccess?: () => void,
    onError?: (error: Error) => void,
    contractAddressOverride?: `0x${string}`
  ) => {
    if (!account) {
      throw new Error("Please connect your wallet");
    }

    const tokenContractInstance = getTokenContract();
    if (!tokenContractInstance) {
      throw new Error("Token contract not configured");
    }

    // Prevent duplicate submissions / double confirmation
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const amountRaw = BigInt(Math.max(1, shareAmount)) * tokenUnit;

      // Approve max if allowance is insufficient
      if (allowanceRaw < amountRaw) {
        const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);
        const approveTx = prepareContractCall({
          contract: tokenContractInstance,
          method: "function approve(address spender, uint256 amount) returns (bool)",
          params: [contractAddressOverride ?? predictionContractAddress, MAX_UINT256],
        });
        await sendAndConfirm(approveTx);
        await refetchAllowance?.();
      }

      // Buy shares
      const marketContract = contractAddressOverride
        ? getPredictionContractByAddress(contractAddressOverride)
        : getPredictionMarketContract();
      const buyTx = prepareContractCall({
        contract: marketContract,
        method: "function buyShares(uint256 _marketId, bool _isOptionA, uint256 _amount)",
        params: [BigInt(marketId), isOptionA, amountRaw],
      });
      await sendAndConfirm(buyTx);

      onSuccess?.();
    } catch (error) {
      console.error("Error buying shares:", error);
      onError?.(error as Error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    buyShares,
    isProcessing,
  };
}

