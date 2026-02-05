// lib/rules/gapRules.ts

export type TimelineItem = { date: string; event: string };

export type FactsShape = {
  jurisdiction?: string;
  track?: string;

  // goal / relief
  goal_relief?: string;

  // participants
  key_people?: string[];

  // dates / timeline
  key_dates?: string[];
  timeline?: TimelineItem[];

  // evidence
  evidence?: string[];

  // any additional intake fields your app stores
  incidents?: any[];
  user_story?: string;
};

function hasText(s?: string) {
  return !!s && s.trim().length > 0;
}

function uniq(items: string[]) {
  return Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
}

export function computeGaps(facts: FactsShape): string[] {
  const gaps: string[] = [];

  // Core “court-ready” basics
  if (!hasText(facts.goal_relief)) gaps.push("What exactly are you asking the court to do (your requested outcome/relief)?");

  const people = facts.key_people || [];
  if (people.length === 0) gaps.push("Who are the key people involved (full names if possible) and what is each person’s role?");

  const timeline = facts.timeline || [];
  if (timeline.length === 0) {
    gaps.push("A basic timeline: key dates in order with what happened on each date.");
  } else {
    // check timeline quality
    const anyMissingEvent = timeline.some((t) => !hasText(t.event));
    if (anyMissingEvent) gaps.push("Some timeline entries are missing the event description (what happened).");

    const anyMissingDate = timeline.some((t) => !hasText(t.date));
    if (anyMissingDate) gaps.push("Some timeline entries are missing dates (approximate dates are okay).");
  }

  // Evidence basics (not required for every matter, but very helpful)
  const evidence = facts.evidence || [];
  if (evidence.length === 0) {
    gaps.push("Any supporting evidence you may have (texts, emails, photos, screenshots, witnesses, receipts, records).");
  }

  // Track-specific “high impact” gaps (kept general — not legal advice)
  const track = (facts.track || "").toLowerCase();

  if (track.includes("protection") || track.includes("dv") || track.includes("abuse") || track.includes("pfa")) {
    gaps.push(
      "For each incident: what was said/done, where it happened, when it happened, and whether there were witnesses or records (texts, photos, medical/police reports)."
    );
    gaps.push("Any current safety concerns or urgency (immediate danger, threats, stalking, access to weapons).");
  }

  if (track.includes("custody") || track.includes("visitation")) {
    gaps.push("What is the current custody/visitation arrangement (if any), and what change are you asking for?");
    gaps.push("Concrete examples supporting why the change is needed (dates, behaviors, impacts on the child).");
  }

  if (track.includes("landlord") || track.includes("tenant") || track.includes("housing")) {
    gaps.push("Address of the property and the key events (lease start, notices, repair requests, payments, court dates).");
    gaps.push("Documents you have: lease, notices, rent ledger, repair requests, photos, inspection reports, communications.");
  }

  // Optional: narrative gap
  if (!hasText(facts.user_story) && (timeline?.length ?? 0) < 2) {
    gaps.push("A short summary of what happened (3–6 sentences) so the story is clear even without details.");
  }

  return uniq(gaps);
}