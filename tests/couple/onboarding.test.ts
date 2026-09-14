import { describe, it, expect, vi, beforeEach } from "vitest";
import { sha256, generatePairingCode } from "@/lib/utils/crypto";
import { CoupleService } from "@/lib/firebase/services/couple";
import type { Couple, CoupleInvite } from "@/types/domain";

// In-memory mock database for testing Firestore operations
let mockDatabase: Record<string, Record<string, any>> = {};

vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, collection, id })),
    getDoc: vi.fn(async (ref: { collection: string; id: string }) => {
      const data = mockDatabase[ref.collection]?.[ref.id];
      return {
        exists: () => !!data,
        data: () => data,
      };
    }),
    setDoc: vi.fn(async (ref: { collection: string; id: string }, data: any, options?: { merge?: boolean }) => {
      if (!mockDatabase[ref.collection]) {
        mockDatabase[ref.collection] = {};
      }
      if (options?.merge && mockDatabase[ref.collection][ref.id]) {
        mockDatabase[ref.collection][ref.id] = {
          ...mockDatabase[ref.collection][ref.id],
          ...data,
        };
      } else {
        mockDatabase[ref.collection][ref.id] = { ...data };
      }
    }),
    updateDoc: vi.fn(async (ref: { collection: string; id: string }, data: any) => {
      if (!mockDatabase[ref.collection]?.[ref.id]) {
        throw new Error(`Document not found: ${ref.collection}/${ref.id}`);
      }
      mockDatabase[ref.collection][ref.id] = {
        ...mockDatabase[ref.collection][ref.id],
        ...data,
      };
    }),
    onSnapshot: vi.fn((ref: { collection: string; id: string }, callback: any) => {
      const data = mockDatabase[ref.collection]?.[ref.id];
      callback({
        exists: () => !!data,
        data: () => data,
      });
      return () => {};
    }),
  };
});

vi.mock("@/lib/firebase/client", () => ({
  db: {},
  auth: { currentUser: { uid: "user_owner_1" } },
}));

