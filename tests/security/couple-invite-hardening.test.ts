import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as acceptInviteRoute } from "@/app/api/couples/accept-invite/route";
import { sha256 } from "@/lib/utils/crypto";

// In-memory transactional database for tests
interface DatabaseState {
  coupleInvites: Map<string, any>;
  couples: Map<string, any>;
  users: Map<string, any>;
}

let dbState: DatabaseState;

// Simple transaction queue to simulate atomic isolation and serializable concurrency
let isTransactionRunning = false;

const mockAdminFirestore = {
  runTransaction: vi.fn(async (updateFunction: (transaction: any) => Promise<any>) => {
    // Wait for any running transaction to complete (simulating Firestore lock/isolation)
    while (isTransactionRunning) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    isTransactionRunning = true;

    // Staging area for atomic commit/rollback
    const stagedUpdates: Array<() => void> = [];

    const tx = {
      get: vi.fn(async (docRef: { collectionName: string; docId: string }) => {
        const store = (dbState as any)[docRef.collectionName] as Map<string, any>;
        const data = store.get(docRef.docId);
        return {
          exists: !!data,
          data: () => (data ? { ...data } : null),
        };
      }),
      update: vi.fn(async (docRef: { collectionName: string; docId: string }, data: any) => {
        stagedUpdates.push(() => {
          const store = (dbState as any)[docRef.collectionName] as Map<string, any>;
          const current = store.get(docRef.docId) || {};
          store.set(docRef.docId, { ...current, ...data });
        });
      }),
      set: vi.fn(async (docRef: { collectionName: string; docId: string }, data: any, opts?: { merge?: boolean }) => {
        stagedUpdates.push(() => {
          const store = (dbState as any)[docRef.collectionName] as Map<string, any>;
          if (opts?.merge) {
            const current = store.get(docRef.docId) || {};
            store.set(docRef.docId, { ...current, ...data });
          } else {
            store.set(docRef.docId, { ...data });
          }
        });
      }),
      delete: vi.fn(async (docRef: { collectionName: string; docId: string }) => {
        stagedUpdates.push(() => {
          const store = (dbState as any)[docRef.collectionName] as Map<string, any>;
          store.delete(docRef.docId);
        });
      }),
    };

    try {
      const result = await updateFunction(tx);
      // Atomic commit: apply all staged updates only on success
      stagedUpdates.forEach((apply) => apply());
      return result;
    } finally {
      isTransactionRunning = false;
    }
  }),
  collection: vi.fn((collectionName: string) => ({
    doc: vi.fn((docId: string) => ({
      collectionName,
      docId,
    })),
  })),
};

vi.mock("@/lib/firebase/server/admin", () => ({
  getAdminAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(async (token: string) => {
      if (token && token.startsWith("bearer_token_")) {
        const uid = token.replace("bearer_token_", "");
        return {
          uid,
          sub: uid,
          email: `${uid}@sanctuary.test`,
          email_verified: true,
          auth_time: Math.floor(Date.now() / 1000),
        };
      }
      const err = new Error("Invalid or unverified Firebase ID token.");
      (err as any).code = "auth/invalid-id-token";
      throw err;
    }),
  })),
  getAdminFirestore: vi.fn(() => mockAdminFirestore),
  getAdminApp: vi.fn(() => ({})),
  isAdminFirebaseConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: { currentUser: { uid: "client_user" } },
}));

