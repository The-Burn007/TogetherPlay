"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}) => {
  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-surface-deep/80 backdrop-blur-md"
          />

          {/* Drawer Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className={cn(
              "relative w-full max-w-lg bg-surface-overlay border-t border-x border-accent-border rounded-t-2xl shadow-2xl p-5 flex flex-col space-y-4 z-10 max-h-[85vh] overflow-y-auto pb-safe",
              className
            )}
          >
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto -mt-1 cursor-grab active:cursor-grabbing shrink-0" />

            {/* Header */}
            <div className="flex items-start justify-between pt-1">
              <div className="flex flex-col space-y-1">
                {title ? (
                  <h3 className="text-base font-semibold text-canvas-cream tracking-tight">
                    {title}
                  </h3>
                ) : null}
                {description ? (
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-raised transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="w-full flex-1">{children}</div>

            {/* Footer */}
            {footer ? (
              <div className="pt-3 border-t border-subtle-border flex items-center justify-end gap-2">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};
