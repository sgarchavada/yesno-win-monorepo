
/**
 * EnableTradingModal Component
 * One-time setup to enable unlimited USDC approvals for all markets
 * Similar to Polymarket's "Enable Trading" flow
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { getUSDC } from "@/lib/contracts";

interface EnableTradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetContract: string; // MarketFactory or specific Market address
  purpose: "trading" | "liquidity" | "all"; // What we're enabling
}

export function EnableTradingModal({
  isOpen,
  onClose,
  onSuccess,
  targetContract,
  purpose = "all",
}: EnableTradingModalProps) {
  const account = useActiveAccount();
  const [step, setStep] = useState<"idle" | "checking" | "approving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

  // Check if already approved
  useEffect(() => {
    async function checkApproval() {
      if (!account || !isOpen) return;

      setStep("checking");
      try {
        const usdcContract = getUSDC();
        const currentAllowance = await readContract({
          contract: usdcContract,
          method: "function allowance(address owner, address spender) view returns (uint256)",
          params: [account.address, targetContract],
        }) as bigint;

        // If already approved with sufficient allowance, skip to success
        if (currentAllowance > BigInt(1e12)) { // If allowance > 1M USDC
          setStep("success");
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else {
          setStep("idle");
        }
      } catch (err) {
        console.error("Error checking approval:", err);
        setStep("idle");
      }
    }

    checkApproval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, isOpen, targetContract]);

  const handleApprove = async () => {
    if (!account) return;

    setStep("approving");
    setError("");

    try {
      const usdcContract = getUSDC();
      
      // Approve unlimited spending
      const approveTx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [targetContract, MAX_UINT256],
      });
      
      await sendTransaction({ transaction: approveTx, account });
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStep("success");
      
      // Auto-close and trigger success callback
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Approval error:", err);
      setError(err?.message || "Failed to approve. Please try again.");
      setStep("error");
    }
  };

  const purposeText = (() => {
    switch (purpose) {
      case "trading":
        return "trade on markets";
      case "liquidity":
        return "add liquidity to markets";
      case "all":
        return "trade and provide liquidity";
      default:
        return "use the platform";
    }
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-linear-to-br from-[#1a1a24] to-[#13131a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-2xl flex items-center justify-center">
                  <Wallet className="w-10 h-10 text-white" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-white text-center mb-3">
                Enable Trading
              </h2>

              {/* Description */}
              <p className="text-gray-400 text-center mb-8">
                Let&apos;s set up your wallet to {purposeText}. This is a one-time setup.
              </p>

              {/* Status Display */}
              <div className="bg-[#1a1a24] border border-white/10 rounded-xl p-6 mb-6">
                {step === "checking" && (
                  <div className="flex items-center justify-center gap-3 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Checking your wallet...</span>
                  </div>
                )}

                {step === "idle" && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium mb-1">One-time approval</div>
                        <div className="text-sm text-gray-400">
                          Approve unlimited PMT spending to avoid future confirmations
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium mb-1">Seamless trading</div>
                        <div className="text-sm text-gray-400">
                          Trade instantly without wallet popups every time
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-purple-400" />
                      </div>
                      <div>
                        <div className="text-white font-medium mb-1">Safe & secure</div>
                        <div className="text-sm text-gray-400">
                          You can revoke this approval anytime from your wallet
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === "approving" && (
                  <div className="flex items-center justify-center gap-3 text-blue-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Waiting for approval...</span>
                  </div>
                )}

                {step === "success" && (
                  <div className="flex items-center justify-center gap-3 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>Trading enabled! 🎉</span>
                  </div>
                )}

                {step === "error" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-red-400">
                      <AlertCircle className="w-5 h-5" />
                      <span>Approval failed</span>
                    </div>
                    {error && (
                      <div className="text-sm text-gray-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {step === "idle" && (
                  <>
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApprove}
                      className="flex-1 py-3 px-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] hover:opacity-90 rounded-xl font-semibold text-white transition-opacity"
                    >
                      Enable Trading
                    </button>
                  </>
                )}

                {step === "error" && (
                  <>
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApprove}
                      className="flex-1 py-3 px-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] hover:opacity-90 rounded-xl font-semibold text-white transition-opacity"
                    >
                      Try Again
                    </button>
                  </>
                )}

                {(step === "checking" || step === "approving" || step === "success") && (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl font-medium text-gray-500 cursor-not-allowed"
                  >
                    {step === "checking" && "Checking..."}
                    {step === "approving" && "Approving..."}
                    {step === "success" && "Success!"}
                  </button>
                )}
              </div>

              {/* Info Note */}
              {step === "idle" && (
                <div className="mt-4 text-xs text-gray-500 text-center">
                  {`You'll only need to do this once. You can revoke this approval anytime from your wallet settings.`}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

