import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getMemoriesRoute, POST as postMemoryRoute } from "@/app/api/couples/[coupleId]/memories/route";
import { DELETE as deleteMemoryRoute } from "@/app/api/couples/[coupleId]/memories/[memoryId]/route";
import { memoryService } from "@/lib/firebase/services/memories";
import * as firestoreModule from "firebase/firestore";

// Simulated server Firestore state
let mockFirestoreBehavior: "success_with_data" | "empty" | "error" = "success_with_data";
let mockFirestoreWriteBehavior: "success" | "error" = "success";
let mockFirestoreDeleteBehavior: "success" | "error" = "success";

const sampleStoredMemory = {
  id: "mem_real_101",
  coupleId: "cpl_regression_test",
  title: "Rainy Afternoon in Kyoto",
  date: "2026-09-18",
  dateLabel: "Sep 18, 2026",
  context: "Sipping matcha under the wooden canopy",
  type: "photo",
  createdBy: "usr_alice",
  authorName: "Alice",
  createdAt: "2026-09-18T14:30:00.000Z",
  updatedAt: "2026-09-18T14:30:00.000Z",
};

// Mock Server Admin SDK
vi.mock("@/lib/firebase/server/admin", () => {
  return {
    getAdminAuth: vi.fn(() => ({
      verifyIdToken: vi.fn(async (token: string) => {
        if (token === "token_alice") {
          return {
            uid: "usr_alice",
            sub: "usr_alice",
            email: "alice@example.com",
            email_verified: true,
          };
        }
        if (token === "token_outsider") {
          return {
            uid: "usr_outsider",
            sub: "usr_outsider",
            email: "outsider@example.com",
            email_verified: true,
          };
        }
        throw new Error("Invalid token");
      }),
    })),
    getAdminFirestore: vi.fn(() => ({
      collection: vi.fn((colName: string) => ({
        doc: vi.fn((docId: string) => {
          if (colName === "couples" && docId === "cpl_regression_test") {
            return {
              get: vi.fn(async () => ({
                exists: true,
                data: () => ({
                  coupleId: "cpl_regression_test",
                  name: "Alice & Partner",
                  memberIds: ["usr_alice", "usr_bob"],
                }),
              })),
              collection: vi.fn((subCol: string) => {
                if (subCol === "memories") {
                  return {
                    doc: vi.fn((subDocId: string) => ({
                      get: vi.fn(async () => {
                        if (mockFirestoreBehavior === "error") {
                          throw new Error("Firestore connection lost: unavailable");
                        }
                        return {
                          exists: true,
                          data: () => ({ ...sampleStoredMemory, id: subDocId }),
                        };
                      }),
                      set: vi.fn(async () => {
                        if (mockFirestoreWriteBehavior === "error") {
                          throw new Error("DEADLINE_EXCEEDED: Firestore unavailable");
                        }
                      }),
                      delete: vi.fn(async () => {
                        if (mockFirestoreDeleteBehavior === "error") {
                          throw new Error("UNAVAILABLE: Backend database service unreachable");
                        }
                      }),
                    })),
                    orderBy: vi.fn(() => ({
                      get: vi.fn(async () => {
                        if (mockFirestoreBehavior === "error") {
                          throw new Error("Firestore read timeout: backend unavailable");
                        }
                        if (mockFirestoreBehavior === "empty") {
                          return {
                            empty: true,
                            forEach: () => {},
                            docs: [],
                          };
                        }
                        return {
                          empty: false,
                          forEach: (fn: (doc: any) => void) => {
                            fn({
                              id: sampleStoredMemory.id,
                              data: () => sampleStoredMemory,
                            });
                          },
                          docs: [sampleStoredMemory],
                        };
                      }),
                    })),
                  };
                }
                return {};
              }),
            };
          }
          return {
            get: vi.fn(async () => ({ exists: false, data: () => null })),
          };
        }),
      })),
    })),
  };
});

// Mock client firebase dependencies
vi.mock("@/lib/firebase/client", () => ({
  db: {},
  storage: {},
  auth: { currentUser: { uid: "usr_alice", email: "alice@example.com" } },
}));

// Mock firestore client methods
vi.mock("firebase/firestore", () => {
  return {
    collection: vi.fn((_db, ...paths) => paths.join("/")),
    doc: vi.fn((_db, ...paths) => paths.join("/")),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn((collRef) => collRef),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
  };
});

// Mock storage client methods
vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage, path) => ({ fullPath: path })),
  uploadBytes: vi.fn().mockResolvedValue({}),
  getBlob: vi.fn().mockResolvedValue(new Blob(["test-bytes"], { type: "image/jpeg" })),
  deleteObject: vi.fn().mockResolvedValue({}),
}));

