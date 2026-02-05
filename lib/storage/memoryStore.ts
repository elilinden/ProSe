// lib/storage/memoryStore.ts

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

// Persist across hot reloads in dev (Next does module caching).
declare global {
  // eslint-disable-next-line no-var
  var __PROSE_PRIME_STORE__: Map<string, SessionRecord> | undefined;
}

const store: Map<string, SessionRecord> =
  globalThis.__PROSE_PRIME_STORE__ ?? new Map<string, SessionRecord>();

if (!globalThis.__PROSE_PRIME_STORE__) {
  globalThis.__PROSE_PRIME_STORE__ = store;
}

export function createSession(input: CreateSessionInput = {}): SessionRecord {
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

  store.set(id, record);
  return record;
}

export function getSession(sessionId: string): SessionRecord | null {
  if (!sessionId) return null;
  return store.get(sessionId) ?? null;
}

export function requireSession(sessionId: string): SessionRecord {
  const s = getSession(sessionId);
  if (!s) throw new Error("Session not found. Start a new session.");
  return s;
}

export function appendMessage(input: AppendMessageInput): ChatMessage {
  const session = requireSession(input.sessionId);
  const now = Date.now();

  const msg: ChatMessage = {
    id: uid(),
    role: input.role,
    content: String(input.content ?? ""),
    ts: now,
  };

  session.messages = [...session.messages, msg];
  session.updatedAt = now;

  store.set(session.id, session);
  return msg;
}

export function mergeFacts(input: MergeFactsInput): SessionFacts {
  const session = requireSession(input.sessionId);
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
  store.set(session.id, session);
  return session.facts;
}

export function saveOutputs(input: SaveOutputsInput) {
  const session = requireSession(input.sessionId);
  const now = Date.now();
  session.outputs = {
    generatedAt: now,
    payload: input.outputs,
  };
  session.updatedAt = now;
  store.set(session.id, session);
}

export function listSessions(): SessionRecord[] {
  return Array.from(store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function resetAllSessions() {
  store.clear();
}