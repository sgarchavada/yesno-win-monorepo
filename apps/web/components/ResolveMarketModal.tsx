"use client";

import { useState } from "react";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { getPredictionMarketContract, getPredictionContractByAddress } from "@/constants/contracts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

interface ResolveMarketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketId: number;
  question: string;
  optionA: string;
  optionB: string;
  contractAddress?: `0x${string}`;
  onSuccess?: () => void;
}

export default function ResolveMarketModal({
  open,
  onOpenChange,
  marketId,
  question,
  optionA,
  optionB,
  contractAddress,
  onSuccess,
}: ResolveMarketModalProps) {
  const { toast } = useToast();
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1 | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { mutateAsync: sendAndConfirm } = useSendAndConfirmTransaction();

  const handleResolve = async () => {
    if (selectedOutcome === null) {
      toast("Please select an outcome", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      const contract = contractAddress ? getPredictionContractByAddress(contractAddress) : getPredictionMarketContract();
      const methodSig = "function resolveMarket(uint256 _marketId, uint8 _outcome)";
      // Map UI selection (0=A, 1=B) to contract enum (1=A, 2=B)
      const outcomeForContract = (selectedOutcome === 0 ? 1 : 2) as 1 | 2;
      const paramsArr = [BigInt(marketId), outcomeForContract] as const;
      const transaction = prepareContractCall({
        contract,
        method: methodSig as any,
        params: paramsArr as any,
      } as any);
      await sendAndConfirm(transaction);
      toast("Market resolved successfully", "success");
      onOpenChange(false);
      setSelectedOutcome(null);
      onSuccess?.();
    } catch (error) {
      console.error("Error resolving market:", error);
      toast("Failed to resolve market", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Market</DialogTitle>
          <DialogDescription>
            Select the winning outcome for this market.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm font-medium mb-2">Market Question:</p>
            <p className="text-sm text-muted">{question}</p>
          </div>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <input
                type="radio"
                name="outcome"
                value="0"
                checked={selectedOutcome === 0}
                onChange={() => setSelectedOutcome(0)}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <p className="font-medium text-foreground">{optionA}</p>
                <p className="text-xs text-muted">Option A</p>
              </div>
            </label>
            <label className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <input
                type="radio"
                name="outcome"
                value="1"
                checked={selectedOutcome === 1}
                onChange={() => setSelectedOutcome(1)}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <p className="font-medium text-foreground">{optionB}</p>
                <p className="text-xs text-muted">Option B</p>
              </div>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={selectedOutcome === null || isProcessing}
            className="btn-primary"
          >
            {isProcessing ? "Processing..." : "Resolve Market"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

