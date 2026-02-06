"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CoachChat from "../../components/CoachChat";

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

const LS_KEY = "prose_prime_session_id";

async function fetchSession(sessionId: string): Promise<Session> {
  const res = await fetch(`/api/session?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Failed to load session");
  return data.session as Session;
}

async function sendToCoach(sessionId: string, userMessage: string): Promise<{ session: Session; coach: CoachReply }> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, userMessage }),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Coach request failed");
  return { session: data.session as Session, coach: data.coach as CoachReply };
}

function hasMeaningfulIntakeFacts(facts: Record<string, any> | undefined | null): boolean {
  if (!facts) return false;

  const goal = String(facts.goal_relief ?? "").trim();
  const people = String(facts.people ?? "").trim();
  const keyEvents = String(facts.key_events ?? "").trim();
  const evidence = String(facts.evidence ?? "").trim();

  const timeline = facts.timeline;
  const hasTimeline =
    Array.isArray(timeline) && timeline.some((x) => x && (String(x.date ?? x.when ?? "").trim() || String(x.event ?? x.what ?? "").trim()));

  // If any of these exist, we treat intake as present and DO NOT auto-nudge.
  return Boolean(goal || people || keyEvents || evidence || hasTimeline);
}

export default function CoachPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent accidental double-seeding (React strict mode + navigation quirks).
  const didAutoSeedRef = useRef(false);

  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_KEY);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setError(null);
        setLoading(true);

        if (!sessionId) {
          throw new Error("No session found. Start at Intake to create one.");
        }

        const s = await fetchSession(sessionId);
        if (!mounted) return;

        setSession(s);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load Coach.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    // Auto-seed ONLY when:
    // - session exists
    // - conversation is empty
    // - there are NO meaningful intake facts
    // This prevents overwriting Intake-seeded context with a generic message.
    async function maybeAutoSeed() {
      if (!sessionId) return;
      if (!session) return;
      if (didAutoSeedRef.current) return;

      const convLen = session.conversation?.length ?? 0;
      if (convLen > 0) return;

      const hasIntake = hasMeaningfulIntakeFacts(session.facts);
      if (hasIntake) {
        // Do not write anything into conversation. Let the user continue normally.
        return;
      }

      didAutoSeedRef.current = true;
      setSeeding(true);
      try {
        const nudge =
          "Tell me what you’re going to court about and what you want the judge to do. " +
          "Then list 3–6 key events in date order and what evidence you have.";
        const { session: updated } = await sendToCoach(sessionId, nudge);
        setSession(updated);
      } catch (e: any) {
        setError(e?.message || "Failed to start coaching.");
      } finally {
        setSeeding(false);
      }
    }

    void maybeAutoSeed();
  }, [session, sessionId]);

  if (loading) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Coach</h1>
        <p style={styles.muted}>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.main}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.h1}>Coach</h1>
            <p style={styles.muted}>AI-assisted organization (not legal advice).</p>
          </div>
          <div style={styles.headerActions}>
            <Link href="/intake" style={styles.linkBtn}>Intake</Link>
            <Link href="/outputs" style={styles.linkBtn}>Outputs</Link>
            <Link href="/review" style={styles.linkBtn}>Review</Link>
          </div>
        </div>

        <div style={styles.errorBox}>{error}</div>
      </main>
    );
  }

  if (!sessionId || !session) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Coach</h1>
        <p style={styles.muted}>No session found.</p>
        <Link href="/intake" style={styles.linkBtn}>Go to Intake</Link>
      </main>
    );
  }

  const intakeDetected = hasMeaningfulIntakeFacts(session.facts);
  const conversationEmpty = (session.conversation?.length ?? 0) === 0;

  return (
    <main style={styles.main}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Coach</h1>
          <p style={styles.muted}>Guided questions to help you organize facts for court. Not legal advice.</p>
          {seeding && <p style={styles.muted}>Starting…</p>}
          {conversationEmpty && intakeDetected && (
            <div style={styles.infoBox}>
              I saved your intake. Ask me what you want help with first (for example: “turn my events into a timeline” or
              “help me prepare a 2-minute script”).
            </div>
          )}
        </div>
        <div style={styles.headerActions}>
          <Link href="/intake" style={styles.linkBtn}>Intake</Link>
          <Link href="/outputs" style={styles.linkBtn}>Outputs</Link>
          <Link href="/review" style={styles.linkBtn}>Review</Link>
        </div>
      </div>

      <CoachChat
        sessionId={sessionId}
        session={session}
        onSessionUpdate={setSession}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  h1: { fontSize: 28, margin: 0 },
  muted: { margin: "6px 0 0", opacity: 0.7, lineHeight: 1.4 },
  linkBtn: {
    display: "inline-block",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    textDecoration: "none",
    color: "#111827",
    fontWeight: 700,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#7f1d1d",
    marginBottom: 12,
    fontWeight: 700,
  },
  infoBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e3a8a",
    fontWeight: 650,
    lineHeight: 1.45,
  },
};
