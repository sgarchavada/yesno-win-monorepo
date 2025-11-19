
/**
 * Create Market Page
 * Admin interface for creating new prediction markets
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowLeft, Calendar, DollarSign, Lock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, waitForReceipt, readContract } from "thirdweb";
import { getMarketFactory, getUSDC, getCreatorRegistry } from "@/lib/contracts";
import { parseUSDC, formatPMT } from "@/lib/format";
import { client } from "@/client";

export default function CreateMarketPage() {
  const account = useActiveAccount();
  
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(["Yes", "No"]);
  const [endTime, setEndTime] = useState("");
  const [initialLiquidity, setInitialLiquidity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authCheckLoading, setAuthCheckLoading] = useState(true);
  const [creationFee, setCreationFee] = useState<bigint>(BigInt(0));
  const [minLiquidity, setMinLiquidity] = useState<bigint>(BigInt(0));

  // Check if user is authorized to create markets and fetch creation fee
  useEffect(() => {
    async function checkAuthorization() {
      if (!account) {
        setIsAuthorized(false);
        setAuthCheckLoading(false);
        return;
      }

      try {
        const registry = getCreatorRegistry();
        const factory = getMarketFactory();

        // Check if user has creator role (everyone must be approved as creator)
        const [isCreator, marketCreationFee, minInitialLiquidity] = await Promise.all([
          readContract({
            contract: registry,
            method: "function isCreator(address) view returns (bool)",
            params: [account.address as `0x${string}`],
          }),
          readContract({
            contract: factory,
            method: "function marketCreationFee() view returns (uint256)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function minInitialLiquidity() view returns (uint256)",
            params: [],
          }),
        ]);

        setIsAuthorized(isCreator as boolean);
        setCreationFee(marketCreationFee as bigint);
        setMinLiquidity(minInitialLiquidity as bigint);
      } catch (err) {
        console.error("Error checking authorization:", err);
        setIsAuthorized(false);
      } finally {
        setAuthCheckLoading(false);
      }
    }

    checkAuthorization();
  }, [account]);

  function addOutcome() {
    if (outcomes.length < 4) {
      setOutcomes([...outcomes, `Outcome ${outcomes.length + 1}`]);
    }
  }

  function removeOutcome(index: number) {
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  }

  function updateOutcome(index: number, value: string) {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  }

  async function handleCreateMarket() {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    if (!question.trim()) {
      setError("Please enter a market question");
      return;
    }

    if (outcomes.some((o) => !o.trim())) {
      setError("All outcomes must have text");
      return;
    }

    if (outcomes.length < 2) {
      setError("Market must have at least 2 outcomes");
      return;
    }

    if (outcomes.length > 4) {
      setError("Market cannot have more than 4 outcomes");
      return;
    }

    if (!endTime) {
      setError("Please select an end time");
      return;
    }

    if (!initialLiquidity || parseFloat(initialLiquidity) <= 0) {
      setError("Please enter initial liquidity");
      return;
    }

    // Check if liquidity meets minimum requirement
    const minLiquidityFormatted = formatPMT(minLiquidity);
    if (parseFloat(initialLiquidity) < parseFloat(minLiquidityFormatted)) {
      setError(`Initial liquidity must be at least ${minLiquidityFormatted} PMT`);
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const factory = getMarketFactory();
      const liquidityWei = parseUSDC(initialLiquidity);
      const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

      // Step 1: Check current allowance and approve if needed
      setError("Step 1/3: Checking PMT approval...");
      const usdcContract = getUSDC();
      
      const currentAllowance = (await readContract({
        contract: usdcContract,
        method: "function allowance(address,address) view returns (uint256)",
        params: [account.address as `0x${string}`, factory.address as `0x${string}`],
      })) as bigint;

      console.log("Current allowance:", currentAllowance.toString());
      console.log("Factory address:", factory.address);
      console.log("User address:", account.address);

      // Calculate required amount (creation fee + liquidity)
      const totalAmount = liquidityWei + creationFee;
      console.log("Total amount needed:", totalAmount.toString());
      console.log("Creation fee:", creationFee.toString());
      console.log("Liquidity:", liquidityWei.toString());
      
      // Always approve max uint to ensure sufficient allowance
      setError(`Step 1/3: Please approve PMT spending in your wallet...`);
      const MAX_UINT = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      const approveTx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [factory.address, MAX_UINT],
      });
      const approvalResult = await sendTransaction({ transaction: approveTx, account });
      
      // IMPORTANT: Wait for the approval transaction to be confirmed on-chain
      setError("Step 1/3: Waiting for approval confirmation...");
      await waitForReceipt({
        client,
        chain: usdcContract.chain,
        transactionHash: approvalResult.transactionHash,
      });
      console.log("Approval confirmed, hash:", approvalResult.transactionHash);
      
      // Add small delay to ensure blockchain state is propagated
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify approval was successful
      const newAllowance = (await readContract({
        contract: usdcContract,
        method: "function allowance(address,address) view returns (uint256)",
        params: [account.address as `0x${string}`, factory.address as `0x${string}`],
      })) as bigint;
      console.log("New allowance after approval:", newAllowance.toString());
      
      if (newAllowance < totalAmount) {
        throw new Error(`Approval failed: allowance is ${newAllowance.toString()} but need ${totalAmount.toString()}`);
      }
      
      // Step 2: Create market
      setError("Step 2/3: Creating market...");
      
      // Add another small delay before preparing transaction to ensure RPC node has updated state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use PMT token address from environment (same as USDC_ADDRESS)
      const pmtTokenAddress = import.meta.env.VITE_USDC_ADDRESS || usdcContract.address;
      
      console.log("Preparing createMarket transaction...");
      console.log("Parameters:", {
        question,
        outcomes,
        endTimestamp,
        pmtTokenAddress,
        liquidityWei: liquidityWei.toString(),
        feeBps: 200
      });
      
      const createTx = prepareContractCall({
        contract: factory,
        method: "function createMarket(string question, string[] outcomes, uint256 endTime, address collateralToken, uint256 initialLiquidity, uint256 feeBps) returns (address)",
        params: [question, outcomes, BigInt(endTimestamp), pmtTokenAddress, liquidityWei, BigInt(200)],
      });
      
      console.log("Sending createMarket transaction...");
      const result = await sendTransaction({ transaction: createTx, account });
      
      // Step 3: Wait for confirmation
      setError("Step 3/3: Waiting for market creation confirmation...");
      await waitForReceipt({
        client,
        chain: factory.chain,
        transactionHash: result.transactionHash,
      });
      
      // Show success message
      setSuccess(true);
      setError("");
      
      // Reset form after a delay
      setTimeout(() => {
        setQuestion("");
        setOutcomes(["Yes", "No"]);
        setEndTime("");
        setInitialLiquidity("");
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error("Create market error:", err);
      setError(err?.message || "Failed to create market");
    } finally {
      setIsLoading(false);
    }
  }

  if (!account) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] py-12 px-4 flex items-center justify-center">
        <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center">
            <Plus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Connect Your Wallet</h1>
          <p className="text-gray-400">
            You need to connect your wallet to create markets
          </p>
        </div>
      </main>
    );
  }

  if (authCheckLoading) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto border-4 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
          <p className="text-gray-400">Checking your creator access...</p>
        </div>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] py-12 px-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#13131A] border border-white/10 rounded-2xl p-12 max-w-md text-center space-y-6"
        >
          <div className="w-20 h-20 mx-auto bg-orange-500/10 rounded-2xl flex items-center justify-center">
            <Lock className="w-10 h-10 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Creator Access Required</h1>
            <p className="text-gray-400">
              You need creator access to create markets. Request access to become an approved creator!
            </p>
          </div>
          <Link to="/become-creator">
            <button className="w-full py-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-bold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Become a Creator
            </button>
          </Link>
          <Link to="/">
            <button className="text-sm text-gray-400 hover:text-white transition-colors">
              ← Back to Home
            </button>
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back button */}
        <Link to="/">
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Markets
          </button>
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-4xl font-bold bg-linear-to-r from-[#00D1FF] to-[#FF00AA] bg-clip-text text-transparent">
            Create New Market
          </h1>
          <p className="text-gray-400">
            Set up a prediction market for any future event
          </p>
        </motion.div>

        {/* Creation Fee Notice */}
        {creationFee > BigInt(0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-400 mb-1">
                  Market Creation Fee
                </h3>
                <p className="text-sm text-gray-300">
                  A one-time fee of <span className="font-bold text-white">{Number(creationFee) / 1e6} USDC</span> is charged when creating a market. 
                  This helps prevent spam and ensures quality markets on the platform.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  This fee is in addition to your initial liquidity amount.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#13131A] border border-white/10 rounded-2xl p-8 space-y-6"
        >
          {/* Question */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">
              Market Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will ETH be above $4000 by December 31, 2025?"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
          </div>

          {/* Outcomes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-400">
                Outcomes ({outcomes.length}/4 max)
              </label>
              <button
                onClick={addOutcome}
                disabled={outcomes.length >= 4}
                className="text-sm text-[#00D1FF] hover:text-[#00D1FF]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                title={outcomes.length >= 4 ? "Maximum 4 outcomes allowed" : "Add another outcome"}
              >
                + Add Outcome
              </button>
            </div>
            {outcomes.length >= 4 && (
              <div className="mb-2 text-xs text-amber-400/80">
                Maximum 4 outcomes reached
              </div>
            )}
            <div className="space-y-2">
              {outcomes.map((outcome, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => updateOutcome(index, e.target.value)}
                    placeholder={`Outcome ${index + 1}`}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
                  />
                  {outcomes.length > 2 && (
                    <button
                      onClick={() => removeOutcome(index)}
                      className="px-3 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* End Time */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              End Time
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
          </div>

          {/* Initial Liquidity */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Initial Liquidity (PMT)
            </label>
            <input
              type="number"
              value={initialLiquidity}
              onChange={(e) => setInitialLiquidity(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder={formatPMT(minLiquidity)}
              min={formatPMT(minLiquidity)}
              step="1"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-2">
              Minimum: <span className="text-white font-semibold">{formatPMT(minLiquidity)} PMT</span>
            </p>
          </div>

          {/* Success */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <span className="text-2xl">🎉</span>
                </div>
                <div>
                  <div className="font-semibold text-green-400">Market Created Successfully!</div>
                  <div className="text-xs text-green-400/70 mt-1">Your market is now live and ready for trading</div>
                </div>
              </div>
              <Link to="/">
                <button className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 text-sm font-medium transition-colors">
                  View All Markets →
                </button>
              </Link>
            </motion.div>
          )}

          {/* Error */}
          {error && !success && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleCreateMarket}
            disabled={isLoading || success}
            className="w-full py-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {success ? "Market Created! ✓" : isLoading ? "Creating Market..." : "Create Market"}
          </button>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400">
            <strong>Note:</strong> You&apos;ll need to approve PMT token spending and pay gas fees.
            The initial liquidity will be used to seed the AMM pool.
          </div>
        </motion.div>
      </div>
    </main>
  );
}

