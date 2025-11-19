
/**
 * Market Detail Page
 * Full market view with trading, liquidity, and claim interfaces
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, TrendingUp, Activity, ExternalLink, AlertCircle } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { getMarketDetails, getOutcomeBalance, type Market } from "@/lib/markets";
import { getMarket } from "@/lib/contracts";
import { useMarketStore } from "@/store/useMarketStore";
import { formatPMT, formatPercent, shortenAddress, formatTokens } from "@/lib/format";
import { getErrorTitle, formatErrorMessage } from "@/lib/errorHandler";
import { TradePanel } from "@/components/TradePanel";
import { LiquidityPanel } from "@/components/LiquidityPanel";
import { ClaimPanel } from "@/components/ClaimPanel";
import { ClaimsPanel } from "@/components/ClaimsPanel";
import { OraclePanel } from "@/components/OraclePanel";
import { PriceChart } from "@/components/PriceChart";
import { Modal } from "@/components/Modal";
import { MarketProvider } from "@/contexts/MarketContext";

export default function MarketDetailPage() {
  const params = useParams();
  const marketAddress = params.id as string;
  
  return (
    <MarketProvider marketAddress={marketAddress}>
      <MarketDetailContent />
    </MarketProvider>
  );
}

function MarketDetailContent() {
  const params = useParams();
  const marketAddress = params.id as string;
  const account = useActiveAccount();
  
  const { selectedMarket, setSelectedMarket } = useMarketStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trade" | "liquidity" | "claim" | "oracle">("trade");
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);
  const [userHasLPTokens, setUserHasLPTokens] = useState(false);
  const [checkingLPTokens, setCheckingLPTokens] = useState(true);

  // Fetch market details
  useEffect(() => {
    async function fetchMarket(showLoading = false) {
      // Only show loading state on initial load
      if (showLoading) {
        setIsLoading(true);
      }
      
      try {
        const market = await getMarketDetails(marketAddress);
        if (market) {
          setSelectedMarket(market);
        }
      } catch (error) {
        console.error("Error fetching market:", error);
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    }

    // Initial load with loading state
    fetchMarket(true);
    
    // Silent refresh every 10 seconds
    const interval = setInterval(() => fetchMarket(false), 10000);
    return () => clearInterval(interval);
  }, [marketAddress, setSelectedMarket]);

  // Auto-switch to Oracle tab when market is resolved (only on initial load or market change)
  useEffect(() => {
    if (selectedMarket && !hasSetInitialTab) {
      if (selectedMarket.resolved || selectedMarket.status === 2) {
        setActiveTab("oracle");
      } else {
        setActiveTab("trade");
      }
      setHasSetInitialTab(true);
    }
  }, [selectedMarket, hasSetInitialTab]);

  // Reset tab state when navigating to a different market
  useEffect(() => {
    setHasSetInitialTab(false);
  }, [marketAddress]);

  // Check if user has LP tokens
  useEffect(() => {
    async function checkLPBalance() {
      if (!account || !selectedMarket) {
        setCheckingLPTokens(false);
        setUserHasLPTokens(false);
        return;
      }

      try {
        const marketContract = getMarket(selectedMarket.address);
        const lpTokenAddress = await readContract({
          contract: marketContract,
          method: "function lpToken() view returns (address)",
          params: [],
        });

        const lpTokenContract = getMarket(lpTokenAddress as string);
        const balance = await readContract({
          contract: lpTokenContract,
          method: "function balanceOf(address) view returns (uint256)",
          params: [account.address],
        });

        const hasTokens = (balance as bigint) > BigInt(0);
        setUserHasLPTokens(hasTokens);
        console.log("🔍 User LP check:", hasTokens ? "Has LP tokens" : "No LP tokens");
      } catch (err) {
        console.error("Error checking LP balance:", err);
        setUserHasLPTokens(false);
      } finally {
        setCheckingLPTokens(false);
      }
    }

    checkLPBalance();
  }, [account, selectedMarket]);

  if (isLoading || !selectedMarket) {
    return <LoadingState />;
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back button */}
        <Link to="/">
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors pb-2">
            <ArrowLeft className="w-5 h-5" />
            Back to Markets
          </button>
        </Link>

        {/* Market header */}
        <MarketHeader market={selectedMarket} />

        {/* Claims Panel (Refunds & LP Fees) */}
        <ClaimsPanel market={selectedMarket} />

        {/* Main Content - Chart Left, Trading Right (Polymarket style) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side - Chart and Stats */}
          <div className="lg:col-span-8 space-y-6">
            {/* Price Chart */}
            <PriceChart market={selectedMarket} />
            
            {/* User Positions */}
            <UserPositionsPanel market={selectedMarket} />
            
            {/* Stats Panel */}
            <StatsPanel market={selectedMarket} />
          </div>

          {/* Right Side - Trading Panel with Tabs */}
          <div className="lg:col-span-4 space-y-4">
            {/* Tabs */}
            <div className="flex gap-2 bg-[#13131A] p-1 rounded-xl border border-white/10">
              <TabButton active={activeTab === "trade"} onClick={() => setActiveTab("trade")}>
                Trade
              </TabButton>
              <div className="relative flex-1 group">
                <TabButton 
                  active={activeTab === "liquidity"} 
                  onClick={() => {
                    if (userHasLPTokens || !account) {
                      setActiveTab("liquidity");
                    }
                  }}
                  disabled={!checkingLPTokens && account && !userHasLPTokens}
                >
                  Liquidity
                </TabButton>
                {!checkingLPTokens && account && !userHasLPTokens && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-white/10">
                    You don't have any LP tokens in this market
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </div>
              <TabButton active={activeTab === "oracle"} onClick={() => setActiveTab("oracle")}>
                Oracle
              </TabButton>
            </div>

            {/* Tab Content - Sticky on scroll */}
            <div className="lg:sticky lg:top-4">
              {activeTab === "trade" && <TradePanel market={selectedMarket} />}
              {activeTab === "liquidity" && <LiquidityPanel market={selectedMarket} />}
              {activeTab === "claim" && <ClaimPanel market={selectedMarket} />}
              {activeTab === "oracle" && <OraclePanel market={selectedMarket} />}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function CountdownTimer({ endTime }: { endTime: bigint }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(endTime);
      const diff = end - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
      };
    };

    const updateTime = () => setTimeLeft(calculateTimeLeft());
    updateTime(); // Initial call
    
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  if (!timeLeft) return <span>Loading...</span>;

  const hasEnded = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (hasEnded) {
    return <span className="text-orange-400">Market has ended</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {timeLeft.days > 0 && (
        <div className="flex items-baseline gap-1">
          <span className="text-white font-bold text-lg">{timeLeft.days}</span>
          <span className="text-xs text-gray-500 uppercase">day{timeLeft.days !== 1 ? 's' : ''}</span>
        </div>
      )}
      <div className="flex items-baseline gap-1">
        <span className="text-white font-bold text-lg">{timeLeft.hours}</span>
        <span className="text-xs text-gray-500 uppercase">hrs</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-white font-bold text-lg">{timeLeft.minutes}</span>
        <span className="text-xs text-gray-500 uppercase">min</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-white font-bold text-lg">{timeLeft.seconds}</span>
        <span className="text-xs text-gray-500 uppercase">sec</span>
      </div>
    </div>
  );
}

