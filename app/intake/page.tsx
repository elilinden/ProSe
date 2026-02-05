"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Session = {
  id: string;
  createdAt: number;
  updatedAt: number;
  jurisdiction?: string;
  matterType?: string;
  track?: string;
  facts: Record<string, any>;
  conversation: Array<{ role: "user" | "assistant"; content: string; ts: number }>;
};

const LS_KEY = "prose_prime_session_id";

async function createSession(payload: { jurisdiction: string; matterType: string; track: string }): Promise<Session> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Failed to create session");
  return data.session as Session;
}

async function seedCoach(sessionId: string, intakeMessage: string) {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, userMessage: intakeMessage }),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Failed to seed coach");
  return data;
}

export default function IntakePage() {
  const router = useRouter();

  const [jurisdiction, setJurisdiction] = useState("NY");
  const [track, setTrack] = useState("order_of_protection"); // MVP default
  const [matterType, setMatterType] = useState("family");

  const [goalRelief, setGoalRelief] = useState("");
  const [people, setPeople] = useState("");
  const [keyEvents, setKeyEvents] = useState("");
  const [evidence, setEvidence] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onStart() {
    setLoading(true);
    setError(null);

    try {
      let sessionId = localStorage.getItem(LS_KEY);

      if (!sessionId) {
        const session = await createSession({ jurisdiction, matterType, track });
        sessionId = session.id;
        localStorage.setItem(LS_KEY, sessionId);
      }

      // Build a clean “intake summary” that the coach route can parse/extract from.
      const intakeMessage =
        `INTAKE SUMMARY\n` +
        `Jurisdiction: ${jurisdiction}\n` +
        `Matter type: ${matterType}\n` +
        `Track: ${track}\n\n` +
        `What I want the judge to do (goal/relief): ${goalRelief || "(not provided yet)"}\n\n` +
        `People involved + relationship:\n${people || "(not provided yet)"}\n\n` +
        `Key events (dates/approx dates, in order):\n${keyEvents || "(not provided yet)"}\n\n` +
        `Evidence I have (texts, emails, photos, witnesses, records):\n${evidence || "(not provided yet)"}\n`;

      await seedCoach(sessionId, intakeMessage);

      router.push("/coach");
    } catch (e: any) {
      setError(e?.message || "Failed to start intake.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Pro-se Prime | Intake</h1>
          <p style={styles.muted}>
            This is a guided intake to help you organize your story. It is <b>not</b> legal advice.
          </p>
        </div>
        <div style={styles.headerActions}>
          <Link href="/coach" style={styles.linkBtn}>Coach</Link>
          <Link href="/review" style={styles.linkBtn}>Review</Link>
          <Link href="/outputs" style={styles.linkBtn}>Outputs</Link>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <section style={styles.card}>
        <h2 style={styles.h2}>Basics</h2>

        <div style={styles.grid}>
          <label style={styles.label}>
            Jurisdiction
            <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={styles.input}>
              <option value="NY">NY</option>
              <option value="PA">PA</option>
              <option value="NJ">NJ</option>
              <option value="CA">CA</option>
            </select>
          </label>

          <label style={styles.label}>
            Matter type
            <select value={matterType} onChange={(e) => setMatterType(e.target.value)} style={styles.input}>
              <option value="family">Family</option>
              <option value="housing">Housing (L/T)</option>
              <option value="small_claims">Small claims</option>
            </select>
          </label>

          <label style={styles.label}>
            Track (MVP)
            <select value={track} onChange={(e) => setTrack(e.target.value)} style={styles.input}>
              <option value="order_of_protection">Order of protection / protection from abuse</option>
              <option value="custody">Child custody / visitation</option>
              <option value="landlord_tenant">Landlord–tenant</option>
              <option value="small_claims">Small claims</option>
            </select>
          </label>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>What you want the judge to do</h2>
        <textarea
          value={goalRelief}
          onChange={(e) => setGoalRelief(e.target.value)}
          placeholder="Example: I’m asking for an order of protection and no contact. Or: I’m asking to modify visitation to…"
          style={styles.textarea}
        />
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>People involved</h2>
        <textarea
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          placeholder="List the people and relationship. Example: Me (Eli), respondent (X), child (Y). We are married / dating / co-parents…"
          style={styles.textarea}
        />
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Key events (date order)</h2>
        <p style={styles.muted}>Try 3–6 bullets with dates or approximate dates.</p>
        <textarea
          value={keyEvents}
          onChange={(e) => setKeyEvents(e.target.value)}
          placeholder="Example:\n- Jan 12: …\n- Feb 3: …\n- Late March: …"
          style={styles.textarea}
        />
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Evidence you have</h2>
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Texts, emails, photos, screenshots, witnesses, police reports, medical records, call logs, etc."
          style={styles.textarea}
        />
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => void onStart()} style={styles.button} disabled={loading}>
          {loading ? "Starting…" : "Start coaching"}
        </button>

        <Link href="/coach" style={styles.secondaryBtn}>
          Skip intake
        </Link>
      </div>

      <div style={styles.disclaimerCard}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Reminder</div>
        <div style={{ opacity: 0.9, lineHeight: 1.45 }}>
          Pro-se Prime provides general legal information and writing/organization help. It does not provide legal advice,
          does not create an attorney-client relationship, and does not guarantee outcomes.
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 },
  headerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  h1: { fontSize: 28, margin: 0 },
  h2: { fontSize: 18, margin: "0 0 8px" },
  muted: { margin: "6px 0 0", opacity: 0.7, lineHeight: 1.4 },
  card: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, marginBottom: 14, background: "#fff" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 10 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontWeight: 700, fontSize: 13 },
  input: { padding: "10px 12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 14, background: "#fff" },
  textarea: {
    width: "100%",
    minHeight: 110,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #d1d5db",
    fontSize: 14,
    lineHeight: 1.45,
    resize: "vertical",
  },
  button: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    display: "inline-block",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    textDecoration: "none",
    color: "#111827",
    fontWeight: 700,
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
  errorBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#7f1d1d",
    marginBottom: 12,
    fontWeight: 700,
  },
  disclaimerCard: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    color: "#92400e",
  },
};