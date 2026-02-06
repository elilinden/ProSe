// app/api/coach/route.ts

import { NextResponse } from "next/server";
// FIX: Use relative path instead of "@/" alias until tsconfig is updated
import { assessSafety } from "../../../lib/rules/safetyRules";

type Role = "user" | "assistant";

type Session = {
  id: string;
  createdAt: number;
  updatedAt: number;
  jurisdiction?: string;
  matterType?: string;
  track?: string;
  facts: Record<string, any>;
  conversation: Array<{ role: Role; content: string; ts: number }>;
};

type CoachReply = {
  assistant_message: string;
  next_questions: string[];
  extracted_facts: Record<string, any>;
  missing_fields: string[];
  progress_percent: number;
  safety_flags: string[];
};

// ✅ FIX: Make the global store the SAME shape as app/api/session/route.ts (a Map)
type Store = Map<string, Session>;

function getStore(): Store {
  const g = globalThis as any;
  if (!g.__PROSE_PRIME_STORE__) {
    g.__PROSE_PRIME_STORE__ = new Map<string, Session>();
  }
  return g.__PROSE_PRIME_STORE__ as Store;
}

function now() {
  return Date.now();
}

function computeMissingFields(session: Session): string[] {
  const f = session.facts ?? {};
  const missing: string[] = [];

  if (!session.jurisdiction) missing.push("jurisdiction");
  if (!session.track) missing.push("track");

  if (!f.goal_relief) missing.push("goal_relief");
  if (!f.people) missing.push("people");
  if (!f.key_events && !f.timeline) missing.push("key_events_or_timeline");
  if (!f.evidence) missing.push("evidence");

  return missing;
}

function computeProgressPercent(session: Session): number {
  const missing = computeMissingFields(session);
  const total = 6; // jurisdiction, track, goal_relief, people, key_events/timeline, evidence
  const filled = total - missing.length;
  const pct = Math.max(5, Math.min(95, Math.round((filled / total) * 100)));
  return pct;
}

/**
 * Very small “MVP coach” fallback if no API key.
 * It simply asks follow-ups based on missing fields.
 */
function fallbackCoach(session: Session, lastUser: string): CoachReply {
  const missing = computeMissingFields(session);
  const progress = computeProgressPercent(session);

  // Use the robust shared safety logic instead of local heuristics
  const safetyAssessment = assessSafety(lastUser);
  const flags = safetyAssessment.flags;

  // If urgent safety issue, return the pre-written safety message immediately
  if (safetyAssessment.level === "urgent" && safetyAssessment.userFacingMessage) {
    return {
      assistant_message: safetyAssessment.userFacingMessage,
      next_questions: [],
      extracted_facts: {},
      missing_fields: missing,
      progress_percent: progress,
      safety_flags: flags,
    };
  }

  const nextQuestions: string[] = [];
  if (missing.includes("goal_relief"))
    nextQuestions.push("What exactly do you want the judge to do (the result you’re asking for)?");
  if (missing.includes("people"))
    nextQuestions.push("Who is involved (names/initials, relationship, and who you are asking about)?");
  if (missing.includes("key_events_or_timeline"))
    nextQuestions.push(
      "What are the 3–6 most important events in date order (include dates or approximate dates)?"
    );
  if (missing.includes("evidence"))
    nextQuestions.push("What proof do you have (texts, emails, photos, witnesses, medical/police records, etc.)?");

  if (nextQuestions.length === 0) {
    nextQuestions.push("What is the strongest fact that supports what you’re asking for?");
    nextQuestions.push("What is the other side likely to say back, and what would your response be?");
  }

  return {
    assistant_message:
      "Thanks — I’m going to help you organize this for court. Answer the questions below as clearly as you can (short sentences, dates if possible).",
    next_questions: nextQuestions.slice(0, 4),
    extracted_facts: {},
    missing_fields: missing,
    progress_percent: progress,
    safety_flags: flags,
  };
}

