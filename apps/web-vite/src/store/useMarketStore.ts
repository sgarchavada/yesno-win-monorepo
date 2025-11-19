/**
 * Global Market Store (Zustand)
 * Manages application state for markets, user positions, and UI state
 */

import { create } from "zustand";
import type { Market, MarketPosition } from "@/lib/markets";

interface MarketStore {
  // Market data
  markets: Market[];
  selectedMarket: Market | null;
  isLoadingMarkets: boolean;

  // User data
  userAddress: string | null;
  userPositions: Record<string, MarketPosition[]>;
  userLPBalances: Record<string, bigint>;

  // UI state
  activeTab: "buy" | "sell" | "parlay";
  showTradeModal: boolean;
  tradeModalOutcome: number;

  // Actions - Markets
  setMarkets: (markets: Market[]) => void;
  setSelectedMarket: (market: Market | null) => void;
  setIsLoadingMarkets: (loading: boolean) => void;
  addMarket: (market: Market) => void;
  updateMarket: (address: string, updates: Partial<Market>) => void;

  // Actions - User
  setUserAddress: (address: string | null) => void;
  setUserPositions: (positions: Record<string, MarketPosition[]>) => void;
  addUserPosition: (marketAddress: string, position: MarketPosition) => void;
  setUserLPBalance: (marketAddress: string, balance: bigint) => void;

  // Actions - UI
  setActiveTab: (tab: "buy" | "sell" | "parlay") => void;
  openTradeModal: (outcomeIndex: number) => void;
  closeTradeModal: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  markets: [],
  selectedMarket: null,
  isLoadingMarkets: false,
  userAddress: null,
  userPositions: {},
  userLPBalances: {},
  activeTab: "buy" as const,
  showTradeModal: false,
  tradeModalOutcome: 0,
};

export const useMarketStore = create<MarketStore>((set) => ({
  ...initialState,

  // Market actions
  setMarkets: (markets) => set({ markets }),
  
  setSelectedMarket: (market) => set({ selectedMarket: market }),
  
  setIsLoadingMarkets: (loading) => set({ isLoadingMarkets: loading }),
  
  addMarket: (market) =>
    set((state) => ({
      markets: [market, ...state.markets],
    })),
  
  updateMarket: (address, updates) =>
    set((state) => ({
      markets: state.markets.map((m) =>
        m.address === address ? { ...m, ...updates } : m
      ),
      selectedMarket:
        state.selectedMarket?.address === address
          ? { ...state.selectedMarket, ...updates }
          : state.selectedMarket,
    })),

  // User actions
  setUserAddress: (address) => set({ userAddress: address }),
  
  setUserPositions: (positions) => set({ userPositions: positions }),
  
  addUserPosition: (marketAddress, position) =>
    set((state) => ({
      userPositions: {
        ...state.userPositions,
        [marketAddress]: [
          ...(state.userPositions[marketAddress] || []),
          position,
        ],
      },
    })),
  
  setUserLPBalance: (marketAddress, balance) =>
    set((state) => ({
      userLPBalances: {
        ...state.userLPBalances,
        [marketAddress]: balance,
      },
    })),

  // UI actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  openTradeModal: (outcomeIndex) =>
    set({ showTradeModal: true, tradeModalOutcome: outcomeIndex }),
  
  closeTradeModal: () => set({ showTradeModal: false }),

  // Reset
  reset: () => set(initialState),
}));

// Selectors for derived state
export const selectActiveMarkets = (state: MarketStore) =>
  state.markets.filter((m) => m.status === 1 && !m.resolved);

export const selectResolvedMarkets = (state: MarketStore) =>
  state.markets.filter((m) => m.resolved);

export const selectUserTotalValue = (state: MarketStore) => {
  // Calculate total value of user positions
  let total = 0n;
  Object.values(state.userPositions).forEach((positions) => {
    positions.forEach((pos) => {
      total += pos.value;
    });
  });
  return total;
};

