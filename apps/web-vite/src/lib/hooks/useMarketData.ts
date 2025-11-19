
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { getPredictionMarketContract, getPredictionContractByAddress } from "@/constants/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readContract, toEther } from "thirdweb";

type MarketDataShape = {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  startTime: number;
  endTime: number;
  status: "Pending" | "Active" | "Closed" | "Resolved" | "Canceled";
  totalSharesA: number;
  totalSharesB: number;
  resolved: boolean;
  resolutionType?: number;
  outcome?: number;
  distributablePool?: number;
} | null;

export function useMarketData(marketId: number, contractAddress?: `0x${string}`, enabled: boolean = true) {
  const contract = useMemo(() => {
    return contractAddress ? getPredictionContractByAddress(contractAddress) : getPredictionMarketContract();
  }, [contractAddress]);

  const [market, setMarket] = useState<MarketDataShape>(null);

  const fetchMarket = useCallback(async () => {
    // Use new core + stats API only
    try {
      if (!contract) {
        throw new Error("Contract not initialized");
      }
      const core = (await readContract({
        contract,
        method:
          "function getMarketCore(uint256 _marketId) view returns (string question, uint256 startTime, uint256 endTime, uint8 status, uint8 outcome, uint8 resolutionType, string optionA, string optionB)",
        params: [BigInt(marketId)],
      })) as readonly unknown[];
      const stats = (await readContract({
        contract,
        method:
          "function getMarketStats(uint256 _marketId) view returns (uint256 totalOptionAShares, uint256 totalOptionBShares, uint256 distributablePool, uint256 totalFeeTaken, uint256 totalClaimedWinnings, bool resolved, uint256 resolvedTime, uint256 claimExpiry)",
        params: [BigInt(marketId)],
      })) as readonly unknown[];

      const statusNum = Number(core[3] as number | string | bigint);
      let status: "Pending" | "Active" | "Closed" | "Resolved" | "Canceled" = "Active";
      if (statusNum === 0) status = "Active";
      else if (statusNum === 1) status = "Closed";
      else if (statusNum === 2) status = "Resolved";
      else if (statusNum === 3) status = "Canceled";

      setMarket({
        id: marketId,
        question: String(core[0]),
        optionA: String(core[6]),
        optionB: String(core[7]),
        startTime: Number(core[1] as number | string | bigint),
        endTime: Number(core[2] as number | string | bigint),
        status,
        totalSharesA: Number(toEther(BigInt(stats[0] as any))),
        totalSharesB: Number(toEther(BigInt(stats[1] as any))),
        resolved: Boolean(stats[5]),
        resolutionType: Number(core[5] as number | string | bigint),
        outcome: Number(core[4] as number | string | bigint),
        distributablePool: Number(toEther(BigInt(stats[2] as any))),
        // expose extra fields for UI if needed
      });
      return;
    } catch {
      setMarket(null);
      return;
    }
    
  }, [contract, marketId]);

  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      void fetchMarket();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchMarket, enabled]);

  return {
    market,
    refetchMarket: fetchMarket,
  };
}

export function useSharesBalance(marketId: number, enabled: boolean = true, contractAddress?: `0x${string}`) {
  const account = useActiveAccount();
  const userAddress = account?.address as string | undefined;
  const contract = useMemo(() => {
    return contractAddress ? getPredictionContractByAddress(contractAddress) : getPredictionMarketContract();
  }, [contractAddress]);

  const { data: sharesData, refetch: refetchShares } = useReadContract({
    contract: contract as any,
    method:
      "function getSharesBalance(uint256 _marketId, address _user) view returns (uint256 optionAShares, uint256 optionBShares)",
    params: [BigInt(marketId), userAddress as string],
    queryOptions: { enabled: enabled && Boolean(userAddress) && Boolean(contract) },
  });

  // Ensure refetch when user or contract changes (some providers don't auto-refetch on enabled toggles)
  useEffect(() => {
    if (enabled && userAddress) {
      void refetchShares();
    }
  }, [enabled, userAddress, marketId, contractAddress, refetchShares]);

  // Aggregate balances for both Smart Account and underlying EOA if present
  const [combined, setCombined] = useState<{ optionAShares: bigint; optionBShares: bigint } | null>(null);
  // Manual refresh nonce to force recomputation after on-chain state changes
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const resolveEOAAddress = async (): Promise<string | undefined> => {
      try {
        // thirdweb smart account may expose personal wallet via experimental api
        const anyAcc = account as any;
        if (anyAcc?.personalWallet?.getAccount) {
          const pwAcc = anyAcc.personalWallet.getAccount();
          if (pwAcc?.address) return pwAcc.address as string;
        }
        if (anyAcc?.personalWallet?.getSigner) {
          const signer = await anyAcc.personalWallet.getSigner();
          if (signer?.getAddress) return await signer.getAddress();
        }
      } catch {}
      try {
        // fallback to injected
        const w = (globalThis as any).ethereum;
        if (w?.selectedAddress) return w.selectedAddress as string;
        const accts = await w?.request?.({ method: "eth_accounts" });
        if (Array.isArray(accts) && accts[0]) return accts[0] as string;
      } catch {}
      return undefined;
    };

    const run = async () => {
      if (!enabled) return setCombined(null);
      const eoa = await resolveEOAAddress();
      const addresses = [userAddress, eoa].filter((a): a is string => Boolean(a))
        // de-duplicate
        .filter((addr, idx, arr) => arr.indexOf(addr) === idx);
      if (addresses.length === 0) return setCombined(null);
      try {
        let aSum = BigInt(0);
        let bSum = BigInt(0);
        const signatures = [
          "function getSharesBalance(uint256 _marketId, address _user) view returns (uint256 optionAShares, uint256 optionBShares)",
          "function getUserShares(uint256 _marketId, address _user) view returns (uint256 optionAShares, uint256 optionBShares)",
          "function sharesOf(uint256 _marketId, address _user) view returns (uint256 optionAShares, uint256 optionBShares)",
          "function getShares(uint256 _marketId, address _user) view returns (uint256 optionAShares, uint256 optionBShares)",
        ] as const;
        for (const addr of addresses) {
          let res: readonly unknown[] | null = null;
          if (!contract) continue;
          for (const sig of signatures) {
            try {
              const out = (await readContract({ contract, method: sig, params: [BigInt(marketId), addr] })) as readonly unknown[];
              if (Array.isArray(out)) { res = out; break; }
            } catch {}
          }
          const a = BigInt(((res?.[0] as unknown) as bigint) ?? 0);
          const b = BigInt(((res?.[1] as unknown) as bigint) ?? 0);
          aSum += a;
          bSum += b;
        }
        setCombined({ optionAShares: aSum, optionBShares: bSum });
      } catch {
        setCombined(null);
      }
    };

    void run();
  }, [enabled, userAddress, account, marketId, contract, contractAddress, refreshNonce]);

  return {
    sharesBalance: combined
      ? combined
      : sharesData
      ? {
          optionAShares: BigInt((sharesData[0] as unknown as bigint) ?? 0),
          optionBShares: BigInt((sharesData[1] as unknown as bigint) ?? 0),
        }
      : null,
    refetchShares: async () => {
      try { await refetchShares(); } catch {}
      // Force recompute of aggregated balances too
      setRefreshNonce((n) => n + 1);
    },
    forceRefreshShares: () => setRefreshNonce((n) => n + 1),
  };
}

