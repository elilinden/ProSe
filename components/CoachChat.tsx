"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import DisclaimerBanner from "./DisclaimerBanner";

type Role = "user" | "assistant";

type CoachReply = {
  assistant_message: string;
  next_questions: string[];
  extracted_facts: Record<string, any>;
  missing_fields: string[];
  progress_percent: number;
  safety_flags: string[];
};

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

const LS_KEY = "prose_prime_session_id";

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function CoachChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Array<{ role: Role; content: string; ts: number }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [nextQuestions, setNextQuestions] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [safetyFlags, setSafetyFlags] = useState<string[]>([]);
  const [meta, setMeta] = useState<{ jurisdiction?: string; track?: string }>({});

  const listRef = useRef<HTMLDivElement | null>(null);

  const danger = useMemo(() => safetyFlags.includes("danger_possible_immediate_risk"), [safetyFlags]);

  useEffect(() => {
    const id = localStorage.getItem(LS_KEY);
    setSessionId(id);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  async function send(text: string) {
    if (!sessionId) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);

    // optimistic user message
    const userMsg = { role: "user" as const, content: trimmed, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userMessage: trimmed }),
      });

      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error || "Coach failed");
      }

      const session: Session = data.session;
      const coach: CoachReply = data.coach;

      // Trust the server as source of truth for conversation:
      setMessages(session.conversation || []);

      setNextQuestions(Array.isArray(coach.next_questions) ? coach.next_questions : []);
      setProgress(Number.isFinite(coach.progress_percent) ? coach.progress_percent : null);
      setMissing(Array.isArray(coach.missing_fields) ? coach.missing_fields : []);
      setSafetyFlags(Array.isArray(coach.safety_flags) ? coach.safety_flags : []);

      setMeta({ jurisdiction: session.jurisdiction, track: session.track });
    } catch (e: any) {
      // add an assistant error bubble
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Something went wrong: ${e?.message || "unknown error"}. Try again.`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onQuickQuestion(q: string) {
    // Put it in input so user can customize; or auto-send:
    setInput(q);
  }

  const topBadges = useMemo(() => {
    const parts: string[] = [];
    if (meta.jurisdiction) parts.push(`Jurisdiction: ${meta.jurisdiction}`);
    if (meta.track) parts.push(`Track: ${meta.track}`);
    if (progress !== null) parts.push(`Progress: ${progress}%`);
    return parts;
  }, [meta.jurisdiction, meta.track, progress]);

  return (
    <div className="chatShell">
      {!sessionId && (
        <DisclaimerBanner variant="warning" title="No session yet">
          It looks like you don’t have a session ID saved. Go to <b>/intake</b> first to start a session.
        </DisclaimerBanner>
      )}

      {danger && (
        <DisclaimerBanner variant="danger" title="Possible immediate danger">
          If you are in immediate danger or fear for your safety, call local emergency services right now.
          If it’s safe, consider reaching out to a trusted person or local support resources.
        </DisclaimerBanner>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h2">Coach</div>
            <div className="small">
              Focus on dates, what happened, and what you want the judge to do. Short sentences are best.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {topBadges.map((b) => (
              <span key={b} className="badge">{b}</span>
            ))}
          </div>
        </div>

        {missing.length > 0 && (
          <div style={{ marginTop: 10 }} className="small">
            <b>Still missing:</b> {missing.join(", ")}
          </div>
        )}

        <div style={{ marginTop: 12 }} className="chatMessages" ref={listRef}>
          {messages.length === 0 && (
            <div className="small">
              Start by telling me: what happened, what you want the judge to do, and the top 3 events (with dates).
            </div>
          )}

          {messages.map((m, idx) => (
            <div key={idx} className="msg">
              <div className="msgMeta">
                {m.role === "user" ? "You" : "Pro-se Prime"} · {formatTime(m.ts)}
              </div>
              <div className={`bubble ${m.role === "user" ? "bubbleUser" : "bubbleAssistant"}`}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg">
              <div className="msgMeta">Pro-se Prime</div>
              <div className="bubble bubbleAssistant">Thinking…</div>
            </div>
          )}
        </div>

        {nextQuestions.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="small" style={{ marginBottom: 8 }}>
              <b>Suggested next questions (click to paste):</b>
            </div>
            <div className="quickQs">
              {nextQuestions.slice(0, 6).map((q) => (
                <button key={q} className="quickQ" onClick={() => onQuickQuestion(q)} type="button">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="hr" />

        <div style={{ display: "grid", gap: 10 }}>
          <textarea
            className="textarea"
            placeholder="Type your answer here…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!sessionId || loading}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={() => void send(input)}
              disabled={!sessionId || loading || !input.trim()}
              type="button"
            >
              Send
            </button>

            <button
              className="btn"
              onClick={() => setInput("")}
              disabled={!sessionId || loading || !input}
              type="button"
            >
              Clear
            </button>
          </div>

          <div className="small">
            Tip: include dates (or approximate dates), specific quotes, and what proof you have (texts, photos, witnesses).
          </div>
        </div>
      </div>

      <DisclaimerBanner />
    </div>
  );
}