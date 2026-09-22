import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import type { CoupleMemory, CreateMemoryPayload, UpdateMemoryPayload } from "@/lib/memories/types";

// Security context types simulating Firebase Auth & Firestore/Storage Rule environments
interface RuleAuthContext {
  uid: string | null;
}

interface FirestoreRuleState {
  couples: Map<string, { memberIds: string[] }>;
  memories: Map<string, CoupleMemory>;
}

interface StorageRuleState {
  couples: Map<string, { memberIds: string[] }>;
  files: Map<string, { size: number; contentType: string; creatorUid?: string }>;
}

/**
 * Rule Engine Evaluator simulating firestore.rules logic for /couples/{coupleId}/memories/{memoryId}
 */
class FirestoreMemoriesRuleEngine {
  constructor(public state: FirestoreRuleState) {}

  private isCoupleMember(coupleId: string, auth: RuleAuthContext): boolean {
    if (!auth.uid) return false;
    const couple = this.state.couples.get(coupleId);
    return !!couple && couple.memberIds.includes(auth.uid);
  }

  evaluateRead(coupleId: string, memoryId: string, auth: RuleAuthContext): { allowed: boolean; reason?: string } {
    if (!this.isCoupleMember(coupleId, auth)) {
      return { allowed: false, reason: "Forbidden: Only verified couple members can read memories." };
    }
    return { allowed: true };
  }

  evaluateCreate(
    coupleId: string,
    memoryId: string,
    data: Record<string, any>,
    auth: RuleAuthContext
  ): { allowed: boolean; reason?: string } {
    if (!this.isCoupleMember(coupleId, auth)) {
      return { allowed: false, reason: "Forbidden: Only couple members can create memories." };
    }
    if (data.id !== memoryId) {
      return { allowed: false, reason: "Violation: memory ID must match document ID." };
    }
    if (data.coupleId !== coupleId) {
      return { allowed: false, reason: "Violation: couple ID must match collection path." };
    }
    if (data.createdBy !== auth.uid) {
      return { allowed: false, reason: "Violation: createdBy must match authenticated UID." };
    }
    if (typeof data.createdAt !== "string" || !data.createdAt) {
      return { allowed: false, reason: "Violation: createdAt must be a valid timestamp string." };
    }
    if (typeof data.date !== "string" || !data.date) {
      return { allowed: false, reason: "Violation: date must be a valid date string." };
    }
    if (data.media) {
      const sp = data.media.storagePath;
      if (typeof sp !== "string" || !sp.startsWith(`couples/${coupleId}/memories/`)) {
        return { allowed: false, reason: "Violation: media storagePath must reside within couple's memories namespace." };
      }
      if (sp.includes("..")) {
        return { allowed: false, reason: "Violation: path traversal detected in media storage reference." };
      }
    }
    return { allowed: true };
  }

  evaluateUpdate(
    coupleId: string,
    memoryId: string,
    newData: Record<string, any>,
    auth: RuleAuthContext
  ): { allowed: boolean; reason?: string } {
    if (!this.isCoupleMember(coupleId, auth)) {
      return { allowed: false, reason: "Forbidden: Only couple members can update memories." };
    }
    const existing = this.state.memories.get(`${coupleId}/${memoryId}`);
    if (!existing) {
      return { allowed: false, reason: "Document not found." };
    }

    // IMMUTABLE FIELD CHECKS:
    if (newData.id !== existing.id) {
      return { allowed: false, reason: "IMMUTABILITY_VIOLATION: memory ID cannot be modified." };
    }
    if (newData.coupleId !== existing.coupleId) {
      return { allowed: false, reason: "IMMUTABILITY_VIOLATION: couple ID cannot be modified." };
    }
    if (newData.createdBy !== existing.createdBy) {
      return { allowed: false, reason: "IMMUTABILITY_VIOLATION: creator ownership cannot be mutated." };
    }
    if (newData.createdAt !== existing.createdAt) {
      return { allowed: false, reason: "IMMUTABILITY_VIOLATION: creation timestamp cannot be forged or mutated." };
    }
    if (existing.media && existing.media.storagePath) {
      if (!newData.media || newData.media.storagePath !== existing.media.storagePath) {
        return { allowed: false, reason: "IMMUTABILITY_VIOLATION: original media storage reference cannot be replaced." };
      }
      if (newData.media.fileName !== existing.media.fileName) {
        return { allowed: false, reason: "IMMUTABILITY_VIOLATION: original media fileName cannot be altered." };
      }
    }

    // CONTROLLED FIELDS CHECK (diff.affectedKeys):
    const allowedKeys = new Set([
      "caption",
      "reaction",
      "reactions",
      "visibility",
      "note",
      "title",
      "context",
      "dateLabel",
      "updatedAt",
      "media",
    ]);

    const modifiedKeys = Object.keys(newData).filter((k) => {
      return JSON.stringify(newData[k]) !== JSON.stringify((existing as any)[k]);
    });

    for (const key of modifiedKeys) {
      if (!allowedKeys.has(key)) {
        return { allowed: false, reason: `Forbidden: field '${key}' is not in allowed controlled update list.` };
      }
    }

    return { allowed: true };
  }

