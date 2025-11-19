import { client } from "@/app/client";
import { getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { latestPredictionContract } from "@/lib/config";

export const predictionContractAddress = latestPredictionContract.address;
// Show PMT (Prediction Token) balance in wallet for testing
export const tokenContractAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || "";

// Helper function to ensure address is properly formatted
const toAddress = (addr: string): `0x${string}` => {
  // Remove any whitespace but preserve case (for checksummed addresses)
  const cleaned = addr.trim();
  // Ensure it starts with 0x
  return (cleaned.startsWith('0x') ? cleaned : `0x${cleaned}`) as `0x${string}`;
};

export const getPredictionContractByAddress = (address: `0x${string}`) => getContract({
    client: client,
    address,
    chain: baseSepolia,
});

// Lazy-load contracts to avoid SSR/build-time issues
export const getTokenContract = () => {
  if (!tokenContractAddress) return null;
  return getContract({
    client: client,
    address: toAddress(tokenContractAddress),
    chain: baseSepolia,
  });
};

export const getPredictionMarketContract = () => getContract({
    client: client,
    address: toAddress(predictionContractAddress),
    chain: baseSepolia,
});

// Removed: These should not be used directly anymore
// All code should use the getter functions instead: getPredictionMarketContract() and getTokenContract()