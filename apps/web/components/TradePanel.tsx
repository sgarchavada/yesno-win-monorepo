"use client";

/**
 * TradePanel Component
 * Buy/Sell/Parlay trading interface
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Zap, AlertCircle } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, getContract, defineChain } from "thirdweb";
import { client } from "@/app/client";
import type { Market } from "@/lib/markets";
import { getMarket, getUSDC } from "@/lib/contracts";
import { formatPMT, formatTokens, parseUSDC, formatPercent } from "@/lib/format";
import { calculateBuyPrice, calculateSellPrice } from "@/lib/markets";
import { useMarketStore } from "@/store/useMarketStore";
import { Modal } from "./Modal";
import { EnableTradingModal } from "./EnableTradingModal";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";

interface TradePanelProps {
  market: Market;
}

export function TradePanel({ market }: TradePanelProps) {
  const account = useActiveAccount();
  const { activeTab, setActiveTab } = useMarketStore();
  
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [estimatedTokens, setEstimatedTokens] = useState("0");
  const [estimatedClaimable, setEstimatedClaimable] = useState("0");
  const [priceImpact, setPriceImpact] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));
  const [outcomeBalances, setOutcomeBalances] = useState<bigint[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showEnableTrading, setShowEnableTrading] = useState(false);
  
  // Check if user has approved USDC spending for MarketFactory (one approval for ALL markets)
  const { isApproved, needsApproval, checkApproval } = useApprovalCheck({
    targetContract: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS!,
  });

  // Check if market is active for trading
  // MarketStatus enum: 0=ACTIVE, 1=CLOSED, 2=RESOLVED, 3=CANCELED
  const now = Math.floor(Date.now() / 1000);
  const hasEnded = now >= market.endTime;
  const isActive = market.status === 0;
  const isResolved = market.resolved || market.status === 2;
  const isClosed = market.status === 1;
  const isCanceled = market.status === 3;
  
  // Trading is ONLY allowed on ACTIVE markets
  const isTradingDisabled = !isActive || hasEnded;
  
  // Determine disabled reason for UI message
  let disabledReason = "";
  if (isCanceled) {
    disabledReason = "Market has been canceled";
  } else if (isResolved) {
    disabledReason = "Market has been resolved";
  } else if (isClosed) {
    disabledReason = "Market has been closed by admin";
  } else if (hasEnded) {
    disabledReason = "Market has ended";
  }

  // Fetch user's USDC balance
  useEffect(() => {
    if (!account?.address) return;

    async function fetchBalance() {
      try {
        const usdc = getUSDC();
        const { readContract } = await import("thirdweb");
        const balance = await readContract({
          contract: usdc,
          method: "function balanceOf(address) view returns (uint256)",
          params: [account?.address || "0x0"],
        }) as bigint;
        setUserBalance(balance);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [account]);

  // Fetch user's outcome token balances
  useEffect(() => {
    if (!account?.address) {
      setOutcomeBalances([]);
      return;
    }

    async function fetchOutcomeBalances() {
      try {
        const { readContract } = await import("thirdweb");
        const { getContract } = await import("thirdweb");
        const { client } = await import("@/app/client");
        const { baseSepolia } = await import("thirdweb/chains");

        const balances = await Promise.all(
          market.outcomeTokens.map(async (tokenAddress) => {
            const tokenContract = getContract({
              client,
              chain: baseSepolia,
              address: tokenAddress,
            });
            
            const balance = await readContract({
              contract: tokenContract,
              method: "function balanceOf(address) view returns (uint256)",
              params: [account.address as `0x${string}`],
            }) as bigint;
            
            return balance;
          })
        );

        setOutcomeBalances(balances);
      } catch (error) {
        console.error("Error fetching outcome balances:", error);
        setOutcomeBalances([]);
      }
    }

    fetchOutcomeBalances();
    const interval = setInterval(fetchOutcomeBalances, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [account, market.outcomeTokens]);

  // Calculate estimated tokens and price impact
  useEffect(() => {
    async function estimate() {
      if (!amount || parseFloat(amount) <= 0) {
        setEstimatedTokens("0");
        setEstimatedClaimable("0");
        setPriceImpact("0");
        return;
      }

      try {
        // For sell, amount is in outcome tokens (18 decimals)
        // For buy/parlay, amount is in USDC (6 decimals)
        const amountWei = activeTab === "sell" 
          ? BigInt(Math.floor(parseFloat(amount) * 1e18))
          : parseUSDC(amount);
        
        if (activeTab === "buy") {
          const tokens = await calculateBuyPrice(market.address, selectedOutcome, amountWei);
          setEstimatedTokens(formatTokens(tokens));
          
          // Calculate estimated claimable amount (what user would get if this outcome wins)
          try {
            const marketContract = getContract({
              client,
              address: market.address,
              chain: defineChain(84532),
            });
            
            // Get current outcome token supply
            const outcomeTokenAddress = market.outcomeTokens[selectedOutcome];
            const outcomeTokenContract = getContract({
              client,
              address: outcomeTokenAddress,
              chain: defineChain(84532),
            });
            
            const { readContract } = await import("thirdweb");
            const currentSupply = await readContract({
              contract: outcomeTokenContract,
              method: "function totalSupply() view returns (uint256)",
              params: [],
            });
            
            // Simulate post-trade state
            const simulatedTotalSupply = currentSupply + tokens;
            
            // Convert to collateral units (6 decimals)
            const TOKEN_TO_COLLATERAL_DIV = BigInt(1e12);
            const simulatedTotalSupplyCollateral = simulatedTotalSupply / TOKEN_TO_COLLATERAL_DIV;
            const userTokensCollateral = tokens / TOKEN_TO_COLLATERAL_DIV;
            
            // Get losing reserves (sum of all OTHER outcomes)
            let losingReserves = BigInt(0);
            for (let i = 0; i < market.outcomes.length; i++) {
              if (i !== selectedOutcome) {
                // Note: Buying YES increases reserves[YES], not losing reserves
                // So losing reserves stay the same or decrease slightly due to fees
                const reserve = market.reserves?.[i] || BigInt(0);
                losingReserves += reserve;
              }
            }
            
            // Calculate estimated claimable (same logic as contract)
            let estimatedClaimableWei: bigint;
            if (losingReserves >= simulatedTotalSupplyCollateral) {
              // Full 1:1 payout
              estimatedClaimableWei = userTokensCollateral;
            } else {
              // Proportional payout
              if (simulatedTotalSupplyCollateral === BigInt(0)) {
                estimatedClaimableWei = BigInt(0);
              } else {
                estimatedClaimableWei = (userTokensCollateral * losingReserves) / simulatedTotalSupplyCollateral;
              }
            }
            
            // Format to display (6 decimals to USD)
            const estimatedClaimableUSD = Number(estimatedClaimableWei) / 1e6;
            setEstimatedClaimable(estimatedClaimableUSD.toFixed(2));
          } catch (err) {
            console.error("Error calculating estimated claimable:", err);
            setEstimatedClaimable("0");
          }
          
          // Calculate price impact for buy
          const currentPrice = market.prices[selectedOutcome] || 0;
          const amountNum = parseFloat(amount);
          
          // Convert totalReserves from bigint (6 decimals - PMT/USDC collateral) to number
          const totalLiquidity = Number(market.totalReserves) / 1e6;
          
          // Safety checks
          if (!currentPrice || !totalLiquidity || totalLiquidity === 0) {
            setPriceImpact("0");
            return;
          }
          
          // Calculate actual fee percentage from market
          const totalFeeBps = Number(market.lpFeeBps + market.protocolFeeBps);
          const feeMultiplier = 1 - (totalFeeBps / 10000);
          const afterFees = amountNum * feeMultiplier;
          
          // Estimated new reserves
          const currentReserve = totalLiquidity * (currentPrice / 100);
          const newReserve = currentReserve + afterFees;
          const newTotalReserves = totalLiquidity + afterFees;
          
          // New price
          const newPrice = (newReserve / newTotalReserves) * 100;
          
          // Price impact percentage
          const impact = ((newPrice - currentPrice) / currentPrice) * 100;
          
          // Final safety check
          if (isNaN(impact) || !isFinite(impact)) {
            setPriceImpact("0");
          } else {
            setPriceImpact(impact.toFixed(2));
          }
          
        } else if (activeTab === "sell") {
          const collateral = await calculateSellPrice(market.address, selectedOutcome, amountWei);
          setEstimatedTokens(formatPMT(collateral));
          
          // Calculate price impact for sell
          const currentPrice = market.prices[selectedOutcome] || 0;
          const tokensNum = parseFloat(amount);
          
          // Convert totalReserves from bigint (6 decimals - PMT/USDC collateral) to number
          const totalLiquidity = Number(market.totalReserves) / 1e6;
          
          // Safety checks
          if (!currentPrice || !totalLiquidity || totalLiquidity === 0) {
            setPriceImpact("0");
            return;
          }
          
          // Estimate collateral value
          const collateralValue = tokensNum * (currentPrice / 100);
          
          // Estimated new reserves
          const currentReserve = totalLiquidity * (currentPrice / 100);
          const newReserve = currentReserve - collateralValue;
          const newTotalReserves = totalLiquidity - collateralValue;
          
          // New price
          const newPrice = newTotalReserves > 0 ? (newReserve / newTotalReserves) * 100 : 0;
          
          // Price impact percentage (negative for sell)
          const impact = ((newPrice - currentPrice) / currentPrice) * 100;
          
          // Final safety check
          if (isNaN(impact) || !isFinite(impact)) {
            setPriceImpact("0");
          } else {
            setPriceImpact(impact.toFixed(2));
          }
        }
      } catch (err) {
        console.error("Error estimating:", err);
        setPriceImpact("0"); // Fallback on error
      }
    }

    estimate();
  }, [amount, selectedOutcome, activeTab, market.address, market.prices, market.totalReserves]);

  async function handleTrade() {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter an amount");
      return;
    }

    // Check approval for buy/parlay (sell doesn't need USDC approval)
    if ((activeTab === "buy" || activeTab === "parlay") && needsApproval) {
      setShowEnableTrading(true);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // For sell, amount is in outcome tokens (18 decimals)
      // For buy/parlay, amount is in USDC (6 decimals)
      const amountWei = activeTab === "sell" 
        ? BigInt(Math.floor(parseFloat(amount) * 1e18))
        : parseUSDC(amount);
      const marketContract = getMarket(market.address);

      if (activeTab === "buy") {
        // Call MarketFactory's buyFor function (user approved factory once for all markets)
        const factoryContract = getContract({
          client,
          chain: defineChain(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532")),
          address: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS!,
        });
        
        const buyTx = prepareContractCall({
          contract: factoryContract,
          method: "function buyFor(address market, uint256 outcomeIndex, uint256 collateralAmount, uint256 minOutcomeTokens)",
          params: [market.address, BigInt(selectedOutcome), amountWei, BigInt(0)],
        });
        await sendTransaction({ transaction: buyTx, account });
        
        setSuccessMessage(`Successfully bought ${estimatedTokens} ${market.outcomes[selectedOutcome]} tokens!`);
        setShowSuccessModal(true);
        setAmount("");
      } else if (activeTab === "sell") {
        const sellTx = prepareContractCall({
          contract: marketContract,
          method: "function sell(uint256 outcomeIndex, uint256 outcomeTokens, uint256 minCollateral) returns (uint256)",
          params: [BigInt(selectedOutcome), amountWei, BigInt(0)],
        });
        await sendTransaction({ transaction: sellTx, account });
        
        setSuccessMessage(`Successfully sold ${amount} ${market.outcomes[selectedOutcome]} tokens!`);
        setShowSuccessModal(true);
        setAmount("");
      } else if (activeTab === "parlay") {
        // NO approval needed - already approved via EnableTradingModal!
        const parlayTx = prepareContractCall({
          contract: marketContract,
          method: "function parlay(uint256 outcomeIndex, uint256 stake, uint256 leverage) returns (uint256)",
          params: [BigInt(selectedOutcome), amountWei, BigInt(leverage)],
        });
        await sendTransaction({ transaction: parlayTx, account });
        
        setSuccessMessage(`Parlay successful! ${leverage}x leverage applied 🚀`);
        setShowSuccessModal(true);
        setAmount("");
      }
    } catch (err: any) {
      console.error("Trade error:", err);
      setError(err?.message || "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  }

  if (!account) {
    return <ConnectWalletPrompt />;
  }

  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-6">
      {/* Market Ended/Resolved Warning */}
      {isTradingDisabled && (
        <div className={`flex items-start gap-3 p-4 border rounded-xl ${
          isCanceled 
            ? "bg-red-500/10 border-red-500/20" 
            : "bg-orange-500/10 border-orange-500/20"
        }`}>
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
            isCanceled ? "text-red-400" : "text-orange-400"
          }`} />
          <div>
            <h4 className={`text-sm font-semibold mb-1 ${
              isCanceled ? "text-red-400" : "text-orange-400"
            }`}>
              Trading Disabled
            </h4>
            <p className="text-xs text-gray-400">
              {disabledReason}. {isCanceled 
                ? "You can claim refunds in the Claims section."
                : isResolved 
                  ? "Use the Claim tab to collect winnings."
                  : "Trading is no longer available for this market."}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={`flex gap-2 bg-white/5 p-1 rounded-xl ${isTradingDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <TabButton
          active={activeTab === "buy"}
          onClick={() => setActiveTab("buy")}
          icon={<TrendingUp className="w-4 h-4" />}
        >
          Buy
        </TabButton>
        <TabButton
          active={activeTab === "sell"}
          onClick={() => setActiveTab("sell")}
          icon={<TrendingDown className="w-4 h-4" />}
        >
          Sell
        </TabButton>
        <TabButton
          active={activeTab === "parlay"}
          onClick={() => setActiveTab("parlay")}
          icon={<Zap className="w-4 h-4" />}
        >
          Parlay
        </TabButton>
      </div>

      {/* Outcome selector */}
      <div className={isTradingDisabled ? 'opacity-50 pointer-events-none' : ''}>
        <label className="text-sm text-gray-400 mb-2 block">Select Outcome</label>
        <div className="grid grid-cols-2 gap-3">
          {market.outcomes.map((outcome, index) => (
            <button
              key={index}
              onClick={() => setSelectedOutcome(index)}
              disabled={isTradingDisabled}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedOutcome === index
                  ? "border-[#00D1FF] bg-[#00D1FF]/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="text-left space-y-1">
                <div className="font-medium text-white">{outcome}</div>
                <div className="flex items-baseline justify-between">
                  <div className={`text-2xl font-bold ${
                    market.prices[index] > 50 ? "text-green-400" : "text-blue-400"
                  }`}>
                    {market.prices[index].toFixed(1)}¢
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">
                      {formatPMT(market.reserves[index])}
                    </div>
                    <div className="text-xs text-gray-500">
                      Vol: {formatPMT(market.volumes[index])}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount input */}
      <div className={isTradingDisabled ? 'opacity-50 pointer-events-none' : ''}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-400">
            {activeTab === "parlay" ? "Stake (USDC)" : activeTab === "buy" ? "Amount (USDC)" : "Tokens to Sell"}
          </label>
          {activeTab === "sell" && outcomeBalances[selectedOutcome] !== undefined && (
            <span className="text-xs text-gray-500">
              Balance: {formatTokens(outcomeBalances[selectedOutcome])}
            </span>
          )}
        </div>
        <div className="space-y-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            disabled={isTradingDisabled}
            className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-semibold focus:outline-none focus:border-[#00D1FF]/50 transition-colors disabled:cursor-not-allowed"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (activeTab === "sell") {
                  // For sell: use outcome token balance
                  const balance = outcomeBalances[selectedOutcome] || BigInt(0);
                  if (balance === BigInt(0)) return;
                  const balanceInTokens = Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18;
                  setAmount((balanceInTokens * 0.05).toFixed(2));
                } else {
                  // For buy/parlay: use USDC balance
                  if (userBalance === BigInt(0)) return;
                  const balanceInUSDC = Number(userBalance / BigInt(1e6)) + Number(userBalance % BigInt(1e6)) / 1e6;
                  setAmount((balanceInUSDC * 0.05).toFixed(2));
                }
              }}
              disabled={isTradingDisabled}
              className="flex-1 px-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed font-medium"
            >
              5%
            </button>
            <button
              onClick={() => {
                if (activeTab === "sell") {
                  const balance = outcomeBalances[selectedOutcome] || BigInt(0);
                  if (balance === BigInt(0)) return;
                  const balanceInTokens = Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18;
                  setAmount((balanceInTokens * 0.10).toFixed(2));
                } else {
                  if (userBalance === BigInt(0)) return;
                  const balanceInUSDC = Number(userBalance / BigInt(1e6)) + Number(userBalance % BigInt(1e6)) / 1e6;
                  setAmount((balanceInUSDC * 0.10).toFixed(2));
                }
              }}
              disabled={isTradingDisabled}
              className="flex-1 px-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed font-medium"
            >
              10%
            </button>
            <button
              onClick={() => {
                if (activeTab === "sell") {
                  const balance = outcomeBalances[selectedOutcome] || BigInt(0);
                  if (balance === BigInt(0)) return;
                  const balanceInTokens = Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18;
                  setAmount((balanceInTokens * 0.20).toFixed(2));
                } else {
                  if (userBalance === BigInt(0)) return;
                  const balanceInUSDC = Number(userBalance / BigInt(1e6)) + Number(userBalance % BigInt(1e6)) / 1e6;
                  setAmount((balanceInUSDC * 0.20).toFixed(2));
                }
              }}
              disabled={isTradingDisabled}
              className="flex-1 px-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed font-medium"
            >
              20%
            </button>
            <button
              onClick={() => {
                if (activeTab === "sell") {
                  const balance = outcomeBalances[selectedOutcome] || BigInt(0);
                  if (balance === BigInt(0)) return;
                  const balanceInTokens = Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18;
                  setAmount((balanceInTokens * 0.30).toFixed(2));
                } else {
                  if (userBalance === BigInt(0)) return;
                  const balanceInUSDC = Number(userBalance / BigInt(1e6)) + Number(userBalance % BigInt(1e6)) / 1e6;
                  setAmount((balanceInUSDC * 0.30).toFixed(2));
                }
              }}
              disabled={isTradingDisabled}
              className="flex-1 px-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed font-medium"
            >
              30%
            </button>
            <button
              onClick={() => {
                if (activeTab === "sell") {
                  const balance = outcomeBalances[selectedOutcome] || BigInt(0);
                  if (balance === BigInt(0)) return;
                  const balanceInTokens = Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18;
                  setAmount((balanceInTokens * 0.50).toFixed(2));
                } else {
                  if (userBalance === BigInt(0)) return;
                  const balanceInUSDC = Number(userBalance / BigInt(1e6)) + Number(userBalance % BigInt(1e6)) / 1e6;
                  setAmount((balanceInUSDC * 0.50).toFixed(2));
                }
              }}
              disabled={isTradingDisabled}
              className="flex-1 px-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed font-medium"
            >
              50%
            </button>
            <button
              onClick={() => {
                if (activeTab === "sell") {
                  const balance = outcomeBalances[selectedOutcome] || BigInt(0);
                  if (balance === BigInt(0)) return;
                  const balanceInTokens = Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18;
                  setAmount((balanceInTokens * 0.75).toFixed(2));
                } else {
                  if (userBalance === BigInt(0)) return;
                  const balanceInUSDC = Number(userBalance / BigInt(1e6)) + Number(userBalance % BigInt(1e6)) / 1e6;
                  setAmount((balanceInUSDC * 0.75).toFixed(2));
                }
              }}
              disabled={isTradingDisabled}
              className="flex-1 px-1.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-colors disabled:cursor-not-allowed font-medium"
            >
              75%
            </button>
            <button
              onClick={() => {
                if (activeTab === "sell") {
                  const balance = outcomeBalances[selectedOutcome] || BigInt(0);
                  if (balance === BigInt(0)) return;
                  const balanceInTokens = Number(balance / BigInt(1e18)) + Number(balance % BigInt(1e18)) / 1e18;
                  setAmount(balanceInTokens.toFixed(2));
                } else {
                  if (userBalance === BigInt(0)) return;
                  const balanceInUSDC = Number(userBalance / BigInt(1e6)) + Number(userBalance % BigInt(1e6)) / 1e6;
                  setAmount(balanceInUSDC.toFixed(2));
                }
              }}
              disabled={isTradingDisabled}
              className="flex-1 px-1.5 py-1.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-500/30 rounded-lg text-xs text-blue-300 hover:text-blue-200 transition-colors disabled:cursor-not-allowed font-bold"
            >
              Max
            </button>
          </div>
        </div>
      </div>

      {/* Leverage slider (Parlay only) */}
      {activeTab === "parlay" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={`space-y-3 ${isTradingDisabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Leverage</label>
            <span className="text-2xl font-bold bg-linear-to-r from-[#00D1FF] to-[#FF00AA] bg-clip-text text-transparent">
              {leverage}x
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            disabled={isTradingDisabled}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-linear-to-r [&::-webkit-slider-thumb]:from-[#00D1FF] [&::-webkit-slider-thumb]:to-[#FF00AA]"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1x</span>
            <span>2x</span>
            <span>3x</span>
            <span>4x</span>
            <span>5x</span>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-400">
            <strong>⚠️ Leveraged Position:</strong> {leverage}x leverage amplifies both gains and losses. Your downside is capped at your stake, but potential upside is multiplied.
          </div>
        </motion.div>
      )}

      {/* Estimated output */}
      {amount && parseFloat(amount) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-xl p-4 space-y-2"
        >
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You receive</span>
            <span className="text-white font-semibold">{estimatedTokens} {market.outcomes[selectedOutcome]} tokens</span>
          </div>
          {activeTab === "buy" && parseFloat(estimatedClaimable) > 0 && (
            <div className="flex justify-between text-sm bg-purple-500/10 -mx-4 px-4 py-2">
              <span className="text-purple-300 flex items-center gap-1">
                <span className="text-xs">💰</span>
                Current est. payout if {market.outcomes[selectedOutcome]} wins
              </span>
              <span className="text-purple-200 font-semibold">${estimatedClaimable}</span>
            </div>
          )}
          {activeTab === "buy" && parseFloat(amount) > 0 && parseFloat(estimatedTokens) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Avg. Price</span>
              <span className="text-gray-400">
                ${(parseFloat(amount) / parseFloat(estimatedTokens)).toFixed(4)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Price impact</span>
            <span className={`font-semibold ${
              Math.abs(parseFloat(priceImpact)) > 5 
                ? "text-red-400" 
                : Math.abs(parseFloat(priceImpact)) > 2 
                ? "text-yellow-400" 
                : "text-green-400"
            }`}>
              {parseFloat(priceImpact) > 0 ? "+" : ""}{priceImpact}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Trading fee</span>
            <span className="text-gray-400">
              {(Number(market.lpFeeBps + market.protocolFeeBps) / 100).toFixed(2)}%
            </span>
          </div>
          {activeTab === "buy" && (
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-start gap-2 text-xs text-gray-400">
                <span className="text-blue-400">ℹ️</span>
                <span>
                  <span className="text-gray-300 font-medium">AMM Payout Model:</span> Winners are paid from losing outcome reserves. 
                  Your claimable amount updates live with every trade and depends on the losing pool reserves at resolution time.
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Sell Warning - No tokens */}
      {activeTab === "sell" && outcomeBalances[selectedOutcome] === BigInt(0) && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
          <AlertCircle className="w-4 h-4" />
          <span>You don&apos;t own any {market.outcomes[selectedOutcome]} tokens. Buy some first to sell.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Trade button */}
      <button
        onClick={handleTrade}
        disabled={
          isLoading || 
          !amount || 
          parseFloat(amount) <= 0 || 
          isTradingDisabled ||
          (activeTab === "sell" && outcomeBalances[selectedOutcome] === BigInt(0))
        }
        className="w-full py-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isTradingDisabled
          ? (isResolved ? "Market Resolved" : "Market Ended")
          : isLoading 
            ? "Processing..." 
            : activeTab === "parlay" 
              ? `Open ${leverage}x Parlay` 
              : activeTab === "buy" 
                ? "Buy Tokens" 
                : "Sell Tokens"}
      </button>

      {/* Help text */}
      <p className="text-xs text-gray-500 text-center">
        {activeTab === "parlay"
          ? `${leverage}x leveraged position with capped downside and amplified upside.`
          : activeTab === "buy"
            ? "You'll need USDC in your wallet. Tokens represent shares of this outcome."
            : "Sell your outcome tokens back to the pool for USDC."}
      </p>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Trade Successful!"
        message={successMessage}
        type="success"
        confirmText="Great!"
        showCancel={false}
      />

      {/* Enable Trading Modal */}
      <EnableTradingModal
        isOpen={showEnableTrading}
        onClose={() => setShowEnableTrading(false)}
        onSuccess={() => {
          checkApproval(); // Recheck approval status
          setShowEnableTrading(false);
          // Automatically retry the trade after approval
          setTimeout(() => handleTrade(), 500);
        }}
        targetContract={process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS!}
        purpose="trading"
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
        active
          ? "bg-linear-to-r from-[#00D1FF] to-[#FF00AA] text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function ConnectWalletPrompt() {
  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-semibold text-white">Connect Your Wallet</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Connect your wallet to start trading outcome tokens on this market
        </p>
      </div>
    </div>
  );
}

