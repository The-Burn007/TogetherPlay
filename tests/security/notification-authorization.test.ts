import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { type PartnerNotification, type NotificationType } from "@/lib/presence/types";

/**
 * Realtime Database Notification Rules Engine Simulator
 * Accurately models the exact rule AST / logic from database.rules.json:
 * rules.notifications.$uid.$notificationId
 */
interface RtdbRootState {
  couples: Record<
    string,
    {
      memberIds?: string[];
      members?: Record<string, boolean>;
    }
  >;
  notifications: Record<string, Record<string, PartnerNotification>>;
}

interface AuthContext {
  uid: string;
}

interface EvaluationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluates notifications read rule:
 * auth != null && auth.uid === $uid
 */
function evaluateNotificationRead(
  targetUid: string,
  auth: AuthContext | null
): boolean {
  if (!auth) return false;
  return auth.uid === targetUid;
}

/**
 * Evaluates notifications write and validate rules:
 * matches rules.notifications.$uid.$notificationId in database.rules.json
 */
function evaluateNotificationWrite(
  targetUid: string,
  notificationId: string,
  auth: AuthContext | null,
  newDataVal: any,
  existingDataVal: any | null,
  rootState: RtdbRootState
): EvaluationResult {
  if (!auth) {
    return { allowed: false, reason: "Unauthenticated" };
  }

  const isDelete = newDataVal === null || newDataVal === undefined;
  const existsBefore = existingDataVal !== null && existingDataVal !== undefined;

  // 1. Evaluate .write condition:
  // auth != null && (
  //   (!data.exists() && newData.child('fromUserId').val() === auth.uid && newData.child('toUserId').val() === $uid && auth.uid !== $uid && newData.hasChild('coupleId') && newData.child('coupleId').isString() && (root.child('couples').child(newData.child('coupleId').val()).child('members').hasChild(auth.uid) || root.child('couples').child(newData.child('coupleId').val()).child('memberIds').hasChild(auth.uid) || root.child('couples').child(newData.child('coupleId').val()).child('memberIds/0').val() === auth.uid || root.child('couples').child(newData.child('coupleId').val()).child('memberIds/1').val() === auth.uid) && (root.child('couples').child(newData.child('coupleId').val()).child('members').hasChild($uid) || root.child('couples').child(newData.child('coupleId').val()).child('memberIds').hasChild($uid) || root.child('couples').child(newData.child('coupleId').val()).child('memberIds/0').val() === $uid || root.child('couples').child(newData.child('coupleId').val()).child('memberIds/1').val() === $uid))
  //   || (auth.uid === $uid && (!newData.exists() || (newData.child('read').val() === true && newData.child('fromUserId').val() === data.child('fromUserId').val() && newData.child('toUserId').val() === data.child('toUserId').val() && newData.child('coupleId').val() === data.child('coupleId').val())))
  // )

  let writeRulePassed = false;

  if (!existsBefore) {
    // New notification write attempt by sender
    if (
      newDataVal &&
      typeof newDataVal === "object" &&
      newDataVal.fromUserId === auth.uid &&
      newDataVal.toUserId === targetUid &&
      auth.uid !== targetUid &&
      typeof newDataVal.coupleId === "string"
    ) {
      const couple = rootState.couples[newDataVal.coupleId];
      if (couple) {
        const senderInCouple =
          Boolean(couple.members?.[auth.uid]) ||
          Boolean(couple.memberIds?.includes(auth.uid)) ||
          couple.memberIds?.[0] === auth.uid ||
          couple.memberIds?.[1] === auth.uid;

        const recipientInCouple =
          Boolean(couple.members?.[targetUid]) ||
          Boolean(couple.memberIds?.includes(targetUid)) ||
          couple.memberIds?.[0] === targetUid ||
          couple.memberIds?.[1] === targetUid;

        if (senderInCouple && recipientInCouple) {
          writeRulePassed = true;
        }
      }
    }
  } else {
    // Existing notification update/deletion by recipient
    if (auth.uid === targetUid) {
      if (isDelete) {
        writeRulePassed = true;
      } else if (
        newDataVal &&
        newDataVal.read === true &&
        newDataVal.fromUserId === existingDataVal.fromUserId &&
        newDataVal.toUserId === existingDataVal.toUserId &&
        newDataVal.coupleId === existingDataVal.coupleId
      ) {
        writeRulePassed = true;
      }
    }
  }

  if (!writeRulePassed) {
    return { allowed: false, reason: "Write permission denied by rules" };
  }

  // 2. Evaluate .validate condition:
  // !newData.exists() || (
  //   newData.hasChildren(['id', 'type', 'title', 'body', 'fromUserId', 'toUserId', 'read', 'coupleId']) &&
  //   (newData.hasChild('createdAt') || newData.hasChild('timestamp')) &&
  //   newData.child('id').isString() && newData.child('id').val().length <= 64 &&
  //   newData.child('coupleId').isString() && newData.child('coupleId').val().length <= 64 &&
  //   newData.child('fromUserId').isString() && newData.child('fromUserId').val().length <= 128 &&
  //   newData.child('toUserId').isString() && newData.child('toUserId').val().length <= 128 &&
  //   newData.child('title').isString() && newData.child('title').val().length <= 120 &&
  //   newData.child('body').isString() && newData.child('body').val().length <= 500 &&
  //   (newData.child('type').val() === 'partner_invited' || newData.child('type').val() === 'game_started' || newData.child('type').val() === 'challenge_sent' || newData.child('type').val() === 'daily_moment' || newData.child('type').val() === 'rematch_requested') &&
  //   (!data.exists() ? (newData.child('fromUserId').val() === auth.uid && newData.child('toUserId').val() === $uid) : (newData.child('fromUserId').val() === data.child('fromUserId').val() && newData.child('toUserId').val() === data.child('toUserId').val() && newData.child('coupleId').val() === data.child('coupleId').val())) &&
  //   (!newData.hasChild('fromName') || (newData.child('fromName').isString() && newData.child('fromName').val().length <= 64)) &&
  //   (!newData.hasChild('actionHref') || (newData.child('actionHref').isString() && newData.child('actionHref').val().length <= 256)) &&
  //   (!newData.hasChild('actionLabel') || (newData.child('actionLabel').isString() && newData.child('actionLabel').val().length <= 64)) &&
  //   (!newData.hasChild('gameId') || (newData.child('gameId').isString() && newData.child('gameId').val().length <= 64))
  // )

  if (isDelete) {
    return { allowed: true };
  }

  const requiredFields = ["id", "type", "title", "body", "fromUserId", "toUserId", "read", "coupleId"];
  for (const field of requiredFields) {
    if (!(field in newDataVal)) {
      return { allowed: false, reason: `Missing required field: ${field}` };
    }
  }

  if (!("createdAt" in newDataVal) && !("timestamp" in newDataVal)) {
    return { allowed: false, reason: "Missing timestamp/createdAt" };
  }

  if (typeof newDataVal.id !== "string" || newDataVal.id.length > 64) {
    return { allowed: false, reason: "Invalid id field or exceeded max size" };
  }
  if (typeof newDataVal.coupleId !== "string" || newDataVal.coupleId.length > 64) {
    return { allowed: false, reason: "Invalid coupleId or exceeded max size" };
  }
  if (typeof newDataVal.fromUserId !== "string" || newDataVal.fromUserId.length > 128) {
    return { allowed: false, reason: "Invalid fromUserId or exceeded max size" };
  }
  if (typeof newDataVal.toUserId !== "string" || newDataVal.toUserId.length > 128) {
    return { allowed: false, reason: "Invalid toUserId or exceeded max size" };
  }
  if (typeof newDataVal.title !== "string" || newDataVal.title.length > 120) {
    return { allowed: false, reason: "Invalid title or exceeded 120 chars" };
  }
  if (typeof newDataVal.body !== "string" || newDataVal.body.length > 500) {
    return { allowed: false, reason: "Invalid body or exceeded 500 chars" };
  }

  const validTypes = [
    "partner_invited",
    "game_started",
    "challenge_sent",
    "daily_moment",
    "rematch_requested",
  ];
  if (!validTypes.includes(newDataVal.type)) {
    return { allowed: false, reason: `Invalid notification type: ${newDataVal.type}` };
  }

  // Immutability checks
  if (!existsBefore) {
    if (newDataVal.fromUserId !== auth.uid || newDataVal.toUserId !== targetUid) {
      return { allowed: false, reason: "New notification sender/recipient mismatch with auth and path" };
    }
  } else {
    if (
      newDataVal.fromUserId !== existingDataVal.fromUserId ||
      newDataVal.toUserId !== existingDataVal.toUserId ||
      newDataVal.coupleId !== existingDataVal.coupleId
    ) {
      return { allowed: false, reason: "Immutable fields (fromUserId, toUserId, coupleId) altered" };
    }
  }

  // Optional string bounds
  if ("fromName" in newDataVal && (typeof newDataVal.fromName !== "string" || newDataVal.fromName.length > 64)) {
    return { allowed: false, reason: "fromName exceeded max length" };
  }
  if ("actionHref" in newDataVal && (typeof newDataVal.actionHref !== "string" || newDataVal.actionHref.length > 256)) {
    return { allowed: false, reason: "actionHref exceeded max length" };
  }
  if ("actionLabel" in newDataVal && (typeof newDataVal.actionLabel !== "string" || newDataVal.actionLabel.length > 64)) {
    return { allowed: false, reason: "actionLabel exceeded max length" };
  }
  if ("gameId" in newDataVal && (typeof newDataVal.gameId !== "string" || newDataVal.gameId.length > 64)) {
    return { allowed: false, reason: "gameId exceeded max length" };
  }

  return { allowed: true };
}

