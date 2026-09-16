import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/utils/crypto";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import type { Couple, CoupleInvite } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inviteId, code, acceptingUserId } = body;

    if (!inviteId || !code || !acceptingUserId) {
      return NextResponse.json(
        { error: "Missing required invitation parameters." },
        { status: 400 }
      );
    }

    // 1. Fetch invitation record
    const inviteRef = doc(db, "coupleInvites", inviteId);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      return NextResponse.json(
        { error: "Invitation not found or invalid." },
        { status: 404 }
      );
    }

    const invite = inviteSnap.data() as CoupleInvite;

    // 2. State & Expiration checks
    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "This invitation has already been accepted or revoked." },
        { status: 409 }
      );
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This invitation has expired. Please ask your partner for a new link." },
        { status: 410 }
      );
    }

    // 3. Cryptographic hash comparison (tokenHash vs sha256(code))
    const inputHash = await sha256(code);
    if (inputHash !== invite.tokenHash) {
      return NextResponse.json(
        { error: "Invalid pairing code. Please double-check your code or link." },
        { status: 403 }
      );
    }

    // 4. Prevent inviter self-joining
    if (invite.inviterId === acceptingUserId) {
      return NextResponse.json(
        { error: "You cannot accept your own invitation." },
        { status: 400 }
      );
    }

    // 5. Fetch couple space
    const coupleRef = doc(db, "couples", invite.coupleId);
    const coupleSnap = await getDoc(coupleRef);

    if (!coupleSnap.exists()) {
      return NextResponse.json(
        { error: "Associated couple space not found." },
        { status: 404 }
      );
    }

    const couple = coupleSnap.data() as Couple;

    // Strict invariant: Maximum 2 members in MVP
    if (couple.memberIds.length >= 2) {
      if (couple.memberIds.includes(acceptingUserId)) {
        return NextResponse.json({
          success: true,
          coupleId: couple.coupleId,
          alreadyMember: true,
        });
      }
      return NextResponse.json(
        { error: "This couple sanctuary is already full (maximum 2 partners)." },
        { status: 409 }
      );
    }

    // 6. Execute atomic membership change
    await updateDoc(coupleRef, {
      memberIds: [couple.memberIds[0], acceptingUserId],
    });

    await updateDoc(inviteRef, {
      status: "accepted",
      acceptedBy: acceptingUserId,
    });

    const userRef = doc(db, "users", acceptingUserId);
    await setDoc(userRef, { coupleId: couple.coupleId }, { merge: true });

    return NextResponse.json({
      success: true,
      coupleId: couple.coupleId,
      message: "Successfully joined your shared sanctuary space.",
    });
  } catch (error) {
    console.error("Server API accept-invite error:", error);
    return NextResponse.json(
      { error: "An error occurred while connecting your couple space." },
      { status: 500 }
    );
  }
}
