"use client";

/**
 * OraclePanel Component
 * Oracle resolution integration for automated market resolution
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Clock, CheckCircle, XCircle, AlertCircle, Shield } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import type { Market } from "@/lib/markets";
import { getOracleAdapter, getMarketFactory } from "@/lib/contracts";
import { formatDate } from "@/lib/format";

interface OraclePanelProps {
  market: Market;
}

interface OracleRequest {
  requestId: bigint;
  market: string;
  question: string;
  requester: string;
  timestamp: bigint;
  fulfilled: boolean;
  canceled: boolean;
}

interface ResolutionData {
  winningOutcome: bigint;
  resolver: string;
  timestamp: bigint;
  resolved: boolean;
}

export function OraclePanel({ market }: OraclePanelProps) {
  const account = useActiveAccount();
  
  const [hasRequest, setHasRequest] = useState(false);
  const [requestData, setRequestData] = useState<OracleRequest | null>(null);
  const [resolutionData, setResolutionData] = useState<ResolutionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!account?.address) {
        setIsAdmin(false);
        return;
      }

      try {
        const factory = getMarketFactory();
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        
        const hasAdminRole = await readContract({
          contract: factory as any,
          method: "function hasRole(bytes32 role, address account) view returns (bool)",
          params: [DEFAULT_ADMIN_ROLE, account.address],
        } as any);

        setIsAdmin(hasAdminRole as boolean);
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, [account]);

  // Check for existing oracle request
  useEffect(() => {
    async function checkOracleStatus() {
      try {
        const oracle = getOracleAdapter();

        // Check if market is resolved via oracle
        const resolution = await readContract({
          contract: oracle as any,
          method: "function getResolution(address) view returns (bool, uint256, uint256, uint256)",
          params: [market.address],
        } as any) as any;

        // resolution is an array: [resolved, winningOutcome, resolvedAt, requestId]
        if (resolution && resolution[0]) {
          setResolutionData({
            winningOutcome: resolution[1],
            resolver: "0x0000000000000000000000000000000000000000", // Not stored in contract
            timestamp: resolution[2],
            resolved: resolution[0],
          });
          setHasRequest(true);
          return;
        }

        // Check for pending request
        const requestIdResult = await readContract({
          contract: oracle as any,
          method: "function getRequestIdForMarket(address) view returns (uint256)",
          params: [market.address],
        } as any);
        const requestId = requestIdResult as unknown as bigint;

        if (requestId && requestId > BigInt(0)) {
          const request = await readContract({
            contract: oracle as any,
            method: "function getRequest(uint256) view returns (address, string, address, uint256, bool, bool)",
            params: [requestId],
          } as any) as any;

          // request is an array: [market, question, requester, timestamp, fulfilled, canceled]
          if (request && !request[5]) {
            setRequestData({
              requestId,
              market: request[0],
              question: request[1],
              requester: request[2],
              timestamp: request[3],
              fulfilled: request[4],
              canceled: request[5],
            });
            setHasRequest(true);
          }
        }
      } catch (err) {
        console.error("Error checking oracle status:", err);
      }
    }

    checkOracleStatus();
  }, [market.address]);

  async function handleRequestResolution() {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const oracle = getOracleAdapter();
      
      const requestTx = prepareContractCall({
        contract: oracle,
        method: "function requestResolution(address market, string question, bytes data) external returns (uint256)",
        params: [market.address, market.question, "0x"],
      });
      
      await sendTransaction({ transaction: requestTx, account });
      
      alert("Oracle resolution requested successfully! 🎯");
      setHasRequest(true);
    } catch (err: any) {
      console.error("Request resolution error:", err);
      setError(err?.message || "Failed to request resolution");
    } finally {
      setIsLoading(false);
    }
  }

  // Market canceled
  if (market.status === 3) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-8">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-red-400" />
          <h3 className="text-xl font-semibold text-white">Market Canceled</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            This market was canceled and cannot be resolved. {market.cancellationReason && `Reason: ${market.cancellationReason}`}
          </p>
        </div>
      </div>
    );
  }

  // Market not ended yet
  if (!market.resolved && Date.now() / 1000 < Number(market.endTime)) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-8">
        <div className="text-center space-y-4">
          <Clock className="w-12 h-12 mx-auto text-gray-600" />
          <h3 className="text-xl font-semibold text-white">Market Still Active</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Oracle resolution can only be requested after the market ends.
          </p>
        </div>
      </div>
    );
  }

  // Already resolved
  if (market.resolved) {
    if (resolutionData) {
      return (
        <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Resolved by Oracle</h3>
              <p className="text-sm text-gray-400">Market has been resolved</p>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Winning Outcome</span>
              <span className="text-white font-semibold">
                {market.outcomes[Number(resolutionData.winningOutcome)]}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Resolved By</span>
              <span className="text-white font-mono text-xs">
                {resolutionData.resolver.slice(0, 10)}...
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Timestamp</span>
              <span className="text-white">
                {formatDate(resolutionData.timestamp)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-8">
        <div className="text-center space-y-4">
          <CheckCircle className="w-12 h-12 mx-auto text-green-400" />
          <h3 className="text-xl font-semibold text-white">Market Resolved</h3>
          <p className="text-gray-400">
            Winner: <span className="text-white font-semibold">{market.outcomes[market.winningOutcome]}</span>
          </p>
        </div>
      </div>
    );
  }

  // Has pending request
  if (hasRequest && requestData && !requestData.fulfilled) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-yellow-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Oracle Request Pending</h3>
            <p className="text-sm text-gray-400">Waiting for oracle response</p>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Request ID</span>
            <span className="text-white font-mono">#{requestData.requestId.toString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Requested</span>
            <span className="text-white">{formatDate(requestData.timestamp)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Status</span>
            <span className="text-yellow-400 flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              Pending
            </span>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400">
          <strong>Note:</strong> The oracle will automatically resolve this market once it receives
          the outcome data. This may take a few minutes to several hours depending on the oracle.
        </div>
      </div>
    );
  }

  // No request yet - show appropriate UI based on admin status
  if (!account) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-8">
        <div className="text-center space-y-4">
          <Sparkles className="w-12 h-12 mx-auto text-gray-600" />
          <h3 className="text-xl font-semibold text-white">Connect Wallet</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Connect your wallet to view oracle resolution options
          </p>
        </div>
      </div>
    );
  }

  // Non-admin user - show info only
  if (!isAdmin) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-orange-500/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-2xl font-semibold text-white">Admin Access Required</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            This market has ended and is ready for resolution. Only platform admins can request oracle resolution to ensure accuracy and prevent manipulation.
          </p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400">
          <strong>Note:</strong> The admin will resolve this market soon. You can also contact the admin to request resolution if needed.
        </div>
      </div>
    );
  }

  // Admin user - show request button
  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-semibold text-white">Oracle Resolution Available</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          This market has ended. Request the oracle to automatically resolve this market based on
          real-world outcome data.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleRequestResolution}
        disabled={isLoading}
        className="w-full py-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Requesting..." : "Request Oracle Resolution"}
      </button>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400">
        <strong>How it works:</strong> The oracle will fetch real-world data about this event
        and automatically resolve the market to the correct outcome. You'll be notified once
        the resolution is complete.
      </div>
    </div>
  );
}

