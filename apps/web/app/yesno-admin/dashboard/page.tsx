"use client";

/**
 * Admin Dashboard
 * Comprehensive admin panel for managing prediction markets
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Shield, 
  CheckCircle, 
  XCircle, 
  Pause, 
  Play, 
  DollarSign,
  Settings,
  AlertTriangle,
  BarChart3,
  Users
} from "lucide-react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { getMarketFactory, getProtocolTreasury, getMarket } from "@/lib/contracts";
import { getAllMarkets, getMarketDetails, type Market } from "@/lib/markets";
import { formatPMT, formatDate, shortenAddress } from "@/lib/format";

export default function AdminDashboard() {
  const account = useActiveAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [activeSection, setActiveSection] = useState<"markets" | "settings" | "emergency">("markets");

  // Check if user is owner
  useEffect(() => {
    async function checkOwner() {
      if (!account) return;
      
      try {
        const factory = getMarketFactory();
        const owner = await readContract({
          contract: factory,
          method: "function owner() view returns (address)",
          params: [],
        });
        
        setIsOwner(owner === account.address);
      } catch (error) {
        console.error("Error checking owner:", error);
      }
    }

    checkOwner();
  }, [account]);

  // Fetch markets
  useEffect(() => {
    async function fetchMarkets() {
      setIsLoading(true);
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
        setIsLoading(false);
      }
    }

    fetchMarkets();
  }, []);

  if (!account) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] py-12 px-4 flex items-center justify-center">
        <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 max-w-md text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-gray-600" />
          <h1 className="text-2xl font-bold text-white">Admin Access Required</h1>
          <p className="text-gray-400">Connect your wallet to access the admin dashboard</p>
        </div>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] py-12 px-4 flex items-center justify-center">
        <div className="bg-[#13131A] border border-red-500/20 rounded-2xl p-12 max-w-md text-center space-y-4">
          <AlertTriangle className="w-16 h-16 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-gray-400">
            You are not the owner of this contract. Admin access is restricted to the contract owner.
          </p>
          <div className="text-sm text-gray-500">
            Connected: {shortenAddress(account.address)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold bg-linear-to-r from-[#00D1FF] to-[#FF00AA] bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-400">
              Manage markets, collect fees, and configure platform settings
            </p>
          </div>
          <Link href="/">
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors">
              Back to Markets
            </button>
          </Link>
        </div>

        {/* Stats */}
        <StatsGrid markets={markets} />

        {/* Navigation */}
        <div className="flex gap-2 bg-[#13131A] p-1 rounded-xl border border-white/10 w-fit">
          <NavButton
            active={activeSection === "markets"}
            onClick={() => setActiveSection("markets")}
            icon={<BarChart3 className="w-4 h-4" />}
          >
            Market Management
          </NavButton>
          <NavButton
            active={activeSection === "settings"}
            onClick={() => setActiveSection("settings")}
            icon={<Settings className="w-4 h-4" />}
          >
            Settings
          </NavButton>
          <NavButton
            active={activeSection === "emergency"}
            onClick={() => setActiveSection("emergency")}
            icon={<AlertTriangle className="w-4 h-4" />}
          >
            Emergency Controls
          </NavButton>
        </div>

        {/* Content */}
        {activeSection === "markets" && (
          <MarketManagement markets={markets} account={account} onUpdate={() => fetchMarkets()} />
        )}
        {activeSection === "settings" && <SettingsPanel />}
        {activeSection === "emergency" && <EmergencyPanel markets={markets} />}
      </div>
    </main>
  );
}

