import { NextResponse } from "next/server";
import { assessSafety } from "../../../lib/rules/safetyRules";
import { 
  requireSession, 
  appendMessage, 
  mergeFacts 
} from "../../../lib/storage/memoryStore";
import type { SessionRecord } from "../../../lib/storage/sessionTypes";

export const runtime = "nodejs";

type CoachReply = {
  assistant_message: string;
  next_questions: string[];
  extracted_facts: Record<string, any>;
  missing_fields: string[];
  progress_percent: number;
  safety_flags: string[];
};

function computeMissingFields(session: SessionRecord): string[] {
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

function computeProgressPercent(session: SessionRecord): number {
  const missing = computeMissingFields(session);
  const total = 6;
  const filled = total - missing.length;
  return Math.max(5, Math.min(95, Math.round((filled / total) * 100)));
}

function fallbackCoach(session: SessionRecord, lastUser: string): CoachReply {
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
  if (missing.includes("people")) nextQuestions.push("Who is involved (names/roles/relationship)?");
  if (missing.includes("key_events_or_timeline"))
    nextQuestions.push("What are the 3–6 most important events in date order (include dates or approximate dates)?");
  if (missing.includes("evidence"))
    nextQuestions.push("What proof do you have for the most important events (texts, photos, witnesses, records)?");

  return {
    assistant_message:
      "Thanks — I’ll help you organize this for court. Answer the questions below as clearly as you can. Stick to dates, what happened, and what you want the judge to do.",
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
  session: SessionRecord;
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
You are Pro-se Prime, a legal-information-only coach for self-represented litigants.

Goals:
- Ask focused follow-up questions that pull out legally relevant facts (dates, who/what/where, what relief they want).
- Help organize the story chronologically and tie facts to what the judge will consider (without giving legal advice).
- Help the user prepare for a short, high-pressure court appearance.

Hard rules:
- Do NOT provide legal advice. Do NOT cite statutes or cases. Do NOT predict outcomes.
- Do NOT tell them what to file. Only help them organize facts and prepare to present clearly.
- If user suggests immediate danger/violence, prioritize safety and return a short safety-oriented message.

Return ONLY valid JSON (no markdown), with keys:
assistant_message (string),
next_questions (string[]),
extracted_facts (object),
missing_fields (string[]),
progress_percent (number),
safety_flags (string[]).
`;

  // Include a little recent context but keep it compact
  const recent = (session.messages || []).slice(-10).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content:
        `SESSION META:\n` +
        `Jurisdiction=${session.jurisdiction || "unknown"}\n` +
        `MatterType=${"family"}\n` + // simplified, add matterType to sessionRecord if needed
        `Track=${session.track || "unknown"}\n\n` +
        `FACTS_JSON=${JSON.stringify(session.facts || {})}\n\n` +
        `RECENT:\n${recent}\n\n` +
        `NEW USER MESSAGE:\n${userMessage}\n\n` +
        `Now respond with JSON only.`,
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

  const mergedFlags = Array.from(new Set([...safetyAssessment.flags, ...((parsed?.safety_flags as any[]) || [])]));

  return {
    assistant_message: String(parsed?.assistant_message || "OK — tell me more."),
    next_questions: Array.isArray(parsed?.next_questions) ? parsed.next_questions.slice(0, 6).map(String) : [],
    extracted_facts:
      parsed?.extracted_facts && typeof parsed.extracted_facts === "object" && !Array.isArray(parsed.extracted_facts)
        ? parsed.extracted_facts
        : {},
    missing_fields: Array.isArray(parsed?.missing_fields)
      ? parsed.missing_fields.map(String)
      : computeMissingFields(session),
    progress_percent: Number(parsed?.progress_percent) || computeProgressPercent(session),
    safety_flags: mergedFlags.map(String),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId;
    const userMessage = (body?.userMessage ?? "").toString().trim();

    if (!sessionId || typeof sessionId !== "string" || !userMessage) {
      return NextResponse.json({ ok: false, error: "Missing sessionId or message" }, { status: 400 });
    }

    // 1. Fetch Session
    const session = await requireSession(sessionId);

    // 2. Persist User Message
    const userMsg = await appendMessage({ sessionId, role: "user", content: userMessage });
    
    // Update local session object so AI sees the new message context
    session.messages.push(userMsg);

    // 3. Call AI
    const coach = await callOpenAI({ session, userMessage });

    // 4. Merge Extracted Facts
    if (coach.extracted_facts && typeof coach.extracted_facts === "object") {
       session.facts = await mergeFacts({ sessionId, patch: coach.extracted_facts });
    }

    // 5. Persist Assistant Message
    const assistantMsg = await appendMessage({ sessionId, role: "assistant", content: coach.assistant_message });
    session.messages.push(assistantMsg);

    return NextResponse.json({ ok: true, session, coach }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("Coach API Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error in /api/coach" },
      { status: 500 }
    );
  }
}
