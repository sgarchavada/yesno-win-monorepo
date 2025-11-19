"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useActiveAccount } from "thirdweb/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ConnectButton } from "thirdweb/react";
import { client } from "@/app/client";
import { baseSepolia } from "thirdweb/chains";
import { useSwitchToBaseSepolia, useCurrentChainId, isBaseSepolia } from "@/lib/chainUtils";
import { tokenContractAddress } from "@/constants/contracts";
import { useBuyShares } from "@/lib/hooks/useBuyShares";
import { useSharesBalance } from "@/lib/hooks/useMarketData";
import { useTokenData } from "@/lib/hooks/useTokenData";
import { prepareContractCall } from "thirdweb";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { getPredictionContractByAddress, predictionMarketContract } from "@/constants/contracts";
import { useToast } from "@/components/ui/toaster";

interface VoteBoxProps {
  marketId: number;
  optionA: string;
  optionB: string;
  totalSharesA: number;
  totalSharesB: number;
  status: "Active" | "Closed" | "Resolved" | "Pending" | "Canceled";
  onBuySuccess?: () => void;
  contractAddress?: `0x${string}`;
  outcome?: number; // 1 for A, 2 for B
  distributablePool?: number;
}

export default function VoteBox({
  marketId,
  optionA,
  optionB,
  totalSharesA,
  totalSharesB,
  status,
  onBuySuccess,
  contractAddress,
  outcome,
  distributablePool,
}: VoteBoxProps) {
  const account = useActiveAccount();
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(null);
  const [shareAmount, setShareAmount] = useState<string>("1");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWrongChain, setIsWrongChain] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const totalShares = totalSharesA + totalSharesB;
  const percentageA = totalShares > 0 ? (totalSharesA / totalShares) * 100 : 0;
  const percentageB = totalShares > 0 ? (totalSharesB / totalShares) * 100 : 0;

  // Check if user is on the correct chain
  const chainId = useCurrentChainId();
  useEffect(() => {
    if (account) {
      setIsWrongChain(!isBaseSepolia(chainId));
    }
  }, [account, chainId]);

  const switchToBaseSepolia = useSwitchToBaseSepolia();
  const handleSwitchChain = async () => {
    try {
      await switchToBaseSepolia();
      setIsWrongChain(false);
    } catch (error) {
      console.error("Failed to switch chain:", error);
    }
  };

  // Reusable hooks
  const { balanceRaw, tokenUnit } = useTokenData();
  const { buyShares, isProcessing } = useBuyShares();
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();
  const { sharesBalance } = useSharesBalance(marketId, true, contractAddress);
  const { toast } = useToast();
  const userOptionAShares = (sharesBalance?.optionAShares ?? (BigInt(0))) as bigint;
  const userOptionBShares = (sharesBalance?.optionBShares ?? (BigInt(0))) as bigint;
  const userHasShares = (userOptionAShares + userOptionBShares) > BigInt(0);
  const userWinningShares = outcome === 1 ? userOptionAShares : outcome === 2 ? userOptionBShares : BigInt(0);
  const userHasWinnings = userWinningShares > BigInt(0);
  // Estimate claimable amount (PMT): proportional share of distributablePool
  const totalWinningShares = outcome === 1 ? totalSharesA : outcome === 2 ? totalSharesB : 0;
  const userWinningSharesHuman = Number(userWinningShares) / Number(tokenUnit || BigInt(1));
  const estimatedClaimable = userHasWinnings && totalWinningShares > 0 && (distributablePool ?? 0) > 0
    ? (userWinningSharesHuman / totalWinningShares) * (distributablePool as number)
    : 0;

  const handleVote = async () => {
    if (!account || !selectedOption) return;

    try {
      toast("Submitting order...", "info");
      await buyShares(
        marketId,
        selectedOption === "A",
        Number(shareAmount),
        () => {
          setIsDialogOpen(false);
          setSelectedOption(null);
          setShareAmount("1");
          onBuySuccess?.();
          toast("Purchase successful", "success");
        },
        undefined,
        contractAddress
      );
    } catch (error) {
      console.error("Error voting:", error);
      toast("Transaction failed", "error");
    }
  };

  const amountRaw = BigInt(Math.max(1, Number(shareAmount))) * tokenUnit;
  const hasInsufficientBalance = balanceRaw < amountRaw;

  // const canVote = status === "Active" && account;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span>{
            status === "Resolved"
              ? "Market Resolved"
              : status === "Canceled"
              ? "Market Canceled"
              : status === "Closed"
              ? "Waiting for Resolution"
              : status === "Pending"
              ? "Market Pending"
              : "Place Your Vote"
          }</span>
          <Badge className={status === "Active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}>
            {status}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {!account ? (
          <div className="text-center space-y-4">
            <p className="text-muted">
              Connect your wallet to participate in this market
            </p>
            <ConnectButton
              client={client}
              chain={baseSepolia}
              connectModal={{
                size: "compact",
                title: "Connect to Vote",
                showThirdwebBranding: false,
              }}
              connectButton={{
                label: "Connect Wallet",
                className: "btn-primary text-sm px-6 py-2",
              }}
              accountAbstraction={{
                chain: baseSepolia,
                sponsorGas: true,
              }}
              detailsButton={{
                displayBalanceToken: {
                  [baseSepolia.id]: tokenContractAddress,
                },
              }}
            />
          </div>
        ) : isWrongChain ? (
          <div className="text-center space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm mb-3">
                Please switch to Base Sepolia network to participate in this market.
              </p>
              <Button
                onClick={handleSwitchChain}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Switch to Base Sepolia
              </Button>
            </div>
          </div>
        ) : status === "Closed" ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-900 dark:text-yellow-100">
            The market has ended and is awaiting resolution by the admin. Voting is closed. Once resolved (or canceled), you will be able to claim winnings (or refund) if eligible.
          </div>
        ) : status !== "Active" && status !== "Canceled" && status !== "Resolved" ? (
          <div className="text-center text-muted">
            <p>This market is {status.toLowerCase()}. Voting is no longer available.</p>
          </div>
        ) : (
          <>
            {/* Option Selection - only for Active */}
            {status === "Active" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedOption === "A"
                        ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                    onClick={() => setSelectedOption("A")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedOption === "A" ? "border-green-500 bg-green-500" : "border-gray-300"
                          }`} />
                          <span className="font-medium text-foreground">
                            {optionA}
                          </span>
                        </div>
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="mt-2 text-sm text-muted">
                        {totalSharesA.toLocaleString()} shares ({percentageA.toFixed(1)}%)
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Option B */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedOption === "B"
                        ? "ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                    onClick={() => setSelectedOption("B")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedOption === "B" ? "border-red-500 bg-red-500" : "border-gray-300"
                          }`} />
                          <span className="font-medium text-foreground">
                            {optionB}
                          </span>
                        </div>
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="mt-2 text-sm text-muted">
                        {totalSharesB.toLocaleString()} shares ({percentageB.toFixed(1)}%)
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
            )}

            {/* Share Amount Input */}
            {status === "Active" && selectedOption && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.3 }}
                className="space-y-2"
              >
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Number of Shares
                </label>
                <Input
                  type="number"
                  min="1"
                  value={shareAmount}
                  onChange={(e) => setShareAmount(e.target.value)}
                  onWheel={(e: any) => e.currentTarget.blur()}
                  placeholder="Enter number of shares"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Each share costs 1 token
                </p>
              </motion.div>
            )}

            {/* Vote Button, Refund or Claim Winnings */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  {status === "Canceled" ? (
                    <button
                      className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!userHasShares || isRefunding}
                      onClick={async () => {
                        if (!userHasShares || isRefunding) return;
                        setIsRefunding(true);
                        try {
                          const contract = contractAddress ? getPredictionContractByAddress(contractAddress) : predictionMarketContract;
                          const tx = prepareContractCall({
                            contract,
                            method: "function claimRefund(uint256 _marketId)",
                            params: [BigInt(marketId)],
                          });
                          toast("Claiming refund...", "info");
                          await sendAndConfirm(tx);
                          toast("Refund claimed", "success");
                          onBuySuccess?.();
                        } catch (e) {
                          console.error("Refund failed", e);
                          toast("Refund failed", "error");
                        } finally {
                          setIsRefunding(false);
                        }
                      }}
                    >
                      {isRefunding ? "Refunding..." : userHasShares ? "Claim Refund" : "No Refund Available"}
                    </button>
                  ) : status === "Resolved" ? (
                    <button
                      className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!userHasWinnings || isClaiming}
                      onClick={async () => {
                        if (!userHasWinnings || isClaiming) return;
                        setIsClaiming(true);
                        try {
                          const contract = contractAddress ? getPredictionContractByAddress(contractAddress) : predictionMarketContract;
                          const tx = prepareContractCall({
                            contract,
                            method: "function claimWinnings(uint256 _marketId)",
                            params: [BigInt(marketId)],
                          });
                          toast("Claiming rewards...", "info");
                          await sendAndConfirm(tx);
                          toast("Rewards claimed", "success");
                          onBuySuccess?.();
                        } catch (e) {
                          console.error("Claim winnings failed", e);
                          toast("Claim failed", "error");
                        } finally {
                          setIsClaiming(false);
                        }
                      }}
                    >
                      {isClaiming
                        ? "Claiming..."
                        : userHasWinnings
                        ? `Claim Rewards${estimatedClaimable > 0 ? ` (~${estimatedClaimable.toFixed(4)} PMT)` : ""}`
                        : "No Rewards Available"}
                    </button>
                  ) : status === "Active" ? (
                    <DialogTrigger asChild>
                      <button
                        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!selectedOption || !shareAmount || isProcessing || hasInsufficientBalance}
                      >
                        {isProcessing ? "Processing..." : hasInsufficientBalance ? "Insufficient Balance" : `Buy ${shareAmount} ${selectedOption === "A" ? optionA : optionB} Shares`}
                      </button>
                    </DialogTrigger>
                  ) : (
                    <button className="btn-primary w-full" disabled>
                      {status === "Resolved" ? "No Winnings Available" : "Unavailable"}
                    </button>
                  )}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Your Vote</DialogTitle>
                  <DialogDescription>
                    {`You are about to purchase {shareAmount} shares for "${selectedOption === "A" ? optionA : optionB}".`}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Option:</span>
                      <span className="font-medium">{selectedOption === "A" ? optionA : optionB}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Shares:</span>
                      <span className="font-medium">{shareAmount}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Cost:</span>
                      <span className="font-medium">{shareAmount} tokens</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <button
                      onClick={handleVote}
                      disabled={isProcessing || hasInsufficientBalance}
                      className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? "Processing..." : "Confirm Vote"}
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
