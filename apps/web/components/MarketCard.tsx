"use client";

/**
 * MarketCard Component
 * Displays market summary with question, outcomes, prices, and status
 */

import { motion } from "framer-motion";
import { Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Market } from "@/lib/markets";
import { formatTimeRemaining, formatPMT, formatPercent } from "@/lib/format";
import { getMarketStatus } from "@/lib/markets";

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const status = getMarketStatus(market);
  const isActive = status === "Active";

  return (
    <Link href={`/market/${market.address}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#13131A] to-[#1A1A24] border border-white/5 hover:border-[#00D1FF]/30 backdrop-blur-lg p-6 cursor-pointer group h-full flex flex-col"
      >
        {/* Gradient glow effect on hover */}
        <div className="absolute inset-0 bg-linear-to-br from-[#00D1FF]/0 to-[#FF00AA]/0 group-hover:from-[#00D1FF]/5 group-hover:to-[#FF00AA]/5 transition-all duration-300" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-semibold text-white line-clamp-2 flex-1 min-h-[3.5rem]">
              {market.question}
            </h3>
            <StatusBadge status={status} isActive={isActive} />
          </div>

          {/* Outcomes with prices */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            {market.outcomes.map((outcome, index) => (
              <OutcomeChip
                key={index}
                outcome={outcome}
                price={market.prices[index]}
                isWinner={market.resolved && market.winningOutcome === index}
              />
            ))}
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{formatTimeRemaining(market.endTime)}</span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-gray-400">
                <TrendingUp className="w-4 h-4" />
                <span>{formatPMT(market.totalReserves)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function StatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  const colors = {
    Active: "bg-green-500/10 text-green-400 border-green-500/20",
    Resolved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Ended: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Closed: "bg-red-500/10 text-red-400 border-red-500/20",
    Canceled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium border ${
        colors[status as keyof typeof colors] || colors.Closed
      }`}
    >
      {status}
    </span>
  );
}

function OutcomeChip({
  outcome,
  price,
  isWinner,
}: {
  outcome: string;
  price: number;
  isWinner: boolean;
}) {
  const priceColor = price > 50 ? "text-green-400" : "text-blue-400";

  return (
    <div
      className={`relative overflow-hidden rounded-xl p-3 transition-all flex flex-col h-full min-h-[5rem] ${
        isWinner
          ? "bg-linear-to-br from-green-500/20 to-green-600/10 border-2 border-green-500/50"
          : "bg-white/5 border border-white/10 hover:bg-white/10"
      }`}
    >
      <div className="flex flex-col gap-1 flex-1">
        <span className="text-sm font-medium text-white line-clamp-2">{outcome}</span>
        <div className="flex items-baseline justify-between mt-auto">
          <span className={`text-xl font-bold ${priceColor}`}>{formatPercent(price)}</span>
          {isWinner && (
            <span className="text-xs text-green-400 font-medium">Winner</span>
          )}
        </div>
      </div>

      {/* Price indicator bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
        <div
          className={`h-full transition-all ${
            price > 50 ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${price}%` }}
        />
      </div>
    </div>
  );
}
