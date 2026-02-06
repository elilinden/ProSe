// app/api/outputs/route.ts
import { NextResponse } from "next/server";
import { assessSafety } from "../../../lib/rules/safetyRules";
import { requireSession, saveOutputs } from "../../../lib/storage/memoryStore";
import type { SessionRecord } from "../../../lib/storage/sessionTypes";

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
  if (assessment.level === "urgent") return ["danger_possible_immediate_risk", ...assessment.flags];
  return assessment.flags;
}

function lastUserText(session: SessionRecord): string {
  const msgs = session.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user") return msgs[i].content;
  }
  return "";
}

function normalizeTimeline(facts: any): Array<{ date: string; event: string }> {
  const timeline: Array<{ date: string; event: string }> = [];
  if (Array.isArray(facts?.timeline)) {
    for (const item of facts.timeline) {
      if (item && typeof item === "object") {
        timeline.push({
          date: String(item.date || item.when || "Unknown date"),
          event: String(item.event || item.what || "Event"),
        });
      }
    }
  }
  return timeline;
}

function fallbackOutputs(session: SessionRecord): Outputs {
  const f: any = session.facts || {};
  const jurisdiction = session.jurisdiction || f.jurisdiction || "New York";
  const track = session.track || f.track || "unknown";
  const goal = f.goal_relief || "Not specified yet.";

  const safety_flags = safetyFlagsFromText(lastUserText(session));

  let timeline = normalizeTimeline(f);
  const rawEvents = f.key_events || f.user_story || "";

  if (timeline.length === 0 && typeof rawEvents === "string" && rawEvents.trim()) {
    const lines = rawEvents
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean)
      .slice(0, 8);
    for (const line of lines) {
      timeline.push({ date: "Unknown/approx", event: line.replace(/^-+\s*/, "") });
    }
  }

  const evidenceList: string[] = Array.isArray(f.evidence)
    ? f.evidence.map(String)
    : [
        "Texts / messages (screenshots)",
        "Call logs / voicemails",
        "Photos / videos",
        "Witness names + what they saw",
        "Police / medical / shelter records (if any)",
        "Court orders / prior filings (if any)",
      ];

  const gaps: string[] = [];
  if (!f.goal_relief) gaps.push("Clarify exactly what you want the judge to do (specific relief).");
  if (!f.timeline && !f.user_story) gaps.push("Add 3–6 key events in date order (include dates or approximate dates).");
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
    `I can support this with evidence such as: ${Array.isArray(f.evidence) ? "documents and witnesses" : "texts, photos, and records"}.\n` +
    `Based on these facts, I respectfully request: ${goal}.\n`;

  const oral_outline_5min =
    `1) What I’m asking for (relief)\n` +
    `   - ${goal}\n\n` +
    `2) Key people / relationship\n` +
    `   - [List parties and relationship]\n\n` +
    `3) Key events (date order)\n` +
    (timeline.length
      ? timeline.map((t, idx) => `   ${idx + 1}. ${t.date}: ${t.event}`).join("\n")
      : `   - [Add 3–6 events with dates]\n`) +
    `\n\n4) Why this matters to the Court\n` +
    `   - [Connect the most serious facts to why the Court should grant the relief]\n\n` +
    `5) Evidence\n` +
    evidenceList.map((x) => `   - ${x}`).join("\n") +
    `\n\n6) Closing\n` +
    `   - Restate request: ${goal}\n` +
    `   - Ask for next steps the Court wants\n`;

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

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function coerceOutputs(parsed: any, session: SessionRecord): Outputs | null {
  if (!parsed || typeof parsed !== "object") return null;

  const out: Outputs = {
    oral_script_2min: String(parsed.oral_script_2min || ""),
    oral_outline_5min: String(parsed.oral_outline_5min || ""),
    timeline: Array.isArray(parsed.timeline)
      ? parsed.timeline.map((x: any) => ({
          date: String(x?.date || ""),
          event: String(x?.event || ""),
        }))
      : [],
    evidence_checklist: Array.isArray(parsed.evidence_checklist) ? parsed.evidence_checklist.map(String) : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
    reviewer_packet: {
      jurisdiction: String(parsed?.reviewer_packet?.jurisdiction || session.jurisdiction || "unknown"),
      track: String(parsed?.reviewer_packet?.track || session.track || "unknown"),
      goal_relief: String(parsed?.reviewer_packet?.goal_relief || (session.facts as any)?.goal_relief || "unknown"),
      key_facts: Array.isArray(parsed?.reviewer_packet?.key_facts) ? parsed.reviewer_packet.key_facts.map(String) : [],
      key_requests: Array.isArray(parsed?.reviewer_packet?.key_requests) ? parsed.reviewer_packet.key_requests.map(String) : [],
    },
    safety_flags: Array.isArray(parsed.safety_flags) ? parsed.safety_flags.map(String) : [],
  };

  if (!out.oral_script_2min.trim() || !out.oral_outline_5min.trim()) return null;
  return out;
}

async function generateWithOpenAI(session: SessionRecord): Promise<Outputs> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackOutputs(session);

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const system = [
    "You are Pro-se Prime Outputs Generator.",
    "Generate legal-information-only, non-advice outputs for a self-represented litigant.",
    "Focus on clarity, dates, relevance, and concise oral presentation.",
    "DO NOT give legal advice, do not cite statutes/cases, do not predict outcomes.",
    "Return ONLY valid JSON (no markdown) matching this schema exactly:",
    "",
    "{",
    '  "oral_script_2min": "string",',
    '  "oral_outline_5min": "string",',
    '  "timeline": [{"date":"string","event":"string"}],',
    '  "evidence_checklist": ["string"],',
    '  "gaps": ["string"],',
    '  "reviewer_packet": {',
    '    "jurisdiction":"string",',
    '    "track":"string",',
    '    "goal_relief":"string",',
    '    "key_facts":["string"],',
    '    "key_requests":["string"]',
    "  },",
    '  "safety_flags": ["string"]',
    "}",
  ].join("\n");

  const recent = (session.messages || [])
    .slice(-12)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const input = [
    `Session context:`,
    `Jurisdiction=${session.jurisdiction || "unknown"}`,
    `Track=${session.track || "unknown"}`,
    `Facts JSON=${JSON.stringify(session.facts || {})}`,
    "",
    "Conversation (recent):",
    recent || "(none)",
    "",
    'Include "danger_possible_immediate_risk" in safety_flags if the user suggests immediate danger/violence.',
    "Generate the outputs now.",
  ].join("\n");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) return fallbackOutputs(session);

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") return fallbackOutputs(session);

  const parsed = safeJsonParse(text);
  const coerced = coerceOutputs(parsed, session);
  return coerced ?? fallbackOutputs(session);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
    }

    const session = requireSession(sessionId);

    // cache hit (optional): if you want to always regenerate, remove this block
    if (session.outputs?.payload) {
      return NextResponse.json({ ok: true, outputs: session.outputs.payload });
    }

    const outputs = await generateWithOpenAI(session);

    // store in memory so the Outputs page can refresh without regenerating
    saveOutputs({ sessionId, outputs });

    return NextResponse.json({ ok: true, outputs });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error in /api/outputs" },
      { status: 500 }
    );
  }
}
