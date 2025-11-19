
/**
 * ApprovalStatus Component
 * Shows user's approval status for a market
 * Can be used to proactively show if user needs to enable trading
 */

import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useApprovalCheck } from "@/lib/hooks/useApprovalCheck";

interface ApprovalStatusProps {
  marketAddress: string;
  showWhenApproved?: boolean; // Show status even when approved (default: false)
}

export function ApprovalStatus({ 
  marketAddress, 
  showWhenApproved = false 
}: ApprovalStatusProps) {
  const { isApproved, isChecking } = useApprovalCheck({
    targetContract: marketAddress,
  });

  // Don't show anything while checking
  if (isChecking || isApproved === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Checking approval...</span>
      </div>
    );
  }

  // If approved and we don't want to show it, return null
  if (isApproved && !showWhenApproved) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${
      isApproved ? "text-green-400" : "text-orange-400"
    }`}>
      {isApproved ? (
        <>
          <CheckCircle className="w-3 h-3" />
          <span>Trading enabled</span>
        </>
      ) : (
        <>
          <XCircle className="w-3 h-3" />
          <span>Enable trading required</span>
        </>
      )}
    </div>
  );
}

