"use client";

import ManageMarkets from "@/components/ManageMarkets";
import { motion } from "framer-motion";

export default function AdminMarketsPage() {
  return (
    <div className="min-h-screen gradient-bg">
      <div className="mx-auto max-w-screen-2xl px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <h1 className="section-title">Manage Markets</h1>
          <p className="text-muted mt-1">Open, close, resolve, or cancel markets.</p>
        </motion.div>

        <ManageMarkets />
      </div>
    </div>
  );
}
