
import { Link } from "react-router-dom";
import { ConnectButton } from "thirdweb/react";
import { client } from "@/client";
import { baseSepolia } from "thirdweb/chains";
import { useActiveAccount } from "thirdweb/react";
import { useSwitchToBaseSepolia, useCurrentChainId, isBaseSepolia } from "@/lib/chainUtils";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { tokenContractAddress } from "@/constants/contracts";

export default function Header() {
  const account = useActiveAccount();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("theme") as "light" | "dark";
    return saved || "dark";
  });

  const switchToBaseSepolia = useSwitchToBaseSepolia();
  const chainId = useCurrentChainId();
  useEffect(() => {
    if (account && !isBaseSepolia(chainId)) {
      const run = async () => {
        try {
          await switchToBaseSepolia();
        } catch {}
      };
      run();
    }
  }, [account, chainId, switchToBaseSepolia]);

  // Initialize theme on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = saved || "dark";
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  // Sync theme changes to DOM
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("theme", next);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-white/10 backdrop-blur-xl">
      <div className="mx-auto max-w-screen-2xl px-6 flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="text-2xl font-bold bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-urbanist">
            yesno.win
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1 ml-8">
          <Link to="/" className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            Markets
          </Link>
          <Link to="/portfolio" className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            Portfolio
          </Link>
          <Link to="/become-creator" className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            Become Creator
          </Link>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Theme + Wallet */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="glass inline-flex h-9 w-9 items-center justify-center rounded-lg hover:shadow-glow transition-all"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-400" />
            )}
          </button>
          <ConnectButton
            client={client}
            chain={baseSepolia}
            connectModal={{
              size: "compact",
              title: "Connect to yesno.win",
              showThirdwebBranding: false,
            }}
            connectButton={{
              label: "Connect Wallet",
              className: "btn-primary text-sm px-4 py-2",
            }}
            accountAbstraction={{
              chain: baseSepolia,
              sponsorGas: true,
            }}
            detailsButton={{
              displayBalanceToken: tokenContractAddress ? {
                [baseSepolia.id]: tokenContractAddress,
              } : undefined,
            }}
          />
        </div>
      </div>
    </header>
  );
}
