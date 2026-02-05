"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

type CoachReply = {
  assistant_message: string;
  next_questions: string[];
  extracted_facts: Record<string, unknown>;
  missing_fields: string[];
  progress_percent: number;
  safety_flags: string[];
};

const LS_KEY = "prose_prime_session_id";

async function createSession(): Promise<Session> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Defaults: NY / family / order_of_protection
    body: JSON.stringify({ jurisdiction: "NY", matterType: "family", track: "order_of_protection" }),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Failed to create session");
  return data.session as Session;
}

async function loadSession(sessionId: string): Promise<Session> {
  const res = await fetch(`/api/session?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Failed to load session");
  return data.session as Session;
}

export default function CoachPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [lastCoach, setLastCoach] = useState<CoachReply | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const conversation = session?.conversation ?? [];

  const progressLabel = useMemo(() => {
    if (!lastCoach) return "Not started";
    const pct = Math.round(lastCoach.progress_percent ?? 0);
    if (pct >= 85) return "Almost ready";
    if (pct >= 60) return "Good progress";
    if (pct >= 30) return "Getting started";
    return "Just beginning";
  }, [lastCoach]);

  useEffect(() => {
    (async () => {
      try {
        setBooting(true);
        setError(null);

        const existingId = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;

        let s: Session | null = null;

        if (existingId) {
          try {
            s = await loadSession(existingId);
          } catch {
            // If the in-memory store was reset (server restart), create a new session
            localStorage.removeItem(LS_KEY);
            s = null;
          }
        }

        if (!s) {
          s = await createSession();
          localStorage.setItem(LS_KEY, s.id);
        }

        setSession(s);

        // Nudge the user with a first “assistant” message if convo is empty
        if (!s.conversation?.length) {
          setLastCoach({
            assistant_message:
              "Tell me what you’re going to court about. Start with: what you want the judge to do, and the 1–3 most important events (with dates or approximate dates).",
            next_questions: [
              "What result are you asking the judge for?",
              "What are the 1–3 most important events (with dates or approximate dates)?",
              "What proof do you have (texts, emails, photos, witnesses, records)?",
            ],
            extracted_facts: {},
            missing_fields: [],
            progress_percent: 10,
            safety_flags: [],
          });
        }
      } catch (e: any) {
        setError(e?.message || "Something went wrong while starting your session.");
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    // Scroll to bottom when conversation changes
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length, lastCoach?.assistant_message]);

  async function sendMessage() {
    if (!session) return;
    const msg = input.trim();
    if (!msg) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, userMessage: msg }),
      });

      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Coach request failed");

      setSession(data.session as Session);
      setLastCoach(data.coach as CoachReply);
      setInput("");
    } catch (e: any) {
      setError(e?.message || "Failed to send message.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  const safetyFlags = lastCoach?.safety_flags ?? [];
  const showSafetyBanner = safetyFlags.some((f) => String(f).toLowerCase().includes("danger"));

  if (booting) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Pro-se Prime | Coach</h1>
          <p style={styles.muted}>Starting your session…</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Pro-se Prime | Coach</h1>
          <p style={styles.muted}>
            This tool helps organize facts and prep an oral summary. It is <b>not</b> legal advice.
          </p>
        </div>
        <div style={styles.headerActions}>
          <Link href="/review" style={styles.linkBtn}>
            Review
          </Link>
          <Link href="/outputs" style={styles.linkBtn}>
            Outputs
          </Link>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {showSafetyBanner && (
        <div style={styles.warnBox}>
          If you are in immediate danger, call emergency services now. If you’re safe, you can continue here.
        </div>
      )}

      <div style={styles.metaRow}>
        <div style={styles.badge}>Progress: {progressLabel}</div>
        {session?.jurisdiction && <div style={styles.badge}>Jurisdiction: {session.jurisdiction}</div>}
        {session?.track && <div style={styles.badge}>Track: {session.track}</div>}
      </div>

      <div style={styles.chatCard}>
        <div style={styles.chatLog}>
          {conversation.length === 0 && (
            <div style={styles.assistantBubble}>
              <div style={styles.roleLabel}>Coach</div>
              <div style={styles.bubbleText}>
                {lastCoach?.assistant_message ||
                  "Tell me what you’re going to court about. Start with what you want the judge to do."}
              </div>
            </div>
          )}

          {conversation.map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <div key={idx} style={isUser ? styles.userBubble : styles.assistantBubble}>
                <div style={styles.roleLabel}>{isUser ? "You" : "Coach"}</div>
                <div style={styles.bubbleText}>{m.content}</div>
              </div>
            );
          })}

          {/* Show suggested follow-ups after the last AI response */}
          {lastCoach?.next_questions?.length ? (
            <div style={styles.suggestionsBox}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Suggested follow-ups</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {lastCoach.next_questions.map((q, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <div style={styles.inputRow}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your answer… (press Enter)"
            style={styles.input}
            disabled={loading || !session}
          />
          <button onClick={() => void sendMessage()} style={styles.button} disabled={loading || !session}>
            {loading ? "Sending…" : "Send"}
          </button>
        </div>

        <div style={styles.footerRow}>
          <button
            style={styles.secondaryBtn}
            onClick={() => router.push("/review")}
            disabled={!session}
            title="Review your captured facts and gaps"
          >
            Go to Review
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => router.push("/outputs")}
            disabled={!session}
            title="Generate your 2-minute script and outline"
          >
            Generate Outputs
          </button>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 },
  headerActions: { display: "flex", gap: 10 },
  h1: { fontSize: 28, margin: 0 },
  muted: { margin: "6px 0 0", opacity: 0.7, lineHeight: 1.4 },
  card: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 },
  chatCard: { border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" },
  chatLog: { padding: 16, background: "#fafafa", minHeight: 420 },
  userBubble: {
    maxWidth: "78%",
    marginLeft: "auto",
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
  },
  assistantBubble: {
    maxWidth: "78%",
    marginRight: "auto",
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
  },
  roleLabel: { fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 6 },
  bubbleText: { whiteSpace: "pre-wrap", lineHeight: 1.45 },
  suggestionsBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "1px dashed #d1d5db",
    background: "#ffffff",
  },
  inputRow: { display: "flex", gap: 10, padding: 12, borderTop: "1px solid #e5e7eb", background: "#fff" },
  input: { flex: 1, padding: "12px 12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 14 },
  button: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  footerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
  },
  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
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
  errorBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#7f1d1d",
    marginBottom: 12,
    fontWeight: 600,
  },
  warnBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#92400e",
    marginBottom: 12,
    fontWeight: 600,
  },
};
