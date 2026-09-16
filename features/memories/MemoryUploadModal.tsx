"use client";

import React, { useState, useRef } from "react";
import type {
  CoupleMemoryCategory,
  CreateMemoryPayload,
  MemoryGameType,
} from "@/lib/memories/types";
import {
  X,
  Camera,
  Gamepad2,
  Trophy,
  CalendarHeart,
  FileText,
  Upload,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface MemoryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    payload: CreateMemoryPayload,
    mediaFile?: File | Blob
  ) => Promise<void>;
  currentUserName: string;
}

export const MemoryUploadModal: React.FC<MemoryUploadModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUserName,
}) => {
  const [category, setCategory] = useState<CoupleMemoryCategory>("photo");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [context, setContext] = useState("");
  const [note, setNote] = useState("");

  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Game moment fields
  const [gameType, setGameType] = useState<MemoryGameType>("speed_duel");
  const [gameResultSummary, setGameResultSummary] = useState("");
  const [gameScoreMetric, setGameScoreMetric] = useState("");
  const [gameWinnerName, setGameWinnerName] = useState(currentUserName);

  // Milestone fields
  const [milestoneType, setMilestoneType] = useState<"streak" | "distance" | "anniversary" | "ritual" | "custom">("streak");
  const [metricLabel, setMetricLabel] = useState("Active Streak");
  const [metricValue, setMetricValue] = useState("45 Days");
  const [badgeTitle, setBadgeTitle] = useState("Unbroken Meridian");

  // Relationship date fields
  const [location, setLocation] = useState("");
  const [anniversaryYear, setAnniversaryYear] = useState<number | undefined>(undefined);

  // Submission / Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setErrorMessage("Please select a valid image file (JPEG, PNG, or WebP). Vector formats (SVG) are not permitted.");
      return;
    }
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("File exceeds the 15MB size limit. Please choose a smaller image.");
      return;
    }
    setErrorMessage(null);
    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaPreviewUrl(objectUrl);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Please give this memory a title.");
      return;
    }
    if (!context.trim()) {
      setErrorMessage("Please provide relationship context (location, backstory, or what made this moment special).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: CreateMemoryPayload = {
      type: category,
      title: title.trim(),
      date,
      context: context.trim(),
      note: note.trim() || undefined,
      authorName: currentUserName,
    };

    if (category === "game_moment") {
      const gameTitles: Record<MemoryGameType, string> = {
        speed_duel: "Speed Duel: Reflex Matrix",
        find_it_first: "Find It First: Sensory Hunt",
        camera_challenge: "Camera Challenge: Dual Quest",
        couple_race: "Couple Race: Meridian Journey",
        ai_game_night: "AI Game Night: Meridian Sequence",
        ai_challenge: "TogetherPlay AI Challenge",
        other: "Relationship Game Session",
      };
      payload.gameActivity = {
        gameType,
        gameTitle: gameTitles[gameType],
        resultSummary: gameResultSummary.trim() || undefined,
        scoreOrMetric: gameScoreMetric.trim() || undefined,
        winnerName: gameWinnerName.trim() || undefined,
      };
    } else if (category === "milestone") {
      payload.milestoneData = {
        milestoneType,
        metricLabel: metricLabel.trim(),
        metricValue: metricValue.trim(),
        badgeTitle: badgeTitle.trim(),
      };
    } else if (category === "relationship_date") {
      payload.relationshipDateData = {
        eventDate: date,
        location: location.trim() || undefined,
        anniversaryYear: anniversaryYear ? Number(anniversaryYear) : undefined,
      };
    }

    try {
      await onSubmit(payload, mediaFile || undefined);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record memory";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="memory-upload-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-deep/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="memory-upload-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-upload-title"
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-surface-raised border border-subtle-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle-border pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-shared-amber font-semibold">
              Private Couple Archive
            </span>
            <h2
              id="memory-upload-title"
              className="text-xl font-semibold text-on-surface tracking-tight"
            >
              Preserve a Memory
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-deep transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-player-one-ember/15 border border-player-one-ember/30 text-player-one-ember text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selector Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-on-surface-variant">
              Memory Category
            </label>
            <div className="grid grid-cols-5 gap-1.5 bg-surface-deep p-1 rounded-xl border border-subtle-border">
              <button
                type="button"
                onClick={() => setCategory("photo")}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-mono transition-all ${
                  category === "photo"
                    ? "bg-surface-raised text-player-one-ember font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory("game_moment")}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-mono transition-all ${
                  category === "game_moment"
                    ? "bg-surface-raised text-shared-amber font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Game</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory("milestone")}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-mono transition-all ${
                  category === "milestone"
                    ? "bg-surface-raised text-player-two-sage font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Milestone</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory("relationship_date")}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-mono transition-all ${
                  category === "relationship_date"
                    ? "bg-surface-raised text-player-one-ember font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <CalendarHeart className="w-3.5 h-3.5" />
                <span>Date</span>
              </button>
              <button
                type="button"
                onClick={() => setCategory("note")}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-mono transition-all ${
                  category === "note"
                    ? "bg-surface-raised text-on-surface font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Note</span>
              </button>
            </div>
          </div>

          {/* Title & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="memory-title-input" className="text-xs font-mono text-on-surface-variant">
                Title *
              </label>
              <input
                id="memory-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === "photo"
                    ? "e.g., Morning Coffee Across 9,560 km"
                    : category === "game_moment"
                    ? "e.g., Midnight Speed Duel Climax"
                    : category === "milestone"
                    ? "e.g., Crossed 50-Day Ritual Streak"
                    : category === "relationship_date"
                    ? "e.g., Tokyo Autumn Reunion Planning"
                    : "e.g., Midnight Letter on the Train"
                }
                className="w-full bg-surface-deep border border-subtle-border rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="memory-date-input" className="text-xs font-mono text-on-surface-variant">
                Date *
              </label>
              <input
                id="memory-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface-deep border border-subtle-border rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                required
              />
            </div>
          </div>

          {/* Intimate Context */}
          <div className="space-y-1">
            <label htmlFor="memory-context-input" className="text-xs font-mono text-on-surface-variant flex items-center justify-between">
              <span>Intimate Context &amp; Backstory *</span>
              <span className="text-[10px] text-on-surface-muted">Location / Setting</span>
            </label>
            <textarea
              id="memory-context-input"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Where were you both? What was the weather, room atmosphere, or backstory behind this moment?"
              rows={2}
              className="w-full bg-surface-deep border border-subtle-border rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-shared-amber resize-none"
              required
            />
          </div>

          {/* Category-Specific Form Section */}
          {/* 1. PHOTO UPLOAD SECTION */}
          {category === "photo" && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-on-surface-variant flex items-center justify-between">
                <span>Private Photo</span>
                <span className="text-[10px] text-on-surface-muted">
                  Stored securely under couples/{`{coupleId}`}/memories/
                </span>
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                  isDragging
                    ? "border-shared-amber bg-shared-amber/5"
                    : "border-subtle-border hover:border-shared-amber/50 bg-surface-deep/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {mediaPreviewUrl ? (
                  <div className="relative w-full max-h-48 rounded-lg overflow-hidden border border-subtle-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaPreviewUrl}
                      alt="Preview"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-surface-deep/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs font-mono text-canvas-cream bg-surface-deep/80 px-2 py-1 rounded">
                        Click or drag to replace
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                      <ImageIcon className="w-5 h-5 text-shared-amber" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-on-surface font-medium">
                        Drag &amp; drop your private photo, or click to browse
                      </p>
                      <p className="text-[10px] font-mono text-on-surface-muted">
                        Zero public URLs · Ephemeral streaming
                      </p>
                    </div>
                  </>
                )}
              </div>

              {mediaFile && (
                <div className="space-y-1">
                  <label htmlFor="media-caption-input" className="text-[11px] font-mono text-on-surface-variant">
                    Photo Caption (optional)
                  </label>
                  <input
                    id="media-caption-input"
                    type="text"
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                    placeholder="e.g., The golden light reflecting on the kitchen counter."
                    className="w-full bg-surface-deep border border-subtle-border rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. GAME MOMENT SECTION */}
          {category === "game_moment" && (
            <div className="bg-surface-deep border border-subtle-border rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Game / Activity
                  </label>
                  <select
                    value={gameType}
                    onChange={(e) => setGameType(e.target.value as MemoryGameType)}
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  >
                    <option value="speed_duel">Speed Duel: Reflex Matrix</option>
                    <option value="find_it_first">Find It First: Sensory Hunt</option>
                    <option value="camera_challenge">Camera Challenge: Dual Quest</option>
                    <option value="couple_race">Couple Race: Meridian Journey</option>
                    <option value="ai_game_night">AI Game Night: 5-Round Sequence</option>
                    <option value="ai_challenge">TogetherPlay AI Challenge</option>
                    <option value="other">Custom Relationship Game</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Winner (optional)
                  </label>
                  <input
                    type="text"
                    value={gameWinnerName}
                    onChange={(e) => setGameWinnerName(e.target.value)}
                    placeholder="e.g., Sam or Tie"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Score / Metric
                  </label>
                  <input
                    type="text"
                    value={gameScoreMetric}
                    onChange={(e) => setGameScoreMetric(e.target.value)}
                    placeholder="e.g., 230ms reaction or 98% synchrony"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Outcome Summary
                  </label>
                  <input
                    type="text"
                    value={gameResultSummary}
                    onChange={(e) => setGameResultSummary(e.target.value)}
                    placeholder="e.g., Decided on the 5th final round tiebreak"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. MILESTONE SECTION */}
          {category === "milestone" && (
            <div className="bg-surface-deep border border-subtle-border rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Milestone Type
                  </label>
                  <select
                    value={milestoneType}
                    onChange={(e) => setMilestoneType(e.target.value as any)}
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  >
                    <option value="streak">Ritual Streak</option>
                    <option value="distance">Distance Bridged</option>
                    <option value="anniversary">Relationship Anniversary</option>
                    <option value="ritual">Shared Habit / Ritual</option>
                    <option value="custom">Custom Milestone</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Badge Title
                  </label>
                  <input
                    type="text"
                    value={badgeTitle}
                    onChange={(e) => setBadgeTitle(e.target.value)}
                    placeholder="e.g., Meridian Keepers"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Metric Label
                  </label>
                  <input
                    type="text"
                    value={metricLabel}
                    onChange={(e) => setMetricLabel(e.target.value)}
                    placeholder="e.g., Active Streak"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Metric Value
                  </label>
                  <input
                    type="text"
                    value={metricValue}
                    onChange={(e) => setMetricValue(e.target.value)}
                    placeholder="e.g., 50 Consecutive Days"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. RELATIONSHIP DATE SECTION */}
          {category === "relationship_date" && (
            <div className="bg-surface-deep border border-subtle-border rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Location / Destination
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Shinjuku Gyoen or London Bridge"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-on-surface-variant">
                    Anniversary Year (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={anniversaryYear || ""}
                    onChange={(e) => setAnniversaryYear(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g., 2"
                    className="w-full bg-surface-raised border border-subtle-border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-shared-amber"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Detailed Reflections / Notes / Whispers */}
          <div className="space-y-1">
            <label htmlFor="memory-note-input" className="text-xs font-mono text-on-surface-variant flex items-center justify-between">
              <span>{category === "note" ? "Letter / Whispered Note *" : "Personal Reflection / Notes (optional)"}</span>
              <span className="text-[10px] text-on-surface-muted">Private to couple</span>
            </label>
            <textarea
              id="memory-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a letter, a whispered thought, or what this memory feels like..."
              rows={category === "note" ? 4 : 2}
              className="w-full bg-surface-deep border border-subtle-border rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-shared-amber resize-none font-serif leading-relaxed"
              required={category === "note"}
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-subtle-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-mono bg-surface-deep border border-subtle-border text-on-surface hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-memory-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono bg-shared-amber text-surface-deep font-semibold hover:brightness-105 disabled:opacity-50 transition-all shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preserving in Archive...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Preserve Memory</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
