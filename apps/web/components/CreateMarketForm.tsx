"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useActiveAccount } from "thirdweb/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, AlertCircle, Loader2, Calendar } from "lucide-react";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { predictionMarketContract, predictionContractAddress } from "@/constants/contracts";
import { ConnectButton } from "thirdweb/react";
import { client } from "@/app/client";
import { baseSepolia } from "thirdweb/chains";
import { useSwitchToBaseSepolia, useCurrentChainId, isBaseSepolia } from "@/lib/chainUtils";
import { tokenContractAddress } from "@/constants/contracts";
import { getUSDC } from "@/lib/contracts";
import { useToast } from "@/components/ui/toaster";

interface CreateMarketFormProps {
  onMarketCreated?: () => void;
}

export default function CreateMarketForm({ onMarketCreated }: CreateMarketFormProps) {
  const account = useActiveAccount();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    question: "",
    optionA: "",
    optionB: "",
    startTime: "",
    endTime: "",
    resolutionType: "0", // 0=MANUAL, 1=ORACLE
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWrongChain, setIsWrongChain] = useState(false);
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.question.trim()) {
      const msg = "Question is required";
      setError(msg);
      toast(msg, "error");
      return false;
    }
    if (!formData.optionA.trim()) {
      const msg = "Option A is required";
      setError(msg);
      toast(msg, "error");
      return false;
    }
    if (!formData.optionB.trim()) {
      const msg = "Option B is required";
      setError(msg);
      toast(msg, "error");
      return false;
    }
    if (!formData.startTime) {
      const msg = "Start time is required";
      setError(msg);
      toast(msg, "error");
      return false;
    }
    if (!formData.endTime) {
      const msg = "End time is required";
      setError(msg);
      toast(msg, "error");
      return false;
    }
    if (formData.resolutionType !== "0" && formData.resolutionType !== "1") {
      const msg = "Resolution Type is required";
      setError(msg);
      toast(msg, "error");
      return false;
    }

    const startTime = new Date(formData.startTime).getTime() / 1000;
    const endTime = new Date(formData.endTime).getTime() / 1000;
    const now = Date.now() / 1000;

    if (startTime < now) {
      const msg = "Start time must be in the future";
      setError(msg);
      toast(msg, "error");
      return false;
    }
    if (endTime <= startTime) {
      const msg = "End time must be after start time";
      setError(msg);
      toast(msg, "error");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) {
      const msg = "Please connect your wallet first";
      setError(msg);
      toast(msg, "warning");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1) Ensure USDC approval for MarketFactory (prediction contract)
      toast("Checking PMT approval...", "info");
      
      const usdc = getUSDC();
      const allowance = (await readContract({
        contract: usdc,
        method: "function allowance(address,address) view returns (uint256)",
        params: [account.address!, predictionContractAddress as `0x${string}`],
      })) as bigint;

      console.log("Current allowance:", allowance.toString());

      // Approve max if no allowance (or very small)
      const MIN_REQUIRED = BigInt(10) * BigInt(1e6); // 10 PMT buffer
      if (!allowance || allowance < MIN_REQUIRED) {
        toast("Please approve PMT spending in your wallet...", "warning");
        
        const MAX_UINT = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approveTx = prepareContractCall({
          contract: usdc,
          method: "function approve(address,uint256) returns (bool)",
          params: [predictionContractAddress as `0x${string}`, MAX_UINT],
        });
        
        const approvalResult = await sendAndConfirm(approveTx);
        console.log("Approval confirmed:", approvalResult);
        toast("PMT approval confirmed! Creating market...", "success");
      } else {
        toast("PMT already approved. Creating market...", "success");
      }

      // Convert datetime to Unix timestamp
      const startTimestamp = BigInt(Math.floor(new Date(formData.startTime).getTime() / 1000));
      const endTimestamp = BigInt(Math.floor(new Date(formData.endTime).getTime() / 1000));

      // Get contract instance
      const contract = predictionMarketContract;
      if (!contract) {
        throw new Error("Contract not initialized");
      }

      // Call createMarket on contract
      const transaction = prepareContractCall({
        contract,
        method: "function createMarket(string _question, uint256 _startTime, uint256 _endTime, string _optionA, string _optionB, uint8 _resolutionType) returns (uint256 marketId)",
        params: [
          formData.question,
          startTimestamp,
          endTimestamp,
          formData.optionA,
          formData.optionB,
          Number(formData.resolutionType),
        ],
      });
      
      const result = await sendAndConfirm(transaction);
      const txHash = (result as any)?.transactionHash || (result as any)?.receipt?.transactionHash || "";
      
      setTransactionHash(txHash);
      setIsSuccessDialogOpen(true);
      toast("Market created successfully!", "success");
      
      // Reset form
      setFormData({
        question: "",
        optionA: "",
        optionB: "",
        startTime: "",
        endTime: "",
        resolutionType: "0",
      });

      // Notify parent component
      if (onMarketCreated) {
        onMarketCreated();
      }
    } catch (err: any) {
      console.error("Error creating market:", err);
      const errorMsg = err?.message || "Failed to create market. Please try again.";
      setError(errorMsg);
      toast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); // At least 1 minute in the future
    return now.toISOString().slice(0, 16);
  };

  const getMinEndTime = () => {
    if (!formData.startTime) return getMinDateTime();
    const startTime = new Date(formData.startTime);
    startTime.setMinutes(startTime.getMinutes() + 1);
    return startTime.toISOString().slice(0, 16);
  };

  if (!account) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span>Wallet Required</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted">
            Connect your wallet to create new prediction markets
          </p>
          <ConnectButton
            client={client}
            chain={baseSepolia}
            connectModal={{
              size: "compact",
              title: "Connect to Create Markets",
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
              displayBalanceToken: tokenContractAddress ? {
                [baseSepolia.id]: tokenContractAddress,
              } : undefined,
            }}
          />
        </CardContent>
      </Card>
    );
  }

  if (isWrongChain) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span>Wrong Network</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm mb-3">
              Please switch to Base Sepolia network to create markets.
            </p>
            <Button
              onClick={handleSwitchChain}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              Switch to Base Sepolia
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Create New Market</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Question */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Question *
              </label>
              <Input
                name="question"
                value={formData.question}
                onChange={handleInputChange}
                placeholder="What will happen?"
                className="w-full"
                required
              />
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Option A *
                </label>
                <Input
                  name="optionA"
                  value={formData.optionA}
                  onChange={handleInputChange}
                  placeholder="Yes / First option"
                  className="w-full"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Option B *
                </label>
                <Input
                  name="optionB"
                  value={formData.optionB}
                  onChange={handleInputChange}
                  placeholder="No / Second option"
                  className="w-full"
                  required
                />
              </div>
            </div>

            {/* Timing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Start Time *</span>
                </label>
                <Input
                  name="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  min={getMinDateTime()}
                  className="w-full glass"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>End Time *</span>
                </label>
                <Input
                  name="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  min={getMinEndTime()}
                  className="w-full glass"
                  required
                />
              </div>
            </div>

            {/* Resolution Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Resolution Type *
              </label>
              <div className="flex gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resolutionType"
                    value="0"
                    checked={formData.resolutionType === "0"}
                    onChange={handleInputChange}
                  />
                  <span>Manual</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resolutionType"
                    value="1"
                    checked={formData.resolutionType === "1"}
                    onChange={handleInputChange}
                  />
                  <span>Oracle</span>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
              >
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Market...
                </>
              ) : (
                "Create Market"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Market Created Successfully!</span>
            </DialogTitle>
            <DialogDescription>
              Your prediction market has been created and is now live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Transaction Hash:</span>
                <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                  {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                </code>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsSuccessDialogOpen(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setIsSuccessDialogOpen(false);
                  if (onMarketCreated) onMarketCreated();
                }}
                className="btn-primary flex-1"
              >
                View Markets
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