  evaluateDelete(
    coupleId: string,
    memoryId: string,
    auth: RuleAuthContext
  ): { allowed: boolean; reason?: string } {
    if (!this.isCoupleMember(coupleId, auth)) {
      return { allowed: false, reason: "Forbidden: Only couple members can delete memories." };
    }
    const existing = this.state.memories.get(`${coupleId}/${memoryId}`);
    if (!existing) {
      return { allowed: false, reason: "Document not found." };
    }

    // STRICT CREATOR-ONLY DELETION
    if (existing.createdBy !== auth.uid) {
      return { allowed: false, reason: "UNAUTHORIZED_DELETE: Only the creator who authored this memory can delete it." };
    }

    return { allowed: true };
  }
}

/**
 * Rule Engine Evaluator simulating storage.rules logic for couple memory media paths
 */
class StorageMemoriesRuleEngine {
  constructor(public state: StorageRuleState) {}

  private isCoupleMember(coupleId: string, auth: RuleAuthContext): boolean {
    if (!auth.uid) return false;
    const couple = this.state.couples.get(coupleId);
    return !!couple && couple.memberIds.includes(auth.uid);
  }

  evaluateRead(storagePath: string, auth: RuleAuthContext): { allowed: boolean; reason?: string } {
    const match = storagePath.match(/^couples\/([^/]+)\/memories\/(.+)$/);
    if (!match) return { allowed: false, reason: "Invalid storage path." };
    const coupleId = match[1];

    if (!this.isCoupleMember(coupleId, auth)) {
      return { allowed: false, reason: "Forbidden: Not authorized to read couple media." };
    }
    return { allowed: true };
  }

  evaluateCreate(
    storagePath: string,
    metadata: { size: number; contentType: string },
    auth: RuleAuthContext
  ): { allowed: boolean; reason?: string } {
    // 1. Path format match
    const ownershipMatch = storagePath.match(/^couples\/([^/]+)\/memories\/([^/]+)\/([^/]+)$/);
    const topLevelMatch = storagePath.match(/^couples\/([^/]+)\/memories\/([^/]+)$/);

    if (!ownershipMatch && !topLevelMatch) {
      return { allowed: false, reason: "Invalid storage path structure." };
    }

    const coupleId = ownershipMatch ? ownershipMatch[1] : topLevelMatch![1];
    const creatorUid = ownershipMatch ? ownershipMatch[2] : null;
    const fileName = ownershipMatch ? ownershipMatch[3] : topLevelMatch![2];

    // Check couple membership
    if (!this.isCoupleMember(coupleId, auth)) {
      return { allowed: false, reason: "Forbidden: Not a member of this couple." };
    }

    // Ownership-aware check
    if (creatorUid && auth.uid !== creatorUid) {
      return { allowed: false, reason: "Forbidden: Cannot upload into another user's media folder." };
    }

    // Path traversal check
    if (fileName.includes("..") || fileName.length > 128) {
      return { allowed: false, reason: "Security violation: path traversal or excessive filename length." };
    }

    // Size limit (15MB)
    if (metadata.size > 15 * 1024 * 1024) {
      return { allowed: false, reason: "Violation: file exceeds 15MB size limit." };
    }

    // Safe MIME type (SVG blocked)
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(metadata.contentType)) {
      return { allowed: false, reason: "Violation: only JPEG, PNG, and WebP raster images permitted." };
    }

