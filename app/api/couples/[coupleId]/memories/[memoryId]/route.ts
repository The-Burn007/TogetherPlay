import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/server/admin";
import { requireServerAuth, forbiddenResponse } from "@/lib/firebase/server/auth";
import { checkApiRateLimit, requireAppCheck } from "@/lib/firebase/server/security";
import type { Couple } from "@/types/domain";
import type { CoupleMemory } from "@/lib/memories/types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ coupleId: string; memoryId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { coupleId, memoryId } = await params;
    const authResult = await requireServerAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const authUser = authResult.user;

    const firestore = getAdminFirestore();
    const coupleSnap = await firestore.collection("couples").doc(coupleId).get();
    if (!coupleSnap.exists) {
      return NextResponse.json({ error: "Couple sanctuary not found" }, { status: 404 });
    }
    const couple = coupleSnap.data() as Couple;
    if (!Array.isArray(couple.memberIds) || !couple.memberIds.includes(authUser.uid)) {
      return forbiddenResponse("Access denied: Not a member of this couple.");
    }

    const memDoc = await firestore
      .collection("couples")
      .doc(coupleId)
      .collection("memories")
      .doc(memoryId)
      .get();

    if (!memDoc.exists) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, memory: memDoc.data() });
  } catch (err) {
    console.error("GET /api/couples/[coupleId]/memories/[memoryId] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. App Check attestation
    const appCheckResult = await requireAppCheck(req);
    if (!appCheckResult.success) return appCheckResult.errorResponse;

    const { coupleId, memoryId } = await params;
    const authResult = await requireServerAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const authUser = authResult.user;

    // Rate limiting
    const rateLimit = checkApiRateLimit(`mem_patch_${authUser.uid}`, 30, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
      );
    }

    const firestore = getAdminFirestore();
    const coupleSnap = await firestore.collection("couples").doc(coupleId).get();
    if (!coupleSnap.exists) {
      return NextResponse.json({ error: "Couple sanctuary not found" }, { status: 404 });
    }
    const couple = coupleSnap.data() as Couple;
    if (!Array.isArray(couple.memberIds) || !couple.memberIds.includes(authUser.uid)) {
      return forbiddenResponse("Access denied: Not a member of this couple.");
    }

    const memRef = firestore
      .collection("couples")
      .doc(coupleId)
      .collection("memories")
      .doc(memoryId);

    const memSnap = await memRef.get();
    if (!memSnap.exists) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    const existing = memSnap.data() as CoupleMemory;

    const body = await req.json();

    // STRICT IMMUTABILITY ENFORCEMENT:
    // A couple member must NOT be able to:
    // - change memory ID
    // - change couple ID
    // - change creator (createdBy)
    // - change creation timestamp (createdAt)
    // - replace another member's original memory object or storage reference
    if (body.id !== undefined && body.id !== existing.id) {
      return forbiddenResponse("IMMUTABILITY_VIOLATION: Memory ID is immutable.");
    }
    if (body.coupleId !== undefined && body.coupleId !== existing.coupleId) {
      return forbiddenResponse("IMMUTABILITY_VIOLATION: Couple ID is immutable.");
    }
    if (body.createdBy !== undefined && body.createdBy !== existing.createdBy) {
      return forbiddenResponse("IMMUTABILITY_VIOLATION: Creator ownership cannot be mutated.");
    }
    if (body.createdAt !== undefined && body.createdAt !== existing.createdAt) {
      return forbiddenResponse("IMMUTABILITY_VIOLATION: Creation timestamp is immutable and cannot be forged.");
    }
    if (
      body.media?.storagePath !== undefined &&
      existing.media?.storagePath &&
      body.media.storagePath !== existing.media.storagePath
    ) {
      return forbiddenResponse("IMMUTABILITY_VIOLATION: Original media storage reference is immutable.");
    }

    // CONTROLLED UPDATES: caption, reaction, reactions, visibility, note, title, context, dateLabel
    const updates: Partial<CoupleMemory> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.caption !== undefined) updates.caption = String(body.caption).trim().slice(0, 300);
    if (body.visibility !== undefined) {
      if (!["couple", "private", "archived"].includes(body.visibility)) {
        return NextResponse.json({ error: "Invalid visibility mode" }, { status: 400 });
      }
      updates.visibility = body.visibility;
    }
    if (body.note !== undefined) updates.note = String(body.note).trim().slice(0, 3000);
    if (body.title !== undefined) updates.title = String(body.title).trim().slice(0, 120);
    if (body.context !== undefined) updates.context = String(body.context).trim().slice(0, 600);
    if (body.dateLabel !== undefined) updates.dateLabel = String(body.dateLabel).trim().slice(0, 60);

    // Reactions: merge partner reaction or replace reactions map safely
    if (body.reactions !== undefined && typeof body.reactions === "object") {
      updates.reactions = { ...(existing.reactions || {}), ...body.reactions };
    } else if (body.reaction !== undefined) {
      const currentReactions = { ...(existing.reactions || {}) };
      if (currentReactions[authUser.uid] === body.reaction) {
        delete currentReactions[authUser.uid]; // Toggle off
      } else {
        currentReactions[authUser.uid] = String(body.reaction).slice(0, 10);
      }
      updates.reactions = currentReactions;
    }

    await memRef.update(updates);
    const updatedMemory = { ...existing, ...updates };

    return NextResponse.json({ success: true, memory: updatedMemory });
  } catch (err) {
    console.error("PATCH /api/couples/[coupleId]/memories/[memoryId] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const appCheckResult = await requireAppCheck(req);
    if (!appCheckResult.success) return appCheckResult.errorResponse;

    const { coupleId, memoryId } = await params;
    const authResult = await requireServerAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const authUser = authResult.user;

    const firestore = getAdminFirestore();
    const coupleSnap = await firestore.collection("couples").doc(coupleId).get();
    if (!coupleSnap.exists) {
      return NextResponse.json({ error: "Couple sanctuary not found" }, { status: 404 });
    }
    const couple = coupleSnap.data() as Couple;
    if (!Array.isArray(couple.memberIds) || !couple.memberIds.includes(authUser.uid)) {
      return forbiddenResponse("Access denied: Not a member of this couple.");
    }

    const memRef = firestore
      .collection("couples")
      .doc(coupleId)
      .collection("memories")
      .doc(memoryId);

    const memSnap = await memRef.get();
    if (!memSnap.exists) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    const memory = memSnap.data() as CoupleMemory;

    // UNAUTHORIZED DELETE DEFENSE:
    // Only the creator who authored the memory can delete it
    if (memory.createdBy !== authUser.uid) {
      return forbiddenResponse("UNAUTHORIZED_DELETE: Only the creator who authored this memory can delete it.");
    }

    await memRef.delete();
    return NextResponse.json({ success: true, message: "Memory deleted successfully." });
  } catch (err) {
    console.error("DELETE /api/couples/[coupleId]/memories/[memoryId] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
