"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCircle2, Zap, Radio, AlertCircle } from "lucide-react";

export type ToastVariant = "info" | "success" | "nudge" | "turn" | "error";

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastContextType {
  showToast: (messageOrOptions: string | ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastOptions | null>(null);

  const showToast = useCallback((messageOrOptions: string | ToastOptions) => {
    const opts: ToastOptions =
      typeof messageOrOptions === "string"
        ? { message: messageOrOptions, variant: "nudge" }
        : messageOrOptions;

    setToast(opts);
    const timer = setTimeout(() => {
      setToast(null);
    }, opts.durationMs || 3200);

    return () => clearTimeout(timer);
  }, []);

  const variantIcons = {
    info: Radio,
    success: CheckCircle2,
    nudge: Bell,
    turn: Zap,
    error: AlertCircle,
  };

  const variantStyles = {
    info: "border-border-sage/40 text-player-two-sage-text",
    success: "border-border-sage/50 text-player-two-sage",
    nudge: "border-border-amber/50 text-shared-amber",
    turn: "border-border-ember/50 text-player-one-ember-text",
    error: "border-status-error/50 text-status-error",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-16 inset-x-0 z-50 pointer-events-none flex justify-center px-4">
        <AnimatePresence>
          {toast ? (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-full bg-surface-overlay border shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-mono tracking-wide ${
                variantStyles[toast.variant || "nudge"]
              }`}
            >
              {React.createElement(variantIcons[toast.variant || "nudge"], {
                className: "w-4 h-4 shrink-0 animate-pulse",
              })}
              <span className="text-on-surface font-medium">{toast.message}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