describe("Harden Couple Invitation & Acceptance Flow (Security & Concurrency)", () => {
  const INVITE_ID = "inv_sec_test_1";
  const COUPLE_ID = "cpl_sec_test_1";
  const INVITATION_CODE = "SANCT-8888-9999";
  const OWNER_UID = "user_owner_alice";
  const PARTNER_UID = "user_partner_bob";
  const THIRD_PARTY_UID = "user_intruder_charlie";

  let validTokenHash: string;

  beforeEach(async () => {
    validTokenHash = await sha256(INVITATION_CODE);

    dbState = {
      coupleInvites: new Map([
        [
          INVITE_ID,
          {
            inviteId: INVITE_ID,
            coupleId: COUPLE_ID,
            inviterId: OWNER_UID,
            inviterName: "Alice",
            tokenHash: validTokenHash,
            status: "pending",
            expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours in the future
            createdAt: new Date().toISOString(),
          },
        ],
      ]),
      couples: new Map([
        [
          COUPLE_ID,
          {
            coupleId: COUPLE_ID,
            ownerId: OWNER_UID,
            memberIds: [OWNER_UID],
            status: "active",
            createdAt: new Date().toISOString(),
          },
        ],
      ]),
      users: new Map([
        [OWNER_UID, { uid: OWNER_UID, coupleId: COUPLE_ID }],
        [PARTNER_UID, { uid: PARTNER_UID }], // Not paired
        [THIRD_PARTY_UID, { uid: THIRD_PARTY_UID }], // Not paired
      ]),
    };
  });

  it("1. Normal acceptance: atomically binds partner, accepts invite, and links user profile", async () => {
    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.coupleId).toBe(COUPLE_ID);

    // Verify atomic updates in database
    const updatedInvite = dbState.coupleInvites.get(INVITE_ID);
    expect(updatedInvite.status).toBe("accepted");
    expect(updatedInvite.acceptedBy).toBe(PARTNER_UID);
    expect(updatedInvite.acceptedAt).toBeDefined();

    const updatedCouple = dbState.couples.get(COUPLE_ID);
    expect(updatedCouple.memberIds).toEqual([OWNER_UID, PARTNER_UID]);

    const updatedUser = dbState.users.get(PARTNER_UID);
    expect(updatedUser.coupleId).toBe(COUPLE_ID);
  });

  it("2. Expired invite: rejects with 410 Gone and leaves database completely unmodified", async () => {
    // Set invite to expired
    const invite = dbState.coupleInvites.get(INVITE_ID);
    invite.expiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    dbState.coupleInvites.set(INVITE_ID, invite);

    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(410);

    const json = await res.json();
    expect(json.error).toContain("expired");

    // Verify no state changes occurred
    const checkInvite = dbState.coupleInvites.get(INVITE_ID);
    expect(checkInvite.status).toBe("pending");
    const checkCouple = dbState.couples.get(COUPLE_ID);
    expect(checkCouple.memberIds).toEqual([OWNER_UID]);
    const checkUser = dbState.users.get(PARTNER_UID);
    expect(checkUser.coupleId).toBeUndefined();
  });

  it("3. Reused invite: rejects already accepted or revoked invitations with 409 Conflict", async () => {
    // Mark invite as already accepted
    const invite = dbState.coupleInvites.get(INVITE_ID);
    invite.status = "accepted";
    invite.acceptedBy = "some_other_user";
    dbState.coupleInvites.set(INVITE_ID, invite);

    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.error).toContain("already been accepted or revoked");
  });

  it("4. Simultaneous acceptance: prevents race conditions where two users attempt to accept concurrently", async () => {
    // Simulate Partner Bob and Intruder Charlie both attempting to accept the same single invite concurrently
    const reqBob = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    const reqCharlie = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${THIRD_PARTY_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    // Execute concurrently
    const [resBob, resCharlie] = await Promise.all([
      acceptInviteRoute(reqBob),
      acceptInviteRoute(reqCharlie),
    ]);

    const statuses = [resBob.status, resCharlie.status].sort();

    // Exactly one must succeed (200), and the other must fail with conflict (409)
    expect(statuses).toEqual([200, 409]);

    // Verify couple contains exactly 2 members, never 3
    const finalCouple = dbState.couples.get(COUPLE_ID);
    expect(finalCouple.memberIds.length).toBe(2);
    expect(finalCouple.memberIds[0]).toBe(OWNER_UID);

    // The winning partner is in memberIds; the losing partner was rejected
    const winningUid = finalCouple.memberIds[1];
    expect([PARTNER_UID, THIRD_PARTY_UID]).toContain(winningUid);

    const losingUid = winningUid === PARTNER_UID ? THIRD_PARTY_UID : PARTNER_UID;
    expect(dbState.users.get(winningUid).coupleId).toBe(COUPLE_ID);
    expect(dbState.users.get(losingUid).coupleId).toBeUndefined();
  });

  it("5. Already-paired user: prevents a user who is already in a couple from joining another couple", async () => {
    // Set user as already connected to another couple
    dbState.users.set(PARTNER_UID, {
      uid: PARTNER_UID,
      coupleId: "existing_couple_xyz",
    });

    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.error).toContain("already connected to a couple sanctuary");

    // Verify user was NOT modified
    expect(dbState.users.get(PARTNER_UID).coupleId).toBe("existing_couple_xyz");
    // Verify couple still only has 1 member
    expect(dbState.couples.get(COUPLE_ID).memberIds).toEqual([OWNER_UID]);
  });

  it("6. Self-invite: rejects inviter attempting to accept their own invitation", async () => {
    // Owner Alice attempts to accept her own invite
    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${OWNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("cannot accept your own invitation");
  });

  it("7. Invalid code: rejects incorrect pairing code (cryptographic hash mismatch)", async () => {
    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: "SANCT-WRONG-CODE",
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toContain("Invalid pairing code");

    // Verify no updates occurred
    expect(dbState.coupleInvites.get(INVITE_ID).status).toBe("pending");
  });

  it("8. Forged acceptingUserId: rejects client attempt to supply a different acceptingUserId than auth token", async () => {
    // Attacker authenticated as PARTNER_UID attempts to submit acceptingUserId = THIRD_PARTY_UID
    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
        acceptingUserId: THIRD_PARTY_UID, // Forgery attempt!
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error?.message || json.message || json.error).toContain("Access denied");

    // Verify no database changes
    expect(dbState.coupleInvites.get(INVITE_ID).status).toBe("pending");
    expect(dbState.users.get(THIRD_PARTY_UID).coupleId).toBeUndefined();
  });

  it("9. Omitted acceptingUserId: successfully derives identity solely from auth token", async () => {
    // Legitimate modern client does not send acceptingUserId at all
    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        authorization: `Bearer bearer_token_${PARTNER_UID}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
        // acceptingUserId completely omitted
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    // The verified UID from token is the one recorded
    expect(dbState.coupleInvites.get(INVITE_ID).acceptedBy).toBe(PARTNER_UID);
    expect(dbState.users.get(PARTNER_UID).coupleId).toBe(COUPLE_ID);
  });

  it("10. Unauthenticated request: rejects with 401 when Authorization header is absent", async () => {
    const req = new NextRequest("http://localhost:3000/api/couples/accept-invite", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inviteId: INVITE_ID,
        code: INVITATION_CODE,
      }),
    });

    const res = await acceptInviteRoute(req);
    expect(res.status).toBe(401);
  });
});
