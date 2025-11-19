"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, ExternalLink, Activity } from "lucide-react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { getMarketCount, getMarketsPaginated, getMarketDetails, getOutcomeBalance, type Market } from "@/lib/markets";
import { formatTokens, shortenAddress } from "@/lib/format";

interface Position {
  market: Market;
  outcomeIndex: number;
  outcomeName: string;
  balance: bigint;
  currentValue: number;
  potentialValue: number;
  profit: number;
}

export default function PortfolioPage() {
  const account = useActiveAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPotential, setTotalPotential] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  useEffect(() => {
    if (!account?.address) {
      setIsLoading(false);
      return;
    }

    async function fetchPortfolio() {
      setIsLoading(true);
      
      try {
        // Get all markets
        const count = await getMarketCount();
        const addresses = await getMarketsPaginated(0, count);
        
        // Fetch market details
        const markets = await Promise.all(
          addresses.map((addr) => getMarketDetails(addr))
        );
        const validMarkets = markets.filter((m) => m !== null) as Market[];
        
        // Check user's positions in each market
        const allPositions: Position[] = [];
        let sumValue = 0;
        let sumPotential = 0;
        
        for (const market of validMarkets) {
          for (let i = 0; i < market.outcomes.length; i++) {
            const balance = await getOutcomeBalance(market.outcomeTokens[i], account.address);
            
            if (balance > BigInt(0)) {
              const balanceNum = Number(balance) / 1e18;
              const currentPrice = market.prices[i] / 100;
              const currentValue = balanceNum * currentPrice;
              const potentialValue = balanceNum; // 1 token = 1 USDC if wins
              const profit = potentialValue - currentValue;
              
              allPositions.push({
                market,
                outcomeIndex: i,
                outcomeName: market.outcomes[i],
                balance,
                currentValue,
                potentialValue,
                profit,
              });
              
              sumValue += currentValue;
              sumPotential += potentialValue;
            }
          }
        }
        
        setPositions(allPositions);
        setTotalValue(sumValue);
        setTotalPotential(sumPotential);
        setTotalProfit(sumPotential - sumValue);
      } catch (error) {
        console.error("Error fetching portfolio:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPortfolio();
  }, [account]);

  if (!account) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center py-20 space-y-4">
            <Wallet className="w-20 h-20 mx-auto text-gray-600" />
            <h2 className="text-3xl font-bold text-white">Connect Your Wallet</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Connect your wallet to view your prediction market portfolio
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-4xl font-bold text-white">Your Portfolio</h1>
          <p className="text-gray-400">Track your positions and earnings</p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Current Value */}
          <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Current Value</div>
                <div className="text-2xl font-bold text-white">
                  ${totalValue.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Value at current market prices
            </div>
          </div>

          {/* Potential Value */}
          <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Potential Value</div>
                <div className="text-2xl font-bold text-white">
                  ${totalPotential.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              If all your positions win
            </div>
          </div>

          {/* Total Profit */}
          <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-12 h-12 ${totalProfit > 0 ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-xl flex items-center justify-center`}>
                {totalProfit > 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" />
                )}
              </div>
              <div>
                <div className="text-sm text-gray-400">Potential Profit</div>
                <div className={`text-2xl font-bold ${totalProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalProfit > 0 ? '+' : ''}${totalProfit.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {totalProfit > 0 ? 'Projected gains' : 'Break even or loss'}
            </div>
          </div>
        </motion.div>

        {/* Positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            Your Positions ({positions.length})
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-[#13131A] border border-white/10 rounded-2xl p-6 animate-pulse">
                  <div className="space-y-3">
                    <div className="h-6 bg-white/5 rounded w-3/4" />
                    <div className="h-4 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Positions Yet</h3>
              <p className="text-gray-400 mb-6">
                Start trading on prediction markets to build your portfolio
              </p>
              <Link href="/">
                <button className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity">
                  Browse Markets
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {positions.map((position, index) => (
                <motion.div
                  key={`${position.market.address}-${position.outcomeIndex}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-[#13131A] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Market Info */}
                    <div className="flex-1">
                      <Link href={`/market/${position.market.address}`}>
                        <h3 className="text-lg font-semibold text-white hover:text-blue-400 transition-colors mb-2">
                          {position.market.question}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg font-medium">
                          {position.outcomeName}
                        </span>
                        <span className="text-gray-400">
                          @ {position.market.prices[position.outcomeIndex].toFixed(1)}%
                        </span>
                        <a
                          href={`https://sepolia.basescan.org/address/${position.market.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    {/* Position Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Tokens</div>
                        <div className="text-white font-semibold">{formatTokens(position.balance)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Current Value</div>
                        <div className="text-white font-semibold">${position.currentValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">If Wins</div>
                        <div className="text-green-400 font-semibold">${position.potentialValue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Profit</div>
                        <div className={`font-bold ${position.profit > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                          {position.profit > 0 ? '+' : ''}${position.profit.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}