function StatsGrid({ markets }: { markets: Market[] }) {
  const activeMarkets = markets.filter((m) => m.status === 1 && !m.resolved).length;
  const resolvedMarkets = markets.filter((m) => m.resolved).length;
  const totalLiquidity = markets.reduce((sum, m) => sum + Number(m.totalReserves), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        icon={<BarChart3 className="w-6 h-6 text-blue-400" />}
        label="Total Markets"
        value={markets.length.toString()}
      />
      <StatCard
        icon={<Play className="w-6 h-6 text-green-400" />}
        label="Active Markets"
        value={activeMarkets.toString()}
      />
      <StatCard
        icon={<CheckCircle className="w-6 h-6 text-purple-400" />}
        label="Resolved"
        value={resolvedMarkets.toString()}
      />
      <StatCard
        icon={<DollarSign className="w-6 h-6 text-yellow-400" />}
        label="Total Liquidity"
        value={formatPMT(BigInt(totalLiquidity))}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#13131A] border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function NavButton({
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
      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
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

// Import sub-components
function MarketManagement({
  markets,
  account,
  onUpdate,
}: {
  markets: Market[];
  account: any;
  onUpdate: () => void;
}) {
  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4">
      <h2 className="text-2xl font-semibold text-white mb-4">Market Management</h2>
      
      {markets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No markets found
        </div>
      ) : (
        <div className="space-y-3">
          {markets.map((market) => (
            <MarketRow key={market.address} market={market} account={account} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketRow({ market, account, onUpdate }: { market: Market; account: any; onUpdate: () => void }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleResolve(outcomeIndex: number) {
    setIsLoading(true);
    try {
      const treasury = getProtocolTreasury();
      const resolveTx = prepareContractCall({
        contract: treasury,
        method: "function resolveMarket(address market, uint256 winningOutcome) external",
        params: [market.address, BigInt(outcomeIndex)],
      });
      await sendTransaction({ transaction: resolveTx, account });
      alert("Market resolved successfully!");
      onUpdate();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePause() {
    setIsLoading(true);
    try {
      const treasury = getProtocolTreasury();
      const pauseTx = prepareContractCall({
        contract: treasury,
        method: "function pauseMarket(address market, bool paused) external",
        params: [market.address, true],
      });
      await sendTransaction({ transaction: pauseTx, account });
      alert("Market paused!");
      onUpdate();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCollectFees() {
    setIsLoading(true);
    try {
      const treasury = getProtocolTreasury();
      const collectTx = prepareContractCall({
        contract: treasury,
        method: "function collectProtocolFees(address market, address to) external",
        params: [market.address, account.address],
      });
      await sendTransaction({ transaction: collectTx, account });
      alert("Fees collected!");
      onUpdate();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this market? This will refund all users.")) {
      return;
    }
    
    setIsLoading(true);
    try {
      const treasury = getProtocolTreasury();
      const cancelTx = prepareContractCall({
        contract: treasury,
        method: "function cancelMarket(address market) external",
        params: [market.address],
      });
      await sendTransaction({ transaction: cancelTx, account });
      alert("Market canceled!");
      onUpdate();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white/5 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1">{market.question}</h3>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{shortenAddress(market.address)}</span>
            <span>•</span>
            <span>Ends: {formatDate(market.endTime)}</span>
            <span>•</span>
            <span>Liquidity: {formatPMT(market.totalReserves)}</span>
          </div>
        </div>
        <StatusBadge market={market} />
      </div>

      {/* Actions */}
      {!market.resolved && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const outcome = prompt(`Enter winning outcome index (0-${market.outcomes.length - 1}):`);
              if (outcome !== null) {
                handleResolve(parseInt(outcome));
              }
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50 text-sm"
          >
            <CheckCircle className="w-4 h-4 inline mr-1" />
            Resolve
          </button>
          <button
            onClick={handlePause}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors disabled:opacity-50 text-sm"
          >
            <Pause className="w-4 h-4 inline mr-1" />
            Pause
          </button>
          <button
            onClick={handleCollectFees}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50 text-sm"
          >
            <DollarSign className="w-4 h-4 inline mr-1" />
            Collect Fees
          </button>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 text-sm"
          >
            <XCircle className="w-4 h-4 inline mr-1" />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ market }: { market: Market }) {
  if (market.resolved) {
    return (
      <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium">
        Resolved
      </span>
    );
  }
  if (market.status === 1) {
    return (
      <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-medium">
        Active
      </span>
    );
  }
  return (
    <span className="px-3 py-1 bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-full text-xs font-medium">
      Closed
    </span>
  );
}

function SettingsPanel() {
  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-8">
      <h2 className="text-2xl font-semibold text-white mb-6">Platform Settings</h2>
      <div className="text-center py-12 text-gray-400">
        Settings panel coming soon...
        <div className="mt-4 text-sm">
          Configure default fees, treasury address, oracle adapter, and more.
        </div>
      </div>
    </div>
  );
}

function EmergencyPanel({ markets }: { markets: Market[] }) {
  return (
    <div className="bg-[#13131A] border border-red-500/20 rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <h2 className="text-2xl font-semibold text-white">Emergency Controls</h2>
      </div>
      <div className="text-center py-12 text-gray-400">
        Emergency controls coming soon...
        <div className="mt-4 text-sm">
          Pause all markets, withdraw stuck tokens, and emergency shutdown.
        </div>
      </div>
    </div>
  );
}