describe("NOTIFICATION AUTHORIZATION HARDENING: SECURITY RULES & RELATIONSHIP INVARIANTS", () => {
  const rulesPath = path.resolve(process.cwd(), "database.rules.json");
  const rulesJson = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
  const notifRules = rulesJson.rules.notifications;

  const coupleId1 = "cpl_tokyo_london_4209";
  const userA = "user_sam";
  const userB = "user_alex";
  const userC = "user_charlie_outsider";
  const coupleId2 = "cpl_paris_rome_8801";
  const userD = "user_danielle_outsider";

  const rootState: RtdbRootState = {
    couples: {
      [coupleId1]: {
        memberIds: [userA, userB],
        members: {
          [userA]: true,
          [userB]: true,
        },
      },
      [coupleId2]: {
        memberIds: [userC, userD],
        members: {
          [userC]: true,
          [userD]: true,
        },
      },
    },
    notifications: {},
  };

  const validPayload: PartnerNotification = {
    id: "notif_1001",
    type: "partner_invited",
    title: "Sam invited you to play!",
    body: "Let's play Find It First! Ready when you are.",
    fromUserId: userA,
    fromName: "Sam",
    toUserId: userB,
    coupleId: coupleId1,
    createdAt: Date.now(),
    read: false,
    gameId: "find_it_first",
    actionHref: "/play/lobby?game=find_it_first",
    actionLabel: "Join Game Lobby",
  };

  describe("Static Security Rules Syntax & Structure Verification", () => {
    it("database.rules.json contains hardened notifications node", () => {
      expect(notifRules).toBeDefined();
      expect(notifRules.$uid).toBeDefined();
      expect(notifRules.$uid.$notificationId).toBeDefined();
    });

    it("verifies read rule restricts access strictly to the recipient ($uid)", () => {
      expect(notifRules.$uid[".read"]).toBe("auth != null && auth.uid === $uid");
      expect(notifRules.$uid.$notificationId[".read"]).toBe("auth != null && auth.uid === $uid");
    });

    it("verifies write rule checks both sender and recipient in root.child('couples')", () => {
      const writeRule = notifRules.$uid.$notificationId[".write"];
      expect(writeRule).toContain("root.child('couples').child(newData.child('coupleId').val())");
      expect(writeRule).toContain("hasChild(auth.uid)");
      expect(writeRule).toContain("hasChild($uid)");
    });

    it("verifies validate rule enforces whitelist of valid notification types", () => {
      const validateRule = notifRules.$uid.$notificationId[".validate"];
      expect(validateRule).toContain("'partner_invited'");
      expect(validateRule).toContain("'game_started'");
      expect(validateRule).toContain("'challenge_sent'");
      expect(validateRule).toContain("'daily_moment'");
      expect(validateRule).toContain("'rematch_requested'");
    });

    it("verifies validate rule enforces title <= 120 and body <= 500 length limits", () => {
      const validateRule = notifRules.$uid.$notificationId[".validate"];
      expect(validateRule).toContain("child('title').val().length <= 120");
      expect(validateRule).toContain("child('body').val().length <= 500");
    });
  });

  describe("Scenario 1: User A → User B, actual couple: PASS", () => {
    it("allows User A to send a legitimate notification to partner User B", () => {
      const result = evaluateNotificationWrite(
        userB,
        validPayload.id,
        { uid: userA },
        validPayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("Scenario 2: User A → unrelated User C: DENY", () => {
    it("denies User A sending a notification to unrelated User C using User A's coupleId", () => {
      const payloadToC = {
        ...validPayload,
        toUserId: userC,
        coupleId: coupleId1, // User C is NOT in coupleId1
      };

      const result = evaluateNotificationWrite(
        userC,
        payloadToC.id,
        { uid: userA },
        payloadToC,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Write permission denied");
    });

    it("denies User A sending a notification to unrelated User C using User C's coupleId", () => {
      const payloadToC = {
        ...validPayload,
        toUserId: userC,
        coupleId: coupleId2, // User A is NOT in coupleId2
      };

      const result = evaluateNotificationWrite(
        userC,
        payloadToC.id,
        { uid: userA },
        payloadToC,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Write permission denied");
    });
  });

  describe("Scenario 3: User A changes recipient UID to arbitrary user: DENY", () => {
    it("denies when target path is User B but payload toUserId is forged to arbitrary user C", () => {
      const forgedPayload = {
        ...validPayload,
        toUserId: userC, // mismatched with path $uid (userB)
      };

      const result = evaluateNotificationWrite(
        userB,
        forgedPayload.id,
        { uid: userA },
        forgedPayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
    });

    it("denies when target path is arbitrary user C but payload claims toUserId is user B", () => {
      const forgedPayload = {
        ...validPayload,
        toUserId: userB, // mismatched with path $uid (userC)
      };

      const result = evaluateNotificationWrite(
        userC,
        forgedPayload.id,
        { uid: userA },
        forgedPayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe("Scenario 4: User A changes coupleId client-side: DENY", () => {
    it("denies when client supplies a forged, non-existent coupleId", () => {
      const forgedPayload = {
        ...validPayload,
        coupleId: "cpl_fake_unauthorized_9999",
      };

      const result = evaluateNotificationWrite(
        userB,
        forgedPayload.id,
        { uid: userA },
        forgedPayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Write permission denied");
    });

    it("denies when client supplies another real couple's coupleId where they are not both members", () => {
      const forgedPayload = {
        ...validPayload,
        coupleId: coupleId2,
      };

      const result = evaluateNotificationWrite(
        userB,
        forgedPayload.id,
        { uid: userA },
        forgedPayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe("Scenario 5: User C attempts to write notification pretending to be User A: DENY", () => {
    it("denies outsider User C attempting to send notification with fromUserId = User A", () => {
      const spoofedPayload = {
        ...validPayload,
        fromUserId: userA, // spoofed
      };

      const result = evaluateNotificationWrite(
        userB,
        spoofedPayload.id,
        { uid: userC }, // authenticated as userC
        spoofedPayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Write permission denied");
    });
  });

  describe("Scenario 6: User leaves couple and attempts to notify former partner: DENY", () => {
    it("denies notification creation after authoritative couple membership is dissolved", () => {
      // Dissolve membership: User A leaves the couple
      const stateAfterLeaving: RtdbRootState = {
        couples: {
          [coupleId1]: {
            memberIds: [userB], // userA removed
            members: {
              [userB]: true,
            },
          },
          [coupleId2]: rootState.couples[coupleId2],
        },
        notifications: {},
      };

      const result = evaluateNotificationWrite(
        userB,
        validPayload.id,
        { uid: userA },
        validPayload,
        null,
        stateAfterLeaving
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Write permission denied");
    });
  });

  describe("Scenario 7: Recipient can read their own legitimate notifications: PASS", () => {
    it("allows User B (recipient) to read notifications at notifications/user_alex", () => {
      const canRead = evaluateNotificationRead(userB, { uid: userB });
      expect(canRead).toBe(true);
    });

    it("allows User B (recipient) to mark notification as read", () => {
      const readUpdate = {
        ...validPayload,
        read: true,
      };

      const result = evaluateNotificationWrite(
        userB,
        validPayload.id,
        { uid: userB },
        readUpdate,
        validPayload,
        rootState
      );
      expect(result.allowed).toBe(true);
    });

    it("allows User B (recipient) to delete / dismiss notification", () => {
      const result = evaluateNotificationWrite(
        userB,
        validPayload.id,
        { uid: userB },
        null, // deletion
        validPayload,
        rootState
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("Scenario 8: Unrelated user cannot read another user's notifications: DENY", () => {
    it("denies outsider User C reading notifications of User B", () => {
      const canRead = evaluateNotificationRead(userB, { uid: userC });
      expect(canRead).toBe(false);
    });

    it("denies unauthenticated user reading notifications", () => {
      const canRead = evaluateNotificationRead(userB, null);
      expect(canRead).toBe(false);
    });

    it("denies sender User A reading recipient User B's notification inbox directly", () => {
      const canRead = evaluateNotificationRead(userB, { uid: userA });
      expect(canRead).toBe(false);
    });
  });

  describe("Payload Constraints & Immutability Enforcement", () => {
    it("rejects notifications with title exceeding 120 characters", () => {
      const longTitlePayload = {
        ...validPayload,
        title: "A".repeat(121),
      };

      const result = evaluateNotificationWrite(
        userB,
        longTitlePayload.id,
        { uid: userA },
        longTitlePayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("120 chars");
    });

    it("accepts notifications with title up to 120 characters", () => {
      const maxTitlePayload = {
        ...validPayload,
        title: "A".repeat(120),
      };

      const result = evaluateNotificationWrite(
        userB,
        maxTitlePayload.id,
        { uid: userA },
        maxTitlePayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(true);
    });

    it("rejects notifications with body exceeding 500 characters", () => {
      const longBodyPayload = {
        ...validPayload,
        body: "B".repeat(501),
      };

      const result = evaluateNotificationWrite(
        userB,
        longBodyPayload.id,
        { uid: userA },
        longBodyPayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("500 chars");
    });

    it("rejects invalid notification type outside whitelist", () => {
      const invalidTypePayload = {
        ...validPayload,
        type: "malicious_promo" as unknown as NotificationType,
      };

      const result = evaluateNotificationWrite(
        userB,
        invalidTypePayload.id,
        { uid: userA },
        invalidTypePayload,
        null,
        rootState
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Invalid notification type");
    });

    it("enforces immutable sender identity (fromUserId cannot be changed on update)", () => {
      const updateAttempt = {
        ...validPayload,
        read: true,
        fromUserId: userC, // tampering with sender
      };

      const result = evaluateNotificationWrite(
        userB,
        validPayload.id,
        { uid: userB },
        updateAttempt,
        validPayload,
        rootState
      );
      expect(result.allowed).toBe(false);
    });

    it("enforces immutable recipient path identity (toUserId cannot be altered on update)", () => {
      const updateAttempt = {
        ...validPayload,
        read: true,
        toUserId: userC, // tampering with recipient
      };

      const result = evaluateNotificationWrite(
        userB,
        validPayload.id,
        { uid: userB },
        updateAttempt,
        validPayload,
        rootState
      );
      expect(result.allowed).toBe(false);
    });

    it("enforces immutable coupleId (coupleId cannot be altered on update)", () => {
      const updateAttempt = {
        ...validPayload,
        read: true,
        coupleId: coupleId2, // tampering with coupleId
      };

      const result = evaluateNotificationWrite(
        userB,
        validPayload.id,
        { uid: userB },
        updateAttempt,
        validPayload,
        rootState
      );
      expect(result.allowed).toBe(false);
    });
  });
});