    return { allowed: true };
  }

  evaluateUpdate(storagePath: string, auth: RuleAuthContext): { allowed: boolean; reason?: string } {
    // Storage rules specify: allow update: if false;
    return { allowed: false, reason: "OVERWRITE_FORBIDDEN: Replacing existing memory media is strictly prohibited." };
  }

  evaluateDelete(storagePath: string, auth: RuleAuthContext): { allowed: boolean; reason?: string } {
    const ownershipMatch = storagePath.match(/^couples\/([^/]+)\/memories\/([^/]+)\/([^/]+)$/);
    const topLevelMatch = storagePath.match(/^couples\/([^/]+)\/memories\/([^/]+)$/);

    if (!ownershipMatch && !topLevelMatch) {
      return { allowed: false, reason: "Invalid storage path." };
    }

    const coupleId = ownershipMatch ? ownershipMatch[1] : topLevelMatch![1];
    const creatorUid = ownershipMatch ? ownershipMatch[2] : null;

    if (!this.isCoupleMember(coupleId, auth)) {
      return { allowed: false, reason: "Forbidden: Not a member of this couple." };
    }

    // In ownership-aware paths: only creator can delete
    if (creatorUid && auth.uid !== creatorUid) {
      return { allowed: false, reason: "UNAUTHORIZED_DELETE: Only the creator who uploaded this media can delete it." };
    }

    return { allowed: true };
  }
}

