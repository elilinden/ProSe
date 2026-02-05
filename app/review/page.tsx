"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Role = "user" | "assistant";

type Session = {
  id: string;
  createdAt: number;
  updatedAt: number;
  jurisdiction?: string;
  matterType?: string;
  track?: string;
  facts: Record<string, unknown>;
  conversation: Array<{ role: Role; content: string; ts: number }>;
};

const LS_KEY = "prose_prime_session_id";

async function loadSession(sessionId: string): Promise<Session> {
  const res = await fetch(`/api/session?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Failed to load session");
  return data.session as Session;
}

// Client-side gap check (simple MVP version)
function computeGaps(session: Session): string[] {
  const f = session.facts ?? {};
  const gaps: string[] = [];

  if (!session.jurisdiction) gaps.push("Jurisdiction not set");
  if (!session.track) gaps.push("Track not set (ex: order_of_protection)");

  if (!("goal_relief" in f)) gaps.push("What you’re asking the judge for (goal/relief)");
  if (!("people" in f)) gaps.push("Who is involved (people + relationship)");
  if (!("key_events" in f) && !("timeline" in f)) gaps.push("Key events in date order (timeline)");
  if (!("evidence" in f)) gaps.push("Evidence you have (texts, photos, witnesses, documents)");

  return gaps;
}

export default function ReviewPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const gaps = useMemo(() => (session ? computeGaps(session) : []), [session]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const id = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
        if (!id) throw new Error("No session found. Go to Coach to start.");

        const s = await loadSession(id);
        setSession(s);
      } catch (e: any) {
        setError(e?.message || "Failed to load review.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Review</h1>
        <p style={styles.muted}>Loading…</p>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Review</h1>
        <div style={styles.errorBox}>{error || "Missing session."}</div>
        <Link href="/coach" style={styles.linkBtn}>
          Go to Coach
        </Link>
      </main>
    );
  }

  const factsJson = JSON.stringify(session.facts ?? {}, null, 2);

  return (
    <main style={styles.main}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Review</h1>
          <p style={styles.muted}>
            Check what the tool captured. Fix gaps before generating your oral argument script.
          </p>
        </div>
        <div style={styles.headerActions}>
          <Link href="/coach" style={styles.linkBtn}>
            Coach
          </Link>
          <Link href="/outputs" style={styles.linkBtn}>
            Outputs
          </Link>
        </div>
      </div>

      <div style={styles.metaRow}>
        {session.jurisdiction && <div style={styles.badge}>Jurisdiction: {session.jurisdiction}</div>}
        {session.track && <div style={styles.badge}>Track: {session.track}</div>}
        {session.matterType && <div style={styles.badge}>Matter: {session.matterType}</div>}
      </div>

      <section style={styles.card}>
        <h2 style={styles.h2}>Gaps to Fill</h2>
        {gaps.length === 0 ? (
          <p style={styles.goodText}>Looks good — you have the basics needed for outputs.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {gaps.map((g, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {g}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <Link href="/coach" style={styles.secondaryBtn}>
            Go back to Coach to fill gaps
          </Link>
          <Link href="/outputs" style={styles.secondaryBtn}>
            Generate outputs anyway
          </Link>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Captured Facts (JSON)</h2>
        <p style={styles.muted}>
          For MVP debugging: this is what your backend currently has stored for the case state.
        </p>
        <pre style={styles.pre}>{factsJson}</pre>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Recent Conversation</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {session.conversation.slice(-12).map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <div key={idx} style={isUser ? styles.userBubble : styles.assistantBubble}>
                <div style={styles.roleLabel}>{isUser ? "You" : "Coach"}</div>
                <div style={styles.bubbleText}>{m.content}</div>
              </div>
            );
          })}
          {session.conversation.length === 0 && <p style={styles.muted}>No messages yet.</p>}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 },
  headerActions: { display: "flex", gap: 10 },
  h1: { fontSize: 28, margin: 0 },
  h2: { fontSize: 18, margin: "0 0 8px" },
  muted: { margin: "6px 0 0", opacity: 0.7, lineHeight: 1.4 },
  metaRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.85,
  },
  card: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginBottom: 14, background: "#fff" },
  pre: {
    margin: 0,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    overflowX: "auto",
    fontSize: 12,
    lineHeight: 1.45,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#7f1d1d",
    marginBottom: 12,
    fontWeight: 600,
  },
  goodText: { color: "#065f46", fontWeight: 700, margin: 0 },
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
  secondaryBtn: {
    display: "inline-block",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    textDecoration: "none",
    color: "#111827",
    fontWeight: 600,
  },
  userBubble: {
    maxWidth: "78%",
    marginLeft: "auto",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
  },
  assistantBubble: {
    maxWidth: "78%",
    marginRight: "auto",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
  },
  roleLabel: { fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6 },
  bubbleText: { whiteSpace: "pre-wrap", lineHeight: 1.45 },
};
