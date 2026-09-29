"use client";

import React, { useState } from "react";
import type { CoupleMemory } from "@/lib/memories/types";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

interface DeleteConfirmationModalProps {
  memory: CoupleMemory | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (memory: CoupleMemory) => Promise<void>;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  memory,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !memory) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(memory);
      onClose();
    } catch (err) {
      console.error("Failed to delete memory:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="delete-memory-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-canvas/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="delete-memory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-memory-title"
        className="relative w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-elevation-lg space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center text-danger">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <h3
            id="delete-memory-title"
            className="text-lg font-display font-medium text-text-primary tracking-tight"
          >
            Remove from Couple Archive?
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to remove <span className="font-semibold text-text-primary">&ldquo;{memory.title}&rdquo;</span>? This memory artifact and its private media will be permanently deleted from both partners&apos; timeline.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-mono bg-surface-raised border border-border text-text-primary hover:bg-surface-overlay transition-colors cursor-pointer"
          >
            Keep Memory
          </button>
          <button
            type="button"
            id="confirm-delete-memory-btn"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono bg-danger hover:brightness-110 text-text-primary font-medium disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
