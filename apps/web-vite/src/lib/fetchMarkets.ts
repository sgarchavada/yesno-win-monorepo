import { getContract, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { client } from "@/client";
import { predictionContracts } from "./config";

type RawMarket = {
  question: string;
  startTime: number;
  endTime: number;
  statusNum?: number;
  optionA?: string;
  optionB?: string;
  totalOptionAShares?: number;
  totalOptionBShares?: number;
  resolved?: boolean;
  outcome?: number;
  resolutionType?: number;
  distributablePool?: number;
  totalFeeTaken?: number;
  totalClaimedWinnings?: number;
  resolvedTime?: number;
  claimExpiry?: number;
};

export async function fetchAllMarkets() {
  const all: Array<RawMarket & { id: number; version?: string; label?: string; contractAddress: string; createdAt: number }> = [];

  for (const { version, label, address } of predictionContracts) {
    const contract = getContract({ client, address, chain: baseSepolia });

    // Try multiple shapes to be compatible with both versions
    let countVal: number | 0 = 0;
    const countCandidates = [
      "function getMarketCount() view returns (uint256)",
      "function marketCount() view returns (uint256)",
    ] as const;
    for (const sig of countCandidates) {
      try {
        const c = (await readContract({ contract, method: sig, params: [] })) as number | bigint;
        countVal = Number(c || 0);
        break;
      } catch {
        // try next
      }
    }

    const marketCount = Number(countVal ?? 0);
    for (let i = 0; i < marketCount; i++) {
      let decoded: RawMarket | null = null;
      // Try new core+stats API first
      try {
        const core = (await readContract({
          contract,
          method:
            "function getMarketCore(uint256 _marketId) view returns (string question, uint256 startTime, uint256 endTime, uint8 status, uint8 outcome, uint8 resolutionType, string optionA, string optionB)",
          params: [BigInt(i)],
        })) as readonly unknown[];
        const stats = (await readContract({
          contract,
          method:
            "function getMarketStats(uint256 _marketId) view returns (uint256 totalOptionAShares, uint256 totalOptionBShares, uint256 distributablePool, uint256 totalFeeTaken, uint256 totalClaimedWinnings, bool resolved, uint256 resolvedTime, uint256 claimExpiry)",
          params: [BigInt(i)],
        })) as readonly unknown[];

        decoded = {
          question: String(core[0]),
          startTime: Number(core[1] as number | string | bigint),
          endTime: Number(core[2] as number | string | bigint),
          statusNum: Number(core[3] as number | string | bigint),
          outcome: Number(core[4] as number | string | bigint),
          resolutionType: Number(core[5] as number | string | bigint),
          optionA: String(core[6]),
          optionB: String(core[7]),
          totalOptionAShares: Number(stats[0] as number | string | bigint),
          totalOptionBShares: Number(stats[1] as number | string | bigint),
          distributablePool: Number(stats[2] as number | string | bigint),
          totalFeeTaken: Number(stats[3] as number | string | bigint),
          totalClaimedWinnings: Number(stats[4] as number | string | bigint),
          resolved: Boolean(stats[5]),
          resolvedTime: Number(stats[6] as number | string | bigint),
          claimExpiry: Number(stats[7] as number | string | bigint),
        };
      } catch {
        decoded = null;
      }

      if (!decoded) continue;

      all.push({
        id: i,
        version,
        label,
        contractAddress: address,
        createdAt: decoded.startTime ?? 0,
        ...decoded,
      });
    }
  }

  return all.sort((a, b) => b.createdAt - a.createdAt);
}


export type MarketsPage = {
  markets: Array<RawMarket & { id: number; version?: string; label?: string; contractAddress: string; createdAt: number }>;
  nextCursors: Record<string, number>; // contractAddress -> next index to read (descending), -1 when exhausted
  hasMore: boolean;
};

// Fetch latest markets across all contracts in descending order using per-contract cursors.
// Cursors are the next index to read (descending). If a cursor is undefined, it starts at marketCount - 1.
export async function fetchMarketsPage(limit: number = 20, cursors?: Record<string, number>): Promise<MarketsPage> {
  const collected: Array<RawMarket & { id: number; version?: string; label?: string; contractAddress: string; createdAt: number }> = [];
  const nextCursors: Record<string, number> = {};

  // First, get counts for all contracts and establish starting cursors
  const contractMetas = await Promise.all(
    predictionContracts.map(async ({ version, label, address }) => {
      const contract = getContract({ client, address, chain: baseSepolia });
      let countVal = 0;
      const countCandidates = [
        "function getMarketCount() view returns (uint256)",
        "function marketCount() view returns (uint256)",
      ] as const;
      for (const sig of countCandidates) {
        try {
          const c = (await readContract({ contract, method: sig, params: [] })) as number | bigint;
          countVal = Number(c || 0);
          break;
        } catch {}
      }
      const startIndex = typeof cursors?.[address] === "number" ? cursors![address] : countVal - 1;
      return { version, label, address, contract, count: countVal, cursor: startIndex };
    })
  );

  // Read up to `limit` markets by pulling chunks from each contract, then merge-sort by createdAt
  for (const meta of contractMetas) {
    nextCursors[meta.address] = meta.cursor;
  }

  // We will try to read at most `limit` per contract to bound RPC calls
  for (const meta of contractMetas) {
    if (meta.cursor < 0 || meta.count <= 0) continue;
    const take = Math.min(limit, meta.cursor + 1);
    for (let idx = meta.cursor; idx >= Math.max(0, meta.cursor - take + 1); idx--) {
      try {
        const core = (await readContract({
          contract: meta.contract,
          method:
            "function getMarketCore(uint256 _marketId) view returns (string question, uint256 startTime, uint256 endTime, uint8 status, uint8 outcome, uint8 resolutionType, string optionA, string optionB)",
          params: [BigInt(idx)],
        })) as readonly unknown[];
        const stats = (await readContract({
          contract: meta.contract,
          method:
            "function getMarketStats(uint256 _marketId) view returns (uint256 totalOptionAShares, uint256 totalOptionBShares, uint256 distributablePool, uint256 totalFeeTaken, uint256 totalClaimedWinnings, bool resolved, uint256 resolvedTime, uint256 claimExpiry)",
          params: [BigInt(idx)],
        })) as readonly unknown[];

        collected.push({
          id: idx,
          version: meta.version,
          label: meta.label,
          contractAddress: meta.address,
          createdAt: Number(core[1] as number | string | bigint) ?? 0,
          question: String(core[0]),
          startTime: Number(core[1] as number | string | bigint),
          endTime: Number(core[2] as number | string | bigint),
          statusNum: Number(core[3] as number | string | bigint),
          outcome: Number(core[4] as number | string | bigint),
          resolutionType: Number(core[5] as number | string | bigint),
          optionA: String(core[6]),
          optionB: String(core[7]),
          totalOptionAShares: Number(stats[0] as number | string | bigint),
          totalOptionBShares: Number(stats[1] as number | string | bigint),
          distributablePool: Number(stats[2] as number | string | bigint),
          totalFeeTaken: Number(stats[3] as number | string | bigint),
          totalClaimedWinnings: Number(stats[4] as number | string | bigint),
          resolved: Boolean(stats[5]),
          resolvedTime: Number(stats[6] as number | string | bigint),
          claimExpiry: Number(stats[7] as number | string | bigint),
        });
      } catch {}
      nextCursors[meta.address] = idx - 1;
      if (collected.length >= limit) break;
    }
    if (collected.length >= limit) break;
  }

  const sorted = collected.sort((a, b) => (b.createdAt - a.createdAt));
  const page = sorted.slice(0, limit);

  // If we sliced, figure out the minimum index consumed per contract and update cursors accordingly
  const consumedByContract: Record<string, number> = {};
  for (const m of page) {
    consumedByContract[m.contractAddress] = Math.min(
      typeof consumedByContract[m.contractAddress] === "number" ? consumedByContract[m.contractAddress] : Number.MAX_SAFE_INTEGER,
      m.id - 1
    );
  }
  for (const meta of contractMetas) {
    if (typeof consumedByContract[meta.address] === "number") {
      nextCursors[meta.address] = consumedByContract[meta.address];
    }
  }

  const hasMore = Object.values(nextCursors).some((v) => (typeof v === "number" ? v : -1) >= 0);
  return { markets: page, nextCursors, hasMore };
}


