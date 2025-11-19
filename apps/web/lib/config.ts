export type PredictionContractConfig = {
  version: "v1" | "v2" | string;
  address: `0x${string}`;
  label: string;
};

// Keep newest (active) first
export const predictionContracts: PredictionContractConfig[] = [
  {
    version: "v1",
    address: "0xf96d5c0d13dd596eb3067e2cfa333f51a7d58c42",
    label: "New Markets",
  },
];

export const latestPredictionContract = predictionContracts[0];