async function callOpenAI({
  session,
  userMessage,
}: {
  session: Session;
  userMessage: string;
}): Promise<CoachReply> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackCoach(session, userMessage);

  // 1. Run rigorous regex safety check FIRST
  const safetyAssessment = assessSafety(userMessage);

  // If urgent, skip AI and return safety message immediately
  if (safetyAssessment.level === "urgent" && safetyAssessment.userFacingMessage) {
    return {
      assistant_message: safetyAssessment.userFacingMessage,
      next_questions: [],
      extracted_facts: {},
      missing_fields: computeMissingFields(session),
      progress_percent: computeProgressPercent(session),
      safety_flags: safetyAssessment.flags,
    };
  }

  const schemaInstruction = `
Return ONLY valid JSON (no markdown) with keys:
assistant_message (string)
next_questions (string[])
extracted_facts (object) // STRICTLY use this key "extracted_facts". Only add fields you are confident about.
missing_fields (string[]) // use these canonical names: jurisdiction, track, goal_relief, people, key_events_or_timeline, evidence
progress_percent (number 0-100)
safety_flags (string[]) // include "danger_possible_immediate_risk" if user suggests immediate danger/violence
`;

  const system = `
You are Pro-se Prime, a legal-information-only coach for self-represented people.
Your job:
- Ask focused follow-up questions
- Help them organize facts chronologically
- Help them align facts to what they are asking the judge to do
- Prepare a concise oral outline
Do NOT give legal advice, do NOT predict outcomes, do NOT tell them what to file.
Be extra careful in family / domestic violence contexts: focus on clarity, dates, evidence.
${schemaInstruction}
`;

  // Keep context short for MVP. Use the last ~10 messages only.
  const recent = session.conversation.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const input = [
    { role: "system", content: system },
    {
      role: "user",
      content:
        `Context:\nJurisdiction=${session.jurisdiction || "unknown"}\nTrack=${
          session.track || "unknown"
        }\nFacts JSON=${JSON.stringify(session.facts || {})}\n\nConversation so far:\n` +
        recent.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n") +
        `\n\nNew user message:\n${userMessage}`,
    },
  ];

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    // If OpenAI fails for any reason, fallback instead of breaking the app.
    return fallbackCoach(session, userMessage);
  }

  const data = await resp.json();

  // responses API usually returns output_text; handle a few shapes defensively
  const text =
    data?.output_text || data?.output?.[0]?.content?.[0]?.text || data?.output?.[0]?.content?.[0]?.json || "";

  let parsed: any;
  try {
    parsed = typeof text === "string" ? JSON.parse(text) : text;
  } catch {
    return fallbackCoach(session, userMessage);
  }

  // Merge regex safety flags with AI safety flags
  const aiFlags = Array.isArray(parsed?.safety_flags) ? parsed.safety_flags : [];
  const mergedFlags = Array.from(new Set([...safetyAssessment.flags, ...aiFlags]));

  const reply: CoachReply = {
    assistant_message: String(
      parsed?.assistant_message || "OK — tell me more, focusing on dates and what you want the judge to do."
    ),
    next_questions: Array.isArray(parsed?.next_questions) ? parsed.next_questions.map(String).slice(0, 6) : [],
    // Ensure we look for the correct key "extracted_facts"
    extracted_facts: parsed?.extracted_facts && typeof parsed.extracted_facts === "object" ? parsed.extracted_facts : {},
    missing_fields: Array.isArray(parsed?.missing_fields) ? parsed.missing_fields.map(String) : computeMissingFields(session),
    progress_percent: Number.isFinite(parsed?.progress_percent)
      ? Number(parsed.progress_percent)
      : computeProgressPercent(session),
    safety_flags: mergedFlags,
  };

  return reply;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId;
    const userMessage = (body?.userMessage ?? "").toString();

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
    }
    if (!userMessage.trim()) {
      return NextResponse.json({ ok: false, error: "Missing userMessage" }, { status: 400 });
    }

    const store = getStore();

    // ✅ FIX: store is the Map
    const session = store.get(sessionId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found (server memory reset?)" }, { status: 404 });
    }

    // Append user message
    session.conversation.push({ role: "user", content: userMessage.trim(), ts: now() });

    // Generate coach reply
    const coach = await callOpenAI({ session, userMessage: userMessage.trim() });

    // Merge extracted facts (only shallow merge for MVP)
    if (coach.extracted_facts && typeof coach.extracted_facts === "object") {
      session.facts = { ...(session.facts || {}), ...coach.extracted_facts };
    }

    // Append assistant message
    session.conversation.push({ role: "assistant", content: coach.assistant_message, ts: now() });

    // Update timestamps
    session.updatedAt = now();

    // Recompute missing/progress if model didn't provide
    coach.missing_fields = coach.missing_fields?.length ? coach.missing_fields : computeMissingFields(session);
    coach.progress_percent = Number.isFinite(coach.progress_percent) ? coach.progress_percent : computeProgressPercent(session);

    // ✅ FIX: save back into the Map
    store.set(session.id, session);

    return NextResponse.json({ ok: true, session, coach });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error in /api/coach" }, { status: 500 });
  }
}
