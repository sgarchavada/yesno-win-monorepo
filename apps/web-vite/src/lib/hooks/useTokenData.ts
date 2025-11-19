
import { useReadContract } from "thirdweb/react";
import { getTokenContract, predictionContractAddress } from "@/constants/contracts";
import { useActiveAccount } from "thirdweb/react";

export function useTokenData() {
  const account = useActiveAccount();
  const userAddress = account?.address as string | undefined;
  const tokenContract = getTokenContract();

  // Token decimals
  const { data: decimalsData } = useReadContract({
    contract: tokenContract as any,
    method: "function decimals() view returns (uint8)",
    queryOptions: { enabled: Boolean(tokenContract) },
  });
  const decimals = Number(decimalsData ?? 18);
  const tokenUnit = BigInt(10) ** BigInt(decimals);

  // User balance
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    contract: tokenContract as any,
    method: "function balanceOf(address owner) view returns (uint256)",
    params: [userAddress as string],
    queryOptions: { enabled: Boolean(userAddress) && Boolean(tokenContract) },
  });
  const balanceRaw = (() => {
    try {
      return BigInt(balanceData as unknown as bigint);
    } catch {
      return BigInt(0);
    }
  })();

  // Allowance
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    contract: tokenContract as any,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: [userAddress as string, predictionContractAddress],
    queryOptions: { enabled: Boolean(userAddress) && Boolean(tokenContract) },
  });
  const allowanceRaw = (() => {
    try {
      return BigInt(allowanceData as unknown as bigint);
    } catch {
      return BigInt(0);
    }
  })();

  return {
    decimals,
    tokenUnit,
    balanceRaw,
    allowanceRaw,
    refetchBalance,
    refetchAllowance,
    isConnected: Boolean(userAddress),
  };
}