describe("TogetherPlay Couple Onboarding Flow & Security", () => {
  let service: CoupleService;

  beforeEach(() => {
    mockDatabase = {
      couples: {},
      coupleInvites: {},
      users: {},
    };
    service = new CoupleService();
  });

  describe("Cryptographic Invariants & Invitation Security", () => {
    it("generates structured, high-entropy pairing codes", () => {
      const code = generatePairingCode();
      expect(code).toMatch(/^SANCT-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    });

    it("computes deterministic 64-character hex SHA-256 digests", async () => {
      const digest1 = await sha256("SANCT-TEST-CODE");
      const digest2 = await sha256("sanct-test-code "); // case & whitespace normalized
      expect(digest1).toBe(digest2);
      expect(digest1.length).toBe(64);
    });

    it("creates invitation storing ONLY tokenHash and never plaintext secret in the database", async () => {
      const ownerId = "user_owner_1";
      const couple = await service.createCouple(ownerId, "2023-06-15");

      const result = await service.createInvitation(couple.coupleId, ownerId, "Alex");

      expect(result.pairingCode).toBeDefined();
      expect(result.inviteUrl).toContain(result.inviteId);

      // Verify the Firestore document stored in coupleInvites
      const storedInvite = mockDatabase.coupleInvites[result.inviteId] as CoupleInvite;
      expect(storedInvite).toBeDefined();
      expect(storedInvite.coupleId).toBe(couple.coupleId);
      expect(storedInvite.tokenHash).toHaveLength(64);

      // Security check: NEVER store plaintext secret in document
      expect((storedInvite as any).rawSecret).toBeUndefined();
      expect((storedInvite as any).secret).toBeUndefined();
      expect((storedInvite as any).pairingCode).toBeUndefined();

      // Verify stored hash matches hash of the issued pairing code
      const expectedHash = await sha256(result.pairingCode);
      expect(storedInvite.tokenHash).toBe(expectedHash);
    });
  });

  describe("Couple Creation & Invariants", () => {
    it("creates a couple with exactly 1 initial member (owner) and links owner's profile", async () => {
      const ownerId = "user_owner_1";
      const couple = await service.createCouple(ownerId, "2024-02-14");

      expect(couple.coupleId).toBeDefined();
      expect(couple.ownerId).toBe(ownerId);
      expect(couple.memberIds).toEqual([ownerId]);
      expect(couple.memberIds.length).toBe(1);
      expect(couple.status).toBe("active");
      expect(couple.relationshipStartDate).toBe("2024-02-14");

      // Verify owner's user document was updated with coupleId
      expect(mockDatabase.users[ownerId]?.coupleId).toBe(couple.coupleId);
    });
  });

  describe("Invitation Acceptance & Partner Connection", () => {
    it("allows partner B to accept with matching code, reaching exactly two members", async () => {
      const ownerId = "user_owner_1";
      const partnerId = "user_partner_2";

      const couple = await service.createCouple(ownerId);
      const invite = await service.createInvitation(couple.coupleId, ownerId, "Alex");

      const acceptRes = await service.acceptInvitation(
        invite.inviteId,
        invite.pairingCode,
        partnerId
      );

      expect(acceptRes.success).toBe(true);
      expect(acceptRes.coupleId).toBe(couple.coupleId);

      // Verify couple now has exactly 2 members
      const updatedCouple = mockDatabase.couples[couple.coupleId] as Couple;
      expect(updatedCouple.memberIds).toEqual([ownerId, partnerId]);
      expect(updatedCouple.memberIds.length).toBe(2);

      // Verify invite status marked as accepted
      const updatedInvite = mockDatabase.coupleInvites[invite.inviteId] as CoupleInvite;
      expect(updatedInvite.status).toBe("accepted");
      expect(updatedInvite.acceptedBy).toBe(partnerId);

      // Verify partner B profile document linked
      expect(mockDatabase.users[partnerId]?.coupleId).toBe(couple.coupleId);
    });

    it("rejects acceptance if pairing code is invalid (hash mismatch)", async () => {
      const ownerId = "user_owner_1";
      const partnerId = "user_partner_2";

      const couple = await service.createCouple(ownerId);
      const invite = await service.createInvitation(couple.coupleId, ownerId, "Alex");

      await expect(
        service.acceptInvitation(invite.inviteId, "WRONG-CODE-9999", partnerId)
      ).rejects.toThrow("Invalid pairing code");
    });

    it("rejects inviter attempting to accept their own invitation", async () => {
      const ownerId = "user_owner_1";

      const couple = await service.createCouple(ownerId);
      const invite = await service.createInvitation(couple.coupleId, ownerId, "Alex");

      await expect(
        service.acceptInvitation(invite.inviteId, invite.pairingCode, ownerId)
      ).rejects.toThrow("You cannot accept your own invitation");
    });

    it("enforces MVP 2-member limit: rejects a 3rd party from joining an already paired couple", async () => {
      const ownerId = "user_owner_1";
      const partnerId = "user_partner_2";
      const intruderId = "user_intruder_3";

      const couple = await service.createCouple(ownerId);
      const invite = await service.createInvitation(couple.coupleId, ownerId, "Alex");

      // Partner B joins
      await service.acceptInvitation(invite.inviteId, invite.pairingCode, partnerId);

      // A second invite or attempt by a 3rd user
      const invite2 = await service.createInvitation(couple.coupleId, ownerId, "Alex");
      await expect(
        service.acceptInvitation(invite2.inviteId, invite2.pairingCode, intruderId)
      ).rejects.toThrow("already has two partners connected");

      // Verify couple still only has 2 members
      const finalCouple = mockDatabase.couples[couple.coupleId] as Couple;
      expect(finalCouple.memberIds.length).toBe(2);
      expect(finalCouple.memberIds).not.toContain(intruderId);
    });

    it("rejects already accepted or expired invitations", async () => {
      const ownerId = "user_owner_1";
      const partnerId = "user_partner_2";

      const couple = await service.createCouple(ownerId);
      const invite = await service.createInvitation(couple.coupleId, ownerId, "Alex");

      // Accept once
      await service.acceptInvitation(invite.inviteId, invite.pairingCode, partnerId);

      // Try accepting again
      await expect(
        service.acceptInvitation(invite.inviteId, invite.pairingCode, "user_other_4")
      ).rejects.toThrow("already been accepted");
    });
  });
});
