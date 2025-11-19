
import { useState, useEffect } from "react";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { readContract, prepareContractCall, toEther } from "thirdweb";
import { getPredictionContractByAddress } from "@/constants/contracts";
import { predictionContracts } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import ResolveMarketModal from "./ResolveMarketModal";

interface Market {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  startTime: number;
  endTime: number;
  status: number;
  outcome: number;
  resolved: boolean;
  version: string;
  contractAddress: `0x${string}`;
  totalOptionAShares: number;
  totalOptionBShares: number;
  resolutionType?: number; // 0 manual, 1 oracle
}

export default function ManageMarkets() {
  const { toast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelTargetAddress, setCancelTargetAddress] = useState<`0x${string}` | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  // const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  const [activeVersion, setActiveVersion] = useState<string>(predictionContracts[0].version);

  // Fetch all markets from all configured contracts
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const all: Market[] = [];
        for (const { version, address } of predictionContracts) {
          // get count (support both names)
          const counts = [
            "function getMarketCount() view returns (uint256)",
            "function marketCount() view returns (uint256)",
          ] as const;
          let count = 0;
          for (const sig of counts) {
            try {
              const c = (await readContract({
                contract: getPredictionContractByAddress(address),
                method: sig,
                params: [],
              })) as number | bigint;
              count = Number(c || 0);
              if (count >= 0) break;
            } catch {}
          }

          const per = await Promise.all(
            Array.from({ length: count }, async (_, i) => {
              const contract = getPredictionContractByAddress(address);
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
                  question: String(core[0]),
                  startTime: Number(core[1]),
                  endTime: Number(core[2]),
                  status: Number(core[3]),
                  outcome: Number(core[4]),
                  resolutionType: Number(core[5] as number | string | bigint),
                  optionA: String(core[6]),
                  optionB: String(core[7]),
                  totalOptionAShares: Number(toEther(BigInt(stats[0] as number | string | bigint))),
                  totalOptionBShares: Number(toEther(BigInt(stats[1] as number | string | bigint))),
                  resolved: Boolean(stats[5]),
                  version,
                  contractAddress: address,
                } as Market;
              } catch {
                return null;
              }
            })
          );
          all.push(...per.filter((m): m is Market => m !== null));
        }

        setMarkets(all);
      } catch (error) {
        console.error("Error fetching markets:", error);
        toast("Failed to fetch markets", "error");
      } finally {
        setLoading(false);
      }
    };

    void fetchAll();
  }, [toast]);

  const getStatusBadge = (market: Market) => {
    const now = Math.floor(Date.now() / 1000);
    // Prefer contract status first
    if (market.status === 3) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Canceled</Badge>;
    }
    if (market.status === 2) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Resolved</Badge>;
    }
    // Fallback to time-based for Active/Closed/Pending
    if (now < market.startTime) {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>
          <div className="text-xs text-muted/70">{market.startTime - now}s until start</div>
        </div>
      );
    }
    if (now > market.endTime) {
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Closed</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
  };

  const canResolve = (market: Market) => {
    // Disable for canceled
    if (market.status === 3) return false;
    return !market.resolved;
  };

  const canCancel = (market: Market) => {
    return !market.resolved;
  };

  // Close action removed per requirements; admin resolves or cancels only

  const handleCancelMarket = async (marketId: number, contractAddress: `0x${string}`) => {
    setIsCanceling(true);
    try {
      const transaction = prepareContractCall({
        contract: getPredictionContractByAddress(contractAddress),
        method: "function cancelMarket(uint256 _marketId)",
        params: [BigInt(marketId)],
      });
      // Wait for confirmation to avoid false UI states
      await sendAndConfirm(transaction);
      toast("Market canceled successfully", "success");
      // Refetch the single market via core+stats to reflect authoritative status
      const contract = getPredictionContractByAddress(contractAddress);
      let refreshed: { status?: number; resolved?: boolean } = {};
      try {
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
        refreshed = { status: Number(core[3] as number | string | bigint), resolved: Boolean(stats[5]) };
      } catch {}
      setMarkets((prev) =>
        prev.map((m) => (m.id === marketId && m.contractAddress === contractAddress ? { ...m, ...refreshed } : m))
      );
      setCancelModalOpen(false);
      setCancelTargetId(null);
    } catch (error) {
      console.error("Error canceling market:", error);
      toast("Failed to cancel market", "error");
    } finally {
      setIsCanceling(false);
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Manage Markets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const filtered = markets.filter(m => m.version === activeVersion);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Manage Markets ({filtered.length})</CardTitle>
          <div className="glass rounded-xl p-1 inline-flex">
            {predictionContracts.map((c) => (
              <button
                key={c.version}
                onClick={() => setActiveVersion(c.version)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeVersion === c.version ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-glow" : "text-muted hover:text-foreground"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted">Question</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted">Start Time</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted">End Time</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted">Outcome</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted">Resolution</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted">Total Votes</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted">
                    No markets found
                  </td>
                </tr>
              ) : (
                filtered.map((market) => (
                  <tr
                    key={market.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="max-w-md">
                        <p className="text-sm font-medium text-foreground line-clamp-1">{market.question}</p>
                        <p className="text-xs text-muted mt-1">
                          {market.optionA} / {market.optionB}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(market)}</td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="text-sm text-muted">
                          {new Date(market.startTime * 1000).toLocaleString()}
                        </span>
                        <div className="text-xs text-muted/70">
                          (Unix: {market.startTime})
                        </div>
                        <div className="text-xs text-blue-500 dark:text-blue-400">
                          Now: {Math.floor(Date.now() / 1000)}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted">
                        {new Date(market.endTime * 1000).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {market.resolved ? (
                        <span className="text-sm font-medium">
                          {market.outcome === 0 ? market.optionA : market.optionB}
                        </span>
                      ) : (
                        <span className="text-sm text-muted">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className="text-xs">
                        {(market.resolutionType ?? 0) === 0 ? "Manual" : "Oracle"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{market.totalOptionAShares + market.totalOptionBShares}</span>
                        <span className="text-xs text-muted ml-2">A: {market.totalOptionAShares} · B: {market.totalOptionBShares}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Close action removed */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMarket(market);
                            setResolveModalOpen(true);
                          }}
                          disabled={!canResolve(market)}
                          className="text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!canCancel(market)) return;
                            setCancelTargetId(market.id);
                            setCancelTargetAddress(market.contractAddress);
                            setCancelModalOpen(true);
                          }}
                          disabled={!canCancel(market)}
                          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      {selectedMarket && (
        <ResolveMarketModal
          open={resolveModalOpen}
          onOpenChange={setResolveModalOpen}
          marketId={selectedMarket.id}
          question={selectedMarket.question}
          optionA={selectedMarket.optionA}
          optionB={selectedMarket.optionB}
          contractAddress={selectedMarket.contractAddress}
          onSuccess={() => {
            // Refresh markets after resolution
            setMarkets((prev) =>
              prev.map((m) => (m.id === selectedMarket.id && m.contractAddress === selectedMarket.contractAddress ? { ...m, resolved: true } : m))
            );
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={(o) => { if (!isCanceling) setCancelModalOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Market</DialogTitle>
            <DialogDescription>
              This action will permanently cancel the market and prevent further trading.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-muted">
            Are you sure you want to cancel this market?
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              disabled={isCanceling}
            >
              Keep Market
            </Button>
            <Button
              onClick={() => cancelTargetId !== null && cancelTargetAddress && handleCancelMarket(cancelTargetId, cancelTargetAddress)}
              disabled={isCanceling || cancelTargetId === null || !cancelTargetAddress}
              className="btn-primary"
            >
              {isCanceling ? (
                <span className="inline-flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </span>
              ) : (
                "Confirm Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


