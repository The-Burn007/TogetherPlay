/**
 * TogetherPlay Memories Domain Types
 * Private visual archive & relationship artifact models.
 * Path: couples/{coupleId}/memories/{memoryId}
 * Storage: couples/{coupleId}/memories/{fileName}
 */

export type CoupleMemoryCategory =
  | "photo"
  | "game_moment"
  | "milestone"
  | "relationship_date"
  | "note";

export interface CoupleMemoryMedia {
  storagePath: string; // Must match: couples/{coupleId}/memories/{fileName}
  fileName: string;
  contentType: string;
  fileSize?: number;
  caption?: string;
  // Local ephemeral object URL for private session rendering (never public!)
  ephemeralUrl?: string;
}

export type MemoryGameType =
  | "speed_duel"
  | "find_it_first"
  | "camera_challenge"
  | "couple_race"
  | "ai_game_night"
  | "ai_challenge"
  | "other";

export interface CoupleMemoryGameActivity {
  gameType: MemoryGameType;
  gameTitle: string;
  resultSummary?: string;
  scoreOrMetric?: string;
  winnerName?: string;
  roundsPlayed?: number;
}

export interface CoupleMemoryMilestone {
  milestoneType: "streak" | "distance" | "anniversary" | "ritual" | "custom";
  metricLabel?: string;
  metricValue?: string;
  badgeTitle?: string;
}

export interface CoupleMemoryRelationshipDate {
  eventDate: string;
  location?: string;
  anniversaryYear?: number;
  reflection?: string;
}

export interface CoupleMemory {
  id: string;
  coupleId: string;
  type: CoupleMemoryCategory;
  title: string;
  date: string; // ISO format string: YYYY-MM-DD or full timestamp
  dateLabel: string; // Human-friendly label: "Yesterday · 23:18 GMT" or "Oct 12, 2026"
  context: string; // Intimate relationship context: backstory, location, or atmosphere
  note?: string; // Optional detailed reflections, letters, whispers
  caption?: string; // Controlled visual caption
  reactions?: Record<string, string>; // Controlled partner reactions: e.g. { [uid]: "❤️" }
  visibility?: "couple" | "private" | "archived"; // Controlled archive visibility
  media?: CoupleMemoryMedia;
  gameActivity?: CoupleMemoryGameActivity;
  milestoneData?: CoupleMemoryMilestone;
  relationshipDateData?: CoupleMemoryRelationshipDate;
  createdBy: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateMemoryPayload {
  type: CoupleMemoryCategory;
  title: string;
  date: string;
  dateLabel?: string;
  context: string;
  note?: string;
  caption?: string;
  reactions?: Record<string, string>;
  visibility?: "couple" | "private" | "archived";
  media?: CoupleMemoryMedia;
  gameActivity?: CoupleMemoryGameActivity;
  milestoneData?: CoupleMemoryMilestone;
  relationshipDateData?: CoupleMemoryRelationshipDate;
  authorName?: string;
}

export interface UpdateMemoryPayload {
  caption?: string;
  reaction?: string;
  reactions?: Record<string, string>;
  visibility?: "couple" | "private" | "archived";
  note?: string;
  title?: string;
  context?: string;
  dateLabel?: string;
}

export type MemoryFilter = "all" | CoupleMemoryCategory;
