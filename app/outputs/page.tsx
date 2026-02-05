"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type Outputs = {
  two_minute_script: string;
  five_minute_outline: string[];
  key_facts_bullets: string[];
  evidence_checklist: string[];
  gaps_to_fill: string[];
  next_steps_process: string[];
  disclaimer: string;
};

const LS_KEY = "prose_prime_session_id";

async function generateOutputs(sessionId: string): Promise<Outputs> {
  const res = await fetch("/api/outputs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Failed to generate outputs");
  return data.outputs as Outputs;
}

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<Outputs | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenLoading, setRegenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runGenerate(isRegen: boolean) {
    try {
      setError(null);
      if (isRegen) setRegenLoading(true);
      else setLoading(true);

      const id = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      if (!id) throw new Error("No session found. Go to Coach to start.");

      const out = await generateOutputs(id);
      setOutputs(out);
    } catch (e: any) {
      setError(e?.message || "Failed to generate outputs.");
    } finally {
      setLoading(false);
      setRegenLoading(false);
    }
  }

  useEffect(() => {
    void runGenerate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyAll() {
    if (!outputs) return;
    const text = [
      "2-Minute Script",
      outputs.two_minute_script,
      "",
      "5-Minute Outline",
      ...outputs.five_minute_outline.map((x) => `- ${x}`),
      "",
      "Key Facts",
      ...outputs.key_facts_bullets.map((x) => `- ${x}`),
      "",
      "Evidence Checklist",
      ...outputs.evidence_checklist.map((x) => `- ${x}`),
      "",
      "Gaps To Fill",
      ...outputs.gaps_to_fill.map((x) => `- ${x}`),
      "",
      "Next Steps (General)",
      ...outputs.next_steps_process.map((x) => `- ${x}`),
      "",
      outputs.disclaimer,
    ].join("\n");

    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (loading) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Outputs</h1>
        <p style={styles.muted}>Generating…</p>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Outputs</h1>
          <p style={styles.muted}>2-minute script, 5-minute outline, evidence checklist, and gaps.</p>
        </div>
        <div style={styles.headerActions}>
          <Link href="/coach" style={styles.linkBtn}>
            Coach
          </Link>
          <Link href="/review" style={styles.linkBtn}>
            Review
          </Link>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button style={styles.secondaryBtn} onClick={() => void runGenerate(true)} disabled={regenLoading}>
          {regenLoading ? "Regenerating…" : "Regenerate"}
        </button>
        <button style={styles.secondaryBtn} onClick={copyAll} disabled={!outputs}>
          Copy all
        </button>
      </div>

      {!outputs ? (
        <p style={styles.muted}>No outputs yet.</p>
      ) : (
        <>
          <section style={styles.card}>
            <h2 style={styles.h2}>2-Minute Oral Script</h2>
            <pre style={styles.pre}>{outputs.two_minute_script}</pre>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>5-Minute Oral Outline</h2>
            <ul style={styles.ul}>
              {outputs.five_minute_outline.map((x, i) => (
                <li key={i} style={styles.li}>
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Key Facts</h2>
            <ul style={styles.ul}>
              {outputs.key_facts_bullets.map((x, i) => (
                <li key={i} style={styles.li}>
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Evidence Checklist</h2>
            <ul style={styles.ul}>
              {outputs.evidence_checklist.map((x, i) => (
                <li key={i} style={styles.li}>
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Gaps to Fill</h2>
            {outputs.gaps_to_fill.length === 0 ? (
              <p style={styles.goodText}>No major gaps flagged.</p>
            ) : (
              <ul style={styles.ul}>
                {outputs.gaps_to_fill.map((x, i) => (
                  <li key={i} style={styles.li}>
                    {x}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Next Steps (General)</h2>
            <ul style={styles.ul}>
              {outputs.next_steps_process.map((x, i) => (
                <li key={i} style={styles.li}>
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section style={styles.disclaimerCard}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Disclaimer</div>
            <div style={{ opacity: 0.9, lineHeight: 1.45 }}>{outputs.disclaimer}</div>
          </section>
        </>
      )}
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
  card: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginBottom: 14, background: "#fff" },
  pre: {
    margin: 0,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fafafa",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  },
  ul: { margin: 0, paddingLeft: 18 },
  li: { marginBottom: 6, lineHeight: 1.45 },
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
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
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
  goodText: { color: "#065f46", fontWeight: 800, margin: 0 },
  disclaimerCard: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    color: "#92400e",
  },
};
