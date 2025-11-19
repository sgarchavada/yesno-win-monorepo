/**
 * Contract Integration Layer
 * Connects frontend to deployed smart contracts using Thirdweb SDK v5
 */

import { getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { client } from "@/app/client";

// Contract addresses from .env
export const MARKET_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_FACTORY_PROXY!;
export const CREATOR_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_CREATOR_REGISTRY_PROXY!;
export const PROTOCOL_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_PROTOCOL_TREASURY_PROXY!;
export const ORACLE_ADAPTER_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADAPTER_ADDRESS || "";
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS!;

// Debug: Log addresses on client side only
if (typeof window !== 'undefined') {
  console.log('🔍 Contract Addresses:', {
    MARKET_FACTORY_ADDRESS,
    CREATOR_REGISTRY_ADDRESS,
    PROTOCOL_TREASURY_ADDRESS,
    ORACLE_ADAPTER_ADDRESS,
    USDC_ADDRESS,
  });
}

// Network configuration
export const CHAIN = baseSepolia;
export const CHAIN_ID = 84532;

/**
 * Get MarketFactory contract instance
 */
export function getMarketFactory() {
  console.log('🏭 Creating MarketFactory contract with address:', MARKET_FACTORY_ADDRESS);
  console.log('🏭 Address type:', typeof MARKET_FACTORY_ADDRESS);
  console.log('🏭 Address length:', MARKET_FACTORY_ADDRESS?.length);
  
  return getContract({
    client,
    chain: CHAIN,
    address: MARKET_FACTORY_ADDRESS as `0x${string}`,
  });
}

/**
 * Get Market contract instance
 */
export function getMarket(address: string) {
  return getContract({
    client,
    chain: CHAIN,
    address: address as `0x${string}`,
  });
}

/**
 * Get Oracle Adapter contract instance
 */
export function getOracleAdapter() {
  return getContract({
    client,
    chain: CHAIN,
    address: ORACLE_ADAPTER_ADDRESS as `0x${string}`,
  });
}

/**
 * Get Collateral Token (PMT) contract instance
 * Note: Using PMT token for testing instead of USDC
 */
export function getUSDC() {
  return getContract({
    client,
    chain: CHAIN,
    address: USDC_ADDRESS as `0x${string}`,
  });
}

/**
 * Get ProtocolTreasury contract instance
 */
export function getProtocolTreasury() {
  return getContract({
    client,
    chain: CHAIN,
    address: PROTOCOL_TREASURY_ADDRESS as `0x${string}`,
  });
}

/**
 * Get CreatorRegistry contract instance
 */
export function getCreatorRegistry() {
  return getContract({
    client,
    chain: CHAIN,
    address: CREATOR_REGISTRY_ADDRESS as `0x${string}`,
  });
}

// Export contract addresses for easy access
export const contracts = {
  marketFactory: MARKET_FACTORY_ADDRESS,
  creatorRegistry: CREATOR_REGISTRY_ADDRESS,
  protocolTreasury: PROTOCOL_TREASURY_ADDRESS,
  oracleAdapter: ORACLE_ADAPTER_ADDRESS,
  usdc: USDC_ADDRESS,
} as const;


