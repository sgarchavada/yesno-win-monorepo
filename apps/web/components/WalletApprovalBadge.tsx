"use client";

/**
 * WalletApprovalBadge Component
 * Shows user's overall approval status in wallet area
 * Displays how many markets they've approved
 */

import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useGlobalApprovalStatus } from "@/hooks/useGlobalApprovalStatus";

interface WalletApprovalBadgeProps {
  marketAddresses: string[]; // List of markets to check
  compact?: boolean; // Show compact version
}

export function WalletApprovalBadge({ 
  marketAddresses, 
  compact = false 
}: WalletApprovalBadgeProps) {
  const {
    approvedMarketsCount,
    totalMarketsCount,
    isChecking,
    allApproved,
  } = useGlobalApprovalStatus(marketAddresses);

  if (totalMarketsCount === 0) {
    return null;
  }

  if (isChecking) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        {!compact && (
          <span className="text-xs text-gray-400">Checking...</span>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
        allApproved 
          ? "bg-green-500/10 text-green-400" 
          : "bg-orange-500/10 text-orange-400"
      }`}>
        {allApproved ? (
          <CheckCircle className="w-3 h-3" />
        ) : (
          <AlertCircle className="w-3 h-3" />
        )}
        <span className="text-xs font-medium">
          {approvedMarketsCount}/{totalMarketsCount}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
      allApproved 
        ? "bg-green-500/10 border border-green-500/20" 
        : "bg-orange-500/10 border border-orange-500/20"
    }`}>
      {allApproved ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
      )}
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${
          allApproved ? "text-green-400" : "text-orange-400"
        }`}>
          {allApproved ? "All Markets Enabled" : "Enable Trading"}
        </span>
        <span className="text-[10px] text-gray-500">
          {approvedMarketsCount} of {totalMarketsCount} approved
        </span>
      </div>
    </div>
  );
}

