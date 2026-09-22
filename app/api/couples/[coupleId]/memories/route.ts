import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/server/admin";
import type { Couple } from "@/types/domain";
import type { CoupleMemory, CreateMemoryPayload } from "@/lib/memories/types";
import { getDefaultCoupleMemories } from "@/lib/memories/defaultMemories";
import { checkApiRateLimit, requireAppCheck } from "@/lib/firebase/server/security";
import { requireServerAuth, forbiddenResponse } from "@/lib/firebase/server/auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    coupleId: string;
  }>;
}

/**
 * GET /api/couples/[coupleId]/memories
 * Enforces strict authentication and couple membership before returning private timeline memories.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(req);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    const { coupleId } = await params;

    if (!coupleId) {
      return NextResponse.json({ error: "Missing coupleId parameter." }, { status: 400 });
    }

    // 2. Authenticate requesting user using Firebase Admin ID token verification
    const authResult = await requireServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const authUser = authResult.user;

    // 2. Rate limiting (60 requests per minute per user)
    const rateLimit = checkApiRateLimit(`memories_get_${authUser.uid}`, 60, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
      );
    }

    // 3. Fetch couple document to enforce couple membership
    const firestore = getAdminFirestore();
    const coupleSnap = await firestore.collection("couples").doc(coupleId).get();

    if (!coupleSnap.exists) {
      return NextResponse.json(
        { error: "Couple sanctuary not found." },
        { status: 404 }
      );
    }

    const couple = coupleSnap.data() as Couple;
    if (!Array.isArray(couple.memberIds) || !couple.memberIds.includes(authUser.uid)) {
      return forbiddenResponse("Access denied. Memories are private to the couple.");
    }

    // 4. Fetch memories from couples/{coupleId}/memories
    try {
      const snapshot = await firestore
        .collection("couples")
        .doc(coupleId)
        .collection("memories")
        .orderBy("date", "desc")
        .get();

      if (snapshot.empty) {
        return NextResponse.json({
          memories: getDefaultCoupleMemories(coupleId),
        });
      }

      const memories: CoupleMemory[] = [];
      snapshot.forEach((d) => {
        memories.push({
          id: d.id,
          ...(d.data() as Omit<CoupleMemory, "id">),
        });
      });

      return NextResponse.json({ memories });
    } catch {
      return NextResponse.json({
        memories: getDefaultCoupleMemories(coupleId),
      });
    }
  } catch (error: unknown) {
    console.error("GET /api/couples/[coupleId]/memories error:", error);
    return NextResponse.json({ error: "Failed to retrieve memories" }, { status: 500 });
  }
}

/**
 * POST /api/couples/[coupleId]/memories
 * Creates a memory under couples/{coupleId}/memories/{memoryId} with strict auth & membership enforcement.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. App Check Attestation
    const appCheckResult = await requireAppCheck(req);
    if (!appCheckResult.success) {
      return appCheckResult.errorResponse;
    }

    const { coupleId } = await params;
    const body = await req.json();
    const { authorUid, authorName, payload } = body as {
      authorUid: string;
      authorName: string;
      payload: CreateMemoryPayload;
    };

    // 2. Authenticate caller strictly using Firebase Admin SDK
    const authResult = await requireServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const authUser = authResult.user;

    // Security check: Client cannot override authenticated UID
    if (authorUid && authorUid !== authUser.uid) {
      return forbiddenResponse("Access denied. Cannot record memories on behalf of another user.");
    }

    // 2. Input validation
    if (!coupleId || !payload?.title || !payload?.context) {
      return NextResponse.json(
        { error: "Missing required fields for couple memory creation." },
        { status: 400 }
      );
    }

    if (payload.title.trim().length > 120) {
      return NextResponse.json({ error: "Title exceeds 120 character limit." }, { status: 400 });
    }
    if (payload.context.trim().length > 600) {
      return NextResponse.json({ error: "Context exceeds 600 character limit." }, { status: 400 });
    }
    if (payload.note && payload.note.length > 3000) {
      return NextResponse.json({ error: "Note exceeds 3000 character limit." }, { status: 400 });
    }

    // 3. Rate limiting (15 creations per minute per couple/user)
    const rateLimit = checkApiRateLimit(`memories_post_${authUser.uid}`, 15, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Memory creation rate limit exceeded. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
      );
    }

    // 4. Verify couple membership
    const firestore = getAdminFirestore();
    const coupleSnap = await firestore.collection("couples").doc(coupleId).get();

    if (!coupleSnap.exists) {
      return NextResponse.json(
        { error: "Couple sanctuary not found." },
        { status: 404 }
      );
    }

    const couple = coupleSnap.data() as Couple;
    if (!Array.isArray(couple.memberIds) || !couple.memberIds.includes(authUser.uid)) {
      return forbiddenResponse("Access denied. Only verified couple members can record memories.");
    }

    // 5. Media storage reference security validation
    let mediaPayload: CoupleMemory["media"] | undefined = undefined;
    if (payload.media) {
      const storagePath = payload.media.storagePath;
      if (typeof storagePath !== "string" || !storagePath) {
        return NextResponse.json({ error: "Invalid media: missing storagePath." }, { status: 400 });
      }

      // Check path traversal attempts (e.g. '../' or '..')
      if (storagePath.includes("..") || storagePath.includes("//")) {
        return NextResponse.json(
          { error: "Security violation: path traversal detected in media reference." },
          { status: 400 }
        );
      }

      // Must be strictly confined to this couple's memories namespace
      const expectedPrefix = `couples/${coupleId}/memories/`;
      if (!storagePath.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "Security violation: media storagePath must reside within the couple's memory archive." },
          { status: 403 }
        );
      }

      // Ownership-aware check: if formatted as couples/{coupleId}/memories/{uid}/{fileName},
      // UID MUST match authenticated user (cannot hijack or reference another user's private media folder)
      const pathSuffix = storagePath.substring(expectedPrefix.length);
      const parts = pathSuffix.split("/");
      if (parts.length > 1) {
        const pathOwnerUid = parts[0];
        if (pathOwnerUid !== authUser.uid) {
          return forbiddenResponse("Security violation: cannot associate media from another user's storage path.");
        }
      }

      mediaPayload = {
        storagePath,
        fileName: payload.media.fileName || "photo.jpg",
        contentType: payload.media.contentType || "image/jpeg",
        fileSize: payload.media.fileSize,
        caption: payload.media.caption ? payload.media.caption.trim() : undefined,
      };
    }

    // 6. Create immutable memory document with server-generated ID & timestamps
    const memoryId = `mem_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newMemory: CoupleMemory = {
      id: memoryId,
      coupleId,
      type: payload.type,
      title: payload.title.trim(),
      date: payload.date || now,
      dateLabel: payload.dateLabel || "Recently",
      context: payload.context.trim(),
      note: payload.note ? payload.note.trim() : undefined,
      caption: payload.caption ? payload.caption.trim() : (mediaPayload?.caption || undefined),
      reactions: payload.reactions || {},
      visibility: payload.visibility || "couple",
      media: mediaPayload,
      gameActivity: payload.gameActivity,
      milestoneData: payload.milestoneData,
      relationshipDateData: payload.relationshipDateData,
      createdBy: authUser.uid,
      authorName: authorName || "Partner",
      createdAt: now,
      updatedAt: now,
    };

    await firestore
      .collection("couples")
      .doc(coupleId)
      .collection("memories")
      .doc(memoryId)
      .set(newMemory);

    return NextResponse.json({ success: true, memory: newMemory });
  } catch (error: unknown) {
    console.error("POST /api/couples/[coupleId]/memories error:", error);
    return NextResponse.json({ error: "Failed to create memory" }, { status: 500 });
  }
}
