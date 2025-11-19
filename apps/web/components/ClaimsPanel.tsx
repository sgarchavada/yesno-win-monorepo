"use client";

import { useState, useEffect } from "react";
import { prepareContractCall, sendTransaction, getContract, readContract, defineChain } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { getMarket } from "@/lib/contracts";
import { getLPBalance, calculateClaimableLPFees, getOutcomeBalance, type Market } from "@/lib/markets";
import { formatTokens, formatPMT } from "@/lib/format";
import { Modal } from "./Modal";
import { getErrorTitle, formatErrorMessage } from "@/lib/errorHandler";
import { client } from "@/app/client";

interface ClaimsPanelProps {
  market: Market;
}

export function ClaimsPanel({ market }: ClaimsPanelProps) {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [lpBalance, setLpBalance] = useState<bigint>(BigInt(0));
  const [claimableLPFees, setClaimableLPFees] = useState<bigint>(BigInt(0));
  const [refundableAmount, setRefundableAmount] = useState<bigint>(BigInt(0));

  // Modal state
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

  // Fetch balances
  useEffect(() => {
    if (!account?.address) return;

    const fetchBalances = async () => {
      try {
        const [lpBal, claimableFees] = await Promise.all([
          getLPBalance(market.address, account.address),
          calculateClaimableLPFees(market.address, account.address),
        ]);

        setLpBalance(lpBal);
        setClaimableLPFees(claimableFees);

        // For canceled markets, calculate refundable amount based on user investments (MarketStatus.CANCELED = 3)
        if (market.status === 3) {
          let totalRefund = BigInt(0);
          const marketContract = getContract({
            address: market.address,
            chain: defineChain(84532),
            client,
          });

          for (let i = 0; i < market.outcomeTokens.length; i++) {
            const balance = await getOutcomeBalance(
              market.outcomeTokens[i],
              account.address
            );
            
            // Only fetch investment if user has tokens for this outcome
            if (balance > BigInt(0)) {
              const investment = await readContract({
                contract: marketContract as any,
                method: "function userInvestments(address user, uint256 outcomeIndex) view returns (uint256)",
                params: [account.address, BigInt(i)],
              }) as bigint;
              
              totalRefund += investment;
            }
          }
          setRefundableAmount(totalRefund);
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, [account, market]);

  const handleClaimLPFees = async () => {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    if (claimableLPFees === BigInt(0)) {
      showError({ message: "No fees to claim" });
      return;
    }

    setLoading(true);
    try {
      const marketContract = getMarket(market.address);
      const tx = prepareContractCall({
        contract: marketContract,
        method: "function claimLPFees()",
        params: [],
      });

      await sendTransaction({ transaction: tx, account });

      showSuccess(
        "Fees Claimed!",
        `Successfully claimed ${formatPMT(claimableLPFees)} in LP fees!`
      );

      // Refresh balances
      const newClaimableFees = await calculateClaimableLPFees(
        market.address,
        account.address
      );
      setClaimableLPFees(newClaimableFees);
    } catch (error: any) {
      console.error("Error claiming LP fees:", error);
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRefund = async () => {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    if (refundableAmount === BigInt(0)) {
      showError({ message: "No tokens to refund" });
      return;
    }

    setLoading(true);
    try {
      const marketContract = getMarket(market.address);
      const tx = prepareContractCall({
        contract: marketContract,
        method: "function claimRefund()",
        params: [],
      });

      await sendTransaction({ transaction: tx, account });

      showSuccess(
        "Refund Claimed!",
        `Successfully claimed ${formatPMT(refundableAmount)} refund!`
      );

      // Refresh refundable amount
      setRefundableAmount(BigInt(0));
    } catch (error: any) {
      console.error("Error claiming refund:", error);
      showError(error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show panel if user has nothing to claim
  if (
    !account ||
    (lpBalance === BigInt(0) &&
      claimableLPFees === BigInt(0) &&
      refundableAmount === BigInt(0))
  ) {
    return null;
  }

  return (
    <>
      <div className="bg-[#1a1b23] rounded-lg border border-gray-800 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">💰 Your Claims</h3>

        {/* AMM Model Explanation for Resolved Markets */}
        {(market.status === 2 || market.resolved) && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="text-purple-400 text-sm mt-0.5">ℹ️</div>
              <div>
                <p className="text-xs text-purple-300 font-medium mb-1">Pure AMM Payout Model</p>
                <p className="text-xs text-gray-400">
                  Winners are paid from <strong className="text-purple-300">losing outcome reserves</strong>. LPs withdraw from <strong className="text-purple-300">winning outcome reserves + fees</strong>. This ensures both traders and LPs can claim their funds.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LP Fees - Only claimable on RESOLVED markets (MarketStatus.RESOLVED = 2) */}
        {lpBalance > BigInt(0) && claimableLPFees > BigInt(0) && (market.status === 2 || market.resolved) && (
          <div className="bg-[#13141a] rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-gray-400">LP Fee Share</p>
                <p className="text-xl font-bold text-green-400">
                  {formatPMT(claimableLPFees)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  You hold {formatTokens(lpBalance)} LP tokens
                </p>
              </div>
              <button
                onClick={handleClaimLPFees}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? "Claiming..." : "Claim Fees"}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Claim your proportional share of accumulated trading fees
            </p>
          </div>
        )}

        {/* LP Info for non-resolved markets */}
        {lpBalance > BigInt(0) && market.status !== 2 && !market.resolved && (() => {
          const now = Math.floor(Date.now() / 1000);
          const hasEnded = now >= Number(market.endTime);
          const isActive = market.status === 0;
          const isCanceled = market.status === 3;
          const isClosed = market.status === 1;
          
          // Determine color based on status
          const bgColor = (hasEnded && isActive) || isClosed ? "bg-orange-500/10" : isCanceled ? "bg-red-500/10" : "bg-blue-500/10";
          const borderColor = (hasEnded && isActive) || isClosed ? "border-orange-500/20" : isCanceled ? "border-red-500/20" : "border-blue-500/20";
          const textColor = (hasEnded && isActive) || isClosed ? "text-orange-300" : isCanceled ? "text-red-300" : "text-blue-300";
          const textColorLight = (hasEnded && isActive) || isClosed ? "text-orange-200/80" : isCanceled ? "text-red-200/80" : "text-blue-200/80";
          
          return (
            <div className={`${bgColor} rounded-lg p-4 border ${borderColor}`}>
              <div className="flex items-start gap-3">
                <div className={`${textColor} text-sm`}>{(hasEnded && isActive) || isClosed ? "⚠️" : isCanceled ? "❌" : "ℹ️"}</div>
                <div>
                  <p className={`text-sm font-medium ${textColor} mb-1`}>
                    LP Position: {formatTokens(lpBalance)} tokens
                  </p>
                  <p className={`text-xs ${textColorLight}`}>
                    {isCanceled 
                      ? "Market was canceled. You can remove your liquidity in the Liquidity tab to claim your refund."
                      : (hasEnded && isActive)
                        ? "Market has ended but not yet resolved. LP withdrawal is locked until resolution to protect potential winner payouts. Once resolved, you can remove your liquidity to claim your share."
                        : isClosed
                          ? "Market is closed. LP withdrawal is locked until resolution."
                          : "Market is open. LP fees can only be claimed after the market is resolved to ensure sufficient funds for potential refunds."}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Refund for canceled markets (MarketStatus.CANCELED = 3) */}
        {market.status === 3 && refundableAmount > BigInt(0) && (
          <div className="bg-[#13141a] rounded-lg p-4 border border-red-900/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Refund Available</p>
                <p className="text-xl font-bold text-red-400">
                  {formatPMT(refundableAmount)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Market was canceled - claim your proportional refund
                </p>
              </div>
              <button
                onClick={handleClaimRefund}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? "Claiming..." : "Claim Refund"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        confirmText="OK"
        showCancel={false}
      />
    </>
  );
}

