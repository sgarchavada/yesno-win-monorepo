"use client";

/**
 * SettingsPanel Component
 * Platform configuration and parameter management
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Save, AlertCircle, ExternalLink } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { getMarketFactory, getProtocolTreasury, getOracleAdapter, getCreatorRegistry } from "@/lib/contracts";
import { formatBps, shortenAddress } from "@/lib/format";
import { Modal } from "./Modal";
import { formatErrorMessage, getErrorTitle } from "@/lib/errorHandler";

type ModalConfig = {
  isOpen: boolean;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "danger";
  showCancel?: boolean;
};

export function SettingsPanel() {
  const account = useActiveAccount();
  
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Separate loading states for each action
  const [isLoadingTreasury, setIsLoadingTreasury] = useState(false);
  const [isLoadingOracle, setIsLoadingOracle] = useState(false);
  const [isLoadingFees, setIsLoadingFees] = useState(false);
  const [isLoadingCollateral, setIsLoadingCollateral] = useState(false);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);
  const [isLoadingCreatorRequests, setIsLoadingCreatorRequests] = useState(false);
  
  // Modal state
  const [modal, setModal] = useState<ModalConfig>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // Modal helpers
  const showSuccess = (message: string) => {
    setModal({
      isOpen: true,
      title: "Success!",
      message,
      type: "success",
      showCancel: false,
    });
  };

  const showError = (error: any) => {
    const title = getErrorTitle(error);
    const message = formatErrorMessage(error);
    
    setModal({
      isOpen: true,
      title,
      message,
      type: "danger",
      showCancel: false,
    });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };
  
  // Current values
  const [treasury, setTreasury] = useState("");
  const [oracleAdapter, setOracleAdapter] = useState("");
  const [defaultCollateral, setDefaultCollateral] = useState("");
  const [minInitialLiquidity, setMinInitialLiquidity] = useState("");
  const [maxOutcomes, setMaxOutcomes] = useState("");
  const [defaultLpFeeBps, setDefaultLpFeeBps] = useState("");
  const [defaultProtocolFeeBps, setDefaultProtocolFeeBps] = useState("");
  const [defaultParlayFeeBps, setDefaultParlayFeeBps] = useState("");
  const [creatorRequestsEnabled, setCreatorRequestsEnabled] = useState(false);
  
  // New values
  const [newTreasury, setNewTreasury] = useState("");
  const [newOracleAdapter, setNewOracleAdapter] = useState("");
  const [newDefaultCollateral, setNewDefaultCollateral] = useState("");
  const [newMinInitialLiquidity, setNewMinInitialLiquidity] = useState("");
  const [newMaxOutcomes, setNewMaxOutcomes] = useState("");
  const [newDefaultLpFeeBps, setNewDefaultLpFeeBps] = useState("");
  const [newDefaultProtocolFeeBps, setNewDefaultProtocolFeeBps] = useState("");
  const [newDefaultParlayFeeBps, setNewDefaultParlayFeeBps] = useState("");

  // Check if user is owner OR admin and fetch settings
  useEffect(() => {
    async function fetchSettings() {
      if (!account) {
        setIsOwner(false);
        setIsAdmin(false);
        setIsAuthorized(false);
        return;
      }

      try {
        const factory = getMarketFactory();
        
        // Check owner
        const owner = await readContract({
          contract: factory,
          method: "function owner() view returns (address)",
          params: [],
        });
        
        const isOwnerCheck = (owner as string).toLowerCase() === account.address.toLowerCase();
        setIsOwner(isOwnerCheck);

        // Check admin
        const adminCheck = await readContract({
          contract: factory,
          method: "function isAdmin(address) view returns (bool)",
          params: [account.address as `0x${string}`],
        });
        setIsAdmin(adminCheck as boolean);

        // User is authorized if they are owner OR admin
        const authorized = isOwnerCheck || (adminCheck as boolean);
        setIsAuthorized(authorized);
        
        if (!authorized) return;

        // Fetch current settings from MarketFactory
        const [
          treasuryAddr,
          oracleAddr,
          collateralAddr,
          minLiq,
          maxOut,
          lpFee,
          protocolFee,
          parlayFee,
        ] = await Promise.all([
          readContract({
            contract: factory,
            method: "function treasury() view returns (address)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function oracleAdapter() view returns (address)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function defaultCollateralToken() view returns (address)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function minInitialLiquidity() view returns (uint256)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function maxOutcomes() view returns (uint256)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function defaultLpFeeBps() view returns (uint256)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function defaultProtocolFeeBps() view returns (uint256)",
            params: [],
          }),
          readContract({
            contract: factory,
            method: "function defaultParlayFeeBps() view returns (uint256)",
            params: [],
          }),
        ]);

        // Fetch creator requests setting from CreatorRegistry
        const registry = getCreatorRegistry();
        const creatorReqEnabled = await readContract({
          contract: registry,
          method: "function creatorRequestsEnabled() view returns (bool)",
          params: [],
        });

        setTreasury(treasuryAddr as string);
        setOracleAdapter(oracleAddr as string);
        setDefaultCollateral(collateralAddr as string);
        setMinInitialLiquidity((minLiq as bigint).toString());
        setMaxOutcomes((maxOut as bigint).toString());
        setCreatorRequestsEnabled(creatorReqEnabled as boolean);
        setDefaultLpFeeBps((lpFee as bigint).toString());
        setDefaultProtocolFeeBps((protocolFee as bigint).toString());
        setDefaultParlayFeeBps((parlayFee as bigint).toString());
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    }

    fetchSettings();
  }, [account]);

  async function handleUpdateTreasury() {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    if (!newTreasury) {
      showError({ message: "Please enter a treasury address" });
      return;
    }

    setIsLoadingTreasury(true);

    try {
      const factory = getMarketFactory();
      const updateTx = prepareContractCall({
        contract: factory,
        method: "function setTreasury(address newTreasury) external",
        params: [newTreasury],
      });
      await sendTransaction({ transaction: updateTx, account });
      
      setTreasury(newTreasury);
      setNewTreasury("");
      showSuccess("Treasury updated successfully!");
    } catch (err: any) {
      console.error("Update treasury error:", err);
      showError(err);
    } finally {
      setIsLoadingTreasury(false);
    }
  }

  async function handleUpdateOracle() {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    if (!newOracleAdapter) {
      showError({ message: "Please enter an oracle adapter address" });
      return;
    }

    setIsLoadingOracle(true);

    try {
      const factory = getMarketFactory();
      const updateTx = prepareContractCall({
        contract: factory,
        method: "function setOracleAdapter(address newOracle) external",
        params: [newOracleAdapter],
      });
      await sendTransaction({ transaction: updateTx, account });
      
      setOracleAdapter(newOracleAdapter);
      setNewOracleAdapter("");
      showSuccess("Oracle adapter updated successfully!");
    } catch (err: any) {
      console.error("Update oracle error:", err);
      showError(err);
    } finally {
      setIsLoadingOracle(false);
    }
  }

  async function handleUpdateFees() {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    if (!newDefaultLpFeeBps && !newDefaultProtocolFeeBps && !newDefaultParlayFeeBps) {
      showError({ message: "Please enter at least one fee parameter" });
      return;
    }

    setIsLoadingFees(true);

    try {
      const factory = getMarketFactory();
      const lpFee = newDefaultLpFeeBps ? BigInt(newDefaultLpFeeBps) : BigInt(defaultLpFeeBps);
      const protocolFee = newDefaultProtocolFeeBps ? BigInt(newDefaultProtocolFeeBps) : BigInt(defaultProtocolFeeBps);
      const parlayFee = newDefaultParlayFeeBps ? BigInt(newDefaultParlayFeeBps) : BigInt(defaultParlayFeeBps);
      
      const updateTx = prepareContractCall({
        contract: factory,
        method: "function setFeeParams(uint256 _lpFeeBps, uint256 _protocolFeeBps, uint256 _parlayFeeBps) external",
        params: [lpFee, protocolFee, parlayFee],
      });
      await sendTransaction({ transaction: updateTx, account });
      
      setDefaultLpFeeBps(lpFee.toString());
      setDefaultProtocolFeeBps(protocolFee.toString());
      setDefaultParlayFeeBps(parlayFee.toString());
      setNewDefaultLpFeeBps("");
      setNewDefaultProtocolFeeBps("");
      setNewDefaultParlayFeeBps("");
      showSuccess("Fee parameters updated successfully!");
    } catch (err: any) {
      console.error("Update fees error:", err);
      showError(err);
    } finally {
      setIsLoadingFees(false);
    }
  }

  async function handleUpdateCollateral() {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    if (!newDefaultCollateral) {
      showError({ message: "Please enter a collateral token address" });
      return;
    }

    setIsLoadingCollateral(true);

    try {
      const factory = getMarketFactory();
      const updateTx = prepareContractCall({
        contract: factory,
        method: "function setDefaultCollateral(address newToken) external",
        params: [newDefaultCollateral],
      });
      await sendTransaction({ transaction: updateTx, account });
      
      setDefaultCollateral(newDefaultCollateral);
      setNewDefaultCollateral("");
      showSuccess("Default collateral updated successfully!");
    } catch (err: any) {
      console.error("Update collateral error:", err);
      showError(err);
    } finally {
      setIsLoadingCollateral(false);
    }
  }

  async function handleUpdateLimits() {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    if (!newMinInitialLiquidity && !newMaxOutcomes) {
      showError({ message: "Please enter at least one limit parameter" });
      return;
    }

    setIsLoadingLimits(true);

    try {
      const factory = getMarketFactory();
      
      if (newMinInitialLiquidity) {
        // Convert USDC to wei (6 decimals)
        // User enters: 10 → Contract gets: 10000000
        const minLiquidityWei = BigInt(Math.floor(Number(newMinInitialLiquidity) * 1e6));
        
        const updateMinLiqTx = prepareContractCall({
          contract: factory,
          method: "function setMinInitialLiquidity(uint256 newMin) external",
          params: [minLiquidityWei],
        });
        await sendTransaction({ transaction: updateMinLiqTx, account });
        
        // Store the wei value in state (for display consistency)
        setMinInitialLiquidity(minLiquidityWei.toString());
        setNewMinInitialLiquidity("");
      }

      if (newMaxOutcomes) {
        const updateMaxOutTx = prepareContractCall({
          contract: factory,
          method: "function setMaxOutcomes(uint256 newMax) external",
          params: [BigInt(newMaxOutcomes)],
        });
        await sendTransaction({ transaction: updateMaxOutTx, account });
        setMaxOutcomes(newMaxOutcomes);
        setNewMaxOutcomes("");
      }

      showSuccess("Limits updated successfully!");
    } catch (err: any) {
      console.error("Update limits error:", err);
      showError(err);
    } finally {
      setIsLoadingLimits(false);
    }
  }

  async function handleToggleCreatorRequests() {
    if (!account) {
      showError({ message: "Please connect your wallet" });
      return;
    }

    setIsLoadingCreatorRequests(true);

    try {
      const registry = getCreatorRegistry();
      const newValue = !creatorRequestsEnabled;
      
      const toggleTx = prepareContractCall({
        contract: registry,
        method: "function setCreatorRequestsEnabled(bool enabled) external",
        params: [newValue],
      });
      await sendTransaction({ transaction: toggleTx, account });
      setCreatorRequestsEnabled(newValue);
      
      showSuccess(`Creator requests ${newValue ? 'enabled' : 'disabled'} successfully!`);
    } catch (err: any) {
      console.error("Toggle creator requests error:", err);
      showError(err);
    } finally {
      setIsLoadingCreatorRequests(false);
    }
  }

  if (!account || !isAuthorized) {
    return (
      <div className="bg-[#13131A] border border-white/10 rounded-2xl p-12 text-center">
        <Settings className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h3 className="text-2xl font-semibold text-white mb-2">Not Authorized</h3>
        <p className="text-gray-400">
          Only the contract owner or admin can access platform settings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Treasury Settings */}
      <SettingCard title="Treasury Address" description="Address where protocol fees are sent">
        <div className="space-y-3">
          <div className="text-sm text-gray-400 flex items-center gap-2">
            Current: 
            <a
              href={`https://sepolia.basescan.org/address/${treasury}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors font-mono"
            >
              {shortenAddress(treasury)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <input
            type="text"
            value={newTreasury}
            onChange={(e) => setNewTreasury(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
          />
          <button
            onClick={handleUpdateTreasury}
            disabled={isLoadingTreasury || !newTreasury}
            className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {isLoadingTreasury ? "Processing..." : "Update Treasury"}
          </button>
        </div>
      </SettingCard>

      {/* Oracle Settings */}
      <SettingCard title="Oracle Adapter" description="Oracle contract for market resolution">
        <div className="space-y-3">
          <div className="text-sm text-gray-400 flex items-center gap-2">
            Current: 
            <a
              href={`https://sepolia.basescan.org/address/${oracleAdapter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors font-mono"
            >
              {shortenAddress(oracleAdapter)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <input
            type="text"
            value={newOracleAdapter}
            onChange={(e) => setNewOracleAdapter(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
          />
          <button
            onClick={handleUpdateOracle}
            disabled={isLoadingOracle || !newOracleAdapter}
            className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {isLoadingOracle ? "Processing..." : "Update Oracle"}
          </button>
        </div>
      </SettingCard>

      {/* Fee Settings */}
      <SettingCard title="Default Fee Parameters" description="Default fees for new markets">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">LP Fee</div>
              <div className="text-white font-semibold">{formatBps(BigInt(defaultLpFeeBps))}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Protocol Fee</div>
              <div className="text-white font-semibold">{formatBps(BigInt(defaultProtocolFeeBps))}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Parlay Fee</div>
              <div className="text-white font-semibold">{formatBps(BigInt(defaultParlayFeeBps))}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <input
              type="number"
              value={newDefaultLpFeeBps}
              onChange={(e) => setNewDefaultLpFeeBps(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="LP (bps)"
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
            <input
              type="number"
              value={newDefaultProtocolFeeBps}
              onChange={(e) => setNewDefaultProtocolFeeBps(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Protocol (bps)"
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
            <input
              type="number"
              value={newDefaultParlayFeeBps}
              onChange={(e) => setNewDefaultParlayFeeBps(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Parlay (bps)"
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
          </div>
          
          <button
            onClick={handleUpdateFees}
            disabled={isLoadingFees || (!newDefaultLpFeeBps && !newDefaultProtocolFeeBps && !newDefaultParlayFeeBps)}
            className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {isLoadingFees ? "Processing..." : "Update Fees"}
          </button>
        </div>
      </SettingCard>

      {/* Collateral Settings */}
      <SettingCard title="Default Collateral Token" description="Default collateral token (e.g., USDC)">
        <div className="space-y-3">
          <div className="text-sm text-gray-400 flex items-center gap-2">
            Current: 
            <a
              href={`https://sepolia.basescan.org/address/${defaultCollateral}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#00D1FF] hover:text-[#00D1FF]/80 transition-colors font-mono"
            >
              {shortenAddress(defaultCollateral)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <input
            type="text"
            value={newDefaultCollateral}
            onChange={(e) => setNewDefaultCollateral(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
          />
          <button
            onClick={handleUpdateCollateral}
            disabled={isLoadingCollateral || !newDefaultCollateral}
            className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {isLoadingCollateral ? "Processing..." : "Update Collateral"}
          </button>
        </div>
      </SettingCard>

      {/* Limits Settings */}
      <SettingCard title="Market Limits" description="Minimum liquidity and maximum outcomes">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">Min Initial Liquidity</div>
              <div className="text-white font-semibold">{(Number(minInitialLiquidity) / 1e6).toFixed(2)} USDC</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Max Outcomes</div>
              <div className="text-white font-semibold">{maxOutcomes}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                value={newMinInitialLiquidity}
                onChange={(e) => setNewMinInitialLiquidity(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="e.g., 10 or 20"
                min="0"
                step="1"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
              />
              <div className="text-xs text-gray-500 mt-1">Enter amount in USDC (e.g., 10, 20, 100)</div>
            </div>
            <input
              type="number"
              value={newMaxOutcomes}
              onChange={(e) => setNewMaxOutcomes(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Max outcomes"
              min="2"
              max="20"
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
            />
          </div>
          
          <button
            onClick={handleUpdateLimits}
            disabled={isLoadingLimits || (!newMinInitialLiquidity && !newMaxOutcomes)}
            className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-2" />
            {isLoadingLimits ? "Processing..." : "Update Limits"}
          </button>
        </div>
      </SettingCard>

      {/* Creator Requests Settings */}
      <SettingCard title="Creator Requests" description="Enable or disable new creator role requests from users">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div className="flex-1">
              <div className="text-white font-semibold mb-1">
                Creator Requests Status
              </div>
              <div className={`text-sm ${creatorRequestsEnabled ? 'text-green-400' : 'text-orange-400'}`}>
                Currently {creatorRequestsEnabled ? 'Enabled' : 'Disabled'}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {creatorRequestsEnabled 
                  ? "Users can submit requests to become creators. You'll review them in the Creators tab."
                  : "New creator requests are disabled. Users will see a message that you're not accepting requests."}
              </p>
            </div>
            <button
              onClick={handleToggleCreatorRequests}
              disabled={isLoadingCreatorRequests}
              className={`px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 ${
                creatorRequestsEnabled
                  ? 'bg-orange-500/20 hover:bg-orange-500/30 border-2 border-orange-500/50'
                  : 'bg-linear-to-r from-[#00D1FF] to-[#FF00AA] hover:opacity-90'
              }`}
            >
              {isLoadingCreatorRequests ? "Processing..." : creatorRequestsEnabled ? "Disable Requests" : "Enable Requests"}
            </button>
          </div>
        </div>
      </SettingCard>

      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        showCancel={modal.showCancel}
      />
    </div>
  );
}

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#13131A] border border-white/10 rounded-2xl p-6 space-y-4"
    >
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>
      {children}
    </motion.div>
  );
}

