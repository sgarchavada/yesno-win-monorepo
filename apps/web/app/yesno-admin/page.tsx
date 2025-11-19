"use client";

/**
 * Admin Dashboard
 * Comprehensive admin panel for market management, fees, and configuration
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  TrendingUp,
  Pause,
  XCircle,
  CheckCircle,
  DollarSign,
  Settings,
  AlertTriangle,
  AlertCircle,
  Users,
  ExternalLink,
  RefreshCw,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { getMarketFactory, getProtocolTreasury, getCreatorRegistry } from "@/lib/contracts";
import { getAllMarkets, getMarketDetails, type Market } from "@/lib/markets";
import { formatPMT, formatBps, shortenAddress } from "@/lib/format";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Modal } from "@/components/Modal";
import { formatErrorMessage, getErrorTitle } from "@/lib/errorHandler";

type ModalConfig = {
  isOpen: boolean;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "danger";
  confirmText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
};

export default function AdminDashboard() {
  const account = useActiveAccount();
  
  const [isOwner, setIsOwner] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"markets" | "fees" | "creators" | "settings" | "upgrades">("markets");
  
  // Modal state
  const [modal, setModal] = useState<ModalConfig>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // Cancellation reason state
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancellationError, setCancellationError] = useState("");
  
  // Refs to hold latest values (solves closure issue)
  const selectedReasonRef = useRef(selectedReason);
  const customReasonRef = useRef(customReason);
  
  // Update refs whenever state changes
  useEffect(() => {
    selectedReasonRef.current = selectedReason;
  }, [selectedReason]);
  
  useEffect(() => {
    customReasonRef.current = customReason;
  }, [customReason]);

  // Modal helpers
  const showSuccess = (message: string) => {
    setModal({
      isOpen: true,
      title: "Success!",
      message,
      type: "success",
      showCancel: false,
    });
  };

  const showError = (error: any) => {
    const title = getErrorTitle(error);
    const message = formatErrorMessage(error);
    
    setModal({
      isOpen: true,
      title,
      message,
      type: "danger",
      showCancel: false,
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: "warning",
      confirmText: "Confirm",
      onConfirm,
      showCancel: true,
    });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    // Reset cancellation states when modal closes
    setSelectedReason("");
    setCustomReason("");
    setCancellationError("");
  };

  // Check if user is owner OR admin
  useEffect(() => {
    async function checkAuthorization() {
      if (!account) {
        setIsOwner(false);
        setIsAuthorized(false);
        return;
      }

      try {
        const factory = getMarketFactory();
        
        // Check if user is owner
        const owner = await readContract({
          contract: factory,
          method: "function owner() view returns (address)",
          params: [],
        });
        const ownerCheck = (owner as string).toLowerCase() === account.address.toLowerCase();
        setIsOwner(ownerCheck);

        // Check if user has DEFAULT_ADMIN_ROLE (granted by deployment script)
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const hasAdminRole = await readContract({
          contract: factory,
          method: "function hasRole(bytes32,address) view returns (bool)",
          params: [DEFAULT_ADMIN_ROLE as `0x${string}`, account.address as `0x${string}`],
        });

        // User is authorized if they are owner OR have DEFAULT_ADMIN_ROLE
        setIsAuthorized(ownerCheck || (hasAdminRole as boolean));
      } catch (err) {
        console.error("Error checking authorization:", err);
        setIsOwner(false);
        setIsAuthorized(false);
      }
    }

    checkAuthorization();
  }, [account]);

  // Fetch markets function (reusable)
  const fetchMarkets = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const addresses = await getAllMarkets();
      const marketDetails = await Promise.all(
        addresses.map((addr) => getMarketDetails(addr))
      );
      const validMarkets = marketDetails.filter((m) => m !== null) as Market[];
      setMarkets(validMarkets);
    } catch (error) {
      console.error("Error fetching markets:", error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Fetch markets on mount
  useEffect(() => {
    if (isAuthorized) {
      fetchMarkets();
    }
  }, [isAuthorized]);

  if (!account) {
    return <ConnectWalletPrompt />;
  }

  if (!isAuthorized) {
    return <NotAuthorized />;
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                  isOwner 
                    ? 'bg-[#FF00AA]/20 text-[#FF00AA]' 
                    : 'bg-[#00D1FF]/20 text-[#00D1FF]'
                }`}>
                  {isOwner ? '👑 OWNER' : '🛡️ ADMIN'}
                </span>
              </div>
              <p className="text-sm text-gray-400">Manage markets, fees, and configuration</p>
            </div>
          </div>
          <Link href="/">
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
              ← Back to Home
            </button>
          </Link>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 bg-[#13131A] p-1 rounded-xl border border-white/10 w-fit">
          <TabButton
            active={activeTab === "markets"}
            onClick={() => setActiveTab("markets")}
            icon={<TrendingUp className="w-4 h-4" />}
          >
            Markets
          </TabButton>
          <TabButton
            active={activeTab === "fees"}
            onClick={() => setActiveTab("fees")}
            icon={<DollarSign className="w-4 h-4" />}
          >
            Fees
          </TabButton>
          <TabButton
            active={activeTab === "creators"}
            onClick={() => setActiveTab("creators")}
            icon={<Users className="w-4 h-4" />}
          >
            Creators
          </TabButton>
          <TabButton
            active={activeTab === "upgrades"}
            onClick={() => setActiveTab("upgrades")}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Upgrades
          </TabButton>
          <TabButton
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            icon={<Settings className="w-4 h-4" />}
          >
            Settings
          </TabButton>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            {activeTab === "markets" && <MarketsTab markets={markets} account={account} showSuccess={showSuccess} showError={showError} showConfirm={showConfirm} closeModal={closeModal} selectedReason={selectedReason} setSelectedReason={setSelectedReason} customReason={customReason} setCustomReason={setCustomReason} cancellationError={cancellationError} setCancellationError={setCancellationError} selectedReasonRef={selectedReasonRef} customReasonRef={customReasonRef} refetchMarkets={fetchMarkets} />}
            {activeTab === "fees" && (
              <FeesTab
                markets={markets}
                account={account}
                showSuccess={showSuccess}
                showError={showError}
                refetchMarkets={fetchMarkets}
              />
            )}
            {activeTab === "creators" && <CreatorsTab account={account} showSuccess={showSuccess} showError={showError} showConfirm={showConfirm} />}
            {activeTab === "upgrades" && <UpgradesTab markets={markets} account={account} showSuccess={showSuccess} showError={showError} showConfirm={showConfirm} refetchMarkets={fetchMarkets} />}
            {activeTab === "settings" && <SettingsTab />}
          </>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        showCancel={modal.showCancel}
      >
        {/* Cancellation reason input (only shown for cancel market modal) */}
        {modal.title === "Cancel Market" && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-300">
              Reason for Cancellation *
            </label>
            
            {/* Predefined Reasons */}
            <div className="space-y-2">
              {[
                "No trading activity - returning liquidity to creator",
                "Duplicate market created",
                "Incorrect market details or outcomes",
                "External circumstances make market invalid",
                "Technical issues with market configuration",
                "Other (specify below)"
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setSelectedReason(reason);
                    setCancellationError(""); // Clear error when selection changes
                    if (reason !== "Other (specify below)") {
                      setCustomReason("");
                    }
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedReason === reason
                      ? 'bg-[#00D1FF]/10 border-[#00D1FF]/50 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedReason === reason
                        ? 'border-[#00D1FF] bg-[#00D1FF]'
                        : 'border-gray-500'
                    }`}>
                      {selectedReason === reason && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-sm">{reason}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Reason Input (only shown when "Other" is selected) */}
            {selectedReason === "Other (specify below)" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <textarea
                  id="custom-cancellation-reason"
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value);
                    setCancellationError(""); // Clear error when typing
                  }}
                  placeholder="Please specify the reason for cancellation..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00D1FF]/50 transition-all resize-none"
                  maxLength={200}
                  autoFocus
                />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Minimum 10 characters</span>
                  <span className={`${customReason.length >= 10 ? 'text-green-400' : 'text-gray-500'}`}>
                    {customReason.length}/200
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {cancellationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{cancellationError}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}

// ============================================================================
// Markets Tab - Manage all markets
// ============================================================================

function MarketsTab({ 
  markets, 
  account,
  showSuccess,
  showError,
  showConfirm,
  closeModal,
  selectedReason,
  setSelectedReason,
  customReason,
  setCustomReason,
  cancellationError,
  setCancellationError,
  selectedReasonRef,
  customReasonRef,
  refetchMarkets,
}: { 
  markets: Market[]; 
  account: any;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  closeModal: () => void;
  selectedReason: string;
  setSelectedReason: (reason: string) => void;
  customReason: string;
  setCustomReason: (reason: string) => void;
  cancellationError: string;
  setCancellationError: (error: string) => void;
  selectedReasonRef: React.MutableRefObject<string>;
  customReasonRef: React.MutableRefObject<string>;
  refetchMarkets: (showLoading?: boolean) => Promise<void>;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved" | "closed" | "canceled">("all");

  async function handleResolve(market: Market, winningOutcome: number) {
    // Show confirmation modal
    const outcomeName = market.outcomes[winningOutcome];
    showConfirm(
      "Resolve Market?",
      `Are you sure you want to resolve "${market.question}" with outcome "${outcomeName}"?\n\nThis action cannot be undone. Winners will be able to claim their winnings.`,
      () => {
        // Execute resolution in a separate async function
        executeResolve(market, winningOutcome, outcomeName);
      }
    );
  }

  async function executeResolve(market: Market, winningOutcome: number, outcomeName: string) {
    // Close modal and wait for next tick
    closeModal();
    
    // Use setTimeout to ensure modal is closed before proceeding
    setTimeout(async () => {
      setActionLoading(market.address);
      try {
        const treasury = getProtocolTreasury();
        const resolveTx = prepareContractCall({
          contract: treasury,
          method: "function resolveMarket(address market, uint256 winningOutcome) external",
          params: [market.address, BigInt(winningOutcome)],
        });
        await sendTransaction({ transaction: resolveTx, account });
        showSuccess(`Market resolved successfully! Winning outcome: "${outcomeName}"`);
        await refetchMarkets(false);
      } catch (err: any) {
        console.error("Resolve error:", err);
        showError(err);
      } finally {
        setActionLoading(null);
      }
    }, 200);
  }

  async function handlePause(market: Market, paused: boolean) {
    setActionLoading(market.address);
    try {
      const treasury = getProtocolTreasury();
      const pauseTx = prepareContractCall({
        contract: treasury,
        method: "function pauseMarket(address market, bool paused) external",
        params: [market.address, paused],
      });
      await sendTransaction({ transaction: pauseTx, account });
      showSuccess(`Market ${paused ? "paused" : "unpaused"} successfully!`);
      await refetchMarkets(false); // Refetch to update UI
    } catch (err: any) {
      console.error("Pause error:", err);
      showError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClose(market: Market) {
    setActionLoading(market.address);
    try {
      const treasury = getProtocolTreasury();
      const closeTx = prepareContractCall({
        contract: treasury,
        method: "function closeMarket(address market) external",
        params: [market.address],
      });
      await sendTransaction({ transaction: closeTx, account });
      showSuccess("Market closed successfully!");
      await refetchMarkets(false); // Refetch to update UI
    } catch (err: any) {
      console.error("Close error:", err);
      showError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(market: Market) {
    showConfirm(
      "Cancel Market",
      "Are you sure you want to cancel this market? This will enable refunds for all participants.",
      async () => {
        // Clear any previous error
        setCancellationError("");
        
        // Get LATEST values from refs (solves closure problem!)
        const currentReason = selectedReasonRef.current;
        const currentCustom = customReasonRef.current;
        
        console.log("🔍 Selected reason:", currentReason);
        console.log("🔍 Custom reason:", currentCustom);
        
        // Validate reason selection
        if (!currentReason) {
          console.log("❌ Validation failed: No reason selected");
          setCancellationError("Please select a cancellation reason");
          return false; // Return false to keep modal open
        }

        // If "Other" is selected, validate custom reason
        if (currentReason === "Other (specify below)") {
          if (!currentCustom || currentCustom.trim().length < 10) {
            setCancellationError("Please provide a custom reason (at least 10 characters)");
            return false; // Return false to keep modal open
          }
        }

        // Determine final reason to send
        const finalReason = currentReason === "Other (specify below)" 
          ? currentCustom.trim() 
          : currentReason;

        setActionLoading(market.address);
        try {
          const treasury = getProtocolTreasury();
          const cancelTx = prepareContractCall({
            contract: treasury,
            method: "function cancelMarket(address market, string reason) external",
            params: [market.address, finalReason],
          });
          const receipt = await sendTransaction({ transaction: cancelTx, account });
          
          // Wait a bit for blockchain state to update (1 second)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Clear states after success
          setSelectedReason("");
          setCustomReason("");
          setActionLoading(null);
          
          showSuccess("Market canceled successfully!");
          
          // Refetch markets to update UI (no loading skeleton)
          await refetchMarkets(false);
          
          return true; // Allow modal to close
        } catch (err: any) {
          setActionLoading(null);
          console.error("Cancel error:", err);
          setCancellationError(formatErrorMessage(err));
          return false; // Return false to keep modal open on error
        }
      }
    );
  }

  // Filter markets based on selected status
  const filteredMarkets = markets.filter((market) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return market.status === 0 && !market.resolved;
    if (filterStatus === "resolved") return market.status === 2 || market.resolved;
    if (filterStatus === "closed") return market.status === 1;
    if (filterStatus === "canceled") return market.status === 3;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 bg-[#13131A] p-1 rounded-xl border border-white/10 w-fit">
        <FilterButton
          active={filterStatus === "all"}
          onClick={() => setFilterStatus("all")}
          count={markets.length}
        >
          All
        </FilterButton>
        <FilterButton
          active={filterStatus === "active"}
          onClick={() => setFilterStatus("active")}
          count={markets.filter(m => m.status === 0 && !m.resolved).length}
        >
          Active
        </FilterButton>
        <FilterButton
          active={filterStatus === "resolved"}
          onClick={() => setFilterStatus("resolved")}
          count={markets.filter(m => m.status === 2 || m.resolved).length}
        >
          Resolved
        </FilterButton>
        <FilterButton
          active={filterStatus === "closed"}
          onClick={() => setFilterStatus("closed")}
          count={markets.filter(m => m.status === 1).length}
        >
          Closed
        </FilterButton>
        <FilterButton
          active={filterStatus === "canceled"}
          onClick={() => setFilterStatus("canceled")}
          count={markets.filter(m => m.status === 3).length}
        >
          Canceled
        </FilterButton>
      </div>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMarkets.length === 0 ? (
          <div className="col-span-full bg-[#13131A] border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-gray-400">
              {filterStatus === "all" 
                ? "No markets found" 
                : `No ${filterStatus} markets found`}
            </p>
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <MarketAdminCard
              key={market.address}
              market={market}
              onResolve={handleResolve}
              onPause={handlePause}
              onClose={handleClose}
              onCancel={handleCancel}
              isLoading={actionLoading === market.address}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-[#00D1FF] to-[#FF00AA] text-white"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
      <span className={`ml-2 ${active ? "text-white/80" : "text-gray-500"}`}>
        ({count})
      </span>
    </button>
  );
}

function MarketAdminCard({
  market,
  onResolve,
  onPause,
  onClose,
  onCancel,
  isLoading,
}: {
  market: Market;
  onResolve: (market: Market, outcome: number) => void;
  onPause: (market: Market, paused: boolean) => void;
  onClose: (market: Market) => void;
  onCancel: (market: Market) => void;
  isLoading: boolean;
}) {
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  // Check if market has ended
  const hasEnded = now >= market.endTime;
  const isResolved = market.resolved;

  // Check if market had any trading (prices moved from initial 50/50)
  const hasTrading = market.prices.some(price => Math.abs(price - 50.0) > 0.1);

  // Admin can resolve ANYTIME - even active markets (no restrictions)
  // Resolving an active market ends it early
  const canAdminResolve = true;

  // Determine status (MarketStatus enum: 0=ACTIVE, 1=CLOSED, 2=RESOLVED, 3=CANCELED)
  let statusText = "Active";
  let statusColor = "bg-green-500/10 text-green-400 border-green-500/20";

  if (market.status === 3) {
    statusText = "Canceled";
    statusColor = "bg-red-500/10 text-red-400 border-red-500/20";
  } else if (market.status === 2 || isResolved) {
    statusText = "Resolved";
    statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  } else if (hasEnded && market.status === 0) {
    statusText = "Ended";
    statusColor = "bg-orange-500/10 text-orange-400 border-orange-500/20";
  } else if (market.status === 1) {
    statusText = "Closed";
    statusColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#13131A] border border-white/10 rounded-xl p-4 space-y-3 flex flex-col h-full"
    >
      {/* Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${statusColor}`}>
          {statusText}
        </span>
        <a
          href={`https://sepolia.basescan.org/address/${market.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors"
          title={market.address}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight min-h-[2.5rem]">
        {market.question}
      </h3>

      {/* Liquidity */}
      <div className="text-xs text-gray-400">
        Liquidity: <span className="text-white font-medium">{formatPMT(market.totalReserves)}</span>
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-2 gap-2">
        {market.outcomes.map((outcome, index) => (
          <div
            key={index}
            className="p-2 bg-white/5 rounded-lg border border-white/10"
          >
            <div className="text-xs text-gray-400 truncate">{outcome}</div>
            <div className="text-base font-bold text-[#00D1FF]">
              {market.prices[index].toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-3 border-t border-white/5 mt-auto">
        {/* Info banner for ended markets with no trading */}
        {hasEnded && !isResolved && !hasTrading && (
          <div className="w-full flex items-start gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              No trading. You can Resolve or Cancel this market.
            </p>
          </div>
        )}

        {/* Resolve - Admin can resolve any market anytime */}
        {!market.resolved && market.status !== 3 && (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2">
              <select
                value={selectedOutcome}
                onChange={(e) => setSelectedOutcome(parseInt(e.target.value))}
                className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs"
              >
                {market.outcomes.map((outcome, index) => (
                  <option key={index} value={index}>
                    {outcome}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onResolve(market, selectedOutcome)}
                disabled={isLoading}
                className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-green-400 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title={hasEnded ? "Resolve market with selected outcome" : "Resolve and end market early with selected outcome"}
              >
                <CheckCircle className="w-3 h-3 inline mr-1" />
                Resolve
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-1.5">
          {/* Pause/Unpause */}
          {market.status === 1 && (
            <button
              onClick={() => onPause(market, true)}
              disabled={isLoading}
              className="flex-1 min-w-[80px] px-2 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-lg text-yellow-400 text-xs font-medium transition-colors disabled:opacity-50"
              title="Pause Market"
            >
              <Pause className="w-3 h-3 inline" />
            </button>
          )}

          {/* Close */}
          {market.status === 1 && !market.resolved && (
            <button
              onClick={() => onClose(market)}
              disabled={isLoading}
              className="flex-1 min-w-[80px] px-2 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-blue-400 text-xs font-medium transition-colors disabled:opacity-50"
              title="Close Trading"
            >
              Close
            </button>
          )}

          {/* Cancel */}
          {!market.resolved && market.status !== 3 && (
            <button
              onClick={() => onCancel(market)}
              disabled={isLoading}
              className="flex-1 min-w-[80px] px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
              title="Cancel Market"
            >
              <XCircle className="w-3 h-3 inline mr-1" />
              Cancel
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Fees Tab - Collect protocol fees
// ============================================================================

function FeesTab({ 
  markets, 
  account,
  showSuccess,
  showError,
  refetchMarkets,
}: { 
  markets: Market[]; 
  account: any;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  refetchMarkets: (showLoading?: boolean) => Promise<void>;
}) {
  const [collectingFees, setCollectingFees] = useState<string | null>(null);
  const [collectingAll, setCollectingAll] = useState(false);
  const [totalCreationFees, setTotalCreationFees] = useState<bigint>(BigInt(0));
  const [marketCreationFee, setMarketCreationFee] = useState<bigint>(BigInt(0));

  // Fetch creation fee stats
  useEffect(() => {
    async function fetchCreationFees() {
      try {
        const factory = getMarketFactory();
        
        const [totalFees, currentFee] = await Promise.all([
          readContract({
            contract: factory,
            method: "function totalCreationFeesCollected() view returns (uint256)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function marketCreationFee() view returns (uint256)",
            params: [],
          }),
        ]);
        
        setTotalCreationFees(totalFees as bigint);
        setMarketCreationFee(currentFee as bigint);
      } catch (error) {
        console.error("Error fetching creation fees:", error);
      }
    }
    
    if (account) {
      fetchCreationFees();
    }
  }, [account]);

  // Calculate total fees across all markets
  const totalFees = markets.reduce((sum, market) => sum + Number(market.accumulatedProtocolFees), 0);
  const marketsWithFees = markets.filter(market => Number(market.accumulatedProtocolFees) > 0);

  async function handleCollectFees(marketAddress: string) {
    setCollectingFees(marketAddress);
    try {
      const treasury = getProtocolTreasury();
      const collectTx = prepareContractCall({
        contract: treasury,
        method: "function collectProtocolFees(address market, address to) external",
        params: [marketAddress, account.address],
      });
      await sendTransaction({ transaction: collectTx, account });
      showSuccess("Fees collected successfully!");
      await refetchMarkets(false);
    } catch (err: any) {
      console.error("Collect fees error:", err);
      showError(err);
    } finally {
      setCollectingFees(null);
    }
  }

  async function handleCollectAllFees() {
    if (marketsWithFees.length === 0) return;
    
    setCollectingAll(true);
    try {
      const treasury = getProtocolTreasury();
      
      // Collect from each market with fees
      for (const market of marketsWithFees) {
        const collectTx = prepareContractCall({
          contract: treasury,
          method: "function collectProtocolFees(address market, address to) external",
          params: [market.address, account.address],
        });
        await sendTransaction({ transaction: collectTx, account });
      }
      
      showSuccess(`Collected fees from ${marketsWithFees.length} market(s) successfully!`);
      await refetchMarkets(false);
    } catch (err: any) {
      console.error("Collect all fees error:", err);
      showError(err);
    } finally {
      setCollectingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">Fee Collection</h2>
            <p className="text-gray-400 text-sm">
              Collect accumulated protocol fees from each market. Fees will be sent to your wallet.
            </p>
          </div>
          {marketsWithFees.length > 1 && (
            <button
              onClick={handleCollectAllFees}
              disabled={collectingAll}
              className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              {collectingAll ? "Collecting All..." : `Collect All (${marketsWithFees.length})`}
            </button>
          )}
        </div>

        {/* Total Fees Summary */}
        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
          <div className="w-12 h-12 bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-400">Total Collectable Fees</div>
            <div className="text-2xl font-bold text-white">
              {formatPMT(BigInt(totalFees))}
            </div>
          </div>
          <div className="text-sm text-gray-400">
            {marketsWithFees.length} of {markets.length} markets
          </div>
        </div>
      </div>

      {/* Market Creation Fees Card */}
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Market Creation Fees</h2>
        <p className="text-gray-400 text-sm mb-6">
          Fees charged when creators create new markets. These fees go directly to the treasury.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Current Fee Amount */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Current Creation Fee</div>
                <div className="text-lg font-bold text-white">
                  {formatPMT(marketCreationFee)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Charged per market created
            </div>
          </div>

          {/* Total Collected */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Total Fees Collected</div>
                <div className="text-lg font-bold text-white">
                  {formatPMT(totalCreationFees)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              From {markets.length} market{markets.length !== 1 ? 's' : ''} created
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <div className="font-semibold mb-1">About Creation Fees</div>
              <div className="text-blue-300/80">
                Market creation fees are collected automatically when a creator makes a new market.
                These fees help prevent spam and support platform operations. They are sent directly
                to the treasury address and don&apos;t require manual collection.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Fees from Markets */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Trading Fees (Protocol)</h2>
        <p className="text-gray-400 text-sm mb-6">
          Accumulated trading fees from market activities. Collect fees from resolved markets.
        </p>
      </div>

      {/* Markets */}
      <div className="space-y-4">
        {markets.map((market) => {
          const hasFees = Number(market.accumulatedProtocolFees) > 0;
          const isResolved = market.status === 2 || market.resolved;
          const isCanceled = market.status === 3;
          const canCollect = hasFees && isResolved;
          
          // Determine status badge
          let statusBadge = null;
          if (isCanceled) {
            statusBadge = (
              <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-medium border border-red-500/20">
                Canceled
              </span>
            );
          } else if (isResolved) {
            statusBadge = (
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-medium border border-blue-500/20">
                Resolved
              </span>
            );
          } else if (market.status === 0) {
            statusBadge = (
              <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium border border-green-500/20">
                Active
              </span>
            );
          }
          
          return (
            <div
              key={market.address}
              className="bg-[#13131A] border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {market.question}
                    </h3>
                    {statusBadge}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <span>Protocol Fee Rate:</span>
                      <span className="text-white font-medium">{formatBps(market.protocolFeeBps)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span>Accumulated Fees:</span>
                      <span className={`font-bold ${hasFees ? 'text-[#00D1FF]' : 'text-gray-500'}`}>
                        {formatPMT(market.accumulatedProtocolFees)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span>Liquidity:</span>
                      <span className="text-white">{formatPMT(market.totalReserves)}</span>
                    </div>
                  </div>
                </div>
                
                {canCollect ? (
                  <button
                    onClick={() => handleCollectFees(market.address)}
                    disabled={collectingFees === market.address || collectingAll}
                    className="px-6 py-3 bg-gradient-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    {collectingFees === market.address ? "Collecting..." : "Collect Fees"}
                  </button>
                ) : hasFees && !isResolved ? (
                  <div className="px-6 py-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {isCanceled ? "Market canceled" : "Only collect on resolved markets"}
                  </div>
                ) : (
                  <div className="px-6 py-3 bg-white/5 rounded-xl text-gray-500 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    No fees yet
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Settings Tab - Platform configuration
// ============================================================================

function CreatorsTab({ 
  account,
  showSuccess,
  showError,
  showConfirm,
}: { 
  account: any;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}) {
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [currentCreators, setCurrentCreators] = useState<Array<{address: string, marketCount: number}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ address: string; action: 'approve' | 'reject' | 'revoke' } | null>(null);

  useEffect(() => {
    async function fetchCreatorData() {
      try {
        const registry = getCreatorRegistry();

        // Fetch pending creator requests
        const pending = await readContract({
          contract: registry,
          method: "function getPendingCreatorRequests() view returns (address[])",
          params: [],
        });
        setPendingRequests(pending as string[]);

        // Fetch all creators with their market counts
        const creators = await readContract({
          contract: registry,
          method: "function getAllCreators() view returns (address[])",
          params: [],
        });

        // Fetch market count for each creator
        const creatorsWithCounts = await Promise.all(
          (creators as string[]).map(async (creatorAddress) => {
            const count = await readContract({
              contract: registry,
              method: "function getCreatorMarketCount(address) view returns (uint256)",
              params: [creatorAddress as `0x${string}`],
            });
            return {
              address: creatorAddress,
              marketCount: Number(count),
            };
          })
        );

        // Sort by market count (most active first)
        creatorsWithCounts.sort((a, b) => b.marketCount - a.marketCount);
        setCurrentCreators(creatorsWithCounts);
      } catch (err) {
        console.error("Error fetching creator data:", err);
        setPendingRequests([]);
        setCurrentCreators([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCreatorData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchCreatorData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleApprove(userAddress: string) {
    if (!account) return;

    setActionLoading({ address: userAddress, action: 'approve' });
    try {
      const registry = getCreatorRegistry();
      const tx = prepareContractCall({
        contract: registry,
        method: "function approveCreator(address user)",
        params: [userAddress as `0x${string}`],
      });

      await sendTransaction({ transaction: tx, account });

      // Remove from pending list
      setPendingRequests(prev => prev.filter(addr => addr !== userAddress));
      showSuccess(`Approved ${shortenAddress(userAddress)} as creator!`);
    } catch (err: any) {
      console.error("Approve error:", err);
      showError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(userAddress: string) {
    if (!account) return;

    setActionLoading({ address: userAddress, action: 'reject' });
    try {
      const registry = getCreatorRegistry();
      const tx = prepareContractCall({
        contract: registry,
        method: "function rejectCreatorRequest(address user)",
        params: [userAddress as `0x${string}`],
      });

      await sendTransaction({ transaction: tx, account });

      // Remove from pending list
      setPendingRequests(prev => prev.filter(addr => addr !== userAddress));
      showSuccess(`Rejected request from ${shortenAddress(userAddress)}`);
    } catch (err: any) {
      console.error("Reject error:", err);
      showError(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(userAddress: string) {
    if (!account) return;

    const marketCount = currentCreators.find(c => c.address === userAddress)?.marketCount || 0;
    
    showConfirm(
      "Revoke Creator Access",
      `Are you sure you want to revoke creator access for ${shortenAddress(userAddress)}?\n\nThey have created ${marketCount} market(s).`,
      async () => {
        setActionLoading({ address: userAddress, action: 'revoke' });
        try {
          const registry = getCreatorRegistry();
          const tx = prepareContractCall({
            contract: registry,
            method: "function revokeCreator(address user)",
            params: [userAddress as `0x${string}`],
          });

          await sendTransaction({ transaction: tx, account });

          // Remove from creators list
          setCurrentCreators(prev => prev.filter(creator => creator.address !== userAddress));
          showSuccess(`Revoked creator access for ${shortenAddress(userAddress)}`);
        } catch (err: any) {
          console.error("Revoke error:", err);
          showError(err);
        } finally {
          setActionLoading(null);
        }
      }
    );
  }

  if (isLoading) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 mx-auto border-4 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
        <p className="text-gray-400 mt-4">Loading creator requests...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pending Requests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#13131A] border border-white/10 rounded-2xl p-6 flex flex-col h-[calc(100vh-16rem)]"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Pending Creator Requests</h3>
              <p className="text-sm text-gray-400">Review and approve users who want to create markets</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-full text-sm font-medium">
            {pendingRequests.length} Pending
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No pending creator requests</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar">
            {pendingRequests.map((address) => (
              <div
                key={address}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center text-white font-bold">
                    {address.slice(2, 4).toUpperCase()}
                  </div>
                  <div>
                    <a
                      href={`https://sepolia.basescan.org/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors"
                    >
                      {shortenAddress(address)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <div className="text-sm text-gray-400">Wallet Address</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(address)}
                    disabled={actionLoading?.address === address}
                    className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {actionLoading?.address === address && actionLoading?.action === 'approve' ? "Approving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleReject(address)}
                    disabled={actionLoading?.address === address}
                    className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    {actionLoading?.address === address && actionLoading?.action === 'reject' ? "Rejecting..." : "Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Current Creators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#13131A] border border-white/10 rounded-2xl p-6 flex flex-col h-[calc(100vh-16rem)]"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Current Creators</h3>
              <p className="text-sm text-gray-400">Active creators and their market activity</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium">
            {currentCreators.length} Active
          </span>
        </div>

        {currentCreators.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No approved creators yet</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar">
            {currentCreators.map((creator) => (
              <div
                key={creator.address}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-linear-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                    {creator.address.slice(2, 4).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <a
                        href={`https://sepolia.basescan.org/address/${creator.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-mono text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors"
                      >
                        {shortenAddress(creator.address)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        creator.marketCount === 0 
                          ? 'bg-red-500/10 text-red-400' 
                          : creator.marketCount < 3
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'bg-green-500/10 text-green-400'
                      }`}>
                        {creator.marketCount} {creator.marketCount === 1 ? 'Market' : 'Markets'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {creator.marketCount === 0 
                        ? '⚠️ Inactive - No markets created' 
                        : creator.marketCount < 3
                          ? '📊 Moderately Active'
                          : '🚀 Highly Active'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRevoke(creator.address)}
                  disabled={actionLoading?.address === creator.address}
                  className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {actionLoading?.address === creator.address && actionLoading?.action === 'revoke' ? "Revoking..." : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SettingsTab() {
  return <SettingsPanel />;
}

// ============================================================================
// Helper Components
// ============================================================================

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
        active
          ? "bg-linear-to-r from-[#00D1FF] to-[#FF00AA] text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function ConnectWalletPrompt() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center p-4">
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-full flex items-center justify-center">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Admin Access Required</h1>
        <p className="text-gray-400">Connect your wallet to access the admin dashboard</p>
      </div>
    </main>
  );
}

// ============================================================================
// Upgrades Tab - Upgrade markets to new implementations
// ============================================================================

function UpgradesTab({ 
  markets, 
  account,
  showSuccess,
  showError,
  showConfirm,
  refetchMarkets,
}: { 
  markets: Market[]; 
  account: any;
  showSuccess: (title: string, message: string) => void;
  showError: (error: any) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  refetchMarkets: (showLoading?: boolean) => Promise<void>;
}) {
  const [upgradingAll, setUpgradingAll] = useState(false);
  const [upgradingMarket, setUpgradingMarket] = useState<string | null>(null);

  async function handleUpgradeAll() {
    if (!account) return;

    showConfirm(
      "Upgrade All Markets",
      `This will upgrade all ${markets.length} markets to the latest implementation. This operation may take some time and cost gas. Are you sure?`,
      async () => {
        setUpgradingAll(true);
        try {
          const factory = getMarketFactory();
          const tx = prepareContractCall({
            contract: factory,
            method: "function upgradeAllMarkets(uint256 startIndex, uint256 count)",
            params: [0n, 0n], // 0, 0 = upgrade all markets
          });

          const receipt = await sendTransaction({ transaction: tx, account });

          // Parse the BatchMarketUpgrade event to get actual upgrade count
          // Event: BatchMarketUpgrade(uint256 startIndex, uint256 endIndex, uint256 upgraded)
          console.log("Upgrade receipt:", receipt);

          showSuccess(
            "Markets Upgraded!",
            `Upgrade transaction completed! Please verify the results on individual markets.`
          );

          await refetchMarkets(false);
        } catch (err: any) {
          console.error("Upgrade all error:", err);
          showError(err);
        } finally {
          setUpgradingAll(false);
        }
      }
    );
  }

  async function handleUpgradeMarket(marketAddress: string, marketName: string) {
    if (!account) return;

    showConfirm(
      "Upgrade Market",
      `Upgrade "${marketName}" to the latest implementation? This will fix any bugs and add new features.`,
      async () => {
        setUpgradingMarket(marketAddress);
        try {
          const factory = getMarketFactory();
          
          // Get the current market implementation from factory
          const currentImpl = await readContract({
            contract: factory,
            method: "function marketImplementation() view returns (address)",
            params: [],
          }) as `0x${string}`;

          const tx = prepareContractCall({
            contract: factory,
            method: "function upgradeMarket(address market, address newImplementation)",
            params: [marketAddress as `0x${string}`, currentImpl],
          });

          await sendTransaction({ transaction: tx, account });

          showSuccess(
            "Market Upgraded!",
            `Successfully upgraded "${marketName}" to the latest implementation!`
          );

          await refetchMarkets(false);
        } catch (err: any) {
          console.error("Upgrade market error:", err);
          showError(err);
        } finally {
          setUpgradingMarket(null);
        }
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Upgrade All button */}
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Market Upgrades</h2>
            <p className="text-gray-400">
              Upgrade markets to the latest implementation to fix bugs and add new features.
            </p>
          </div>
          <button
            onClick={handleUpgradeAll}
            disabled={upgradingAll || markets.length === 0}
            className="px-6 py-3 bg-gradient-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {upgradingAll ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Upgrading...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Upgrade All ({markets.length})
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Total Markets</div>
                <div className="text-2xl font-bold text-white">{markets.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Active Markets</div>
                <div className="text-2xl font-bold text-white">
                  {markets.filter(m => m.status === 0).length}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Upgradeable</div>
                <div className="text-2xl font-bold text-white">{markets.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <div className="font-semibold mb-1">About Market Upgrades</div>
              <div className="text-blue-300/80">
                Upgrading markets allows you to fix bugs, add new features, and improve existing markets without losing data or creating new contracts. All market data (trades, balances, liquidity) is preserved.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Markets List */}
      <div className="space-y-4">
        {markets.length === 0 ? (
          <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 text-center">
            <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-gray-400">No markets found</p>
          </div>
        ) : (
          markets.map((market) => {
            const isUpgrading = upgradingMarket === market.address;
            const isResolved = market.status === 2 || market.resolved;
            const isCanceled = market.status === 3;
            
            let statusColor = "bg-green-500/10 text-green-400 border-green-500/20";
            let statusText = "Active";
            
            if (isCanceled) {
              statusColor = "bg-red-500/10 text-red-400 border-red-500/20";
              statusText = "Canceled";
            } else if (isResolved) {
              statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
              statusText = "Resolved";
            } else if (market.status === 1) {
              statusColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
              statusText = "Closed";
            }

            return (
              <div
                key={market.address}
                className="bg-[#13131A] border border-white/10 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {market.question}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor} shrink-0`}>
                        {statusText}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-3">
                      <div className="flex items-center gap-1">
                        <span>Liquidity:</span>
                        <span className="text-white font-medium">{formatPMT(market.totalReserves)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Volume:</span>
                        <span className="text-white font-medium">{formatPMT(market.totalVolume)}</span>
                      </div>
                      <a 
                        href={`https://sepolia.basescan.org/address/${market.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <span>{shortenAddress(market.address)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="text-xs text-gray-500">
                      {market.outcomes.join(" • ")}
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpgradeMarket(market.address, market.question)}
                    disabled={isUpgrading || upgradingAll}
                    className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-purple-400 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                  >
                    {isUpgrading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Upgrade
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NotAuthorized() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center p-4">
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Not Authorized</h1>
        <p className="text-gray-400">
          You don&apos;t have permission to access this page. Only the contract owner can access the admin dashboard.
        </p>
        <Link href="/">
          <button className="mt-4 px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity">
            Back to Home
          </button>
        </Link>
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-[#13131A] border border-white/10 rounded-2xl p-6 animate-pulse"
        >
          <div className="h-6 bg-white/5 rounded w-3/4 mb-4" />
          <div className="h-4 bg-white/5 rounded w-1/2 mb-6" />
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="h-20 bg-white/5 rounded" />
            <div className="h-20 bg-white/5 rounded" />
          </div>
          <div className="h-10 bg-white/5 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

