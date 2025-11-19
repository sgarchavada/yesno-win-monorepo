
import { useEffect, useMemo, useState } from "react";
import { useSendAndConfirmTransaction, useReadContract } from "thirdweb/react";
import { prepareContractCall, readContract, toEther } from "thirdweb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Wallet, Coins, Loader2, RefreshCw, ArrowUpRight, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { baseSepolia } from "thirdweb/chains";
import { getPredictionContractByAddress } from "@/constants/contracts";
import { predictionContracts } from "@/lib/config";

type MarketRow = {
  id: number;
  contractAddress: `0x${string}`;
  status: number; // 0 active,1 closed,2 resolved,3 canceled
  distributablePool: bigint;
  totalClaimedWinnings: bigint;
  resolvedTime: number;
  claimExpiry: number;
};

const CLAIM_WINDOW_SECONDS = 30 * 24 * 60 * 60; // 30 days

export default function TreasuryDashboard() {
  const { toast } = useToast();
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  // Overview (use latest contract for platform-level fields)
  const latestAddress = predictionContracts[0]?.address as `0x${string}`;
  const latest = getPredictionContractByAddress(latestAddress);

  const { data: totalFeesRaw, isLoading: feesLoading, refetch: refetchFees } = useReadContract({
    contract: latest,
    method: "function totalPlatformFeesCollected() view returns (uint256)",
    params: [],
  });
  const { data: treasuryAddress, isLoading: treasuryLoading, refetch: refetchTreasury } = useReadContract({
    contract: latest,
    method: "function treasury() view returns (address)",
    params: [],
  });
  const { data: stakingTokenAddress } = useReadContract({
    contract: latest,
    method: "function stakingToken() view returns (address)",
    params: [],
  });

  const [treasuryBalance, setTreasuryBalance] = useState<string>("0");
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [withdrawingAll, setWithdrawingAll] = useState(false);

  // Fetch treasury token balance when addresses are known
  useEffect(() => {
    const run = async () => {
      try {
        if (!treasuryAddress || !stakingTokenAddress) return;
        const token = {
          address: stakingTokenAddress as `0x${string}`,
          client: latest.client,
          chain: baseSepolia,
        } as any;
        const balance = (await readContract({
          contract: token,
          method: "function balanceOf(address) view returns (uint256)",
          params: [treasuryAddress as string],
        })) as bigint;
        setTreasuryBalance(Number(toEther(BigInt(balance || 0n))).toString());
      } catch {
        setTreasuryBalance("0");
      }
    };
    void run();
  }, [latest.client, treasuryAddress, stakingTokenAddress]);

  // Fetch per-market data across all configured contracts
  const refetchMarkets = useMemo(() => {
    return async () => {
      setLoadingMarkets(true);
      try {
        const all: MarketRow[] = [];
        for (const { address } of predictionContracts) {
          const contract = getPredictionContractByAddress(address);
          // get count (support both names)
          const countCandidates = [
            "function getMarketCount() view returns (uint256)",
            "function marketCount() view returns (uint256)",
          ] as const;
          let count = 0;
          for (const sig of countCandidates) {
            try {
              const c = (await readContract({ contract, method: sig, params: [] })) as number | bigint;
              count = Number(c || 0);
              if (count >= 0) break;
            } catch {}
          }

          const per = await Promise.all(
            Array.from({ length: count }, async (_, i) => {
              try {
                const core = (await readContract({
                  contract,
                  method:
                    "function getMarketCore(uint256 _marketId) view returns (string question, uint256 startTime, uint256 endTime, uint8 status, uint8 outcome, uint8 resolutionType, string optionA, string optionB)",
                  params: [BigInt(i)],
                })) as readonly unknown[];
                const stats = (await readContract({
                  contract,
                  method:
                    "function getMarketStats(uint256 _marketId) view returns (uint256 totalOptionAShares, uint256 totalOptionBShares, uint256 distributablePool, uint256 totalFeeTaken, uint256 totalClaimedWinnings, bool resolved, uint256 resolvedTime, uint256 claimExpiry)",
                  params: [BigInt(i)],
                })) as readonly unknown[];
                return {
                  id: i,
                  contractAddress: address,
                  status: Number(core[3]),
                  distributablePool: BigInt(stats[2] as any),
                  totalClaimedWinnings: BigInt(stats[4] as any),
                  resolvedTime: Number(stats[6] as any),
                  claimExpiry: Number(stats[7] as any) || (Number(stats[6] as any) + CLAIM_WINDOW_SECONDS),
                } as MarketRow;
              } catch {
                return null;
              }
            })
          );
          all.push(...per.filter((m): m is MarketRow => m !== null));
        }

        // latest first
        all.sort((a, b) => b.id - a.id);
        setMarkets(all);
      } finally {
        setLoadingMarkets(false);
      }
    };
  }, []);

  useEffect(() => {
    void refetchMarkets();
  }, [refetchMarkets]);

  const totalFees = totalFeesRaw ? Number(toEther(BigInt(totalFeesRaw as any))) : 0;

  const handleCopyAddress = () => {
    if (treasuryAddress) {
      navigator.clipboard.writeText(String(treasuryAddress));
      toast("Treasury address copied", "success");
    }
  };

  const withdrawAllFees = async () => {
    setWithdrawingAll(true);
    try {
      const tx = prepareContractCall({ contract: latest, method: "function withdrawPlatformFees()", params: [] });
      await sendAndConfirm(tx);
      toast("Withdrawn platform fees", "success");
      await refetchFees();
    } catch (e) {
      console.error(e);
      toast("Failed to withdraw fees", "error");
    } finally {
      setWithdrawingAll(false);
    }
  };

  const reclaim = async (m: MarketRow) => {
    try {
      const contract = getPredictionContractByAddress(m.contractAddress);
      const now = Math.floor(Date.now() / 1000);
      if (now <= m.claimExpiry) {
        toast("Claim window not expired yet", "warning");
        return;
      }
      const isResolved = m.status === 2;
      const method = isResolved ? "function reclaimUnclaimed(uint256 _marketId)" : "function reclaimUnclaimedRefunds(uint256 _marketId)";
      const tx = prepareContractCall({ contract, method, params: [BigInt(m.id)] });
      await sendAndConfirm(tx);
      toast(isResolved ? "Reclaimed unclaimed winnings" : "Reclaimed unclaimed refunds", "success");
      await refetchMarkets();
    } catch (e) {
      console.error(e);
      toast("Reclaim failed", "error");
    }
  };

  const refreshAll = async () => {
    await Promise.all([refetchFees(), refetchTreasury(), refetchMarkets()]);
    toast("Refreshed", "success");
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted">Total Platform Fees</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{feesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <Coins className="h-5 w-5 text-indigo-500" />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted">Treasury Address</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-indigo-500" />
              <code className="text-xs font-mono">
                {treasuryLoading ? "Loading..." : treasuryAddress ? `${String(treasuryAddress).slice(0,6)}...${String(treasuryAddress).slice(-4)}` : "-"}
              </code>
              <button onClick={handleCopyAddress} title="Copy"><Copy className="h-4 w-4 text-muted hover:text-foreground" /></button>
              {treasuryAddress && (
                <a className="inline-flex items-center text-xs text-blue-600 hover:underline" href={`https://sepolia.basescan.org/address/${treasuryAddress}`} target="_blank" rel="noreferrer">
                  View <ArrowUpRight className="h-3 w-3 ml-1" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted">Treasury Token Balance</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{treasuryBalance}</div>
            <Coins className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={refreshAll} className="text-xs"><RefreshCw className="h-3 w-3 mr-1" /> Refresh</Button>
        <Button onClick={withdrawAllFees} disabled={withdrawingAll || totalFees === 0} className="btn-primary text-xs">
          {withdrawingAll ? (<span className="inline-flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Withdrawing...</span>) : "Withdraw All Platform Fees"}
        </Button>
      </div>

      {/* Markets table */}
      <Card className="glass-card">
        <CardHeader className="pb-2"><CardTitle>Markets</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/80 backdrop-blur border-b">
                <tr>
                  <th className="text-left py-2 px-3">Market ID</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-right py-2 px-3">Fee Taken</th>
                  <th className="text-right py-2 px-3">Total Pool</th>
                  <th className="text-right py-2 px-3">Claimed</th>
                  <th className="text-right py-2 px-3">Unclaimed</th>
                  <th className="text-right py-2 px-3">Claim Expiry</th>
                  <th className="text-right py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingMarkets ? (
                  <tr><td colSpan={8} className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline-block" /></td></tr>
                ) : markets.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center text-muted">No markets</td></tr>
                ) : (
                  markets.map((m) => {
                    const totalPool = Number(toEther(m.distributablePool));
                    const claimed = Number(toEther(m.totalClaimedWinnings));
                    const unclaimed = Math.max(totalPool - claimed, 0);
                    const now = Math.floor(Date.now() / 1000);
                    const expired = now > m.claimExpiry;
                    const statusLabel = m.status === 2 ? "Resolved" : m.status === 3 ? "Canceled" : m.status === 1 ? "Closed" : "Active";
                    const canReclaim = expired && (m.status === 2 || m.status === 3) && unclaimed > 0;
                    return (
                      <tr key={`${m.contractAddress}-${m.id}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 px-3">{m.id}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${m.status===2?"bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200":m.status===3?"bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200":m.status===1?"bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-200":"bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200"}`}>{statusLabel}</span>
                        </td>
                        <td className="py-2 px-3 text-right">-</td>
                        <td className="py-2 px-3 text-right">{totalPool.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                        <td className="py-2 px-3 text-right">{claimed.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                        <td className="py-2 px-3 text-right">{unclaimed.toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                        <td className="py-2 px-3 text-right">{new Date(m.claimExpiry*1000).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          {canReclaim ? (
                            <Button size="sm" variant="outline" className="text-red-600 dark:text-red-400 text-xs" onClick={() => reclaim(m)}>
                              <ShieldAlert className="h-3 w-3 mr-1" /> Reclaim
                            </Button>
                          ) : (
                            <span className="text-xs text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
