
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { type Market } from "@/lib/markets";

interface PriceChartProps {
  market: Market;
}

type TimeRange = "1H" | "6H" | "1D" | "1W" | "ALL";

export function PriceChart({ market }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1D");

  // Generate mock historical price data based on current prices
  // In production, this would come from tracking price changes over time
  const historicalData = useMemo(() => {
    const now = Date.now();
    const points = timeRange === "1H" ? 60 : timeRange === "6H" ? 72 : timeRange === "1D" ? 96 : timeRange === "1W" ? 168 : 336;
    const interval = timeRange === "1H" ? 60000 : timeRange === "6H" ? 300000 : timeRange === "1D" ? 900000 : timeRange === "1W" ? 3600000 : 7200000;

    return Array.from({ length: points }, (_, i) => {
      const timestamp = now - (points - i) * interval;
      const progress = i / points;

      // Generate realistic price movements around current prices
      const data: any = { timestamp };

      market.outcomes.forEach((outcome, index) => {
        const currentPrice = market.prices[index];
        // Add some randomness and trending toward current price
        const variance = 5 * (1 - progress); // Less variance as we get closer to now
        const random = (Math.random() - 0.5) * variance;
        const trendAdjustment = (currentPrice - 50) * progress * 0.3; // Trend toward current
        data[outcome] = Math.max(5, Math.min(95, 50 + trendAdjustment + random));
      });

      // At the last point, use exact current prices
      if (i === points - 1) {
        market.outcomes.forEach((outcome, index) => {
          data[outcome] = market.prices[index];
        });
      }

      return data;
    });
  }, [market, timeRange]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const date = new Date(data.timestamp);

    return (
      <div className="bg-[#1A1A24] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-gray-400 mb-2">
          {date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-300">{entry.name}</span>
            </div>
            <span className="text-xs font-bold text-white">
              {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Colors for each outcome
  const colors = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"];

  return (
    <div className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Price History</h3>
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
          {(["1H", "6H", "1D", "1W", "ALL"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                timeRange === range
                  ? "bg-[#00D1FF]/20 text-[#00D1FF]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <LineChart data={historicalData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => {
                const date = new Date(value);
                if (timeRange === "1H" || timeRange === "6H") {
                  return date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                }
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
              stroke="#6B7280"
              style={{ fontSize: "10px" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              stroke="#6B7280"
              style={{ fontSize: "10px" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {market.outcomes.map((outcome, index) => (
              <Line
                key={outcome}
                type="monotone"
                dataKey={outcome}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={false}
                animationDuration={300}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-white/10">
        {market.outcomes.map((outcome, index) => (
          <div key={outcome} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-xs text-gray-400">{outcome}</span>
            <span className="text-xs font-bold text-white">
              {market.prices[index].toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <div className="text-xs text-center text-gray-500 italic">
        📊 Historical price data • Real-time updates coming soon
      </div>
    </div>
  );
}

