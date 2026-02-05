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

type Store = {
  sessions: Map<string, Session>;
};

function getStore(): Store {
  const g = globalThis as any;
  if (!g.__PROSE_PRIME_STORE__) {
    g.__PROSE_PRIME_STORE__ = { sessions: new Map<string, Session>() } as Store;
  }
  return g.__PROSE_PRIME_STORE__ as Store;
}

type Outputs = {
  oral_script_2min: string;
  oral_outline_5min: string;
  timeline: Array<{ date: string; event: string }>;
  evidence_checklist: string[];
  gaps: string[];
  reviewer_packet: {
    jurisdiction: string;
    track: string;
    goal_relief: string;
    key_facts: string[];
    key_requests: string[];
  };
  safety_flags: string[];
};

function safetyFlagsFromText(text: string): string[] {
  const assessment = assessSafety(text);
  if (assessment.level === "urgent") {
    return ["danger_possible_immediate_risk", ...assessment.flags];
  }
  return assessment.flags;
}

function lastUserText(session: Session): string {
  for (let i = session.conversation.length - 1; i >= 0; i--) {
    if (session.conversation[i].role === "user") return session.conversation[i].content;
  }
  return "";
}

function fallbackOutputs(session: Session): Outputs {
  const f = session.facts || {};
  const jurisdiction = session.jurisdiction || "NY";
  const track = session.track || "unknown";
  const goal = f.goal_relief || "Not specified yet.";
  const people = f.people || "Not specified yet.";
  const keyEvents = f.key_events || f.timeline || "Not specified yet.";
  const evidence = f.evidence || "Not specified yet.";

  const safety_flags = safetyFlagsFromText(lastUserText(session));

  const timeline: Array<{ date: string; event: string }> = [];
  if (Array.isArray(f.timeline)) {
    for (const item of f.timeline) {
      if (item && typeof item === "object") {
        timeline.push({
          date: String((item as any).date || (item as any).when || "Unknown date"),
          event: String((item as any).event || (item as any).what || "Event"),
        });
      }
    }
  }

  // If no structured timeline, make a simple one from raw text.
  if (timeline.length === 0 && typeof keyEvents === "string" && keyEvents.trim()) {
    const lines = keyEvents
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean)
      .slice(0, 8);
    for (const line of lines) {
      timeline.push({ date: "Unknown/approx", event: line.replace(/^-+\s*/, "") });
    }
  }

  const evidenceList: string[] =
    Array.isArray(f.evidence_items) ? f.evidence_items.map(String) : [
      "Texts / messages (screenshots)",
      "Call logs / voicemails",
      "Photos / videos",
      "Witness names + what they saw",
      "Police / medical / shelter records (if any)",
      "Court orders / prior filings (if any)",
    ];

  const gaps: string[] = [];
  if (!f.goal_relief) gaps.push("Clarify exactly what you want the judge to do (specific relief).");
  if (!f.timeline && !f.key_events) gaps.push("Add 3–6 key events in date order (include dates or approximate dates).");
  if (!f.evidence) gaps.push("List what proof you have for the most important events.");
  gaps.push("Identify the single strongest example that supports your request.");
  gaps.push("Write 1–2 sentences on what the other side will argue and your short response.");

  const oral_script_2min =
    `Your Honor, my name is [NAME]. I’m here in ${jurisdiction} regarding ${track}.\n` +
    `I’m asking the Court for: ${goal}\n\n` +
    `In brief, the key facts are:\n` +
    `1) [Most important event with date]\n` +
    `2) [Second important event with date]\n` +
    `3) [Current situation + why relief is needed now]\n\n` +
    `I can support this with evidence such as: ${typeof evidence === "string" ? evidence : "documents and witnesses"}.\n` +
    `Based on these facts, I respectfully request: ${goal}.\n`;

  const oral_outline_5min =
    `1) What I’m asking for (relief)\n` +
    `   - ${goal}\n\n` +
    `2) Who is involved\n` +
    `   - ${typeof people === "string" ? people : "List parties and relationship"}\n\n` +
    `3) Key events (date order)\n` +
    timeline.map((t, idx) => `   ${idx + 1}. ${t.date}: ${t.event}`).join("\n") +
    `\n\n4) Why this matters to the Court\n` +
    `   - [Connect the most serious facts to why the Court should grant the relief]\n\n` +
    `5) Evidence\n` +
    evidenceList.map((x) => `   - ${x}`).join("\n") +
    `\n\n6) Closing\n` +
    `   - Restate request: ${goal}\n` +
    `   - Ask for any next steps or clarification the Court wants\n`;

  return {
    oral_script_2min,
    oral_outline_5min,
    timeline,
    evidence_checklist: evidenceList,
    gaps,
    reviewer_packet: {
      jurisdiction,
      track,
      goal_relief: goal,
      key_facts: timeline.slice(0, 6).map((t) => `${t.date}: ${t.event}`),
      key_requests: [goal],
    },
    safety_flags,
  };
}

