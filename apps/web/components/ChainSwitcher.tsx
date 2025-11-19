"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useSwitchToBaseSepolia, useCurrentChainId, isBaseSepolia } from "@/lib/chainUtils";

export default function ChainSwitcher() {
  const account = useActiveAccount();
  const [isWrongChain, setIsWrongChain] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const chainId = useCurrentChainId();
  useEffect(() => {
    if (account) {
      setIsWrongChain(!isBaseSepolia(chainId));
    } else {
      setIsWrongChain(false);
    }
  }, [account, chainId]);

  const switchToBaseSepolia = useSwitchToBaseSepolia();
  const handleSwitchChain = async () => {
    setIsSwitching(true);
    try {
      await switchToBaseSepolia();
      setIsWrongChain(false);
    } catch (error) {
      console.error("Failed to switch chain:", error);
    } finally {
      setIsSwitching(false);
    }
  };

  if (!account || !isWrongChain) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md mx-4">
      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
            <AlertCircle className="h-5 w-5" />
            <span>Wrong Network</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-800 dark:text-yellow-200 text-sm mb-4">
            Please switch to Base Sepolia network to use this application.
          </p>
          <Button
            onClick={handleSwitchChain}
            disabled={isSwitching}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {isSwitching ? "Switching..." : "Switch to Base Sepolia"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
