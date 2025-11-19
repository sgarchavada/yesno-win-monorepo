"use client";

/**
 * ClaimPanel Component  
 * Claim winnings after market resolution with confetti animation
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, AlertCircle, Sparkles } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import type { Market } from "@/lib/markets";
import { getMarket } from "@/lib/contracts";
import { formatTokens, parseUSDC } from "@/lib/format";

interface ClaimPanelProps {
  market: Market;
}

export function ClaimPanel({ market }: ClaimPanelProps) {
  const account = useActiveAccount();
  const [winningBalance, setWinningBalance] = useState("0");
  const [claimableAmount, setClaimableAmount] = useState("0");
  const [claimAmount, setClaimAmount] = useState("");
  const [isPartialClaim, setIsPartialClaim] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // Check if user has winning tokens
  useEffect(() => {
    async function checkWinnings() {
      if (!account || !market.resolved) return;

      try {
        const winningTokenAddress = market.outcomeTokens[market.winningOutcome];
        const tokenContract = getMarket(winningTokenAddress);

        const balance = await readContract({
          contract: tokenContract,
          method: "function balanceOf(address) view returns (uint256)",
          params: [account.address],
        });

        setWinningBalance(formatTokens(balance as bigint));
        setClaimableAmount(formatTokens(balance as bigint)); // 1:1 ratio (outcome tokens = USD value)
      } catch (err) {
        console.error("Error checking winnings:", err);
      }
    }

    checkWinnings();
  }, [account, market]);

  async function handleClaim(isPartial: boolean = false) {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    if (isPartial && (!claimAmount || parseFloat(claimAmount) <= 0)) {
      setError("Please enter a valid claim amount");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const marketContract = getMarket(market.address);
      
      if (isPartial) {
        // Partial claim
        const amountWei = parseUSDC(claimAmount);
        const claimTx = prepareContractCall({
          contract: marketContract,
          method: "function claim(uint256 amount) external",
          params: [amountWei],
        });
        await sendTransaction({ transaction: claimTx, account });
        
        alert(`🎉 Successfully claimed ${claimAmount} USDC!`);
        setClaimAmount("");
        setIsPartialClaim(false);
      } else {
        // Claim all winnings
        const claimTx = prepareContractCall({
          contract: marketContract,
          method: "function claim() external",
          params: [],
        });
        await sendTransaction({ transaction: claimTx, account });
        
        alert(`🎉 Successfully claimed ${claimableAmount}!`);
        setWinningBalance("0");
        setClaimableAmount("0");
      }
      
      // Show confetti!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      
    } catch (err: any) {
      console.error("Claim error:", err);
      setError(err?.message || "Claim failed");
    } finally {
      setIsLoading(false);
    }
  }

  if (!market.resolved) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-2xl font-semibold text-white">Market Not Resolved</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            This market hasn't been resolved yet. Check back after the oracle announces the winner!
          </p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-white">Connect Your Wallet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Connect your wallet to claim your winnings
          </p>
        </div>
      </div>
    );
  }

  const hasWinnings = parseFloat(winningBalance) > 0;

  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-6 relative overflow-hidden">
      {/* Confetti animation */}
      {showConfetti && <ConfettiAnimation />}

      {/* Winner announcement */}
      <div className="bg-linear-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/50 rounded-xl p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto text-green-400 mb-3" />
        <h3 className="text-xl font-semibold text-white mb-2">Market Resolved!</h3>
        <div className="text-green-400 font-semibold text-lg">
          Winner: {market.outcomes[market.winningOutcome]}
        </div>
      </div>

      {/* Claimable amount */}
      <div className="bg-white/5 rounded-xl p-6 space-y-3">
        <div className="text-sm text-gray-400">Your Winnings</div>
        
        {hasWinnings ? (
          <>
            <div className="text-4xl font-bold text-white">${claimableAmount}</div>
            <div className="text-sm text-gray-400">
              From {winningBalance} winning tokens
            </div>
          </>
        ) : (
          <div className="text-2xl text-gray-400">No winnings to claim</div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Partial claim input (optional) */}
      {hasWinnings && isPartialClaim && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <label className="text-sm text-gray-400">Claim Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
              max={claimableAmount}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-green-500/50 transition-colors"
            />
            <button
              onClick={() => setClaimAmount(claimableAmount)}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-400 transition-colors"
            >
              Max
            </button>
          </div>
        </motion.div>
      )}

      {/* Claim buttons */}
      {hasWinnings && (
        <div className="space-y-2">
          {!isPartialClaim ? (
            <>
              <motion.button
                onClick={() => handleClaim(false)}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-linear-to-r from-green-500 to-green-600 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                {isLoading ? "Claiming..." : "Claim All Winnings"}
              </motion.button>
              <button
                onClick={() => setIsPartialClaim(true)}
                className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Or claim a specific amount
              </button>
            </>
          ) : (
            <>
              <motion.button
                onClick={() => handleClaim(true)}
                disabled={isLoading || !claimAmount || parseFloat(claimAmount) <= 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-linear-to-r from-green-500 to-green-600 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                {isLoading ? "Claiming..." : "Claim Partial Amount"}
              </motion.button>
              <button
                onClick={() => {
                  setIsPartialClaim(false);
                  setClaimAmount("");
                }}
                className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-center text-gray-500">
        {hasWinnings
          ? "Click the button above to claim your winnings. They will be sent to your wallet as USDC."
          : "You don't have any winning outcome tokens for this market."}
      </div>
    </div>
  );
}

function ConfettiAnimation() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: Math.random() * 100 - 50 + "%",
            y: "-10%",
            rotate: Math.random() * 360,
            opacity: 1,
          }}
          animate={{
            y: "110%",
            rotate: Math.random() * 720,
            opacity: 0,
          }}
          transition={{
            duration: Math.random() * 2 + 2,
            delay: Math.random() * 0.5,
            ease: "easeOut",
          }}
          className="absolute w-3 h-3 rounded-full"
          style={{
            left: Math.random() * 100 + "%",
            backgroundColor: [
              "#00D1FF",
              "#FF00AA",
              "#00FF88",
              "#FFAA00",
              "#FF0088",
            ][Math.floor(Math.random() * 5)],
          }}
        />
      ))}
    </div>
  );
}

