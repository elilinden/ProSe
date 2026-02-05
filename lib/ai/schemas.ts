// lib/ai/schemas.ts
// Lightweight runtime validation / normalization (no zod dependency)

export type CoachResult = {
  assistant_message: string;
  next_questions: string[];
  facts_extracted: {
    goal_relief?: string;
    key_people?: string[];
    key_dates?: string[];
    timeline?: { date: string; event: string }[];
    evidence?: string[];
    safety_flags?: string[];
    [k: string]: any;
  };
};

export type Outputs = {
  two_minute_script: string;
  five_minute_outline: string[];
  key_facts_bullets: string[];
  evidence_checklist: string[];
  gaps_to_fill: string[];
  next_steps_process: string[];
  disclaimer: string;
};

function isObj(v: any): v is Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v);
}

function str(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function strArray(v: any, max = 50): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

function timelineArray(v: any, max = 50): { date: string; event: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { date: string; event: string }[] = [];
  for (const item of v.slice(0, max)) {
    if (!isObj(item)) continue;
    const d = str(item.date).trim();
    const e = str(item.event).trim();
    if (!d && !e) continue;
    out.push({ date: d, event: e });
  }
  return out;
}

export function normalizeCoachResult(raw: any): CoachResult {
  const assistant_message = str(raw?.assistant_message, "Thanks — I have a few follow-up questions.");
  const next_questions = strArray(raw?.next_questions, 8);

  const factsRaw = isObj(raw?.facts_extracted) ? raw.facts_extracted : {};
  const facts_extracted: CoachResult["facts_extracted"] = {
    ...factsRaw,
  };

  // normalize common keys
  if (factsRaw.goal_relief !== undefined) facts_extracted.goal_relief = str(factsRaw.goal_relief);
  if (factsRaw.key_people !== undefined) facts_extracted.key_people = strArray(factsRaw.key_people, 25);
  if (factsRaw.key_dates !== undefined) facts_extracted.key_dates = strArray(factsRaw.key_dates, 25);
  if (factsRaw.timeline !== undefined) facts_extracted.timeline = timelineArray(factsRaw.timeline, 60);
  if (factsRaw.evidence !== undefined) facts_extracted.evidence = strArray(factsRaw.evidence, 30);
  if (factsRaw.safety_flags !== undefined) facts_extracted.safety_flags = strArray(factsRaw.safety_flags, 10);

  return { assistant_message, next_questions, facts_extracted };
}

export function normalizeOutputs(raw: any, fallbackDisclaimer: string): Outputs {
  const out: Outputs = {
    two_minute_script: str(raw?.two_minute_script),
    five_minute_outline: strArray(raw?.five_minute_outline, 16),
    key_facts_bullets: strArray(raw?.key_facts_bullets, 20),
    evidence_checklist: strArray(raw?.evidence_checklist, 20),
    gaps_to_fill: strArray(raw?.gaps_to_fill, 20),
    next_steps_process: strArray(raw?.next_steps_process, 20),
    disclaimer: str(raw?.disclaimer, fallbackDisclaimer),
  };

  if (!out.disclaimer || out.disclaimer.trim().length < 10) out.disclaimer = fallbackDisclaimer;

  return out;
}