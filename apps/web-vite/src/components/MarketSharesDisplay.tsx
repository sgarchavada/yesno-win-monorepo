
import { useEffect, useState } from "react";
import { toEther } from "thirdweb";
import { toFixed } from "@/lib/utils";

interface MarketSharesDisplayProps {
  market: {
    optionA: string;
    optionB: string;
    totalOptionAShares: bigint;
    totalOptionBShares: bigint;
    resolved?: boolean;
  };
  sharesBalance: {
    optionAShares: bigint;
    optionBShares: bigint;
  };
}

export function MarketSharesDisplay({ market, sharesBalance }: MarketSharesDisplayProps) {
  const [winnings, setWinnings] = useState<{ A: bigint; B: bigint }>({ A: BigInt(0), B: BigInt(0) });

  const calculateWinnings = (option: "A" | "B") => {
    if (!sharesBalance || !market) return BigInt(0);
    if (!market.resolved) return BigInt(0);

    const userShares = option === "A" ? sharesBalance.optionAShares : sharesBalance.optionBShares;
    const totalSharesForOption = option === "A" ? market.totalOptionAShares : market.totalOptionBShares;
    const totalLosingShares = option === "A" ? market.totalOptionBShares : market.totalOptionAShares;

    if (totalSharesForOption === BigInt(0)) return BigInt(0);

    // Multiply by 1M for precision, then divide back down
    const PRECISION = BigInt(1_000_000);
    const userProportion = (userShares * PRECISION) / totalSharesForOption;
    const winningsFromLosingShares = (totalLosingShares * userProportion) / PRECISION;
    return userShares + winningsFromLosingShares;
  };

  useEffect(() => {
    if (!sharesBalance || !market) return;
    const next = { A: calculateWinnings("A"), B: calculateWinnings("B") };
    if (next.A !== winnings.A || next.B !== winnings.B) setWinnings(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharesBalance, market.totalOptionAShares, market.totalOptionBShares, market.resolved]);

  const displaySharesA = toFixed(Number(toEther((sharesBalance?.optionAShares as unknown as bigint) || BigInt(0))), 2);
  const displaySharesB = toFixed(Number(toEther((sharesBalance?.optionBShares as unknown as bigint) || BigInt(0))), 2);

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full text-xs text-gray-600 dark:text-gray-400">
        Your shares: {market.optionA} - {displaySharesA}{", "}
        {market.optionB} - {displaySharesB}
      </div>
    </div>
  );
}


