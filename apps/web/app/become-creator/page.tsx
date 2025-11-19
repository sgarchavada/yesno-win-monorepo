"use client";

/**
 * Become a Creator Page
 * Users can request creator access to create markets
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, CheckCircle, Clock, AlertCircle, DollarSign } from "lucide-react";
import Link from "next/link";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { getCreatorRegistry } from "@/lib/contracts";

type RequestStatus = "none" | "pending" | "approved" | "disabled" | "loading";

export default function BecomeCreatorPage() {
  const account = useActiveAccount();
  
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [creatorRequestsEnabled, setCreatorRequestsEnabled] = useState(false);

  // Check user's creator status
  useEffect(() => {
    async function checkStatus() {
      if (!account) {
        setStatus("none");
        return;
      }

      try {
        const registry = getCreatorRegistry();

        // Check if creator requests are enabled
        const requestsEnabled = await readContract({
          contract: registry,
          method: "function creatorRequestsEnabled() view returns (bool)",
          params: [],
        });
        setCreatorRequestsEnabled(requestsEnabled as boolean);

        if (!requestsEnabled) {
          setStatus("disabled");
          return;
        }

        // Check if already a creator
        const isCreator = await readContract({
          contract: registry,
          method: "function isCreator(address) view returns (bool)",
          params: [account.address as `0x${string}`],
        });

        if (isCreator) {
          setStatus("approved");
          return;
        }

        // Check if has pending request
        const hasPending = await readContract({
          contract: registry,
          method: "function hasPendingRequest(address) view returns (bool)",
          params: [account.address as `0x${string}`],
        });

        setStatus(hasPending ? "pending" : "none");
      } catch (err) {
        console.error("Error checking creator status:", err);
        setStatus("none");
      }
    }

    checkStatus();
  }, [account]);

  async function handleRequestCreator() {
    if (!account) {
      setError("Please connect your wallet");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const registry = getCreatorRegistry();
      const tx = prepareContractCall({
        contract: registry,
        method: "function requestCreatorRole()",
        params: [],
      });

      await sendTransaction({ transaction: tx, account });
      
      setSuccess(true);
      setStatus("pending");
      
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Request creator error:", err);
      setError(err?.message || "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!account) {
    return <ConnectWalletPrompt />;
  }

  if (status === "loading") {
    return <LoadingState />;
  }

  if (status === "approved") {
    return <AlreadyCreator />;
  }

  if (status === "pending") {
    return <PendingRequest />;
  }

  if (status === "disabled") {
    return <RequestsDisabled />;
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <Link href="/">
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-2xl flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">Become a Market Creator</h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Request access to create prediction markets on YesNo.Win. Our team will review your request and approve qualified creators.
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#13131A] border border-white/10 rounded-2xl p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Creator Benefits</h2>
          <div className="grid gap-4">
            <BenefitItem
              icon="🎯"
              title="Create Prediction Markets"
              description="Launch markets on any topic - sports, politics, crypto, or custom events"
            />
            <BenefitItem
              icon="📊"
              title="Earn from Trading Activity"
              description="Markets you create generate trading fees that benefit the ecosystem"
            />
            <BenefitItem
              icon="🏆"
              title="Build Your Reputation"
              description="Establish yourself as a trusted creator in the prediction market community"
            />
            <BenefitItem
              icon="⚡"
              title="Fast & Easy Process"
              description="Submit your request now and get approved within 24-48 hours"
            />
          </div>
        </motion.div>

        {/* Requirements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#13131A] border border-white/10 rounded-2xl p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Requirements</h2>
          <div className="space-y-3 text-gray-400">
            <RequirementItem text="Connected wallet address" />
            <RequirementItem text="Commit to creating quality, unambiguous markets" />
            <RequirementItem text="Follow platform guidelines and community standards" />
            <RequirementItem text="Provide clear market questions and outcomes" />
          </div>
        </motion.div>

        {/* Market Creation Fee Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-400 mb-2">
                Market Creation Fee
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                Each time you create a market, a <span className="font-bold text-white">one-time fee of 5 USDC</span> will be charged. This helps prevent spam and ensures only quality markets are created on the platform.
              </p>
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>5 USDC per market (in addition to initial liquidity)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Fee goes to platform treasury to support operations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Ensures high-quality, spam-free marketplace</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-4 border border-red-500/20"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 rounded-lg p-4 border border-green-500/20"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>Request submitted successfully! You'll be notified once approved.</span>
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={handleRequestCreator}
          disabled={isSubmitting}
          className="w-full py-6 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-2xl font-bold text-xl text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Submitting Request..." : "Request Creator Access"}
        </motion.button>

        {/* Note */}
        <p className="text-center text-sm text-gray-500">
          By requesting creator access, you agree to follow our platform guidelines and create markets in good faith.
        </p>
      </div>
    </main>
  );
}

function BenefitItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-4 bg-white/5 rounded-xl">
      <span className="text-3xl flex-shrink-0">{icon}</span>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function RequirementItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function ConnectWalletPrompt() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 max-w-md"
      >
        <div className="w-20 h-20 mx-auto bg-linear-to-br from-[#00D1FF] to-[#FF00AA] rounded-2xl flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
        <p className="text-gray-400">
          Connect your wallet to request creator access and start creating prediction markets.
        </p>
      </motion.div>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto border-4 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
        <p className="text-gray-400">Checking your creator status...</p>
      </div>
    </main>
  );
}

function AlreadyCreator() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/">
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#13131A] border border-green-500/20 rounded-2xl p-12 text-center"
        >
          <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">You're Already a Creator! 🎉</h2>
          <p className="text-lg text-gray-400 mb-8">
            Your account has creator access. You can start creating markets now!
          </p>
          <Link href="/create">
            <button className="px-8 py-4 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-bold text-white hover:opacity-90 transition-opacity">
              Create Your First Market
            </button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

function PendingRequest() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/">
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#13131A] border border-orange-500/20 rounded-2xl p-12 text-center"
        >
          <div className="w-20 h-20 mx-auto bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6">
            <Clock className="w-10 h-10 text-orange-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Request Pending Review</h2>
          <p className="text-lg text-gray-400 mb-4">
            Your creator request has been submitted and is awaiting admin approval.
          </p>
          <p className="text-sm text-gray-500">
            We'll review your request within 24-48 hours. You'll be notified once approved!
          </p>
        </motion.div>
      </div>
    </main>
  );
}

function RequestsDisabled() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/">
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#13131A] border border-red-500/20 rounded-2xl p-12 text-center"
        >
          <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Creator Requests Currently Closed</h2>
          <p className="text-lg text-gray-400 mb-4">
            We're not accepting new creator requests at this time.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Our admin team has temporarily disabled creator role requests. Please check back later or contact support for more information.
          </p>
          <Link href="/">
            <button className="px-8 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity">
              Return to Homepage
            </button>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

