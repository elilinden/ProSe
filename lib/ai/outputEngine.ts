import { openai, getModel, requireApiKey } from "./client";
import { outputsSystemPrompt, buildOutputsUserPrompt, DISCLAIMER_SHORT } from "./prompts";

export type Outputs = {
  two_minute_script: string;
  five_minute_outline: string[];
  key_facts_bullets: string[];
  evidence_checklist: string[];
  gaps_to_fill: string[];
  next_steps_process: string[];
  disclaimer: string;
};

function asStringArray(v: any, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim().length > 0).slice(0, max);
}

export async function generateOutputs(params: {
  jurisdiction: string;
  track: string;
  existingFacts: any;
  conversationSummary?: string;
}): Promise<Outputs> {
  requireApiKey();

  const system = outputsSystemPrompt({ jurisdiction: params.jurisdiction, track: params.track });
  const user = buildOutputsUserPrompt({
    existingFacts: params.existingFacts,
    conversationSummary: params.conversationSummary,
  });

  const model = getModel();

  const resp = await openai.responses.create({
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: { format: { type: "json_object" } },
  });

  const text = resp.output_text;
  if (!text) throw new Error("AI returned empty response.");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI returned non-JSON. Try again.");
  }

  const out: Outputs = {
    two_minute_script: typeof parsed.two_minute_script === "string" ? parsed.two_minute_script : "",
    five_minute_outline: asStringArray(parsed.five_minute_outline, 16),
    key_facts_bullets: asStringArray(parsed.key_facts_bullets, 20),
    evidence_checklist: asStringArray(parsed.evidence_checklist, 20),
    gaps_to_fill: asStringArray(parsed.gaps_to_fill, 20),
    next_steps_process: asStringArray(parsed.next_steps_process, 20),
    disclaimer: typeof parsed.disclaimer === "string" ? parsed.disclaimer : DISCLAIMER_SHORT,
  };

  // Hard guarantee disclaimer exists
  if (!out.disclaimer || out.disclaimer.trim().length < 10) out.disclaimer = DISCLAIMER_SHORT;

  return out;
}