async function generateWithOpenAI(session: Session): Promise<Outputs> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackOutputs(session);

  const system = `
You are Pro-se Prime Outputs Generator.
Generate legal-information-only, non-advice outputs for a self-represented litigant.
Focus on:
- clarity, dates, relevance
- concise oral presentation
- evidence and gaps
DO NOT give legal advice, do not cite statutes/cases, do not predict outcomes.
Return ONLY valid JSON (no markdown) with this exact schema:

{
  "oral_script_2min": "string",
  "oral_outline_5min": "string",
  "timeline": [{"date":"string","event":"string"}],
  "evidence_checklist": ["string"],
  "gaps": ["string"],
  "reviewer_packet": {
    "jurisdiction":"string",
    "track":"string",
    "goal_relief":"string",
    "key_facts":["string"],
    "key_requests":["string"]
  },
  "safety_flags": ["string"]
}
`;

  const recent = session.conversation.slice(-12).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const input = `
Session context:
Jurisdiction=${session.jurisdiction || "unknown"}
MatterType=${session.matterType || "unknown"}
Track=${session.track || "unknown"}
Facts JSON=${JSON.stringify(session.facts || {})}

Conversation (recent):
${recent}

Generate the outputs.
Include "danger_possible_immediate_risk" in safety_flags if user suggests immediate danger/violence.
`;

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!resp.ok) return fallbackOutputs(session);

  const data = await resp.json();
  const text =
    data?.output_text ||
    data?.output?.[0]?.content?.[0]?.text ||
    data?.output?.[0]?.content?.[0]?.json ||
    "";

  try {
    const parsed = typeof text === "string" ? JSON.parse(text) : text;
    // Minimal validation/fallbacks:
    const out: Outputs = {
      oral_script_2min: String(parsed?.oral_script_2min || ""),
      oral_outline_5min: String(parsed?.oral_outline_5min || ""),
      timeline: Array.isArray(parsed?.timeline) ? parsed.timeline.map((x: any) => ({ date: String(x?.date || ""), event: String(x?.event || "") })) : [],
      evidence_checklist: Array.isArray(parsed?.evidence_checklist) ? parsed.evidence_checklist.map(String) : [],
      gaps: Array.isArray(parsed?.gaps) ? parsed.gaps.map(String) : [],
      reviewer_packet: {
        jurisdiction: String(parsed?.reviewer_packet?.jurisdiction || session.jurisdiction || "unknown"),
        track: String(parsed?.reviewer_packet?.track || session.track || "unknown"),
        goal_relief: String(parsed?.reviewer_packet?.goal_relief || session.facts?.goal_relief || "unknown"),
        key_facts: Array.isArray(parsed?.reviewer_packet?.key_facts) ? parsed.reviewer_packet.key_facts.map(String) : [],
        key_requests: Array.isArray(parsed?.reviewer_packet?.key_requests) ? parsed.reviewer_packet.key_requests.map(String) : [],
      },
      safety_flags: Array.isArray(parsed?.safety_flags) ? parsed.safety_flags.map(String) : [],
    };

    if (!out.oral_script_2min || !out.oral_outline_5min) return fallbackOutputs(session);
    return out;
  } catch {
    return fallbackOutputs(session);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
    }

    const store = getStore();
    const session = store.sessions.get(sessionId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found (server memory reset?)" }, { status: 404 });
    }

    const outputs = await generateWithOpenAI(session);

    return NextResponse.json({ ok: true, outputs });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error in /api/outputs" },
      { status: 500 }
    );
  }
}