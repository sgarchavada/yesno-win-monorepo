
import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-[#13131A] border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
            
            <p className="text-gray-400">
              We encountered an unexpected error. Please refresh the page to try again.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-left">
                <p className="text-xs text-red-400 font-mono break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center pt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-semibold text-white transition-all"
              >
                Refresh Page
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="px-6 py-3 bg-linear-to-r from-[#00D1FF] to-[#FF00AA] rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

