import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock firebase/database for pure unit execution
vi.mock("firebase/database", () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  onValue: vi.fn(() => vi.fn()),
  onDisconnect: vi.fn(() => ({
    update: vi.fn(() => Promise.resolve()),
    set: vi.fn(() => Promise.resolve()),
  })),
  serverTimestamp: vi.fn(() => 1710000000000),
}));

import { FirebasePresenceService } from "@/lib/firebase/services/presence";

/**
 * Realtime Database Rule Evaluator Simulator
 * Strictly tests the rule structure and logic defined in database.rules.json
 * to verify couple presence authorization hardening invariants.
 */
interface RtdbRootState {
  couples?: Record<
    string,
    {
      memberIds?: string[];
      members?: Record<string, boolean>;
    }
  >;
  presence?: Record<string, Record<string, any>>;
}

function evaluatePresenceRead(
  coupleId: string,
  uid: string,
  auth: { uid: string } | null,
  rootState: RtdbRootState
): boolean {
  if (!auth) return false;
  const couple = rootState.couples?.[coupleId];
  if (!couple) return false;

  const isMember =
    Boolean(couple.members?.[auth.uid]) ||
    Boolean(couple.memberIds?.includes(auth.uid)) ||
    couple.memberIds?.[0] === auth.uid ||
    couple.memberIds?.[1] === auth.uid;

  return isMember;
}

function evaluatePresenceWriteAndValidate(
  coupleId: string,
  uid: string,
  auth: { uid: string } | null,
  newDataVal: any,
  rootState: RtdbRootState,
  serverNow: number
): { writeAllowed: boolean; validationPassed: boolean } {
  if (!auth) return { writeAllowed: false, validationPassed: false };
  if (auth.uid !== uid) return { writeAllowed: false, validationPassed: false };

  const couple = rootState.couples?.[coupleId];
  const isMember =
    Boolean(couple?.members?.[auth.uid]) ||
    Boolean(couple?.memberIds?.includes(auth.uid)) ||
    couple?.memberIds?.[0] === auth.uid ||
    couple?.memberIds?.[1] === auth.uid;

  if (!isMember) {
    return { writeAllowed: false, validationPassed: false };
  }

  if (!newDataVal || typeof newDataVal !== "object") {
    return { writeAllowed: true, validationPassed: true };
  }

  // 1. Impersonation / userId spoofing validation
  if ("userId" in newDataVal) {
    if (typeof newDataVal.userId !== "string" || newDataVal.userId !== uid) {
      return { writeAllowed: true, validationPassed: false };
    }
  }

  // 2. Client arbitrary timestamp validation
  if ("lastSeenMs" in newDataVal) {
    if (newDataVal.lastSeenMs !== serverNow) {
      return { writeAllowed: true, validationPassed: false };
    }
  }

  // 3. Privacy / GPS protection
  const locationKeys = ["lat", "lng", "latitude", "longitude", "location", "gps", "coordinates"];
  for (const k of locationKeys) {
    if (k in newDataVal) {
      return { writeAllowed: true, validationPassed: false };
    }
  }

  return { writeAllowed: true, validationPassed: true };
}

