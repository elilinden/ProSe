// app/api/session/route.ts
// Session lifecycle API. Uses shared in-memory store from lib/storage/memoryStore
// so all routes (session/coach/outputs) share the exact same session structure.

import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  getSession,
  patchSession,
  deleteSession,
} from "../../../lib/storage/memoryStore";

export const runtime = "nodejs";

function safeJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  // Create a new session
  const body = (await req.json().catch(() => ({}))) as Partial<{
    jurisdiction: string;
    matterType: string;
    track: string;
    seedFacts: Record<string, unknown>;
  }>;

  const jurisdiction = typeof body.jurisdiction === "string" ? body.jurisdiction.trim() : undefined;
  const matterType = typeof body.matterType === "string" ? body.matterType.trim() : undefined;
  const track = typeof body.track === "string" ? body.track.trim() : undefined;
  const seedFacts =
    body.seedFacts && typeof body.seedFacts === "object" && !Array.isArray(body.seedFacts)
      ? (body.seedFacts as Record<string, unknown>)
      : undefined;

  const session = createSession({
    jurisdiction: jurisdiction || "New York",
    matterType: matterType || "family",
    track: track || "order_of_protection",
    seedFacts: seedFacts || {},
  });

  return safeJson({ ok: true, sessionId: session.id, session });
}

export async function GET(req: NextRequest) {
  // Fetch an existing session
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) return safeJson({ ok: false, error: "Missing sessionId" }, 400);

  const session = getSession(sessionId);
  if (!session) return safeJson({ ok: false, error: "Session not found (server memory reset?)" }, 404);

  return safeJson({ ok: true, session });
}

export async function PATCH(req: NextRequest) {
  // Update session metadata or facts
  const body = (await req.json().catch(() => ({}))) as Partial<{
    sessionId: string;
    jurisdiction: string;
    matterType: string;
    track: string;
    factsPatch: Record<string, unknown>;
  }>;

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) return safeJson({ ok: false, error: "Missing sessionId" }, 400);

  const jurisdiction = typeof body.jurisdiction === "string" ? body.jurisdiction.trim() : undefined;
  const matterType = typeof body.matterType === "string" ? body.matterType.trim() : undefined;
  const track = typeof body.track === "string" ? body.track.trim() : undefined;
  const factsPatch =
    body.factsPatch && typeof body.factsPatch === "object" && !Array.isArray(body.factsPatch)
      ? (body.factsPatch as Record<string, unknown>)
      : undefined;

  const updated = patchSession({
    sessionId,
    jurisdiction,
    matterType,
    track,
    factsPatch: factsPatch || {},
  });

  if (!updated) {
    return safeJson({ ok: false, error: "Session not found (server memory reset?)" }, 404);
  }

  return safeJson({ ok: true, session: updated });
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) return safeJson({ ok: false, error: "Missing sessionId" }, 400);

  const deleted = deleteSession(sessionId);
  return safeJson({ ok: true, deleted });
}
