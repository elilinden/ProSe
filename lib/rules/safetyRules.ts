// lib/rules/safetyRules.ts

export type SafetyAssessment = {
  level: "none" | "concern" | "urgent";
  flags: string[];
  userFacingMessage?: string; // if urgent, show this instead of normal coaching
};

const URGENT_PATTERNS: Array<{ re: RegExp; flag: string }> = [
  { re: /\b(kill myself|suicide|end my life|self[-\s]?harm)\b/i, flag: "self-harm" },
  { re: /\b(kill you|kill him|kill her|shoot|stab|hurt them)\b/i, flag: "harm-to-others" },
  { re: /\b(he has a gun|she has a gun|weapon|knife|i have a gun)\b/i, flag: "weapon-mention" },
  { re: /\b(i'm in danger|i am in danger|unsafe right now|he's outside|she's outside)\b/i, flag: "immediate-danger" },
];

const CONCERN_PATTERNS: Array<{ re: RegExp; flag: string }> = [
  { re: /\b(stalking|follow(ing)? me|tracking me)\b/i, flag: "stalking" },
  { re: /\b(threat(en|ening|s)?|blackmail)\b/i, flag: "threats" },
  { re: /\b(domestic violence|abuse(d)?|hit me|choked me|strangled)\b/i, flag: "dv-indicator" },
];

export function assessSafety(text: string): SafetyAssessment {
  const t = String(text || "");
  const flags: string[] = [];

  for (const p of URGENT_PATTERNS) {
    if (p.re.test(t)) flags.push(p.flag);
  }

  // urgent if any urgent patterns match
  if (flags.length > 0) {
    return {
      level: "urgent",
      flags,
      userFacingMessage: urgentMessage(),
    };
  }

  for (const p of CONCERN_PATTERNS) {
    if (p.re.test(t)) flags.push(p.flag);
  }

  if (flags.length > 0) {
    return {
      level: "concern",
      flags,
      userFacingMessage: undefined,
    };
  }

  return { level: "none", flags: [] };
}

export function urgentMessage(): string {
  // Keep it short and clear. No legal advice.
  return [
    "I’m concerned you may be in immediate danger.",
    "If you are in the U.S. and you feel unsafe right now, call 911.",
    "If you can’t call safely, try to get to a safe place and contact someone you trust or a local emergency service.",
    "If this is about self-harm, you can call or text 988 (Suicide & Crisis Lifeline in the U.S.).",
    "If you’re outside the U.S., contact your local emergency number or crisis hotline.",
    "",
    "If you want, tell me (1) whether you are safe right now, and (2) whether this is an emergency situation today.",
  ].join("\n");
}

/**
 * Merge new safety flags into existing.
 */
export function mergeSafetyFlags(existing: string[] | undefined, next: string[]): string[] {
  const set = new Set([...(existing || []), ...(next || [])].map((x) => x.trim()).filter(Boolean));
  return Array.from(set);
}