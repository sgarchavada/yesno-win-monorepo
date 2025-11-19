"use client";

/**
 * Home Page - Market List
 * Displays all prediction markets in a grid layout
 */

import { useEffect, useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { MarketCard } from "@/components/MarketCard";
import { getMarketCount, getMarketsPaginated, getMarketDetails, type Market } from "@/lib/markets";
import { useMarketStore } from "@/store/useMarketStore";
import { motion } from "framer-motion";

const MARKETS_PER_PAGE = 20;

export default function HomePage() {
  const { markets, setMarkets, isLoadingMarkets, setIsLoadingMarkets } = useMarketStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "ended" | "resolved" | "canceled">("all");
  const [totalMarketCount, setTotalMarketCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch initial markets
  useEffect(() => {
    async function fetchInitialMarkets() {
      setIsLoadingMarkets(true);
      
      try {
        // Get total count
        const count = await getMarketCount();
        setTotalMarketCount(count);
        
        // Load first batch (most recent markets)
        const start = Math.max(0, count - MARKETS_PER_PAGE);
        const end = count;
        const addresses = await getMarketsPaginated(start, end);
        
        // Fetch details for these markets
        const marketDetails = await Promise.all(
          addresses.reverse().map((addr) => getMarketDetails(addr)) // Reverse to show newest first
        );
        const validMarkets = marketDetails.filter((m) => m !== null) as Market[];
        
        setMarkets(validMarkets);
        setLoadedCount(validMarkets.length);
      } catch (error) {
        console.error("Error fetching markets:", error);
      } finally {
        setIsLoadingMarkets(false);
      }
    }

    fetchInitialMarkets();
  }, [setMarkets, setIsLoadingMarkets]);

  // Silent refresh of loaded markets every 30 seconds
  useEffect(() => {
    if (markets.length === 0) return;

    const interval = setInterval(async () => {
      try {
        // Silently refetch only the currently loaded markets
        const addresses = markets.map((m) => m.address);
        const marketDetails = await Promise.all(
          addresses.map((addr) => getMarketDetails(addr))
        );
        const validMarkets = marketDetails.filter((m) => m !== null) as Market[];
        setMarkets(validMarkets);
      } catch (error) {
        console.error("Error refreshing markets:", error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [markets, setMarkets]);

  // Load more markets
  async function loadMoreMarkets() {
    if (isLoadingMore || loadedCount >= totalMarketCount) return;
    
    setIsLoadingMore(true);
    
    try {
      // Calculate next batch
      const newEnd = totalMarketCount - loadedCount;
      const newStart = Math.max(0, newEnd - MARKETS_PER_PAGE);
      
      const addresses = await getMarketsPaginated(newStart, newEnd);
      const marketDetails = await Promise.all(
        addresses.reverse().map((addr) => getMarketDetails(addr))
      );
      const validMarkets = marketDetails.filter((m) => m !== null) as Market[];
      
      // Append to existing markets
      setMarkets([...markets, ...validMarkets]);
      setLoadedCount(loadedCount + validMarkets.length);
    } catch (error) {
      console.error("Error loading more markets:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Filter markets
  const filteredMarkets = markets.filter((market) => {
    // Search filter
    if (
      searchQuery &&
      !market.question.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Status filter
    // MarketStatus enum: 0=ACTIVE, 1=CLOSED, 2=RESOLVED, 3=CANCELED
    const now = Math.floor(Date.now() / 1000);
    const hasEnded = now >= Number(market.endTime);
    const isActive = market.status === 0 && !hasEnded && !market.resolved;
    const isEnded = market.status === 0 && hasEnded && !market.resolved;
    const isResolved = market.resolved || market.status === 2;
    const isCanceled = market.status === 3;
    
    if (filterStatus === "active" && !isActive) {
      return false;
    }
    if (filterStatus === "ended" && !isEnded) {
      return false;
    }
    if (filterStatus === "resolved" && !isResolved) {
      return false;
    }
    if (filterStatus === "canceled" && !isCanceled) {
      return false;
    }

    return true;
  });

  return (
    <main className="min-h-screen bg-[#0B0B0F] py-6">
      <div className="max-w-screen-2xl mx-auto px-6 space-y-2">
        {/* Search and filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-between"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#13131A] border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 bg-[#13131A] p-1 rounded-xl border border-white/10">
            <FilterButton
              active={filterStatus === "all"}
              onClick={() => setFilterStatus("all")}
            >
              All
            </FilterButton>
            <FilterButton
              active={filterStatus === "active"}
              onClick={() => setFilterStatus("active")}
            >
              Active
            </FilterButton>
            <FilterButton
              active={filterStatus === "ended"}
              onClick={() => setFilterStatus("ended")}
            >
              Ended
            </FilterButton>
            <FilterButton
              active={filterStatus === "resolved"}
              onClick={() => setFilterStatus("resolved")}
            >
              Resolved
            </FilterButton>
            <FilterButton
              active={filterStatus === "canceled"}
              onClick={() => setFilterStatus("canceled")}
            >
              Canceled
            </FilterButton>
          </div>

          {/* Create market button (for admins) */}
          <Link href="/create">
            <button className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Market
            </button>
          </Link>
        </motion.div>

        {/* Market count */}
        <div className="text-sm text-gray-400">
          Showing {filteredMarkets.length} of {markets.length} markets
        </div>

        {/* Markets grid */}
        {isLoadingMarkets ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingSkeleton key={i} />
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredMarkets.map((market, index) => (
              <motion.div
                key={market.address}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <MarketCard market={market} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Load More Button */}
        {!isLoadingMarkets && loadedCount < totalMarketCount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center pt-8"
          >
            <button
              onClick={loadMoreMarkets}
              disabled={isLoadingMore}
              className="px-8 py-4 bg-[#13131A] hover:bg-[#1A1A24] border border-white/10 rounded-xl font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading more markets...
                </>
              ) : (
                <>
                  Load More
                  <span className="text-sm text-gray-400">
                    ({loadedCount} of {totalMarketCount})
                  </span>
                </>
              )}
            </button>
          </motion.div>
        )}
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${
        active
          ? "bg-linear-to-r from-[#00D1FF] to-[#FF00AA] text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-2xl bg-[#13131A] border border-white/5 p-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-6 bg-white/5 rounded-lg w-3/4" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-white/5 rounded-xl" />
          <div className="h-20 bg-white/5 rounded-xl" />
        </div>
        <div className="h-4 bg-white/5 rounded w-1/2" />
      </div>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-20 space-y-4">
      <div className="text-6xl">🔍</div>
      <h3 className="text-2xl font-semibold text-white">
        {searchQuery ? "No markets found" : "No markets yet"}
      </h3>
      <p className="text-gray-400 max-w-md mx-auto">
        {searchQuery
          ? "Try adjusting your search or filters"
          : "Be the first to create a prediction market!"}
      </p>
      {!searchQuery && (
        <Link href="/create">
          <button className="mt-4 px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity">
            Create First Market
          </button>
        </Link>
      )}
    </div>
  );
}
