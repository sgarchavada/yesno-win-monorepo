"use client";

/**
 * LiquidityPanel Component
 * Add/Remove liquidity interface
 */

import { useState, useEffect, useMemo } from "react";
import { Plus, Minus, AlertCircle, Info } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract, getContract, defineChain, waitForReceipt } from "thirdweb";
import { client } from "@/app/client";
import type { Market } from "@/lib/markets";
import { getMarket } from "@/lib/contracts";
import { formatPMT, parseUSDC, formatTokens, parseTokens } from "@/lib/format";
import { useMarket } from "@/contexts/MarketContext";
import { Modal } from "./Modal";
import { EnableTradingModal } from "./EnableTradingModal";
import { useApprovalCheck } from "@/hooks/useApprovalCheck";

interface LiquidityPanelProps {
  market: Market;
}

export function LiquidityPanel({ market: legacyMarket }: LiquidityPanelProps) {
  // Use context data for fresh, consistent data (with fallback to legacy prop)
  const { marketData, error: contextError } = useMarket();
  const market = legacyMarket; // Keep using legacy prop for basic info
  
  // Log context status
  useEffect(() => {
    if (contextError) {
      console.log("⚠️ MarketContext error (falling back to legacy data):", contextError);
    }
    if (marketData) {
      console.log("✅ MarketContext data available");
    }
  }, [marketData, contextError]);
  const account = useActiveAccount();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [lpBalance, setLpBalance] = useState("0");
  const [maxWithdrawable, setMaxWithdrawable] = useState("0"); // Actual USDC withdrawable for resolved markets
  const [lpShare, setLpShare] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    type: "success" | "danger";
  }>({ title: "", message: "", type: "success" });
  const [showEnableTrading, setShowEnableTrading] = useState(false);
 
  const sanitizeNumberString = (value: string) => value.replace(/,/g, "");
 
  const sanitizedLpBalance = useMemo(() => sanitizeNumberString(lpBalance), [lpBalance]);
 
  const removalCapRaw = useMemo(() => {
    if (mode !== "remove") return undefined;
    if (market.status === 2 || market.status === 3) {
      return maxWithdrawable;
    }
    return sanitizedLpBalance;
  }, [mode, market.status, maxWithdrawable, sanitizedLpBalance]);
 
  const removalCapValue = removalCapRaw ? parseFloat(removalCapRaw) : 0;
 
  // Check if user has approved USDC spending for MarketFactory (one approval for ALL markets)
  const { needsApproval, checkApproval } = useApprovalCheck({
    targetContract: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS!,
  });
  
  // Real-time validation as user types
  useEffect(() => {
    if (mode !== "remove") {
      if (error.includes("You can only remove") || error.includes("⚠️ You're trying to remove")) {
        setError("");
      }
      return;
    }

    if (!amount) {
      if (error.includes("You can only remove") || error.includes("⚠️ You're trying to remove")) {
        setError("");
      }
      return;
    }

    if (!removalCapRaw) return;

    const amountNum = parseFloat(amount);
    if (!Number.isNaN(amountNum) && amountNum > removalCapValue) {
      const unitLabel = market.status === 2 || market.status === 3 ? "USDC" : "LP tokens";
      setError(`You can only remove up to ${removalCapRaw} ${unitLabel}`);
    } else if (error.includes("You can only remove") || error.includes("⚠️ You're trying to remove")) {
      setError("");
    }
  }, [mode, amount, removalCapRaw, removalCapValue, error, market.status]);

  // Check market status for liquidity operations
  // MarketStatus enum: 0=ACTIVE, 1=CLOSED, 2=RESOLVED, 3=CANCELED
  const now = Math.floor(Date.now() / 1000);
  const hasEnded = now >= market.endTime;
  const isActive = market.status === 0;
  const isResolved = market.resolved || market.status === 2;
  const isClosed = market.status === 1;
  const isCanceled = market.status === 3;
  
  // Disable adding liquidity if: canceled, closed, resolved, or ended
  // CRITICAL: Disable removing liquidity on ended-but-not-resolved markets to protect winners
  // Only allow LP removal on: CANCELED or RESOLVED markets
  const isAddLiquidityDisabled = !isActive || hasEnded || isResolved || isCanceled;
  const isRemoveLiquidityDisabled = (hasEnded && !isResolved && !isCanceled) || isClosed; // Block ended markets until resolved
  const canOnlyRemove = isResolved || isCanceled; // After resolution OR cancellation, can only remove
  
  // Determine disabled reason for UI message
  let disabledReason = "";
  let removeLiquidityReason = "";
  if (isCanceled) {
    disabledReason = "Market has been canceled. You can claim refunds in the Claims section.";
  } else if (isResolved) {
    disabledReason = "Market has been resolved";
  } else if (isClosed) {
    disabledReason = "Market has been closed by admin";
    removeLiquidityReason = "Market has been closed by admin. Wait for resolution.";
  } else if (hasEnded && !isResolved) {
    disabledReason = "Market has ended";
    removeLiquidityReason = "Market has ended but not yet resolved. LP withdrawal is locked until the market is resolved to protect potential winner payouts.";
  }

  // Fetch user's LP token balance
  const fetchLPBalance = async () => {
    if (!account) return;

    try {
      const marketContract = getMarket(market.address);
      const lpToken = await readContract({
        contract: marketContract,
        method: "function lpToken() view returns (address)",
        params: [],
      });

      // Get LP token contract and check balance
      const lpTokenContract = getMarket(lpToken as string);
      const balance = await readContract({
        contract: lpTokenContract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [account.address],
      });

      setLpBalance(formatTokens(balance as bigint));

      // Calculate share percentage
      const totalSupply = await readContract({
        contract: lpTokenContract,
        method: "function totalSupply() view returns (uint256)",
        params: [],
      });
      
      const share = totalSupply && (totalSupply as bigint) > BigInt(0)
        ? (Number(balance as bigint) / Number(totalSupply as bigint)) * 100
        : 0;
      setLpShare(share.toFixed(2));

      // Debug logging
      console.log("=== LP Balance Calculation Debug ===");
      console.log("Market Status:", market.status);
      console.log("LP Balance (tokens):", formatTokens(balance as bigint));
      console.log("Total Supply:", formatTokens(totalSupply as bigint));
      console.log("Share:", share.toFixed(2) + "%");

      // For RESOLVED or CANCELED markets, use context data to calculate actual withdrawable USDC
      if (marketData && (marketData.status === 2 || marketData.status === 3)) { // RESOLVED or CANCELED
        try {
          if (marketData.status === 2) {
            // RESOLVED: Use context data for winning reserves + fees
            const winningOutcome = marketData.winningOutcome || 0;
            const winningReserve = marketData.reserves[winningOutcome];
            const accumulatedFees = marketData.accumulatedFees;
            
            console.log("RESOLVED Market Calculation (from context):");
            console.log("  Winning Outcome:", winningOutcome);
            console.log("  Reserves[0]:", Number(marketData.reserves[0]) / 1e6, "USDC");
            console.log("  Reserves[1]:", Number(marketData.reserves[1]) / 1e6, "USDC");
            console.log("  Winning Reserve:", Number(winningReserve) / 1e6, "USDC");
            console.log("  Accumulated Fees:", Number(accumulatedFees) / 1e6, "USDC");
            
            // Calculate LP's share of winning reserves + fees
            const lpShareOfWinningReserve = totalSupply && (totalSupply as bigint) > BigInt(0)
              ? (balance as bigint * winningReserve) / (totalSupply as bigint)
              : BigInt(0);
            
            const lpFeeShare = totalSupply && (totalSupply as bigint) > BigInt(0)
              ? (balance as bigint * accumulatedFees) / (totalSupply as bigint)
              : BigInt(0);
            
            const totalWithdrawable = lpShareOfWinningReserve + lpFeeShare;
            
            console.log("  LP Share of Winning Reserve:", Number(lpShareOfWinningReserve) / 1e6, "USDC");
            console.log("  LP Fee Share:", Number(lpFeeShare) / 1e6, "USDC");
            console.log("  Total Withdrawable:", Number(totalWithdrawable) / 1e6, "USDC");
            
            // Convert from 6-decimal USDC to display format
            setMaxWithdrawable((Number(totalWithdrawable) / 1e6).toFixed(2));
          } else {
            // CANCELED: Use context data for total reserves
            const totalReserves = marketData.totalReserves;
            
            console.log("CANCELED Market Calculation (from context):");
            console.log("  Total Reserves:", Number(totalReserves) / 1e6, "USDC");
            
            const lpShareOfReserves = totalSupply && (totalSupply as bigint) > BigInt(0)
              ? (balance as bigint * totalReserves) / (totalSupply as bigint)
              : BigInt(0);
            
            console.log("  LP Share of Reserves:", Number(lpShareOfReserves) / 1e6, "USDC");
            
            // Convert from 6-decimal USDC to display format
            setMaxWithdrawable((Number(lpShareOfReserves) / 1e6).toFixed(2));
          }
        } catch (err) {
          console.error("Error calculating max withdrawable:", err);
          setMaxWithdrawable("0");
        }
      } else {
        // For ACTIVE markets, max withdrawable = LP balance (in tokens)
        console.log("ACTIVE Market - showing LP token balance");
        setMaxWithdrawable(formatTokens(balance as bigint));
      }
      
      console.log("Final maxWithdrawable:", maxWithdrawable);
      console.log("=====================================");
    } catch (err) {
      console.error("Error fetching LP balance:", err);
    }
  };

  useEffect(() => {
    fetchLPBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, market.address]);

  async function handleLiquidity() {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter an amount");
      return;
    }

    // Validation for remove mode
    if (mode === "remove" && removalCapRaw) {
      const amountNum = parseFloat(amount);

      if (!Number.isNaN(amountNum) && amountNum > removalCapValue) {
        const unitLabel = market.status === 2 || market.status === 3 ? "USDC" : "LP tokens";
        setError(`You can only remove up to ${removalCapRaw} ${unitLabel}`);
        return;
      }
    }

    // Check approval for add mode
    if (mode === "add" && needsApproval) {
      setShowEnableTrading(true);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const marketContract = getMarket(market.address);
      let amountWei: bigint;
      
      // For add mode: always use USDC decimals (6)
      if (mode === "add") {
        amountWei = parseUSDC(amount);
      } else {
        // For remove mode on RESOLVED/CANCELED markets: user enters USDC, convert to LP tokens
        // For remove mode on ACTIVE markets: user enters LP tokens directly
        if (market.status === 2 || market.status === 3) {
          // RESOLVED or CANCELED: User entered USDC amount, need to convert to LP tokens
          const usdcAmount = parseFloat(amount);
          const maxUSDC = parseFloat(maxWithdrawable);
          const lpBalanceNum = parseFloat(sanitizedLpBalance);
          
          if (maxUSDC > 0 && lpBalanceNum > 0) {
            // Calculate LP tokens needed: (usdcAmount / maxUSDC) * lpBalance
            const lpTokensNeeded = (usdcAmount / maxUSDC) * lpBalanceNum;
            amountWei = parseTokens(lpTokensNeeded.toFixed(18));
            console.log(`Converting ${usdcAmount} USDC to ${lpTokensNeeded} LP tokens`);
          } else {
            amountWei = parseTokens(amount); // Fallback to direct LP token input
          }
        } else {
          // ACTIVE: User enters LP tokens directly
          amountWei = parseTokens(amount);
        }
      }

      if (mode === "add") {
        // Call MarketFactory's addLiquidityFor function (user approved factory once for all markets)
        const factoryContract = getContract({
          client,
          chain: defineChain(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532")),
          address: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS!,
        });
        
        const addLiqTx = prepareContractCall({
          contract: factoryContract,
          method: "function addLiquidityFor(address market, uint256 collateralAmount) returns (uint256)",
          params: [market.address, amountWei],
        });
        await sendTransaction({ transaction: addLiqTx, account });
        
        setModalConfig({
          title: "Liquidity Added Successfully! 🎉",
          message: `You've added ${amount} PMT to the liquidity pool. You'll now earn a share of all trading fees proportional to your stake. Your LP tokens represent your share of the pool.`,
          type: "success"
        });
        setShowModal(true);
      } else {
        // Remove liquidity
        const removeLiqTx = prepareContractCall({
          contract: marketContract,
          method: "function removeLiquidity(uint256 lpTokenAmount) returns (uint256)",
          params: [amountWei],
        });
        const { transactionHash } = await sendTransaction({ transaction: removeLiqTx, account });
        
        // Wait for transaction to be mined
        await waitForReceipt({ client, chain: defineChain(84532), transactionHash });
        
        // Check if exit fee was applied
        const hasExitFee = isActive && !hasEnded;
        const exitFeeAmount = hasExitFee ? (parseFloat(amount) * 0.01).toFixed(2) : "0";
        
        setModalConfig({
          title: "Liquidity Removed Successfully! ✅",
          message: hasExitFee 
            ? `You've removed ${amount} LP tokens from the pool. A 1% early exit fee (${exitFeeAmount} PMT) was deducted and distributed to remaining LPs. Your net PMT has been returned to your wallet.`
            : `You've removed ${amount} LP tokens from the pool. Your PMT plus accumulated trading fees have been returned to your wallet. No exit fee was charged.`,
          type: "success"
        });
        setShowModal(true);
      }

      // Refresh balances
      await fetchLPBalance();
      setAmount("");
      checkApproval();
    } catch (err: any) {
      console.error("Error handling liquidity:", err);
      setModalConfig({
        title: "Transaction Failed",
        message: err?.message || "Something went wrong while processing your request.",
        type: "danger"
      });
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  }

  const handleAmountChange = (value: string) => {
    if (value === "") {
      setAmount("");
      if (error.includes("You can only remove")) {
        setError("");
      }
      return;
    }

    if (value.startsWith("-")) {
      setAmount("0");
      return;
    }

    const numericValue = parseFloat(value);

    if (!Number.isNaN(numericValue) && numericValue < 0) {
      setAmount("0");
      return;
    }

    if (mode === "remove" && removalCapRaw) {
      if (!Number.isNaN(numericValue) && numericValue > removalCapValue) {
        setAmount(removalCapRaw);
        return;
      }
    }

    setAmount(value);
  };
  
  // Handle modal close and refresh data
  const handleModalClose = () => {
    setShowModal(false);
    // Refresh LP balance without full page reload
    fetchLPBalance();
  };

  if (!account) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center">
            <Plus className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-white">Connect Your Wallet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Connect your wallet to provide liquidity and earn trading fees
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-6">
      {/* Market Status Warning */}
      {isAddLiquidityDisabled && mode === "add" && (
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
              Adding Liquidity Disabled
            </h4>
            <p className="text-xs text-gray-400">
              {disabledReason}. {isCanceled 
                ? "You can remove your liquidity in the Remove tab."
                : isResolved 
                  ? "You can only remove liquidity from resolved markets."
                  : "Adding liquidity is no longer available for this market."}
            </p>
          </div>
        </div>
      )}

      {/* Ended But Not Resolved Warning */}
      {mode === "remove" && hasEnded && !isResolved && !isCanceled && (
        <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-orange-400 mb-1">
              LP Withdrawal Locked Until Resolution
            </h4>
            <p className="text-xs text-gray-400">
              {removeLiquidityReason}
            </p>
          </div>
        </div>
      )}

      {/* Active Market Exit Fee Warning */}
      {mode === "remove" && isActive && !hasEnded && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-400 mb-1">
              Early Exit Fee: 1%
            </h4>
            <p className="text-xs text-gray-400">
              Removing liquidity while the market is active incurs a 1% fee. This fee is distributed to remaining LPs. No fee after market ends.
            </p>
          </div>
        </div>
      )}

      {/* AMM Model Explanation for Resolved Markets */}
      {isResolved && mode === "remove" && (
        <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-purple-400 mb-1">
              AMM Payout Model
            </h4>
            <p className="text-xs text-gray-400">
              Winners are paid from <strong>losing outcome reserves</strong>. Your LP withdrawal comes from <strong>winning outcome reserves + trading fees</strong>. This ensures LPs can always withdraw after winners claim.
            </p>
          </div>
        </div>
      )}

      {/* Resolved/Canceled Market Notice */}
      {canOnlyRemove && (
        <div className={`flex items-start gap-3 p-4 border rounded-xl ${
          isCanceled 
            ? "bg-red-500/10 border-red-500/20"
            : "bg-blue-500/10 border-blue-500/20"
        }`}>
          <Info className={`w-5 h-5 shrink-0 mt-0.5 ${
            isCanceled ? "text-red-400" : "text-blue-400"
          }`} />
          <div>
            <h4 className={`text-sm font-semibold mb-1 ${
              isCanceled ? "text-red-400" : "text-blue-400"
            }`}>
              {isCanceled ? "Market Canceled" : "Market Resolved"}
            </h4>
            <p className="text-xs text-gray-400">
              {isCanceled 
                ? "You can withdraw your liquidity to claim your refund. Adding new liquidity is not available."
                : "You can now withdraw your liquidity. Adding new liquidity is no longer available."}
            </p>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className={`flex gap-2 bg-white/5 p-1 rounded-xl`}>
        <button
          onClick={() => setMode("add")}
          disabled={canOnlyRemove || isAddLiquidityDisabled}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all disabled:cursor-not-allowed ${
            mode === "add"
              ? "bg-linear-to-r from-[#00D1FF] to-[#FF00AA] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
        <button
          onClick={() => {
            setMode("remove");
            setError(""); // Clear any errors when switching modes
          }}
          disabled={isRemoveLiquidityDisabled}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all disabled:cursor-not-allowed ${
            mode === "remove"
              ? "bg-linear-to-r from-[#00D1FF] to-[#FF00AA] text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Minus className="w-4 h-4" />
          <span>Remove</span>
        </button>
      </div>

      {/* User's LP position */}
      <div className="bg-white/5 rounded-xl p-4 space-y-2">
        <h4 className="text-sm font-medium text-gray-400">Your Position</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400">LP Tokens</div>
            <div className="text-lg font-semibold text-white">{lpBalance}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Pool Share</div>
            <div className="text-lg font-semibold text-white">{lpShare}%</div>
          </div>
        </div>
      </div>

      {/* Amount input */}
      <div className={(mode === "add" && isAddLiquidityDisabled) ? 'opacity-50 pointer-events-none' : ''}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-400">
            {mode === "add" 
              ? "Amount (USDC)" 
              : (market.status === 2 || market.status === 3) 
                ? "Amount (USDC)" 
                : "LP Tokens"}
          </label>
          {mode === "remove" && lpBalance !== "0" && (
            <span className="text-xs text-gray-500">
              {(market.status === 2 || market.status === 3) ? ( // RESOLVED or CANCELED
                <>
                  Available: <span className="text-white font-medium">${maxWithdrawable}</span> USDC
                  <span className="text-gray-600 ml-1">({lpBalance} LP)</span>
                </>
              ) : (
                <>
                  Available: <span className="text-white font-medium">{lpBalance}</span> LP
                </>
              )}
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            max={mode === "remove" ? removalCapRaw : undefined}
            min="0"
            disabled={mode === "add" ? isAddLiquidityDisabled : isRemoveLiquidityDisabled}
            className={`w-full px-4 py-4 bg-white/5 border rounded-xl text-white text-xl font-semibold focus:outline-none transition-colors disabled:cursor-not-allowed ${
              error.includes("only have") || error.includes("trying to remove") || error.includes("You can only remove up to")
                ? "border-red-500/50 focus:border-red-500" 
                : "border-white/10 focus:border-[#00D1FF]/50"
            }`}
          />
          {mode === "remove" && (
            <button
              onClick={() => {
                if (removalCapRaw) {
                  setAmount(removalCapRaw);
                  if (error.includes("You can only remove")) {
                    setError("");
                  }
                }
              }}
              disabled={isRemoveLiquidityDisabled}
              className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-400 transition-colors disabled:cursor-not-allowed"
            >
              Max
            </button>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-400">
          {mode === "add"
            ? "By adding liquidity, you'll earn a share of all trading fees proportional to your stake in the pool."
            : isActive && !hasEnded
            ? "Removing liquidity now incurs a 1% early exit fee. Wait for market to end to avoid this fee."
            : "Removing liquidity will return PMT plus your accumulated trading fees. No exit fee after market ends."}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={handleLiquidity}
        disabled={isLoading || !amount || parseFloat(amount) <= 0 || (mode === "add" && isAddLiquidityDisabled) || (mode === "remove" && isRemoveLiquidityDisabled) || (canOnlyRemove && mode === "add")}
        className="w-full py-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(mode === "add" && isAddLiquidityDisabled)
          ? "Adding Liquidity Disabled"
          : canOnlyRemove && mode === "add"
            ? "Adding Disabled (Market Resolved)"
            : isLoading 
              ? "Processing..." 
              : mode === "add" 
                ? "Add Liquidity" 
                : "Remove Liquidity"}
      </button>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
        <div>
          <div className="text-xs text-gray-400">Total Pool</div>
          <div className="text-sm font-medium text-white">{formatPMT(market.totalReserves)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">LP Fee</div>
          <div className="text-sm font-medium text-white">
            {(Number(market.lpFeeBps) / 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Success/Error Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleModalClose}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />

      {/* Enable Trading Modal */}
      <EnableTradingModal
        isOpen={showEnableTrading}
        onClose={() => setShowEnableTrading(false)}
        onSuccess={() => {
          checkApproval(); // Recheck approval status
          setShowEnableTrading(false);
          // Automatically retry adding liquidity after approval
          setTimeout(() => handleLiquidity(), 500);
        }}
        targetContract={process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS!}
        purpose="liquidity"
      />
    </div>
  );
}

