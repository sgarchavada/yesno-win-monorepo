"use client";

import { useActiveWallet, useSwitchActiveWalletChain } from "thirdweb/react";

export const BASE_SEPOLIA_CHAIN = {
  id: 84532,
  chainIdHex: "0x14a34",
  name: "Base Sepolia",
  rpcUrls: ["https://sepolia.base.org"],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
  nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
};

export function useSwitchToBaseSepolia() {
  const wallet = useActiveWallet();
  const switchChain = useSwitchActiveWalletChain();
  return async () => {
    if (!wallet) throw new Error("No wallet connected");
    try {
      await switchChain({ id: BASE_SEPOLIA_CHAIN.id, rpc: BASE_SEPOLIA_CHAIN.rpcUrls[0] });
    } catch (err) {
      throw new Error("Please switch manually to Base Sepolia");
    }
  };
}

export function useCurrentChainId() {
  const wallet = useActiveWallet();
  return wallet?.getChain()?.id ?? null;
}

export function isBaseSepolia(chainId: string | number | null) {
  const id = typeof chainId === "string" ? parseInt(chainId, 16) : chainId;
  return id === BASE_SEPOLIA_CHAIN.id;
}
