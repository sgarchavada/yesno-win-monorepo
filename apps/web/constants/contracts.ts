import { client } from "@/app/client";
import { getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { latestPredictionContract } from "@/lib/config";

export const predictionContractAddress = latestPredictionContract.address;
// Show PMT (Prediction Token) balance in wallet for testing
export const tokenContractAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS;

export const predictionMarketContract = getContract({
    client: client,
    address: predictionContractAddress,
    chain: baseSepolia,
})

export const getPredictionContractByAddress = (address: `0x${string}`) => getContract({
    client: client,
    address,
    chain: baseSepolia,
});

export const tokenContract = getContract({
    client: client,
    address: tokenContractAddress,
    chain: baseSepolia,
})