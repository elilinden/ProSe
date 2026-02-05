"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import IncidentCard, { Incident } from "./IncidentCard";
import DisclaimerBanner from "./DisclaimerBanner";

const LS_KEY = "prose_prime_session_id";

type CreateSessionResponse = {
  ok: boolean;
  session?: { id: string };
  error?: string;
};

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

export default function IntakeForm() {
  const router = useRouter();

  const [jurisdiction, setJurisdiction] = useState("NY");
  const [track, setTrack] = useState<"family" | "landlord_tenant" | "small_claims">("family");
  const [goalRelief, setGoalRelief] = useState("");
  const [topFacts, setTopFacts] = useState("");

  const [incidents, setIncidents] = useState<Incident[]>(() => [
    {
      id: uid(),
      date: "",
      title: "Incident 1",
      details: "",
      evidence: "",
      impact: "",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return goalRelief.trim().length >= 5 && topFacts.trim().length >= 10;
  }, [goalRelief, topFacts]);

  function updateIncident(id: string, patch: Partial<Incident>) {
    setIncidents((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addIncident() {
    setIncidents((prev) => [
      ...prev,
      { id: uid(), date: "", title: `Incident ${prev.length + 1}`, details: "", evidence: "", impact: "" },
    ]);
  }

  function removeIncident(id: string) {
    setIncidents((prev) => prev.filter((x) => x.id !== id));
  }

  async function onStart() {
    try {
      setErr(null);
      setLoading(true);

      const payload = {
        jurisdiction,
        track,
        // Keep it simple: store intake as "facts" keys that your /api/session route can accept.
        facts: {
          goal_relief: goalRelief.trim(),
          top_facts_summary: topFacts.trim(),
          incidents: incidents
            .map((i) => ({
              date: i.date?.trim() || "",
              title: i.title?.trim() || "",
              details: i.details?.trim() || "",
              impact: i.impact?.trim() || "",
              evidence: i.evidence?.trim() || "",
            }))
            .filter((i) => i.title || i.details || i.date || i.impact || i.evidence),
        },
      };

      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CreateSessionResponse;
      if (!data.ok || !data.session?.id) {
        throw new Error(data.error || "Failed to create session.");
      }

      localStorage.setItem(LS_KEY, data.session.id);

      router.push("/coach");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DisclaimerBanner />

      {err && (
        <div className="banner-danger" role="alert">
          {err}
        </div>
      )}

      <div className="card">
        <div className="h2">Start intake</div>
        <div className="small" style={{ marginTop: 6 }}>
          Give a quick overview. The Coach will ask follow-up questions next.
        </div>

        <div className="hr" />

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div className="small" style={{ fontWeight: 900 }}>Jurisdiction</div>
            <select className="select" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
              <option value="NY">NY</option>
              <option value="PA">PA</option>
              <option value="NJ">NJ</option>
              <option value="Other">Other</option>
            </select>
            <div className="small">For MVP, NY is the best default.</div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div className="small" style={{ fontWeight: 900 }}>Track</div>
            <select className="select" value={track} onChange={(e) => setTrack(e.target.value as any)}>
              <option value="family">Family court</option>
              <option value="landlord_tenant">Landlord–tenant</option>
              <option value="small_claims">Small claims</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div className="small" style={{ fontWeight: 900 }}>What do you want the judge to do?</div>
            <input
              className="input"
              value={goalRelief}
              onChange={(e) => setGoalRelief(e.target.value)}
              placeholder='Example: "Grant an order of protection" or "Modify visitation schedule"'
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div className="small" style={{ fontWeight: 900 }}>Top facts in 3–6 sentences</div>
            <textarea
              className="textarea"
              value={topFacts}
              onChange={(e) => setTopFacts(e.target.value)}
              placeholder="Dates, who did what, and why it matters. Keep it simple."
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h2">Incidents</div>
        <div className="small" style={{ marginTop: 6 }}>
          Add 1–3 key incidents. You can keep this short—Coach will fill gaps later.
        </div>

        <div className="hr" />

        <div style={{ display: "grid", gap: 12 }}>
          {incidents.map((inc) => (
            <div key={inc.id} style={{ display: "grid", gap: 10 }}>
              <IncidentEditor incident={inc} onChange={(p) => updateIncident(inc.id, p)} />
              <IncidentCard
                incident={inc}
                onDelete={incidents.length > 1 ? removeIncident : undefined}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={addIncident}>
            Add incident
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary" type="button" onClick={onStart} disabled={!canSubmit || loading}>
            {loading ? "Starting…" : "Start coaching"}
          </button>

          <div className="small">
            This saves a session in your browser and takes you to the Coach chat.
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentEditor({
  incident,
  onChange,
}: {
  incident: Incident;
  onChange: (patch: Partial<Incident>) => void;
}) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h2" style={{ marginBottom: 8 }}>
        {incident.title || "Incident"}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="small" style={{ fontWeight: 900 }}>Date (or approximate)</div>
          <input
            className="input"
            value={incident.date ?? ""}
            onChange={(e) => onChange({ date: e.target.value })}
            placeholder="Example: 2026-02-01 or 'Late Jan 2026'"
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div className="small" style={{ fontWeight: 900 }}>Short label</div>
          <input
            className="input"
            value={incident.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Example: 'Threatening text messages' or 'Missed visitation exchange'"
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div className="small" style={{ fontWeight: 900 }}>What happened</div>
          <textarea
            className="textarea"
            value={incident.details}
            onChange={(e) => onChange({ details: e.target.value })}
            placeholder="Who did what. Include quotes if helpful."
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div className="small" style={{ fontWeight: 900 }}>Why it matters</div>
          <textarea
            className="textarea"
            value={incident.impact ?? ""}
            onChange={(e) => onChange({ impact: e.target.value })}
            placeholder="How this affected you or the child, safety, stability, etc."
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div className="small" style={{ fontWeight: 900 }}>Evidence</div>
          <textarea
            className="textarea"
            value={incident.evidence ?? ""}
            onChange={(e) => onChange({ evidence: e.target.value })}
            placeholder="Texts, emails, photos, witnesses, police report, medical records, etc."
          />
        </div>
      </div>
    </div>
  );
}