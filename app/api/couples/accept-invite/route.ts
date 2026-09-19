import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/utils/crypto";
import { getAdminFirestore } from "@/lib/firebase/server/admin";
import { requireServerAuth, forbiddenResponse } from "@/lib/firebase/server/auth";
import { requireAppCheck, checkApiRateLimit } from "@/lib/firebase/server/security";
import type { Couple, CoupleInvite } from "@/types/domain";

export const dynamic = "force-dynamic";

class InviteAcceptanceError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "InviteAcceptanceError";
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(req);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    // 2. User Authentication using shared Firebase Admin authentication middleware
    const authResult = await requireServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    // Authenticated UID derived strictly from the verified Firebase ID token
    const acceptingUserId = authResult.user.uid;

    const rateLimit = checkApiRateLimit(`accept_invite_${acceptingUserId}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many invitation attempts. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
      );
    }

    const body = await req.json();
    const { inviteId, code, acceptingUserId: clientAcceptingUserId } = body;

    // Security Check: Ignore/reject client-supplied acceptingUserId if it attempts to forge identity
    if (clientAcceptingUserId && clientAcceptingUserId !== acceptingUserId) {
      return forbiddenResponse("Access denied: acceptingUserId does not match authenticated user.");
    }

    if (!inviteId || !code) {
      return NextResponse.json(
        { error: "Missing required invitation parameters." },
        { status: 400 }
      );
    }

    const firestore = getAdminFirestore();

    // 3. Execute atomic Firestore transaction to prevent race conditions and concurrent double-claims
    const txResult = await firestore.runTransaction(async (transaction) => {
      const inviteRef = firestore.collection("coupleInvites").doc(inviteId);
      const userRef = firestore.collection("users").doc(acceptingUserId);

      // 3.1. Read and verify invite document
      const inviteSnap = await transaction.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new InviteAcceptanceError("Invitation not found or invalid.", 404, "INVITE_NOT_FOUND");
      }

      const invite = inviteSnap.data() as CoupleInvite;
      if (!invite || !invite.coupleId || !invite.tokenHash) {
        throw new InviteAcceptanceError("Invitation record is malformed or invalid.", 400, "INVALID_INVITE");
      }

      // 3.2. Verify invite has not already been accepted or revoked
      if (invite.status !== "pending") {
        throw new InviteAcceptanceError("This invitation has already been accepted or revoked.", 409, "INVITE_ALREADY_USED");
      }

      // 3.3. Verify invite has not expired
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        throw new InviteAcceptanceError("This invitation has expired. Please ask your partner for a new link.", 410, "INVITE_EXPIRED");
      }

      // 3.4. Cryptographic pairing code verification
      const inputHash = await sha256(code);
      if (inputHash !== invite.tokenHash) {
        throw new InviteAcceptanceError("Invalid pairing code. Please double-check your code or link.", 403, "INVALID_PAIRING_CODE");
      }

      // 3.5. Prevent inviter from self-inviting / self-pairing
      if (invite.inviterId === acceptingUserId) {
        throw new InviteAcceptanceError("You cannot accept your own invitation.", 400, "SELF_INVITE_DISALLOWED");
      }

      // 3.6. Read accepting user and verify not already paired to another couple
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data();
      if (userData?.coupleId && userData.coupleId !== invite.coupleId) {
        throw new InviteAcceptanceError(
          "You are already connected to a couple sanctuary. You cannot join multiple couples.",
          409,
          "ALREADY_PAIRED"
        );
      }

      // 3.7. Read couple space and verify slot capacity
      const coupleRef = firestore.collection("couples").doc(invite.coupleId);
      const coupleSnap = await transaction.get(coupleRef);
      if (!coupleSnap.exists) {
        throw new InviteAcceptanceError("Associated couple space not found.", 404, "COUPLE_NOT_FOUND");
      }

      const couple = coupleSnap.data() as Couple;

      // Strict capacity check: Maximum 2 partners
      if (couple.memberIds.length >= 2) {
        if (couple.memberIds.includes(acceptingUserId)) {
          return {
            alreadyMember: true,
            coupleId: couple.coupleId,
          };
        }
        throw new InviteAcceptanceError("This couple sanctuary is already full (maximum 2 partners).", 409, "COUPLE_FULL");
      }

      if (couple.memberIds.includes(acceptingUserId)) {
        return {
          alreadyMember: true,
          coupleId: couple.coupleId,
        };
      }

      // 3.8. Execute atomic transactional writes
      const nowIso = new Date().toISOString();
      transaction.update(coupleRef, {
        memberIds: [couple.memberIds[0], acceptingUserId],
        updatedAt: nowIso,
      });

      transaction.update(inviteRef, {
        status: "accepted",
        acceptedBy: acceptingUserId,
        acceptedAt: nowIso,
      });

      transaction.set(
        userRef,
        {
          coupleId: couple.coupleId,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      return {
        alreadyMember: false,
        coupleId: couple.coupleId,
      };
    });

    if (txResult.alreadyMember) {
      return NextResponse.json({
        success: true,
        coupleId: txResult.coupleId,
        alreadyMember: true,
      });
    }

    return NextResponse.json({
      success: true,
      coupleId: txResult.coupleId,
      message: "Successfully joined your shared sanctuary space.",
    });
  } catch (error) {
    if (error instanceof InviteAcceptanceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Server API accept-invite error:", error);
    return NextResponse.json(
      { error: "An error occurred while connecting your couple space." },
      { status: 500 }
    );
  }
}
