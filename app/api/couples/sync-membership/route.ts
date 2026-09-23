import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore, seedAuthoritativeCoupleMembership } from "@/lib/firebase/server/admin";
import { requireServerAuth, forbiddenResponse, unauthorizedResponse } from "@/lib/firebase/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const currentUid = authResult.user.uid;

    const body = await req.json().catch(() => ({}));
    const coupleId = body.coupleId;

    if (!coupleId || typeof coupleId !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing coupleId parameter." },
        { status: 400 }
      );
    }

    const firestore = getAdminFirestore();
    const coupleDoc = await firestore.collection("couples").doc(coupleId).get();

    if (!coupleDoc.exists) {
      return NextResponse.json(
        { error: "Couple record not found in authoritative persistent store." },
        { status: 404 }
      );
    }

    const coupleData = coupleDoc.data();
    const memberIds: string[] = coupleData?.memberIds || [];

    // The user MUST be an authoritative member of the couple
    if (!memberIds.includes(currentUid)) {
      return forbiddenResponse("Caller is not an authoritative member of the requested couple.");
    }

    // Server-authoritatively write to RTDB
    await seedAuthoritativeCoupleMembership(coupleId, memberIds);

    return NextResponse.json({
      success: true,
      coupleId,
      memberIds,
    });
  } catch (error) {
    console.error("[SyncCoupleMembership] Error:", error);
    return NextResponse.json(
      { error: "Failed to synchronize couple membership to realtime presence store." },
      { status: 500 }
    );
  }
}
