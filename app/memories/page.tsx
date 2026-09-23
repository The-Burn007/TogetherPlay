"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container } from "@/components/layout/Container";
import { useAuth } from "@/lib/auth/AuthContext";
import { memoryService } from "@/lib/firebase/services/memories";
import { coupleService } from "@/lib/firebase/services/couple";
import type { CoupleMemory, CreateMemoryPayload, MemoryFilter } from "@/lib/memories/types";
import { MemoriesTimelineItem } from "@/features/memories/MemoriesTimelineItem";
import { MemoryDetailModal } from "@/features/memories/MemoryDetailModal";
import { MemoryUploadModal } from "@/features/memories/MemoryUploadModal";
import { DeleteConfirmationModal } from "@/features/memories/DeleteConfirmationModal";
import { MemoriesSkeleton } from "@/features/memories/MemoriesSkeleton";
import { MemoriesEmptyState } from "@/features/memories/MemoriesEmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  Heart,
  Flame,
  Compass,
  Plus,
  ShieldCheck,
  Camera,
  Gamepad2,
  Trophy,
  CalendarHeart,
  FileText,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function MemoriesPage() {
  const { user, isTestMode } = useAuth();
  const { showToast } = useToast();

  const [coupleId, setCoupleId] = useState<string>("cpl_tokyo_london_4209");
  const [memories, setMemories] = useState<CoupleMemory[]>([]);
  const [activeFilter, setActiveFilter] = useState<MemoryFilter>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [selectedMemory, setSelectedMemory] = useState<CoupleMemory | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [memoryToDelete, setMemoryToDelete] = useState<CoupleMemory | null>(null);

  // 1. Resolve couple membership
  useEffect(() => {
    let isMounted = true;

    async function resolveCouple() {
      if (user?.uid) {
        try {
          const couple = await coupleService.getUserCouple(user.uid);
          if (isMounted && couple?.coupleId) {
            setCoupleId(couple.coupleId);
            return;
          }
        } catch (err) {
          console.warn("Could not fetch user couple, using sanctuary fallback:", err);
        }
      }
      if (isMounted) {
        setCoupleId("cpl_tokyo_london_4209");
      }
    }

    resolveCouple();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // 2. Realtime subscription to couple memories
  useEffect(() => {
    if (!coupleId) return;

    setIsLoading(true);
    setErrorMessage(null);

    const unsubscribe = memoryService.subscribeToMemories(
      coupleId,
      (fetchedMemories) => {
        setMemories(fetchedMemories);
        setIsLoading(false);
      },
      (error) => {
        setErrorMessage("Could not connect to couple archive. Database unavailable.");
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [coupleId]);

  // 3. Filter memories
  const filteredMemories = useMemo(() => {
    if (activeFilter === "all") return memories;
    return memories.filter((m) => m.type === activeFilter);
  }, [memories, activeFilter]);

  // Counts by category
  const counts = useMemo(() => {
    return {
      all: memories.length,
      photo: memories.filter((m) => m.type === "photo").length,
      game_moment: memories.filter((m) => m.type === "game_moment").length,
      milestone: memories.filter((m) => m.type === "milestone").length,
      relationship_date: memories.filter((m) => m.type === "relationship_date").length,
      note: memories.filter((m) => m.type === "note").length,
    };
  }, [memories]);

  // Handle memory creation
  const handleCreateMemory = useCallback(
    async (payload: CreateMemoryPayload, mediaFile?: File | Blob) => {
      const authorUid = user?.uid || "usr_alex_london";
      const authorName = user?.displayName || (isTestMode ? "Alex" : "Partner");

      try {
        const created = await memoryService.createMemory(
          coupleId,
          authorUid,
          authorName,
          payload,
          mediaFile
        );
        // Optimistically update list if subscription hasn't fired yet
        setMemories((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
        showToast("Memory sealed in couple archive");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to save memory";
        showToast(msg);
        throw err;
      }
    },
    [coupleId, user, isTestMode, showToast]
  );

  // Handle memory deletion
  const handleDeleteMemory = useCallback(
    async (memory: CoupleMemory) => {
      try {
        await memoryService.deleteMemory(
          coupleId,
          memory.id,
          memory.media?.storagePath,
          memory.createdBy,
          user?.uid
        );
        setMemories((prev) => prev.filter((m) => m.id !== memory.id));
        if (selectedMemory?.id === memory.id) {
          setSelectedMemory(null);
        }
        showToast("Memory removed from archive");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete memory";
        showToast(msg);
        throw err;
      }
    },
    [coupleId, selectedMemory, showToast, user]
  );

  const filterTabs: { id: MemoryFilter; label: string; count: number; icon: React.ReactNode }[] = [
    { id: "all", label: "All Artifacts", count: counts.all, icon: null },
    { id: "photo", label: "Photos", count: counts.photo, icon: <Camera className="w-3 h-3" /> },
    { id: "game_moment", label: "Game Moments", count: counts.game_moment, icon: <Gamepad2 className="w-3 h-3" /> },
    { id: "milestone", label: "Milestones", count: counts.milestone, icon: <Trophy className="w-3 h-3" /> },
    { id: "relationship_date", label: "Dates", count: counts.relationship_date, icon: <CalendarHeart className="w-3 h-3" /> },
    { id: "note", label: "Notes", count: counts.note, icon: <FileText className="w-3 h-3" /> },
  ];

  return (
    <Container size="sm" className="space-y-6 pb-16">
      {/* 1. Archive Header & Sanctuary Stats */}
      <header className="flex flex-col space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="uppercase tracking-widest text-shared-amber font-semibold">
                Private Visual Archive
              </span>
              <span className="text-on-surface-muted">·</span>
              <span className="flex items-center gap-1 text-player-two-sage">
                <ShieldCheck className="w-3 h-3" />
                <span>Zero Public URLs</span>
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
              Timeline &amp; Memories
            </h1>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Every photo finish, spoken reflection, and shared milestone preserved forever.
            </p>
          </div>

          <button
            id="open-upload-modal-btn"
            onClick={() => setIsUploadOpen(true)}
            className="self-start sm:self-center flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono bg-shared-amber text-surface-deep font-semibold hover:brightness-105 transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Preserve Memory</span>
          </button>
        </div>

        {/* Sanctuary Milestone Stats Banner */}
        <div className="grid grid-cols-3 gap-2 bg-surface-raised border border-subtle-border rounded-xl p-3.5 shadow-md">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-shared-amber mb-0.5">
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span className="text-base font-bold font-mono">{memories.length}</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Preserved Artifacts
            </span>
          </div>

          <div className="flex flex-col items-center text-center border-x border-subtle-border">
            <div className="flex items-center gap-1 text-player-one-ember mb-0.5">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span className="text-base font-bold font-mono">42 Days</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Active Streak
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-player-two-sage mb-0.5">
              <Compass className="w-3.5 h-3.5" />
              <span className="text-base font-bold font-mono">9,560 km</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Distance Bridged
            </span>
          </div>
        </div>
      </header>

      {/* 2. Error State Banner */}
      {errorMessage && (
        <div
          id="memories-error-banner"
          className="flex items-center justify-between p-3.5 rounded-xl bg-player-one-ember/15 border border-player-one-ember/30 text-xs font-mono text-player-one-ember"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => {
              setErrorMessage(null);
              setIsLoading(true);
              memoryService
                .getMemories(coupleId)
                .then((m) => {
                  setMemories(m);
                  setIsLoading(false);
                })
                .catch(() => {
                  setErrorMessage("Failed to connect to archive. Please try again.");
                  setIsLoading(false);
                });
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-player-one-ember/20 hover:bg-player-one-ember/30 text-player-one-ember font-semibold transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 3. Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            id={`filter-tab-${tab.id}`}
            onClick={() => setActiveFilter(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono tracking-wider whitespace-nowrap transition-all border ${
              activeFilter === tab.id
                ? "bg-shared-amber text-surface-deep border-shared-amber font-semibold"
                : "bg-surface-raised text-on-surface-variant border-subtle-border hover:text-on-surface"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeFilter === tab.id
                  ? "bg-surface-deep/20 text-surface-deep"
                  : "bg-surface-deep text-on-surface-muted"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. Loading State */}
      {isLoading && <MemoriesSkeleton />}

      {/* 5. Empty State */}
      {!isLoading && filteredMemories.length === 0 && (
        <MemoriesEmptyState
          filter={activeFilter}
          onOpenUpload={() => setIsUploadOpen(true)}
          onResetFilter={() => setActiveFilter("all")}
        />
      )}

      {/* 6. Timeline-Oriented Composition */}
      {!isLoading && filteredMemories.length > 0 && (
        <div className="relative flex flex-col space-y-6 pt-2">
          {/* Visual Continuous Timeline Spine */}
          <div className="absolute left-1.5 sm:left-2 top-4 bottom-4 w-[1px] bg-subtle-border -z-0" />

          {filteredMemories.map((memory, index) => (
            <MemoriesTimelineItem
              key={memory.id}
              memory={memory}
              isFirst={index === 0}
              isLast={index === filteredMemories.length - 1}
              onSelect={(m) => setSelectedMemory(m)}
            />
          ))}
        </div>
      )}

      {/* 7. Memory Detail Modal */}
      <MemoryDetailModal
        memory={selectedMemory}
        isOpen={Boolean(selectedMemory)}
        onClose={() => setSelectedMemory(null)}
        onRequestDelete={(m) => setMemoryToDelete(m)}
      />

      {/* 8. Memory Upload Modal (Upload State) */}
      <MemoryUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSubmit={handleCreateMemory}
        currentUserName={user?.displayName || (isTestMode ? "Alex" : "Partner")}
      />

      {/* 9. Delete Confirmation Modal */}
      <DeleteConfirmationModal
        memory={memoryToDelete}
        isOpen={Boolean(memoryToDelete)}
        onClose={() => setMemoryToDelete(null)}
        onConfirmDelete={handleDeleteMemory}
      />
    </Container>
  );
}