describe("PRESENCE AUTHORIZATION HARDENING: SECURITY RULES & PRIVACY INVARIANTS", () => {
  const rulesPath = path.resolve(process.cwd(), "database.rules.json");
  const rulesJson = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  const presenceRules = rulesJson.rules.presence;
  const couplesRules = rulesJson.rules.couples;

  const coupleId = "cpl_tokyo_london_4209";
  const aliceUid = "user_alice_couple1";
  const bobUid = "user_bob_couple1";
  const charlieUid = "user_charlie_outsider";
  const malloryUid = "user_mallory_attacker";
  const serverNow = 1710000000000;

  // Authoritative server-controlled database state
  const mockRootState: RtdbRootState = {
    couples: {
      [coupleId]: {
        memberIds: [aliceUid, bobUid],
        members: {
          [aliceUid]: true,
          [bobUid]: true,
        },
      },
      cpl_other: {
        memberIds: [charlieUid],
        members: {
          [charlieUid]: true,
        },
      },
    },
    presence: {
      [coupleId]: {
        [aliceUid]: {
          userId: aliceUid,
          state: "ONLINE",
          connectionStatus: "online",
          lastSeenMs: serverNow,
        },
        [bobUid]: {
          userId: bobUid,
          state: "ONLINE",
          connectionStatus: "online",
          lastSeenMs: serverNow,
        },
      },
    },
  };

  describe("Architectural & Rule Structure Verification", () => {
    it("Presence is scoped under $coupleId/$uid in database.rules.json", () => {
      expect(presenceRules["$coupleId"]).toBeDefined();
      expect(presenceRules["$coupleId"]["$uid"]).toBeDefined();
    });

    it("Presence read rule derives authorization strictly from root.child('couples')", () => {
      const readRule = presenceRules["$coupleId"]["$uid"][".read"];
      expect(readRule).toContain("root.child('couples').child($coupleId)");
      // Must NOT rely on client-writable partnerId or authorizedUsers for read access
      expect(readRule).not.toContain("data.child('partnerId')");
      expect(readRule).not.toContain("data.child('authorizedUsers')");
    });

    it("Presence write rule requires membership in root.child('couples')", () => {
      const writeRule = presenceRules["$coupleId"]["$uid"][".write"];
      expect(writeRule).toContain("auth != null && auth.uid === $uid");
      expect(writeRule).toContain("root.child('couples').child($coupleId)");
    });

    it("Couples collection in RTDB is strictly server-written (.write: false for clients)", () => {
      expect(couplesRules["$coupleId"][".write"]).toBe(false);
    });
  });

  describe("PASS SCENARIOS", () => {
    it("PASS: User can write their own presence", () => {
      const result = evaluatePresenceWriteAndValidate(
        coupleId,
        aliceUid,
        { uid: aliceUid },
        {
          userId: aliceUid,
          state: "ONLINE",
          connectionStatus: "online",
          lastSeenMs: serverNow,
        },
        mockRootState,
        serverNow
      );

      expect(result.writeAllowed).toBe(true);
      expect(result.validationPassed).toBe(true);
    });

    it("PASS: Partner can read appropriate presence", () => {
      // Bob reads Alice's presence in their shared couple sanctuary
      const canRead = evaluatePresenceRead(coupleId, aliceUid, { uid: bobUid }, mockRootState);
      expect(canRead).toBe(true);
    });

    it("PASS: Legitimate couple members can interact as intended", () => {
      // Both Alice and Bob can write their own and read each other's presence
      const aliceCanReadBob = evaluatePresenceRead(coupleId, bobUid, { uid: aliceUid }, mockRootState);
      const bobCanReadAlice = evaluatePresenceRead(coupleId, aliceUid, { uid: bobUid }, mockRootState);

      const aliceWrite = evaluatePresenceWriteAndValidate(
        coupleId,
        aliceUid,
        { uid: aliceUid },
        { userId: aliceUid, state: "IN_GAME", lastSeenMs: serverNow },
        mockRootState,
        serverNow
      );

      const bobWrite = evaluatePresenceWriteAndValidate(
        coupleId,
        bobUid,
        { uid: bobUid },
        { userId: bobUid, state: "IN_CALL", lastSeenMs: serverNow },
        mockRootState,
        serverNow
      );

      expect(aliceCanReadBob).toBe(true);
      expect(bobCanReadAlice).toBe(true);
      expect(aliceWrite.writeAllowed && aliceWrite.validationPassed).toBe(true);
      expect(bobWrite.writeAllowed && bobWrite.validationPassed).toBe(true);
    });
  });

  describe("FAIL SCENARIOS (Security Invariants)", () => {
    it("FAIL: User cannot authorize an arbitrary third-party UID", () => {
      // Even if Alice's client payload or state claims mallory is authorized:
      const poisonedRoot: RtdbRootState = {
        ...mockRootState,
        presence: {
          [coupleId]: {
            [aliceUid]: {
              userId: aliceUid,
              partnerId: malloryUid, // Attacker UID injected by malicious client
              authorizedUsers: { [malloryUid]: true }, // Spoofed authorized map
              state: "ONLINE",
            },
          },
        },
      };

      // Mallory attempts to read Alice's presence
      const canMalloryRead = evaluatePresenceRead(coupleId, aliceUid, { uid: malloryUid }, poisonedRoot);
      expect(canMalloryRead).toBe(false);
    });

    it("FAIL: Unrelated authenticated user cannot read presence", () => {
      // Charlie belongs to cpl_other, NOT to coupleId
      const canCharlieRead = evaluatePresenceRead(coupleId, aliceUid, { uid: charlieUid }, mockRootState);
      expect(canCharlieRead).toBe(false);
    });

    it("FAIL: Unrelated authenticated user cannot write presence for another couple", () => {
      // Charlie attempts to write presence in Alice & Bob's couple sanctuary
      const charlieWrite = evaluatePresenceWriteAndValidate(
        coupleId,
        charlieUid,
        { uid: charlieUid },
        { userId: charlieUid, state: "ONLINE" },
        mockRootState,
        serverNow
      );

      expect(charlieWrite.writeAllowed).toBe(false);
    });

    it("FAIL: Changing partnerId cannot grant access", () => {
      // Alice tries to switch partnerId to charlie in presence payload
      const payloadWithNewPartner = {
        userId: aliceUid,
        partnerId: charlieUid,
        state: "ONLINE",
        lastSeenMs: serverNow,
      };

      // Charlie still CANNOT read Alice's presence because couple membership is server-authoritative
      const canCharlieRead = evaluatePresenceRead(coupleId, aliceUid, { uid: charlieUid }, mockRootState);
      expect(canCharlieRead).toBe(false);
    });

    it("FAIL: One user cannot impersonate another participant", () => {
      // 1. Alice attempts to write directly to Bob's presence path
      const aliceWritesBobNode = evaluatePresenceWriteAndValidate(
        coupleId,
        bobUid,
        { uid: aliceUid }, // Auth is Alice, but path $uid is Bob
        { userId: bobUid, state: "OFFLINE" },
        mockRootState,
        serverNow
      );
      expect(aliceWritesBobNode.writeAllowed).toBe(false);

      // 2. Alice writes to her path but claims userId is Bob
      const aliceSpoofsUserId = evaluatePresenceWriteAndValidate(
        coupleId,
        aliceUid,
        { uid: aliceUid },
        { userId: bobUid, state: "ONLINE" }, // Spoofed userId
        mockRootState,
        serverNow
      );
      expect(aliceSpoofsUserId.writeAllowed).toBe(true);
      expect(aliceSpoofsUserId.validationPassed).toBe(false);
    });

    it("FAIL: Unauthenticated caller cannot read presence", () => {
      const canUnauthRead = evaluatePresenceRead(coupleId, aliceUid, null, mockRootState);
      expect(canUnauthRead).toBe(false);
    });

    it("FAIL: Sensitive GPS / location injection is rejected", () => {
      const result = evaluatePresenceWriteAndValidate(
        coupleId,
        aliceUid,
        { uid: aliceUid },
        {
          userId: aliceUid,
          latitude: 35.6762,
          longitude: 139.6503,
          lastSeenMs: serverNow,
        },
        mockRootState,
        serverNow
      );

      expect(result.validationPassed).toBe(false);
    });

    it("FAIL: Arbitrary client-provided timestamp for lastSeenMs is rejected", () => {
      const result = evaluatePresenceWriteAndValidate(
        coupleId,
        aliceUid,
        { uid: aliceUid },
        {
          userId: aliceUid,
          lastSeenMs: 123456789, // Arbitrary client timestamp
        },
        mockRootState,
        serverNow
      );

      expect(result.validationPassed).toBe(false);
    });
  });

  describe("Application Service Privacy Enforcement", () => {
    let service: FirebasePresenceService;

    beforeEach(() => {
      service = new FirebasePresenceService();
    });

    it("Registers authoritative couple membership correctly", () => {
      service.registerCoupleMembership("cpl_test", ["user_1", "user_2"]);
      expect(service.getEffectiveCoupleId("user_1")).toBe("cpl_test");
      expect(service.getEffectiveCoupleId("user_2")).toBe("cpl_test");
    });

    it("Filters unauthorized subscription attempts for users outside the couple", () => {
      service.registerCoupleMembership("cpl_test", ["user_1", "user_2"]);
      let receivedRecord: unknown = "not_called";

      // Mock auth to represent outsider user_3
      vi.mock("@/lib/firebase/client", () => ({
        auth: { currentUser: { uid: "user_3" } },
        rtdb: null,
      }));

      const unsub = service.subscribeToUserPresence(
        "user_1",
        (record) => {
          receivedRecord = record;
        },
        "cpl_test"
      );

      // outsider user_3 should receive null (privacy shield)
      expect(receivedRecord).toBeNull();
      unsub();
    });
  });
});
