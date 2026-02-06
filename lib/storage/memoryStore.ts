// lib/storage/memoryStore.ts
import { kv } from "@vercel/kv";
import type {
  SessionRecord,
  CreateSessionInput,
  AppendMessageInput,
  MergeFactsInput,
  SaveOutputsInput,
  ChatMessage,
  SessionFacts,
  Track,
} from "./sessionTypes";

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

const DEFAULT_JURISDICTION = "New York";
const DEFAULT_TRACK: Track = "NY_FAMILY_PROTECTION_FROM_ABUSE";

// Helper to construct redis keys
const key = (id: string) => `prose:session:${id}`;
const INDEX_KEY = "prose:sessions_list";

export async function createSession(input: CreateSessionInput = {}): Promise<SessionRecord> {
  const id = uid();
  const now = Date.now();

  const jurisdiction = input.jurisdiction || DEFAULT_JURISDICTION;
  const track = input.track || DEFAULT_TRACK;

  const record: SessionRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    jurisdiction,
    track,
    facts: { jurisdiction, track },
    messages: [],
  };

  // Save to Redis and add ID to the index list
  await kv.set(key(id), record);
  await kv.zadd(INDEX_KEY, { score: now, member: id });

  return record;
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  if (!sessionId) return null;
  return await kv.get<SessionRecord>(key(sessionId));
}

export async function requireSession(sessionId: string): Promise<SessionRecord> {
  const s = await getSession(sessionId);
  if (!s) throw new Error("Session not found. Start a new session.");
  return s;
}

export async function appendMessage(input: AppendMessageInput): Promise<ChatMessage> {
  const now = Date.now();
  const msg: ChatMessage = {
    id: uid(),
    role: input.role,
    content: String(input.content ?? ""),
    ts: now,
  };

  // We fetch, update, and save.
  // Note: In a high-traffic app, you'd want to use separate lists for messages to avoid race conditions.
  // For this MVP, overwriting the object is acceptable but check for concurrency.
  const session = await requireSession(input.sessionId);
  
  session.messages.push(msg);
  session.updatedAt = now;

  await kv.set(key(session.id), session);
  await kv.zadd(INDEX_KEY, { score: now, member: session.id });

  return msg;
}

export async function mergeFacts(input: MergeFactsInput): Promise<SessionFacts> {
  const session = await requireSession(input.sessionId);
  const now = Date.now();

  const patch = input.patch || {};
  session.facts = {
    ...(session.facts || {}),
    ...(patch as any),
  };

  // Keep canonical jurisdiction/track aligned
  if (patch.jurisdiction) session.jurisdiction = String(patch.jurisdiction);
  if (patch.track) session.track = patch.track as any;

  session.updatedAt = now;
  
  await kv.set(key(session.id), session);
  await kv.zadd(INDEX_KEY, { score: now, member: session.id });

  return session.facts;
}

export async function saveOutputs(input: SaveOutputsInput): Promise<void> {
  const session = await requireSession(input.sessionId);
  const now = Date.now();
  
  session.outputs = {
    generatedAt: now,
    payload: input.outputs,
  };
  session.updatedAt = now;
  
  await kv.set(key(session.id), session);
  await kv.zadd(INDEX_KEY, { score: now, member: session.id });
}

export async function listSessions(): Promise<SessionRecord[]> {
  // Get latest 50 sessions from the sorted set (most recent first)
  const ids = await kv.zrange(INDEX_KEY, 0, 49, { rev: true });
  
  if (!ids || ids.length === 0) return [];

  // Fetch all sessions in parallel
  // @ts-ignore - kv types can be tricky with array returns, strictly it returns strings
  const pipelines = ids.map((id) => kv.get<SessionRecord>(key(String(id))));
  const results = await Promise.all(pipelines);

  return results.filter((s): s is SessionRecord => !!s);
}

export async function resetAllSessions(): Promise<void> {
  // Danger zone: strictly for dev/demos
  const ids = await kv.zrange(INDEX_KEY, 0, -1);
  if (ids.length > 0) {
      const keys = ids.map(id => key(String(id)));
      await kv.del(...keys);
  }
  await kv.del(INDEX_KEY);
}