describe("MEMORY PERSISTENCE ERROR-HANDLING REGRESSION SUITE", () => {
  const coupleId = "cpl_regression_test";

  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestoreBehavior = "success_with_data";
    mockFirestoreWriteBehavior = "success";
    mockFirestoreDeleteBehavior = "success";
  });

  describe("API Invariant: Persistence Failure vs Legitimate Empty vs Normal Read", () => {
    it("1. Case: Successful Firestore read -> normal memory response (200 with memories)", async () => {
      mockFirestoreBehavior = "success_with_data";

      const req = new NextRequest(`http://localhost:3000/api/couples/${coupleId}/memories`, {
        headers: { authorization: "Bearer token_alice" },
      });

      const res = await getMemoriesRoute(req, {
        params: Promise.resolve({ coupleId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.memories).toBeDefined();
      expect(Array.isArray(data.memories)).toBe(true);
      expect(data.memories.length).toBe(1);
      expect(data.memories[0].id).toBe("mem_real_101");
      expect(data.memories[0].title).toBe("Rainy Afternoon in Kyoto");
    });

    it("2. Case: Legitimate empty collection -> empty memory response (200 with empty array, NOT masked as defaults)", async () => {
      mockFirestoreBehavior = "empty";

      const req = new NextRequest(`http://localhost:3000/api/couples/${coupleId}/memories`, {
        headers: { authorization: "Bearer token_alice" },
      });

      const res = await getMemoriesRoute(req, {
        params: Promise.resolve({ coupleId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.memories).toBeDefined();
      expect(Array.isArray(data.memories)).toBe(true);
      // MUST be legitimate empty array:
      expect(data.memories.length).toBe(0);
      expect(data.error).toBeUndefined();
    });

    it("3. Case: Firestore unavailable/error -> explicit 5xx response (500, NOT masked as empty or default memories)", async () => {
      mockFirestoreBehavior = "error";

      const req = new NextRequest(`http://localhost:3000/api/couples/${coupleId}/memories`, {
        headers: { authorization: "Bearer token_alice" },
      });

      const res = await getMemoriesRoute(req, {
        params: Promise.resolve({ coupleId }),
      });

      // DATABASE FAILURE must NOT become 'USER HAS NO MEMORIES' or return HTTP 200
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
      expect(data.error).toContain("Failed to retrieve memories");
      expect(data.memories).toBeUndefined();
    });

    it("4. Distinguishability Proof: Database failure (500) is strictly distinct from legitimate empty collection (200, [])", async () => {
      // 4a. Run empty collection query
      mockFirestoreBehavior = "empty";
      const emptyReq = new NextRequest(`http://localhost:3000/api/couples/${coupleId}/memories`, {
        headers: { authorization: "Bearer token_alice" },
      });
      const emptyRes = await getMemoriesRoute(emptyReq, {
        params: Promise.resolve({ coupleId }),
      });
      const emptyData = await emptyRes.json();

      // 4b. Run database failure query
      mockFirestoreBehavior = "error";
      const errorReq = new NextRequest(`http://localhost:3000/api/couples/${coupleId}/memories`, {
        headers: { authorization: "Bearer token_alice" },
      });
      const errorRes = await getMemoriesRoute(errorReq, {
        params: Promise.resolve({ coupleId }),
      });
      const errorData = await errorRes.json();

      // STRICT PROOF:
      // Status codes are distinct
      expect(emptyRes.status).toBe(200);
      expect(errorRes.status).toBe(500);
      expect(emptyRes.status).not.toBe(errorRes.status);

      // Payload shapes are distinct
      expect(emptyData.memories).toEqual([]);
      expect(errorData.memories).toBeUndefined();
      expect(emptyData.error).toBeUndefined();
      expect(errorData.error).toBeDefined();
    });
  });

  describe("API Invariant: POST & DELETE Memory Persistence Error Handling", () => {
    it("POST /api/couples/[coupleId]/memories: returns 500 when Firestore write fails, does NOT silently swallow", async () => {
      mockFirestoreWriteBehavior = "error";

      const req = new NextRequest(`http://localhost:3000/api/couples/${coupleId}/memories`, {
        method: "POST",
        headers: {
          authorization: "Bearer token_alice",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          authorUid: "usr_alice",
          authorName: "Alice",
          payload: {
            title: "Failed Memory Write",
            context: "Testing Firestore write failure",
            type: "note",
          },
        }),
      });

      const res = await postMemoryRoute(req, {
        params: Promise.resolve({ coupleId }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain("Failed to create memory");
    });

    it("DELETE /api/couples/[coupleId]/memories/[memoryId]: returns 500 when Firestore delete fails, does NOT silently swallow", async () => {
      mockFirestoreDeleteBehavior = "error";

      const req = new NextRequest(`http://localhost:3000/api/couples/${coupleId}/memories/mem_real_101`, {
        method: "DELETE",
        headers: { authorization: "Bearer token_alice" },
      });

      const res = await deleteMemoryRoute(req, {
        params: Promise.resolve({ coupleId, memoryId: "mem_real_101" }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  describe("Client MemoryService: Strict Persistence Error Propagation", () => {
    it("getMemories: returns parsed memories on successful read", async () => {
      const mockDoc = {
        id: "mem_doc_1",
        data: () => ({
          title: "Tokyo Ramen",
          date: "2026-09-10",
          context: "Late night meal together",
          type: "note",
          createdBy: "usr_alice",
          authorName: "Alice",
        }),
      };

      vi.mocked(firestoreModule.getDocs).mockResolvedValueOnce({
        empty: false,
        forEach: (fn: (d: any) => void) => fn(mockDoc),
      } as any);

      const result = await memoryService.getMemories(coupleId);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("mem_doc_1");
      expect(result[0].title).toBe("Tokyo Ramen");
    });

    it("getMemories: returns empty array [] on legitimate empty collection", async () => {
      vi.mocked(firestoreModule.getDocs).mockResolvedValueOnce({
        empty: true,
        forEach: () => {},
      } as any);

      const result = await memoryService.getMemories(coupleId);
      // Legitimate empty collection MUST return [] (not fallback default memories)
      expect(result).toEqual([]);
    });

    it("getMemories: throws on Firestore failure, NEVER returns empty array or fake default memories", async () => {
      vi.mocked(firestoreModule.getDocs).mockRejectedValueOnce(
        new Error("Firestore service unavailable: connection reset")
      );

      // DATABASE FAILURE must NOT return [] or default memories
      await expect(memoryService.getMemories(coupleId)).rejects.toThrow("Firestore service unavailable");
    });

    it("createMemory: throws on Firestore setDoc failure, NEVER swallows error or pretends success", async () => {
      vi.mocked(firestoreModule.setDoc).mockRejectedValueOnce(
        new Error("PERMISSION_DENIED: caller lacks write permission")
      );

      await expect(
        memoryService.createMemory(coupleId, "usr_alice", "Alice", {
          title: "Failed Memory",
          context: "Should fail",
          type: "note",
          date: "2026-09-23",
        })
      ).rejects.toThrow("PERMISSION_DENIED");
    });

    it("updateMemory: throws on Firestore updateDoc failure", async () => {
      vi.mocked(firestoreModule.updateDoc).mockRejectedValueOnce(
        new Error("RESOURCE_EXHAUSTED: quota exceeded")
      );

      await expect(
        memoryService.updateMemory(coupleId, "mem_1", "usr_alice", {
          title: "New Title",
        })
      ).rejects.toThrow("RESOURCE_EXHAUSTED");
    });

    it("deleteMemory: throws on Firestore deleteDoc failure", async () => {
      vi.mocked(firestoreModule.deleteDoc).mockRejectedValueOnce(
        new Error("DEADLINE_EXCEEDED: operation timed out")
      );

      await expect(
        memoryService.deleteMemory(coupleId, "mem_1", undefined, "usr_alice", "usr_alice")
      ).rejects.toThrow("DEADLINE_EXCEEDED");
    });

    it("subscribeToMemories: emits [] for legitimate empty collection", () => {
      let emittedMemories: any = null;

      vi.mocked(firestoreModule.onSnapshot).mockImplementationOnce((_q: any, onNext: any) => {
        onNext({
          empty: true,
          forEach: () => {},
        });
        return () => {};
      });

      memoryService.subscribeToMemories(coupleId, (memories) => {
        emittedMemories = memories;
      });

      expect(emittedMemories).toEqual([]);
    });

    it("subscribeToMemories: forwards error to onError callback, never emits fake fallback memories to onUpdate", () => {
      let updateCalled = false;
      let errorReceived: Error | null = null;

      vi.mocked(firestoreModule.onSnapshot).mockImplementationOnce((_q: any, _onNext: any, onError: any) => {
        onError(new Error("Subscription channel broken"));
        return () => {};
      });

      memoryService.subscribeToMemories(
        coupleId,
        (_memories) => {
          updateCalled = true;
        },
        (err) => {
          errorReceived = err;
        }
      );

      expect(updateCalled).toBe(false);
      expect(errorReceived).not.toBeNull();
      expect((errorReceived as Error | null)?.message).toBe("Subscription channel broken");
    });
  });
});