function MarketHeader({ market }: { market: Market }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const hasEnded = now >= Number(market.endTime);
  const isResolved = market.resolved || market.status === 2;
  const isCanceled = market.status === 3; // MarketStatus.CANCELED = 3
  
  // Determine status (MarketStatus enum: 0=ACTIVE, 1=CLOSED, 2=RESOLVED, 3=CANCELED)
  let status = "Active";
  let statusColor = "bg-green-500/10 text-green-400 border-green-500/20";
  
  if (isCanceled) {
    status = "Canceled";
    statusColor = "bg-red-500/10 text-red-400 border-red-500/20";
  } else if (isResolved) {
    status = "Resolved";
    statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  } else if (market.status === 1) {
    status = "Closed";
    statusColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  } else if (hasEnded && market.status === 0) {
    status = "Ended";
    statusColor = "bg-orange-500/10 text-orange-400 border-orange-500/20";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-linear-to-br from-[#13131A] to-[#1A1A24] border border-white/10 rounded-2xl p-8 backdrop-blur-lg"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-white">{market.question}</h1>
          <span className={`px-4 py-2 rounded-full text-sm font-medium border ${statusColor}`}>
            {status}
          </span>
        </div>

        {!isCanceled && (
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <CountdownTimer endTime={market.endTime} />
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Liquidity: {formatPMT(market.totalReserves)}</span>
            </div>
          </div>
        )}
        
        {isCanceled && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span>Liquidity: {formatPMT(market.totalReserves)}</span>
          </div>
        )}

        {/* Cancellation Reason Banner */}
        {isCanceled && market.cancellationReason && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mt-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-400 mb-1">
                🚫 Market Canceled
              </h4>
              <p className="text-sm text-gray-300 mb-2">
                {market.cancellationReason}
              </p>
              <p className="text-xs text-gray-400">
                All participants can claim refunds for their positions.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function UserPositionsPanel({ market }: { market: Market }) {
  const account = useActiveAccount();
  const [positions, setPositions] = useState<{ outcomeIndex: number; balance: bigint }[]>([]);
  const [claimedAmount, setClaimedAmount] = useState<bigint>(BigInt(0));
  const [actualClaimableAmounts, setActualClaimableAmounts] = useState<{ [key: number]: bigint }>({});
  const [loading, setLoading] = useState(true);
  const [claimLoading, setClaimLoading] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"success" | "danger">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const showSuccess = (title: string, message: string) => {
    setModalType("success");
    setModalTitle(title);
    setModalMessage(message);
    setShowModal(true);
  };

  const showError = (error: any) => {
    setModalType("danger");
    setModalTitle(getErrorTitle(error));
    setModalMessage(formatErrorMessage(error));
    setShowModal(true);
  };

  const handleClaimWinnings = async (outcomeIndex: number, balance: bigint) => {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    setClaimLoading(outcomeIndex);
    try {
      const marketContract = getMarket(market.address);
      const tx = prepareContractCall({
        contract: marketContract,
        method: "function claim()",
        params: [],
      });

      await sendTransaction({ transaction: tx, account });

      // Use actual claimable amount if available, otherwise estimate
      const actualClaimable = actualClaimableAmounts[outcomeIndex];
      const claimAmount = actualClaimable 
        ? Number(actualClaimable) / 1e6  // USDC has 6 decimals
        : Number(balance) / 1e18;  // Fallback estimate
      
      showSuccess(
        "Winnings Claimed! 🎉",
        `Successfully claimed $${claimAmount.toFixed(2)} from your winning position!`
      );

      // Refresh the page to update balances
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error("Error claiming winnings:", error);
      showError(error);
    } finally {
      setClaimLoading(null);
    }
  };

  useEffect(() => {
    if (!account?.address) {
      setPositions([]);
      setLoading(false);
      return;
    }

    async function fetchPositions() {
      if (!account?.address) return;
      
      try {
        const balances = await Promise.all(
          market.outcomeTokens.map(async (tokenAddress, index) => {
            const balance = await getOutcomeBalance(tokenAddress, account.address);
            return { outcomeIndex: index, balance };
          })
        );

        // Fetch claimed amount if market is resolved
        if (market.resolved || market.status === 2) {
          const marketContract = getMarket(market.address);
          const claimed = await readContract({
            contract: marketContract as any,
            method: "function partialClaimAmounts(address) view returns (uint256)",
            params: [account.address],
          } as any);
          setClaimedAmount((claimed as unknown) as bigint);
        }

        // Fetch actual claimable amounts from contract (v22+)
        // This is dynamic and changes with every trade!
        const marketContract = getMarket(market.address);
        const claimableAmounts = (await readContract({
          contract: marketContract as any,
          method: "function getAllClaimableAmounts(address) view returns (uint256[])",
          params: [account.address],
        } as any)) as unknown as bigint[];

        // Convert array to map for easy lookup
        const claimableMap: { [key: number]: bigint } = {};
        claimableAmounts.forEach((amount, index) => {
          claimableMap[index] = amount;
        });
        
        setActualClaimableAmounts(claimableMap);

        // Only show positions with non-zero balances
        const nonZeroPositions = balances.filter(p => p.balance > BigInt(0));
        setPositions(nonZeroPositions);
      } catch (error) {
        console.error("Error fetching positions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPositions();
    const interval = setInterval(fetchPositions, 10000); // Update every 10s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, market.outcomeTokens, market.address]);

  // Don't show if user has no positions and hasn't claimed anything
  if (!account || (positions.length === 0 && claimedAmount === BigInt(0))) {
    return null;
  }

  if (loading) {
    return null;
  }

  // Calculate totals
  const totalCurrentValue = positions.reduce((sum, { outcomeIndex, balance }) => {
    const currentPrice = market.prices[outcomeIndex];
    return sum + (Number(balance) / 1e18 * (currentPrice / 100));
  }, 0);

  const totalPotentialValue = positions.reduce((sum, { balance }) => {
    return sum + (Number(balance) / 1e18);
  }, 0);

  const totalProfit = totalPotentialValue - totalCurrentValue;

  // Sort by current value (largest first)
  const sortedPositions = [...positions].sort((a, b) => {
    const valueA = Number(a.balance) / 1e18 * (market.prices[a.outcomeIndex] / 100);
    const valueB = Number(b.balance) / 1e18 * (market.prices[b.outcomeIndex] / 100);
    return valueB - valueA;
  });

  // Check if market is resolved
  const isResolved = market.resolved;
  const winningOutcome = market.winningOutcome;

  return (
    <>
      <div className="bg-linear-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Your Positions
          </h3>
          {isResolved && (
            <div className="text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
              Winners paid from losing reserves
            </div>
          )}
        </div>

        {/* Dynamic Claimable Info Banner */}
        {!isResolved && positions.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-purple-300 bg-purple-500/5 rounded-lg p-3 border border-purple-500/20">
            <span className="text-purple-400">ℹ️</span>
            <span>
              <strong>Claimable amounts update live</strong> with every trade. Your payout depends on the losing outcome&apos;s reserves at resolution time.
            </span>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">Market Value</div>
              <div className="text-xl font-bold text-white">${totalCurrentValue.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Total Profit (if wins)</div>
              <div className={`text-xl font-bold ${totalProfit > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                {totalProfit > 0 ? '+' : ''}${totalProfit.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Positions List - Scrollable */}
        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 scrollbar">
          {sortedPositions.map(({ outcomeIndex, balance }) => {
            const outcomeName = market.outcomes[outcomeIndex];
            const currentPrice = market.prices[outcomeIndex];
            const currentValue = Number(balance) / 1e18 * (currentPrice / 100);
            const isWinner = isResolved && winningOutcome === outcomeIndex;
            
            // Always use actual claimable amount (dynamic, updates with every trade!)
            const actualClaimable = actualClaimableAmounts[outcomeIndex];
            const potentialPayout = actualClaimable 
              ? Number(actualClaimable) / 1e6  // USDC has 6 decimals
              : Number(balance) / 1e18;  // Fallback to 1:1 if calculation pending
            
            const profit = potentialPayout - currentValue;

            return (
              <div
                key={outcomeIndex}
                className={`bg-white/5 border rounded-xl p-3 hover:bg-white/10 transition-all ${
                  isWinner ? 'border-green-500/50 bg-green-500/5' : 'border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{outcomeName}</span>
                    {isResolved && (
                      <>
                        {isWinner ? (
                          <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-400 font-medium">
                            Winner 🎉
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full text-xs text-red-400 font-medium">
                            Lost ✗
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-xs text-purple-400">{formatPercent(currentPrice)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <div className="text-gray-500">Held</div>
                    <div className="text-white font-medium">{formatTokens(balance)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Market Value</div>
                    <div className="text-white font-medium">${currentValue.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 flex items-center gap-1">
                      {isResolved ? 'Claimable' : 'If Wins'}
                      {!isResolved && <span className="text-xs text-purple-400">(Live)</span>}
                    </div>
                    <div className="text-green-400 font-medium">${potentialPayout.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Profit</div>
                    <div className={`font-bold ${profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profit > 0 ? '+' : ''}${profit.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Claim Button for Winners */}
                {isWinner && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400 text-center">
                      Paid from losing outcome reserves
                    </div>
                    <button
                      onClick={() => handleClaimWinnings(outcomeIndex, balance)}
                      disabled={claimLoading === outcomeIndex}
                      className="w-full py-2 bg-linear-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-sm"
                    >
                      {claimLoading === outcomeIndex ? "Claiming..." : `Claim $${potentialPayout.toFixed(2)}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Show claimed amount if user has claimed winnings */}
          {claimedAmount > BigInt(0) && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <span className="text-xl">✓</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-green-400 font-semibold mb-1">
                    Winnings Claimed
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatPMT(claimedAmount)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Successfully claimed from winning position
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-center text-gray-500">
          {positions.length > 0 && `${positions.length} position${positions.length !== 1 ? 's' : ''}`}
          {positions.length > 0 && claimedAmount > BigInt(0) && ' • '}
          {claimedAmount > BigInt(0) && 'Claimed winnings shown'}
          {positions.length === 0 && claimedAmount === BigInt(0) && 'No positions'}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
      />
    </>
  );
}

function StatsPanel({ market }: { market: Market }) {
  const totalFee = Number(market.lpFeeBps + market.protocolFeeBps) / 100;
  
  // Use actual volume data from contract (6 decimals for USDC/PMT)
  const tradingVolume = Number(market.totalVolume) / 1e6;
  const totalFeesCollected = Number(market.accumulatedFees + market.accumulatedProtocolFees) / 1e6;
  
  // For RESOLVED markets, calculate separately for winners and LPs
  const isResolved = market.resolved || market.status === 2;
  let availableForWinners = 0;
  let availableForLPs = 0;
  let totalLiquidity = 0;
  
  if (isResolved && market.winningOutcome !== undefined) {
    // Winners are paid from LOSING outcome reserves
    for (let i = 0; i < market.reserves.length; i++) {
      if (i !== market.winningOutcome) {
        availableForWinners += Number(market.reserves[i]) / 1e6;
      }
    }
    // LPs get WINNING outcome reserves + accumulated fees
    availableForLPs = Number(market.reserves[market.winningOutcome]) / 1e6 + Number(market.accumulatedFees) / 1e6;
    totalLiquidity = availableForWinners + availableForLPs;
  } else {
    // For active/canceled markets, use totalReserves
    totalLiquidity = Number(market.totalReserves + market.accumulatedFees) / 1e6;
  }
  
  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Market Stats</h3>
      
      {/* Trading Activity */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
          <Activity className="w-4 h-4" />
          Trading Activity
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Total Volume</span>
          <span className="text-white font-bold">
            {tradingVolume > 0 ? `$${tradingVolume.toFixed(2)}` : "$0.00"}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Fees Collected</span>
          <span className="text-green-400 font-medium text-sm">
            ${totalFeesCollected.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Market Info */}
      <div className="space-y-3 text-sm">
        {isResolved ? (
          <>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2">
              <div className="text-xs text-purple-300 font-medium mb-2">Resolved Market Breakdown</div>
              <StatRow 
                label="Available for Winners" 
                value={`$${availableForWinners.toFixed(2)}`}
                valueColor="text-green-400"
              />
              <StatRow 
                label="Available for LPs" 
                value={`$${availableForLPs.toFixed(2)}`}
                valueColor="text-blue-400"
              />
              <div className="pt-2 border-t border-purple-500/20">
                <StatRow 
                  label="Total Remaining" 
                  value={`$${totalLiquidity.toFixed(2)}`}
                  valueColor="text-white font-bold"
                />
              </div>
            </div>
          </>
        ) : (
          <StatRow label="Total Liquidity" value={`$${totalLiquidity.toFixed(2)}`} />
        )}
        <StatRow label="Trading Fee" value={`${totalFee}%`} />
        <StatRow 
          label="Market Address" 
          value={shortenAddress(market.address)}
          link={`https://sepolia.basescan.org/address/${market.address}`}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value, link, valueColor }: { label: string; value: string; link?: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors font-medium"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className={valueColor || "text-white font-medium"}>{value}</span>
      )}
    </div>
  );
}


function TabButton({
  active,
  onClick,
  children,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
        disabled
          ? "text-gray-600 cursor-not-allowed opacity-50"
          : active
          ? "bg-linear-to-r from-[#00D1FF] to-[#FF00AA] text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-[#00D1FF] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400">Loading market...</p>
      </div>
    </main>
  );
}
