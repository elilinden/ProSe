import { NextResponse } from "next/server";
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
  const total = 6;
  const filled = total - missing.length;
  return Math.max(5, Math.min(95, Math.round((filled / total) * 100)));
}

function fallbackCoach(session: Session, lastUser: string): CoachReply {
  const missing = computeMissingFields(session);
  const progress = computeProgressPercent(session);
  const safetyAssessment = assessSafety(lastUser);
  
  if (safetyAssessment.level === "urgent" && safetyAssessment.userFacingMessage) {
    return {
      assistant_message: safetyAssessment.userFacingMessage,
      next_questions: [],
      extracted_facts: {},
      missing_fields: missing,
      progress_percent: progress,
      safety_flags: safetyAssessment.flags,
    };
  }

  const nextQuestions: string[] = [];
  if (missing.includes("goal_relief")) nextQuestions.push("What exactly do you want the judge to do?");
  if (missing.includes("people")) nextQuestions.push("Who is involved?");
  if (missing.includes("key_events_or_timeline")) nextQuestions.push("What are the 3–6 most important events in date order?");
  if (missing.includes("evidence")) nextQuestions.push("What proof do you have?");

  return {
    assistant_message: "Thanks — I’m going to help you organize this for court. Answer the questions below as clearly as you can.",
    next_questions: nextQuestions.slice(0, 4),
    extracted_facts: {},
    missing_fields: missing,
    progress_percent: progress,
    safety_flags: safetyAssessment.flags,
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

  const safetyAssessment = assessSafety(userMessage);
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

  const system = `
You are Pro-se Prime, a legal-information-only coach.
- Ask focused follow-up questions.
- Help them organize facts chronologically.
Return ONLY valid JSON with keys: assistant_message, next_questions, extracted_facts, missing_fields, progress_percent, safety_flags.
  `;

  const recent = session.conversation.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Facts JSON=${JSON.stringify(session.facts || {})}\n\nUser: ${userMessage}`,
    },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!resp.ok) return fallbackCoach(session, userMessage);

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "";

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fallbackCoach(session, userMessage);
  }

  const mergedFlags = Array.from(new Set([...safetyAssessment.flags, ...(parsed?.safety_flags || [])]));

  return {
    assistant_message: String(parsed?.assistant_message || "OK — tell me more."),
    next_questions: Array.isArray(parsed?.next_questions) ? parsed.next_questions.slice(0, 6) : [],
    extracted_facts: parsed?.extracted_facts || {},
    missing_fields: Array.isArray(parsed?.missing_fields) ? parsed.missing_fields : computeMissingFields(session),
    progress_percent: Number(parsed?.progress_percent) || computeProgressPercent(session),
    safety_flags: mergedFlags,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId;
    const userMessage = (body?.userMessage ?? "").toString();

    if (!sessionId || !userMessage.trim()) {
      return NextResponse.json({ ok: false, error: "Missing ID or message" }, { status: 400 });
    }

    const store = getStore();
    const session = store.get(sessionId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    session.conversation.push({ role: "user", content: userMessage.trim(), ts: now() });
    const coach = await callOpenAI({ session, userMessage: userMessage.trim() });

    if (coach.extracted_facts) {
      session.facts = { ...(session.facts || {}), ...coach.extracted_facts };
    }

    session.conversation.push({ role: "assistant", content: coach.assistant_message, ts: now() });
    session.updatedAt = now();
    store.set(session.id, session);

    return NextResponse.json({ ok: true, session, coach });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
