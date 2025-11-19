/**
 * Modal Component
 * Beautiful modal dialog for confirmations and alerts
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type ModalType = "info" | "success" | "warning" | "danger";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void> | boolean | Promise<boolean>;
  title: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  children?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = "info",
  confirmText = "OK",
  cancelText = "Cancel",
  showCancel = true,
  children,
}: ModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Reset loading state and error when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
      setError("");
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isLoading, onClose]);

  const handleConfirm = async () => {
    if (isLoading) return;

    // If no onConfirm callback, just close the modal (for simple alerts)
    if (!onConfirm) {
      onClose();
      return;
    }

    // Clear previous error
    setError("");

    try {
      setIsLoading(true);
      const result = onConfirm();
      
      let shouldClose = true;
      
      // If onConfirm returns a Promise, wait for it
      if (result instanceof Promise) {
        const promiseResult = await result;
        // If promise resolves to false, don't close
        if (promiseResult === false) {
          shouldClose = false;
        }
      } else if (result === false) {
        // If returns false synchronously, don't close
        shouldClose = false;
      }
      
      // Only close if validation passed
      if (shouldClose) {
        onClose();
      }
    } catch (err: any) {
      // Show error message inline
      const errorMessage = err?.message || "An unexpected error occurred";
      setError(errorMessage);
      console.error("Modal confirm error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-12 h-12 text-green-400" />;
      case "warning":
        return <AlertTriangle className="w-12 h-12 text-orange-400" />;
      case "danger":
        return <AlertCircle className="w-12 h-12 text-red-400" />;
      default:
        return <Info className="w-12 h-12 text-[#00D1FF]" />;
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case "success":
        return "from-green-500 to-emerald-500";
      case "warning":
        return "from-orange-500 to-amber-500";
      case "danger":
        return "from-red-500 to-rose-500";
      default:
        return "from-[#00D1FF] to-[#FF00AA]";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="bg-[#13131A] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header with gradient accent */}
              <div className={`h-1 bg-linear-to-r ${getAccentColor()}`} />

              {/* Content */}
              <div className="p-6">
                {/* Close button */}
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                  {getIcon()}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white text-center mb-3">
                  {title}
                </h3>

                {/* Message */}
                <p className="text-gray-400 text-center text-sm leading-relaxed mb-6">
                  {message}
                </p>

                {/* Custom Content */}
                {children && <div className="mb-6">{children}</div>}

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {showCancel && (
                    <button
                      onClick={onClose}
                      disabled={isLoading}
                      className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelText}
                    </button>
                  )}
                  <button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className={`flex-1 px-4 py-3 bg-linear-to-r ${getAccentColor()} rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

