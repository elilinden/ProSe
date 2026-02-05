// Next.js Route Handler
// Recommended location: app/api/session/route.ts

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Role = "user" | "assistant";

export type ProSeSession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  jurisdiction?: string; // e.g., "NY"
  matterType?: string; // e.g., "family", "housing", "small_claims"
  track?: string; // e.g., "order_of_protection", "custody", "eviction_defense"
  facts: Record<string, unknown>; // flexible on purpose for MVP
  conversation: Array<{ role: Role; content: string; ts: number }>;
};

type Store = Map<string, ProSeSession>;

function getStore(): Store {
  const g = globalThis as unknown as { __PROSE_PRIME_STORE__?: Store };
  if (!g.__PROSE_PRIME_STORE__) g.__PROSE_PRIME_STORE__ = new Map<string, ProSeSession>();
  return g.__PROSE_PRIME_STORE__!;
}

function now() {
  return Date.now();
}

function safeJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// Lightweight deep merge for objects (arrays overwrite).
function deepMerge<T extends Record<string, any>>(base: T, patch: Record<string, any>): T {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  // Create a new session
  const body = (await req.json().catch(() => ({}))) as Partial<{
    jurisdiction: string;
    matterType: string;
    track: string;
    seedFacts: Record<string, unknown>;
  }>;

  const id = crypto.randomUUID();
  const ts = now();

  const session: ProSeSession = {
    id,
    createdAt: ts,
    updatedAt: ts,
    jurisdiction: body.jurisdiction?.trim() || "NY",
    matterType: body.matterType?.trim() || "family",
    track: body.track?.trim() || "order_of_protection",
    facts: body.seedFacts && typeof body.seedFacts === "object" ? body.seedFacts : {},
    conversation: [],
  };

  getStore().set(id, session);

  return safeJson({ ok: true, sessionId: id, session });
}

export async function GET(req: NextRequest) {
  // Fetch an existing session
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) return safeJson({ ok: false, error: "Missing sessionId" }, 400);

  const session = getStore().get(sessionId);
  if (!session) return safeJson({ ok: false, error: "Session not found" }, 404);

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

  const sessionId = body.sessionId?.trim();
  if (!sessionId) return safeJson({ ok: false, error: "Missing sessionId" }, 400);

  const store = getStore();
  const session = store.get(sessionId);
  if (!session) return safeJson({ ok: false, error: "Session not found" }, 404);

  if (typeof body.jurisdiction === "string") session.jurisdiction = body.jurisdiction.trim();
  if (typeof body.matterType === "string") session.matterType = body.matterType.trim();
  if (typeof body.track === "string") session.track = body.track.trim();

  if (body.factsPatch && typeof body.factsPatch === "object") {
    session.facts = deepMerge(session.facts as Record<string, any>, body.factsPatch as Record<string, any>);
  }

  session.updatedAt = now();
  store.set(sessionId, session);

  return safeJson({ ok: true, session });
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) return safeJson({ ok: false, error: "Missing sessionId" }, 400);

  const store = getStore();
  const existed = store.delete(sessionId);

  return safeJson({ ok: true, deleted: existed });
}