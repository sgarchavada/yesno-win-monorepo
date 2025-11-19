/**
 * Error Handler Utility
 * Translates blockchain errors into user-friendly messages
 */

interface ParsedError {
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Parse and humanize blockchain errors
 */
export function parseError(error: any): ParsedError {
  const errorString = error?.message || error?.toString() || "Unknown error";
  
  // User rejected transaction
  if (
    errorString.includes("User rejected") ||
    errorString.includes("user rejected") ||
    errorString.includes("User denied")
  ) {
    return {
      title: "Transaction Cancelled",
      message: "You cancelled the transaction in your wallet.",
      suggestion: "Click the button again if you want to try again.",
    };
  }

  // Insufficient funds
  if (
    errorString.includes("insufficient funds") ||
    errorString.includes("Insufficient balance")
  ) {
    return {
      title: "Insufficient Funds",
      message: "You don't have enough tokens to complete this transaction.",
      suggestion: "Make sure you have enough tokens and gas (ETH) in your wallet.",
    };
  }

  // Not authorized / No permission
  if (
    errorString.includes("OwnableUnauthorizedAccount") ||
    errorString.includes("Ownable: caller is not the owner") ||
    errorString.includes("not owner or admin") ||
    errorString.includes("Unauthorized") ||
    errorString.includes("not authorized")
  ) {
    return {
      title: "Permission Denied",
      message: "You don't have permission to perform this action.",
      suggestion: "Only admins can access this feature. Please contact the platform owner to grant you admin access.",
    };
  }

  // Contract paused
  if (errorString.includes("Paused") || errorString.includes("paused")) {
    return {
      title: "Feature Temporarily Disabled",
      message: "This feature is currently paused.",
      suggestion: "Please try again later or contact support.",
    };
  }

  // Invalid address
  if (
    errorString.includes("invalid address") ||
    errorString.includes("InvalidAddress")
  ) {
    return {
      title: "Invalid Address",
      message: "The wallet address you entered is not valid.",
      suggestion: "Please check the address and make sure it starts with '0x' and is 42 characters long.",
    };
  }

  // Already exists / Duplicate
  if (
    errorString.includes("already exists") ||
    errorString.includes("AlreadyExists") ||
    errorString.includes("already a creator")
  ) {
    return {
      title: "Already Exists",
      message: "This action has already been completed.",
      suggestion: "No need to do it again!",
    };
  }

  // Market already resolved
  if (
    errorString.includes("AlreadyResolved") ||
    errorString.includes("already resolved")
  ) {
    return {
      title: "Market Already Resolved",
      message: "This market has already been resolved.",
      suggestion: "You can no longer perform this action on a resolved market.",
    };
  }

  // Market ended
  if (
    errorString.includes("MarketEnded") ||
    errorString.includes("market has ended")
  ) {
    return {
      title: "Market Ended",
      message: "This market has ended and trading is no longer available.",
      suggestion: "Wait for the admin to resolve the market.",
    };
  }

  // Insufficient allowance
  if (
    errorString.includes("insufficient allowance") ||
    errorString.includes("ERC20: insufficient allowance")
  ) {
    return {
      title: "Approval Required",
      message: "You need to approve the contract to use your tokens.",
      suggestion: "Click the 'Approve' button first, then try again.",
    };
  }

  // Slippage exceeded
  if (
    errorString.includes("SlippageExceeded") ||
    errorString.includes("slippage")
  ) {
    return {
      title: "Price Changed Too Much",
      message: "The price moved more than your slippage tolerance.",
      suggestion: "Try again with a higher slippage setting or a smaller amount.",
    };
  }

  // Network error
  if (
    errorString.includes("network") ||
    errorString.includes("Network") ||
    errorString.includes("fetch failed")
  ) {
    return {
      title: "Network Error",
      message: "Unable to connect to the blockchain.",
      suggestion: "Check your internet connection and try again.",
    };
  }

  // Transaction reverted (generic)
  if (
    errorString.includes("execution reverted") ||
    errorString.includes("Transaction reverted")
  ) {
    // Try to extract custom error message
    const revertMatch = errorString.match(/reverted:\s*(.+?)(?:\n|$)/i);
    if (revertMatch && revertMatch[1]) {
      return {
        title: "Transaction Failed",
        message: revertMatch[1],
        suggestion: "Please check your input and try again.",
      };
    }
    
    return {
      title: "Transaction Failed",
      message: "The transaction was rejected by the smart contract.",
      suggestion: "Please check your inputs and make sure you meet all requirements.",
    };
  }

  // Gas estimation failed
  if (
    errorString.includes("gas required exceeds allowance") ||
    errorString.includes("gas estimation failed")
  ) {
    return {
      title: "Transaction Would Fail",
      message: "The transaction cannot be completed with the current settings.",
      suggestion: "Check that you have enough tokens and that all requirements are met.",
    };
  }

  // Nonce too low (transaction already processed)
  if (errorString.includes("nonce too low")) {
    return {
      title: "Transaction Already Processed",
      message: "This transaction may have already been completed.",
      suggestion: "Refresh the page and check if the action was successful.",
    };
  }

  // Check for specific error signatures (hex codes)
  if (errorString.includes("0xb521771a")) {
    return {
      title: "Market Not Ready",
      message: "This market cannot be resolved yet. The market contract needs to be upgraded to the latest version.",
      suggestion: "Please upgrade the market contract to the latest version (v21) first, then try resolving again.",
    };
  }

  // Zero collateral return (LP token rounding issue)
  if (errorString.includes("ZeroCollateralReturn")) {
    return {
      title: "Amount Too Small",
      message: "The LP token amount you're trying to remove is too small and would result in 0 collateral returned due to rounding.",
      suggestion: "Try removing a larger amount of LP tokens (at least 0.01 LP tokens).",
    };
  }

  // Default fallback for unknown errors
  return {
    title: "Something Went Wrong",
    message: "An unexpected error occurred.",
    suggestion: "Please try again. If the problem persists, contact support.",
  };
}

/**
 * Format error for display in modal
 */
export function formatErrorMessage(error: any): string {
  const parsed = parseError(error);
  
  let message = parsed.message;
  
  if (parsed.suggestion) {
    message += `\n\n💡 ${parsed.suggestion}`;
  }
  
  return message;
}

/**
 * Get error title
 */
export function getErrorTitle(error: any): string {
  return parseError(error).title;
}