describe("TASK: MEMORY DATA INTEGRITY HARDENING SECURITY TESTS", () => {
  const COUPLE_1 = "cpl_alex_sam";
  const COUPLE_2 = "cpl_outsider_pair";

  const USER_ALEX = "usr_alex_123";
  const USER_SAM = "usr_sam_456";
  const OUTSIDER_CHARLIE = "usr_charlie_789";

  let firestoreEngine: FirestoreMemoriesRuleEngine;
  let storageEngine: StorageMemoriesRuleEngine;

  const sampleMemory: CoupleMemory = {
    id: "mem_london_trip_001",
    coupleId: COUPLE_1,
    type: "photo",
    title: "Rainy Afternoon in Covent Garden",
    date: "2026-09-18",
    dateLabel: "Sep 18, 2026",
    context: "Sharing hot chocolate under the glass canopy.",
    caption: "Our favorite rainy corner.",
    reactions: { [USER_SAM]: "❤️" },
    visibility: "couple",
    media: {
      storagePath: `couples/${COUPLE_1}/memories/${USER_ALEX}/photo_001.jpg`,
      fileName: "photo_001.jpg",
      contentType: "image/jpeg",
      fileSize: 2048000,
    },
    createdBy: USER_ALEX,
    authorName: "Alex",
    createdAt: "2026-09-18T14:30:00.000Z",
    updatedAt: "2026-09-18T14:30:00.000Z",
  };

  beforeEach(() => {
    const firestoreState: FirestoreRuleState = {
      couples: new Map([
        [COUPLE_1, { memberIds: [USER_ALEX, USER_SAM] }],
        [COUPLE_2, { memberIds: [OUTSIDER_CHARLIE] }],
      ]),
      memories: new Map([
        [`${COUPLE_1}/${sampleMemory.id}`, { ...sampleMemory }],
      ]),
    };

    const storageState: StorageRuleState = {
      couples: new Map([
        [COUPLE_1, { memberIds: [USER_ALEX, USER_SAM] }],
        [COUPLE_2, { memberIds: [OUTSIDER_CHARLIE] }],
      ]),
      files: new Map([
        [sampleMemory.media!.storagePath, { size: 2048000, contentType: "image/jpeg", creatorUid: USER_ALEX }],
      ]),
    };

    firestoreEngine = new FirestoreMemoriesRuleEngine(firestoreState);
    storageEngine = new StorageMemoriesRuleEngine(storageState);
  });

  // 1. Correct Member Test Suite
  describe("1. Correct Member Access & Operations", () => {
    it("allows verified couple members (both creator and partner) to read memories", () => {
      const readAlex = firestoreEngine.evaluateRead(COUPLE_1, sampleMemory.id, { uid: USER_ALEX });
      expect(readAlex.allowed).toBe(true);

      const readSam = firestoreEngine.evaluateRead(COUPLE_1, sampleMemory.id, { uid: USER_SAM });
      expect(readSam.allowed).toBe(true);
    });

    it("allows creator to record memory with matching ID, coupleId, and author UID", () => {
      const newMemId = "mem_new_002";
      const newMemoryData = {
        id: newMemId,
        coupleId: COUPLE_1,
        type: "milestone",
        title: "One Year Anniversary",
        date: "2026-10-01",
        dateLabel: "Oct 1, 2026",
        context: "Celebrating one year together.",
        createdBy: USER_SAM,
        createdAt: "2026-10-01T10:00:00.000Z",
      };

      const result = firestoreEngine.evaluateCreate(COUPLE_1, newMemId, newMemoryData, { uid: USER_SAM });
      expect(result.allowed).toBe(true);
    });

    it("allows member to upload media to their own ownership-aware storage path", () => {
      const uploadPath = `couples/${COUPLE_1}/memories/${USER_ALEX}/anniversary.webp`;
      const result = storageEngine.evaluateCreate(
        uploadPath,
        { size: 3500000, contentType: "image/webp" },
        { uid: USER_ALEX }
      );
      expect(result.allowed).toBe(true);
    });

    it("allows partner to update controlled fields (e.g. adding emoji reaction)", () => {
      const updatedData = {
        ...sampleMemory,
        reactions: { [USER_SAM]: "🔥", [USER_ALEX]: "💖" },
        updatedAt: "2026-09-21T10:00:00.000Z",
      };

      const result = firestoreEngine.evaluateUpdate(COUPLE_1, sampleMemory.id, updatedData, { uid: USER_SAM });
      expect(result.allowed).toBe(true);
    });

    it("allows creator to update controlled fields (caption, note, visibility)", () => {
      const updatedData = {
        ...sampleMemory,
        caption: "Updated caption: unforgettable afternoon under rain.",
        note: "Adding a private reflection.",
        visibility: "private",
        updatedAt: "2026-09-21T10:05:00.000Z",
      };

      const result = firestoreEngine.evaluateUpdate(COUPLE_1, sampleMemory.id, updatedData, { uid: USER_ALEX });
      expect(result.allowed).toBe(true);
    });

    it("allows creator to delete their own memory and media asset", () => {
      const deleteMemResult = firestoreEngine.evaluateDelete(COUPLE_1, sampleMemory.id, { uid: USER_ALEX });
      expect(deleteMemResult.allowed).toBe(true);

      const deleteStorageResult = storageEngine.evaluateDelete(sampleMemory.media!.storagePath, { uid: USER_ALEX });
      expect(deleteStorageResult.allowed).toBe(true);
    });
  });

  // 2. Wrong Couple Test Suite
  describe("2. Wrong Couple Boundary Defense", () => {
    it("strictly prohibits non-couple member from reading memories", () => {
      const readResult = firestoreEngine.evaluateRead(COUPLE_1, sampleMemory.id, { uid: OUTSIDER_CHARLIE });
      expect(readResult.allowed).toBe(false);
      expect(readResult.reason).toContain("Only verified couple members");
    });

    it("strictly prohibits non-couple member from creating memories in another couple sanctuary", () => {
      const createResult = firestoreEngine.evaluateCreate(
        COUPLE_1,
        "mem_trespass_01",
        {
          id: "mem_trespass_01",
          coupleId: COUPLE_1,
          type: "note",
          title: "Intruder Note",
          date: "2026-09-21",
          createdBy: OUTSIDER_CHARLIE,
          createdAt: new Date().toISOString(),
        },
        { uid: OUTSIDER_CHARLIE }
      );
      expect(createResult.allowed).toBe(false);
      expect(createResult.reason).toContain("Only couple members");
    });

    it("strictly blocks non-couple member from accessing another couple's storage media", () => {
      const readResult = storageEngine.evaluateRead(sampleMemory.media!.storagePath, { uid: OUTSIDER_CHARLIE });
      expect(readResult.allowed).toBe(false);
      expect(readResult.reason).toContain("Not authorized");
    });

    it("strictly blocks non-couple member from uploading into another couple's storage", () => {
      const uploadPath = `couples/${COUPLE_1}/memories/${OUTSIDER_CHARLIE}/hack.png`;
      const createResult = storageEngine.evaluateCreate(
        uploadPath,
        { size: 1024, contentType: "image/png" },
        { uid: OUTSIDER_CHARLIE }
      );
      expect(createResult.allowed).toBe(false);
      expect(createResult.reason).toContain("Not a member");
    });
  });

  // 3. Ownership Mutation Test Suite
  describe("3. Ownership & Immutability Mutation Defense", () => {
    it("prohibits mutating the 'createdBy' creator field during an update", () => {
      const maliciousUpdate = {
        ...sampleMemory,
        createdBy: USER_SAM, // Attempting to transfer ownership
      };

      const result = firestoreEngine.evaluateUpdate(COUPLE_1, sampleMemory.id, maliciousUpdate, { uid: USER_ALEX });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("creator ownership cannot be mutated");
    });

    it("prohibits mutating the 'coupleId' to detach memory to another couple", () => {
      const maliciousUpdate = {
        ...sampleMemory,
        coupleId: COUPLE_2,
      };

      const result = firestoreEngine.evaluateUpdate(COUPLE_1, sampleMemory.id, maliciousUpdate, { uid: USER_ALEX });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("couple ID cannot be modified");
    });

    it("prohibits mutating the memory 'id'", () => {
      const maliciousUpdate = {
        ...sampleMemory,
        id: "mem_forged_id_999",
      };

      const result = firestoreEngine.evaluateUpdate(COUPLE_1, sampleMemory.id, maliciousUpdate, { uid: USER_ALEX });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("memory ID cannot be modified");
    });

    it("prohibits timestamp forgery by mutating 'createdAt'", () => {
      const forgedTimestampUpdate = {
        ...sampleMemory,
        createdAt: "2020-01-01T00:00:00.000Z", // Falsifying origin date
      };

      const result = firestoreEngine.evaluateUpdate(COUPLE_1, sampleMemory.id, forgedTimestampUpdate, { uid: USER_ALEX });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("creation timestamp cannot be forged or mutated");
    });

    it("prohibits replacing or hijacking the original media storage reference", () => {
      const hijackedStorageUpdate = {
        ...sampleMemory,
        media: {
          storagePath: `couples/${COUPLE_1}/memories/${USER_ALEX}/hijacked_payload.jpg`,
          fileName: "hijacked_payload.jpg",
          contentType: "image/jpeg",
        },
      };

      const result = firestoreEngine.evaluateUpdate(COUPLE_1, sampleMemory.id, hijackedStorageUpdate, { uid: USER_ALEX });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("original media storage reference cannot be replaced");
    });
  });

  // 4. Path Traversal / Incorrect Path Test Suite
  describe("4. Path Traversal & Incorrect Path Protection", () => {
    it("rejects storage filenames containing path traversal sequences ('..')", () => {
      const traversalPath = `couples/${COUPLE_1}/memories/${USER_ALEX}/../../../etc/passwd`;
      const result = storageEngine.evaluateCreate(
        traversalPath,
        { size: 1024, contentType: "image/jpeg" },
        { uid: USER_ALEX }
      );
      expect(result.allowed).toBe(false);
    });

    it("rejects memory creation when media storagePath attempts path traversal", () => {
      const maliciousData = {
        id: "mem_traversal_test",
        coupleId: COUPLE_1,
        type: "photo",
        title: "Exploit Attempt",
        date: "2026-09-21",
        createdBy: USER_ALEX,
        createdAt: new Date().toISOString(),
        media: {
          storagePath: `couples/${COUPLE_1}/memories/../avatars/secret.jpg`,
          fileName: "secret.jpg",
        },
      };

      const result = firestoreEngine.evaluateCreate(COUPLE_1, "mem_traversal_test", maliciousData, { uid: USER_ALEX });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("path traversal");
    });

    it("rejects uploads trying to spoof another member's ownership folder", () => {
      // Alex attempts to upload into Sam's folder
      const spoofPath = `couples/${COUPLE_1}/memories/${USER_SAM}/alex_spoof.jpg`;
      const result = storageEngine.evaluateCreate(
        spoofPath,
        { size: 2048, contentType: "image/jpeg" },
        { uid: USER_ALEX }
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Cannot upload into another user's media folder");
    });
  });

  // 5. Overwrite Attempt Test Suite
  describe("5. Overwrite Attempt Protection", () => {
    it("strictly blocks storage file updates (allow update: if false) to prevent overwriting assets", () => {
      const result = storageEngine.evaluateUpdate(sampleMemory.media!.storagePath, { uid: USER_ALEX });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("OVERWRITE_FORBIDDEN");
    });

    it("strictly blocks partner from overwriting or replacing creator's original storage asset", () => {
      const result = storageEngine.evaluateUpdate(sampleMemory.media!.storagePath, { uid: USER_SAM });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("OVERWRITE_FORBIDDEN");
    });
  });

  // 6. Unauthorized Read Test Suite
  describe("6. Unauthorized Read Protection", () => {
    it("strictly blocks unauthenticated requests from reading memories", () => {
      const result = firestoreEngine.evaluateRead(COUPLE_1, sampleMemory.id, { uid: null });
      expect(result.allowed).toBe(false);
    });

    it("strictly blocks unauthenticated requests from reading storage media", () => {
      const result = storageEngine.evaluateRead(sampleMemory.media!.storagePath, { uid: null });
      expect(result.allowed).toBe(false);
    });

    it("strictly blocks third-party user from reading private memories", () => {
      const result = firestoreEngine.evaluateRead(COUPLE_1, sampleMemory.id, { uid: OUTSIDER_CHARLIE });
      expect(result.allowed).toBe(false);
    });
  });

  // 7. Unauthorized Delete Test Suite
  describe("7. Unauthorized Delete Protection", () => {
    it("strictly prevents partner from deleting creator's memory artifact in Firestore", () => {
      // Sam tries to delete Alex's memory
      const result = firestoreEngine.evaluateDelete(COUPLE_1, sampleMemory.id, { uid: USER_SAM });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("UNAUTHORIZED_DELETE: Only the creator who authored this memory can delete it.");
    });

    it("strictly prevents partner from deleting creator's media file in Storage", () => {
      // Sam tries to delete Alex's file in Alex's ownership path
      const result = storageEngine.evaluateDelete(sampleMemory.media!.storagePath, { uid: USER_SAM });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("UNAUTHORIZED_DELETE: Only the creator who uploaded this media can delete it.");
    });

    it("strictly prevents outsider from deleting memories or storage media", () => {
      const deleteMemResult = firestoreEngine.evaluateDelete(COUPLE_1, sampleMemory.id, { uid: OUTSIDER_CHARLIE });
      expect(deleteMemResult.allowed).toBe(false);

      const deleteStorageResult = storageEngine.evaluateDelete(sampleMemory.media!.storagePath, { uid: OUTSIDER_CHARLIE });
      expect(deleteStorageResult.allowed).toBe(false);
    });
  });

  // 8. Rules File Text Conformance Verification
  describe("8. Security Rules File Conformance Audit", () => {
    it("confirms firestore.rules enforces memories immutability and controlled updates", () => {
      const firestoreRulesPath = path.resolve(process.cwd(), "firestore.rules");
      const rules = fs.readFileSync(firestoreRulesPath, "utf-8");

      expect(rules).toContain("match /couples/{coupleId}/memories/{memoryId}");
      expect(rules).toContain("request.resource.data.id == memoryId");
      expect(rules).toContain("request.resource.data.createdBy == request.auth.uid");
      expect(rules).toContain("request.resource.data.id == resource.data.id");
      expect(rules).toContain("request.resource.data.coupleId == resource.data.coupleId");
      expect(rules).toContain("request.resource.data.createdBy == resource.data.createdBy");
      expect(rules).toContain("request.resource.data.createdAt == resource.data.createdAt");
      expect(rules).toContain("resource.data.createdBy == request.auth.uid");
      expect(rules).toContain("affectedKeys()");
      expect(rules).toContain("hasOnly");
    });

    it("confirms storage.rules enforces ownership-aware paths and prohibits updates/overwrites", () => {
      const storageRulesPath = path.resolve(process.cwd(), "storage.rules");
      const rules = fs.readFileSync(storageRulesPath, "utf-8");

      expect(rules).toContain("match /couples/{coupleId}/memories/{creatorUid}/{fileName}");
      expect(rules).toContain("request.auth.uid == creatorUid");
      expect(rules).toContain("allow update: if false;");
      expect(rules).toContain("image/(jpeg|png|webp)");
      expect(rules).toContain("fileName.matches('.*\\\\.\\\\..*')");
    });
  });
});
