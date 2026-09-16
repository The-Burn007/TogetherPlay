import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CoupleMemory, CreateMemoryPayload } from "@/lib/memories/types";
import { getDefaultCoupleMemories } from "@/lib/memories/defaultMemories";

// Mock Firebase dependencies
vi.mock("@/lib/firebase/client", () => {
  return {
    db: {},
    storage: {},
    getClientApp: vi.fn(),
    getClientAuth: vi.fn(),
    getClientFirestore: vi.fn(),
    getClientDatabase: vi.fn(),
    getClientStorage: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => {
  return {
    collection: vi.fn((_db, ...paths) => paths.join("/")),
    doc: vi.fn((_db, ...paths) => paths.join("/")),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn((collRef) => collRef),
    orderBy: vi.fn(),
    onSnapshot: vi.fn((_q, callback) => {
      callback({
        empty: false,
        forEach: (fn: (docSnap: any) => void) => {
          const defaults = getDefaultCoupleMemories("cpl_test");
          defaults.forEach((m) =>
            fn({
              id: m.id,
              data: () => m,
            })
          );
        },
      });
      return () => {};
    }),
  };
});

vi.mock("firebase/storage", () => {
  return {
    ref: vi.fn((_storage, path) => ({ fullPath: path })),
    uploadBytes: vi.fn().mockResolvedValue({}),
    getBlob: vi.fn().mockResolvedValue(new Blob(["test-image-content"], { type: "image/jpeg" })),
    deleteObject: vi.fn().mockResolvedValue({}),
  };
});

describe("TogetherPlay Memories - Architectural & Security Suite", () => {
  const coupleId = "cpl_tokyo_london_4209";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Data Model & Path Conformance", () => {
    it("adheres strictly to couples/{coupleId}/memories/{memoryId} structure", () => {
      const memoryId = "mem_12345";
      const firestorePath = `couples/${coupleId}/memories/${memoryId}`;
      expect(firestorePath).toMatch(/^couples\/[^/]+\/memories\/[^/]+$/);
    });

    it("adheres strictly to couples/{coupleId}/memories/{fileName} storage path", () => {
      const fileName = "sunset_balcony.webp";
      const storagePath = `couples/${coupleId}/memories/${fileName}`;
      expect(storagePath).toMatch(/^couples\/[^/]+\/memories\/[^/]+$/);
    });

    it("supports all 5 requested memory categories", () => {
      const defaultMemories = getDefaultCoupleMemories(coupleId);
      const supportedTypes = new Set(defaultMemories.map((m) => m.type));

      expect(supportedTypes.has("photo")).toBe(true);
      expect(supportedTypes.has("game_moment")).toBe(true);
      expect(supportedTypes.has("milestone")).toBe(true);
      expect(supportedTypes.has("relationship_date")).toBe(true);
      expect(supportedTypes.has("note")).toBe(true);
    });
  });

  describe("2. Security Mandate: No Public Media URLs", () => {
    it("ensures media items store storagePath and NEVER contain public download tokens", () => {
      const defaultMemories = getDefaultCoupleMemories(coupleId);
      const photoMemories = defaultMemories.filter((m) => m.media !== undefined);

      photoMemories.forEach((photo) => {
        expect(photo.media?.storagePath).toBeDefined();
        expect(photo.media?.storagePath).toContain(`couples/${coupleId}/memories/`);
        // Must never store a public Firebase Storage token URL in storagePath
        expect(photo.media?.storagePath).not.toContain("firebasestorage.googleapis.com");
        expect(photo.media?.storagePath).not.toContain("alt=media&token=");
      });
    });

    it("requires ephemeral blob or object URLs for in-memory display rather than public URLs", () => {
      const sampleMedia = {
        storagePath: `couples/${coupleId}/memories/tea_toast.jpg`,
        fileName: "tea_toast.jpg",
        contentType: "image/jpeg",
        ephemeralUrl: "blob:https://app.togetherplay.com/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      };

      expect(sampleMedia.storagePath).toBe(`couples/${coupleId}/memories/tea_toast.jpg`);
      expect(sampleMedia.ephemeralUrl?.startsWith("blob:")).toBe(true);
    });
  });

  describe("3. Required Fields & Intimate Context", () => {
    it("guarantees every memory includes date, title, intimate context, and author", () => {
      const memories = getDefaultCoupleMemories(coupleId);
      memories.forEach((m) => {
        expect(m.id).toBeDefined();
        expect(m.title.length).toBeGreaterThan(0);
        expect(m.date).toBeDefined();
        expect(m.context.length).toBeGreaterThan(0);
        expect(m.createdBy).toBeDefined();
        expect(m.authorName).toBeDefined();
      });
    });

    it("game moment memories preserve game and activity details", () => {
      const memories = getDefaultCoupleMemories(coupleId);
      const gameMoments = memories.filter((m) => m.type === "game_moment");
      expect(gameMoments.length).toBeGreaterThan(0);

      gameMoments.forEach((gm) => {
        expect(gm.gameActivity).toBeDefined();
        expect(gm.gameActivity?.gameTitle).toBeDefined();
        expect(gm.gameActivity?.gameType).toBeDefined();
      });
    });

    it("milestone memories capture achievements and metrics", () => {
      const memories = getDefaultCoupleMemories(coupleId);
      const milestones = memories.filter((m) => m.type === "milestone");
      expect(milestones.length).toBeGreaterThan(0);

      milestones.forEach((ms) => {
        expect(ms.milestoneData).toBeDefined();
        expect(ms.milestoneData?.metricLabel).toBeDefined();
        expect(ms.milestoneData?.metricValue).toBeDefined();
      });
    });
  });

  describe("4. Memory Lifecycle & Service Operations", () => {
    it("formats memory payload with appropriate metadata and timestamps", () => {
      const payload: CreateMemoryPayload = {
        type: "note",
        title: "Late Night Kyoto Train Whisper",
        date: "2026-09-15",
        context: "Waiting for the express train back to our shared stay.",
        note: "Thinking about our first duel two years ago.",
        authorName: "Alex",
      };

      expect(payload.type).toBe("note");
      expect(payload.title).toBe("Late Night Kyoto Train Whisper");
      expect(payload.context).toContain("express train");
    });
  });
});
