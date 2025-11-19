"use client";

/**
 * Advanced Trade Panel - Polymarket-style Trading Interface
 * Features:
 * - Real-time price impact calculation
 * - Slippage protection
 * - Trade size recommendations
 * - Order preview & confirmation
 * - User position tracking
 * - Recent trades feed
 * - All edge case handling
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Settings,
  Clock,
  XCircle,
} from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import type { Market } from "@/lib/markets";
import { getMarket, getUSDC } from "@/lib/contracts";
import { formatPMT, formatTokens, parseUSDC, formatPercent } from "@/lib/format";

interface AdvancedTradePanelProps {
  market: Market;
}

export function AdvancedTradePanel({ market }: AdvancedTradePanelProps) {
  const account = useActiveAccount();

  // Trade state
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [amount, setAmount] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState(1); // 1% default
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);

  // Calculation state
  const [estimatedOutput, setEstimatedOutput] = useState("0");
  const [priceImpact, setPriceImpact] = useState(0);
  const [executionPrice, setExecutionPrice] = useState(0);
  const [minReceived, setMinReceived] = useState("0");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState("");
  const [userBalance, setUserBalance] = useState("0");
  const [userPosition, setUserPosition] = useState<{[key: number]: string}>({});

  // Market state checks
  const now = Math.floor(Date.now() / 1000);
  const hasEnded = now >= market.endTime;
  const isResolved = market.resolved;
  const isTradingDisabled = hasEnded || isResolved;

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      if (!account) return;

      try {
        const usdc = getUSDC();
        const marketContract = getMarket(market.address);

        // Get USDC balance
        const balance = await readContract({
          contract: usdc,
          method: "function balanceOf(address) view returns (uint256)",
          params: [account.address as `0x${string}`],
        });
        setUserBalance(balance.toString());

        // Get user positions for each outcome
        const positions: {[key: number]: string} = {};
        for (let i = 0; i < market.outcomes.length; i++) {
          const position = await readContract({
            contract: marketContract,
            method: "function balanceOf(address, uint256) view returns (uint256)",
            params: [account.address as `0x${string}`, BigInt(i)],
          });
          positions[i] = position.toString();
        }
        setUserPosition(positions);
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    }

    fetchUserData();
    const interval = setInterval(fetchUserData, 10000);
    return () => clearInterval(interval);
  }, [account, market.address, market.outcomes.length]);

  // Calculate trade details
  useEffect(() => {
    async function calculateTradeDetails() {
      if (!amount || parseFloat(amount) <= 0) {
        setEstimatedOutput("0");
        setPriceImpact(0);
        setExecutionPrice(0);
        setMinReceived("0");
        return;
      }

      try {
        const amountWei = parseUSDC(amount);
        const marketContract = getMarket(market.address);

        if (activeTab === "buy") {
          // Calculate buy price
          const result = await readContract({
            contract: marketContract,
            method: "function calculateBuyPrice(uint256 outcomeIndex, uint256 collateralAmount) view returns (uint256 outcomeTokenAmount)",
            params: [BigInt(selectedOutcome), amountWei],
          });

          const outputTokens = result.toString();
          setEstimatedOutput(outputTokens);

          // Calculate price impact
          const currentPrice = market.prices[selectedOutcome];
          const avgPrice = Number(amountWei) / Number(outputTokens);
          const impact = ((avgPrice - currentPrice) / currentPrice) * 100;
          setPriceImpact(impact);
          setExecutionPrice(avgPrice);

          // Calculate min received with slippage
          const minTokens = (Number(outputTokens) * (100 - slippageTolerance)) / 100;
          setMinReceived(Math.floor(minTokens).toString());
        } else {
          // Calculate sell price
          const result = await readContract({
            contract: marketContract,
            method: "function calculateSellPrice(uint256 outcomeIndex, uint256 outcomeTokenAmount) view returns (uint256 collateralAmount)",
            params: [BigInt(selectedOutcome), amountWei], // For sell, amount is in outcome tokens
          });

          const outputCollateral = result.toString();
          setEstimatedOutput(outputCollateral);

          // Calculate price impact
          const currentPrice = market.prices[selectedOutcome];
          const avgPrice = Number(outputCollateral) / Number(amountWei);
          const impact = ((currentPrice - avgPrice) / currentPrice) * 100;
          setPriceImpact(impact);
          setExecutionPrice(avgPrice);

          // Calculate min received with slippage
          const minCollateral = (Number(outputCollateral) * (100 - slippageTolerance)) / 100;
          setMinReceived(Math.floor(minCollateral).toString());
        }
      } catch (err) {
        console.error("Error calculating trade:", err);
      }
    }

    calculateTradeDetails();
  }, [amount, activeTab, selectedOutcome, market, slippageTolerance]);

  // Get price impact severity
  const priceImpactSeverity = useMemo(() => {
    if (priceImpact < 1) return { level: "low", color: "text-green-400", bgColor: "bg-green-500/10" };
    if (priceImpact < 5) return { level: "medium", color: "text-yellow-400", bgColor: "bg-yellow-500/10" };
    if (priceImpact < 15) return { level: "high", color: "text-orange-400", bgColor: "bg-orange-500/10" };
    return { level: "extreme", color: "text-red-400", bgColor: "bg-red-500/10" };
  }, [priceImpact]);

  // Calculate recommended max trade size (10% of liquidity)
  const recommendedMaxSize = useMemo(() => {
    const totalLiquidity = market.totalReserves;
    const maxSize = Number(totalLiquidity) * 0.1 / 1e6; // 10% in USDC
    return maxSize.toFixed(2);
  }, [market.totalReserves]);

  // Handle trade execution
  async function executeTrade() {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter an amount");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const marketContract = getMarket(market.address);
      const usdc = getUSDC();
      const amountWei = parseUSDC(amount);

      if (activeTab === "buy") {
        // Check and approve USDC
        const allowance = await readContract({
          contract: usdc,
          method: "function allowance(address, address) view returns (uint256)",
          params: [account.address as `0x${string}`, market.address as `0x${string}`],
        });

        if (BigInt(allowance.toString()) < amountWei) {
          const approveTx = prepareContractCall({
            contract: usdc,
            method: "function approve(address spender, uint256 amount) returns (bool)",
            params: [market.address as `0x${string}`, amountWei],
          });
          await sendTransaction({ transaction: approveTx, account });
        }

        // Execute buy
        const buyTx = prepareContractCall({
          contract: marketContract,
          method: "function buy(uint256 outcomeIndex, uint256 collateralAmount, uint256 minOutcomeTokens)",
          params: [BigInt(selectedOutcome), amountWei, BigInt(minReceived)],
        });
        await sendTransaction({ transaction: buyTx, account });
      } else {
        // Execute sell
        const sellTx = prepareContractCall({
          contract: marketContract,
          method: "function sell(uint256 outcomeIndex, uint256 outcomeTokenAmount, uint256 minCollateral)",
          params: [BigInt(selectedOutcome), amountWei, BigInt(minReceived)],
        });
        await sendTransaction({ transaction: sellTx, account });
      }

      // Success
      setAmount("");
      setShowPreview(false);
      alert("Trade executed successfully!");
    } catch (err: any) {
      console.error("Trade error:", err);
      setError(err?.message || "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-6">
      {/* Trade Type Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("buy")}
          className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
            activeTab === "buy"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-white/5 text-gray-400 hover:bg-white/10"
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Buy
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
            activeTab === "sell"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-white/5 text-gray-400 hover:bg-white/10"
          }`}
        >
          <TrendingDown className="w-4 h-4 inline mr-2" />
          Sell
        </button>
      </div>

      {/* Outcome Selection */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Select Outcome</label>
        <div className="grid grid-cols-2 gap-2">
          {market.outcomes.map((outcome, index) => (
            <button
              key={index}
              onClick={() => setSelectedOutcome(index)}
              disabled={isTradingDisabled}
              className={`p-4 rounded-xl border transition-all ${
                selectedOutcome === index
                  ? "border-[#00D1FF] bg-[#00D1FF]/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              } ${isTradingDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-left">
                <div className="text-sm font-semibold text-white mb-1">{outcome}</div>
                <div className="text-lg font-bold text-[#00D1FF]">{formatPercent(market.prices[index])}</div>
                {userPosition[index] && Number(userPosition[index]) > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Your position: {formatTokens(BigInt(userPosition[index]))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-gray-400">
            {activeTab === "buy" ? "Amount to Spend" : "Tokens to Sell"}
          </label>
          <button
            onClick={() => setShowSlippageSettings(!showSlippageSettings)}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            Slippage: {slippageTolerance}%
          </button>
        </div>

        {/* Slippage Settings */}
        <AnimatePresence>
          {showSlippageSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white/5 rounded-xl p-4 space-y-2"
            >
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Slippage Tolerance</span>
                <span className="text-white">{slippageTolerance}%</span>
              </div>
              <div className="flex gap-2">
                {[0.5, 1, 2, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippageTolerance(value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      slippageTolerance === value
                        ? "bg-[#00D1FF] text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {value}%
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={slippageTolerance}
                onChange={(e) => setSlippageTolerance(parseFloat(e.target.value) || 1)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                placeholder="Custom %"
                step="0.1"
                min="0.1"
                max="50"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            disabled={isTradingDisabled || isLoading}
            className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-semibold focus:outline-none focus:border-[#00D1FF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="0.00"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
            {activeTab === "buy" ? "PMT" : "Tokens"}
          </div>
        </div>

        {account && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">
              Balance: {formatPMT(BigInt(userBalance))} PMT
            </span>
            <button
              onClick={() => setAmount((Number(userBalance) / 1e6).toString())}
              className="text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors"
            >
              Max
            </button>
          </div>
        )}
      </div>

      {/* Trade Preview */}
      {amount && parseFloat(amount) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Estimated Output */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">You will receive</span>
              <span className="text-lg font-bold text-white">
                {activeTab === "buy"
                  ? formatTokens(BigInt(estimatedOutput))
                  : formatPMT(BigInt(estimatedOutput)) + " PMT"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Execution price</span>
              <span className="text-white">${executionPrice.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Min. received</span>
              <span className="text-white">
                {activeTab === "buy"
                  ? formatTokens(BigInt(minReceived))
                  : formatPMT(BigInt(minReceived)) + " PMT"}
              </span>
            </div>
          </div>

          {/* Price Impact Warning */}
          {priceImpact > 0 && (
            <div className={`${priceImpactSeverity.bgColor} rounded-xl p-4 border border-${priceImpactSeverity.color}/20`}>
              <div className="flex items-start gap-3">
                {priceImpact < 5 ? (
                  <Info className={`w-5 h-5 ${priceImpactSeverity.color} shrink-0`} />
                ) : (
                  <AlertTriangle className={`w-5 h-5 ${priceImpactSeverity.color} shrink-0`} />
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-semibold ${priceImpactSeverity.color}`}>
                      Price Impact
                    </span>
                    <span className={`text-lg font-bold ${priceImpactSeverity.color}`}>
                      {priceImpact.toFixed(2)}%
                    </span>
                  </div>
                  {priceImpact > 5 && (
                    <p className="text-sm text-gray-300 mt-1">
                      {priceImpact > 15
                        ? `⚠️ Extreme price impact! Consider splitting into smaller trades. Max recommended: ${recommendedMaxSize} PMT`
                        : `High price impact. Consider splitting your trade for better execution.`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recommended Size Warning */}
          {parseFloat(amount) > parseFloat(recommendedMaxSize) && (
            <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-400 mb-1">Large Trade Warning</p>
                  <p className="text-sm text-gray-300">
                    Your trade size ({amount} PMT) exceeds the recommended maximum ({recommendedMaxSize} PMT).
                    Split into smaller trades for better prices.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Trading Disabled Message */}
      {isTradingDisabled && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-orange-400 shrink-0" />
            <p className="text-sm text-orange-400">
              {isResolved ? "Market has been resolved" : "Market has ended"}. Trading is disabled.
            </p>
          </div>
        </div>
      )}

      {/* Trade Button */}
      <button
        onClick={() => setShowPreview(true)}
        disabled={
          !account ||
          !amount ||
          parseFloat(amount) <= 0 ||
          isTradingDisabled ||
          isLoading
        }
        className="w-full py-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading
          ? "Processing..."
          : !account
          ? "Connect Wallet"
          : activeTab === "buy"
          ? "Review Buy Order"
          : "Review Sell Order"}
      </button>

      {/* Order Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#13131A] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-6"
            >
              <h3 className="text-2xl font-bold text-white">Confirm {activeTab === "buy" ? "Buy" : "Sell"} Order</h3>

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">Outcome</span>
                  <span className="text-white font-semibold">{market.outcomes[selectedOutcome]}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-white font-semibold">{amount} {activeTab === "buy" ? "PMT" : "Tokens"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">You receive</span>
                  <span className="text-white font-semibold">
                    {activeTab === "buy" ? formatTokens(BigInt(estimatedOutput)) : formatPMT(BigInt(estimatedOutput)) + " PMT"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">Price impact</span>
                  <span className={priceImpactSeverity.color}>{priceImpact.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Min. received</span>
                  <span className="text-white">
                    {activeTab === "buy" ? formatTokens(BigInt(minReceived)) : formatPMT(BigInt(minReceived)) + " PMT"}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeTrade}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoading ? "Confirming..." : "Confirm Trade"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

