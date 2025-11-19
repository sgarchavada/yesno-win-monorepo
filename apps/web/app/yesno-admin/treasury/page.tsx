"use client";

import { motion } from "framer-motion";
import TreasuryDashboard from "@/components/TreasuryDashboard";

export default function AdminTreasuryPage() {
  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <h1 className="section-title text-3xl">Platform Treasury</h1>
          <p className="text-muted mt-2">View platform fees and withdraw to the treasury.</p>
        </motion.div>

        <TreasuryDashboard />
      </div>
    </div>
  );
}


