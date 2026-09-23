import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getBlob,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../client";
import { handleFirestoreError, OperationType } from "../errors";
import type { CoupleMemory, CreateMemoryPayload, UpdateMemoryPayload } from "@/lib/memories/types";

export class MemoryService {
  /**
   * In-memory cache of resolved blob URLs to prevent redundant network downloads
   * and avoid creating thousands of uncollected object URLs.
   */
  private blobUrlCache = new Map<string, string>();

  /**
   * Subscribes in realtime to memories under couples/{coupleId}/memories/{memoryId}
   * Returns an unsubscribe function.
   */
  subscribeToMemories(
    coupleId: string,
    onUpdate: (memories: CoupleMemory[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    if (!coupleId) {
      onUpdate([]);
      return () => {};
    }

    try {
      const memoriesCollRef = collection(db, "couples", coupleId, "memories");
      const q = query(memoriesCollRef, orderBy("date", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            onUpdate([]);
            return;
          }

          const memories: CoupleMemory[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Omit<CoupleMemory, "id">;
            memories.push({
              id: docSnap.id,
              ...data,
            });
          });

          onUpdate(memories);
        },
        (error) => {
          console.error("Realtime memories subscription error:", error.message);
          if (onError) onError(error);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.error("Failed to attach memories listener:", err);
      if (onError && err instanceof Error) onError(err);
      return () => {};
    }
  }

  /**
   * One-time fetch of all memories for a couple.
   */
  async getMemories(coupleId: string): Promise<CoupleMemory[]> {
    if (!coupleId) return [];

    try {
      const memoriesCollRef = collection(db, "couples", coupleId, "memories");
      const q = query(memoriesCollRef, orderBy("date", "desc"));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return [];
      }

      const memories: CoupleMemory[] = [];
      snapshot.forEach((docSnap) => {
        memories.push({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CoupleMemory, "id">),
        });
      });

      return memories;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `couples/${coupleId}/memories`);
    }
  }

  /**
   * Creates a new memory record in Firestore:
   * couples/{coupleId}/memories/{memoryId}
   * If a media file is attached, uploads to:
   * couples/{coupleId}/memories/{fileName}
   *
   * STRICT SECURITY MANDATE:
   * Never calls getDownloadURL(). Media is strictly accessed via
   * authenticated Cloud Storage calls or ephemeral in-memory Blob URLs.
   */
  async createMemory(
    coupleId: string,
    authorUid: string,
    authorName: string,
    payload: CreateMemoryPayload,
    mediaFile?: File | Blob
  ): Promise<CoupleMemory> {
    const memoryId = `mem_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    let mediaData: CoupleMemory["media"] | undefined = undefined;

    if (mediaFile) {
      const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];
      const contentType = mediaFile.type || "image/jpeg";
      if (!ALLOWED_MIMES.includes(contentType)) {
        throw new Error("Invalid file type: only JPEG, PNG, and WebP images are allowed.");
      }
      const MAX_SIZE = 15 * 1024 * 1024;
      if (mediaFile.size > MAX_SIZE) {
        throw new Error("File exceeds maximum allowed size of 15MB.");
      }

      const originalName = mediaFile instanceof File ? mediaFile.name : "photo.jpg";
      const ext = originalName.split(".").pop() || "jpg";
      const sanitizedExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4) || "jpg";
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${sanitizedExt}`;
      // Ownership-aware storage path: couples/{coupleId}/memories/{authorUid}/{fileName}
      const storagePath = `couples/${coupleId}/memories/${authorUid}/${fileName}`;

      try {
        const storageReference = ref(storage, storagePath);
        await uploadBytes(storageReference, mediaFile, {
          contentType,
          customMetadata: {
            coupleId,
            authorUid,
            memoryId,
          },
        });
      } catch (storageErr) {
        console.warn("Cloud storage upload bypassed or failed, caching locally:", storageErr);
      }

      // Generate in-memory ephemeral URL for this session (never public download URL)
      let ephemeralUrl: string | undefined = undefined;
      if (typeof window !== "undefined" && typeof URL !== "undefined") {
        try {
          ephemeralUrl = URL.createObjectURL(mediaFile);
          this.blobUrlCache.set(storagePath, ephemeralUrl);
        } catch {
          // ignore
        }
      }

      mediaData = {
        storagePath,
        fileName,
        contentType,
        fileSize: mediaFile.size,
        caption: payload.caption ? payload.caption.trim() : undefined,
        ephemeralUrl,
      };
    }

    const memoryItem: CoupleMemory = {
      id: memoryId,
      coupleId,
      type: payload.type,
      title: payload.title.trim(),
      date: payload.date || now,
      dateLabel: payload.dateLabel || this.formatDateLabel(payload.date || now),
      context: payload.context.trim(),
      note: payload.note ? payload.note.trim() : undefined,
      caption: payload.caption ? payload.caption.trim() : undefined,
      reactions: payload.reactions || {},
      visibility: payload.visibility || "couple",
      gameActivity: payload.gameActivity,
      media: mediaData,
      milestoneData: payload.milestoneData,
      relationshipDateData: payload.relationshipDateData,
      createdBy: authorUid,
      authorName: authorName || "Partner",
      createdAt: now,
      updatedAt: now,
    };

    try {
      const memoryRef = doc(db, "couples", coupleId, "memories", memoryId);
      await setDoc(memoryRef, memoryItem);
    } catch (firestoreErr) {
      handleFirestoreError(firestoreErr, OperationType.CREATE, `couples/${coupleId}/memories/${memoryId}`);
    }

    return memoryItem;
  }

  /**
   * Updates controlled metadata on a memory:
   * caption, reactions, visibility, note, title, context.
   * Enforces immutability: memoryId, coupleId, createdBy, createdAt,
   * and original media storage reference cannot be altered.
   */
  async updateMemory(
    coupleId: string,
    memoryId: string,
    authorUid: string,
    updates: UpdateMemoryPayload
  ): Promise<void> {
    const memoryRef = doc(db, "couples", coupleId, "memories", memoryId);

    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.caption !== undefined) updatePayload.caption = updates.caption;
    if (updates.reactions !== undefined) updatePayload.reactions = updates.reactions;
    if (updates.reaction !== undefined) {
      updatePayload[`reactions.${authorUid}`] = updates.reaction;
    }
    if (updates.visibility !== undefined) updatePayload.visibility = updates.visibility;
    if (updates.note !== undefined) updatePayload.note = updates.note;
    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.context !== undefined) updatePayload.context = updates.context;
    if (updates.dateLabel !== undefined) updatePayload.dateLabel = updates.dateLabel;

    try {
      await updateDoc(memoryRef, updatePayload);
    } catch (firestoreErr) {
      handleFirestoreError(firestoreErr, OperationType.UPDATE, `couples/${coupleId}/memories/${memoryId}`);
    }
  }

  /**
   * Deletes a memory document and associated storage file.
   * Enforces that only the author who recorded the memory can delete it.
   */
  async deleteMemory(
    coupleId: string,
    memoryId: string,
    storagePath?: string,
    creatorUid?: string,
    currentUid?: string
  ): Promise<void> {
    // 1. Client-side ownership enforcement
    if (creatorUid && currentUid && creatorUid !== currentUid) {
      throw new Error("Unauthorized delete: only the creator can delete this memory.");
    }

    // 2. Delete media asset from Storage if exists
    if (storagePath) {
      try {
        const storageReference = ref(storage, storagePath);
        await deleteObject(storageReference);
      } catch (err) {
        console.warn("Could not delete storage object:", err);
      }

      // Clean up cached blob URL
      const cachedUrl = this.blobUrlCache.get(storagePath);
      if (cachedUrl && typeof URL !== "undefined") {
        try {
          URL.revokeObjectURL(cachedUrl);
        } catch {
          // ignore
        }
        this.blobUrlCache.delete(storagePath);
      }
    }

    // 3. Delete Firestore document
    try {
      const memoryRef = doc(db, "couples", coupleId, "memories", memoryId);
      await deleteDoc(memoryRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `couples/${coupleId}/memories/${memoryId}`);
    }
  }

  /**
   * Resolves private Cloud Storage media without creating public media URLs.
   * Downloads blob securely using authenticated Firebase Storage SDK
   * and returns an in-memory session Blob URL.
   */
  async loadEphemeralMediaUrl(storagePath: string): Promise<string | null> {
    if (!storagePath) return null;

    // Check cache
    if (this.blobUrlCache.has(storagePath)) {
      return this.blobUrlCache.get(storagePath)!;
    }

    try {
      const storageReference = ref(storage, storagePath);
      const blob = await getBlob(storageReference);
      const objectUrl = URL.createObjectURL(blob);
      this.blobUrlCache.set(storagePath, objectUrl);
      return objectUrl;
    } catch (err) {
      console.warn("Authenticated storage blob fetch error:", err);
      return null;
    }
  }

  private formatDateLabel(isoString: string): string {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "Recently";
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch {
      return "Recently";
    }
  }
}

export const memoryService = new MemoryService();
