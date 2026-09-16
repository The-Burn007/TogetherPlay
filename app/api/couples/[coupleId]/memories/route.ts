import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, collection, getDocs, setDoc, query, orderBy } from "firebase/firestore";
import type { Couple } from "@/types/domain";
import type { CoupleMemory, CreateMemoryPayload } from "@/lib/memories/types";
import { getDefaultCoupleMemories } from "@/lib/memories/defaultMemories";
import { extractAuthContext, checkApiRateLimit } from "@/lib/firebase/server/security";

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
    const { coupleId } = await params;
    const { searchParams } = new URL(req.url);

    if (!coupleId) {
      return NextResponse.json({ error: "Missing coupleId parameter." }, { status: 400 });
    }

    // 1. Authenticate requesting user
    let authContext = extractAuthContext(req);
    const queryUserId = searchParams.get("userId");
    if (!authContext && queryUserId) {
      authContext = { uid: queryUserId };
    }

    if (!authContext) {
      return NextResponse.json(
        { error: "Authentication required to access couple memories." },
        { status: 401 }
      );
    }

    // 2. Rate limiting (60 requests per minute per user)
    const rateLimit = checkApiRateLimit(`memories_get_${authContext.uid}`, 60, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
      );
    }

    // 3. Fetch couple document to enforce couple membership
    const coupleRef = doc(db, "couples", coupleId);
    const coupleSnap = await getDoc(coupleRef);

    if (coupleSnap.exists()) {
      const couple = coupleSnap.data() as Couple;
      if (!Array.isArray(couple.memberIds) || !couple.memberIds.includes(authContext.uid)) {
        return NextResponse.json(
          { error: "Access denied. Memories are private to the couple." },
          { status: 403 }
        );
      }
    }

    // 4. Fetch memories from couples/{coupleId}/memories
    try {
      const memoriesCollRef = collection(db, "couples", coupleId, "memories");
      const q = query(memoriesCollRef, orderBy("date", "desc"));
      const snapshot = await getDocs(q);

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
    const { coupleId } = await params;
    const body = await req.json();
    const { authorUid, authorName, payload } = body as {
      authorUid: string;
      authorName: string;
      payload: CreateMemoryPayload;
    };

    // 1. Authenticate caller
    let authContext = extractAuthContext(req);
    if (!authContext && authorUid) {
      authContext = { uid: authorUid };
    }

    if (!authContext) {
      return NextResponse.json(
        { error: "Authentication required to record memories." },
        { status: 401 }
      );
    }

    // Enforce that author matches authenticated user
    if (authorUid && authorUid !== authContext.uid) {
      return NextResponse.json(
        { error: "Access denied. Cannot record memories on behalf of another user." },
        { status: 403 }
      );
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
    const rateLimit = checkApiRateLimit(`memories_post_${authContext.uid}`, 15, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Memory creation rate limit exceeded. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
      );
    }

    // 4. Verify couple membership
    const coupleRef = doc(db, "couples", coupleId);
    const coupleSnap = await getDoc(coupleRef);

    if (coupleSnap.exists()) {
      const couple = coupleSnap.data() as Couple;
      if (!Array.isArray(couple.memberIds) || !couple.memberIds.includes(authContext.uid)) {
        return NextResponse.json(
          { error: "Access denied. Only verified couple members can record memories." },
          { status: 403 }
        );
      }
    }

    // 5. Create memory document
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
      gameActivity: payload.gameActivity,
      milestoneData: payload.milestoneData,
      relationshipDateData: payload.relationshipDateData,
      createdBy: authContext.uid,
      authorName: authorName || "Partner",
      createdAt: now,
      updatedAt: now,
    };

    const memoryDocRef = doc(db, "couples", coupleId, "memories", memoryId);
    await setDoc(memoryDocRef, newMemory);

    return NextResponse.json({ success: true, memory: newMemory });
  } catch (error: unknown) {
    console.error("POST /api/couples/[coupleId]/memories error:", error);
    return NextResponse.json({ error: "Failed to create memory" }, { status: 500 });
  }
}
