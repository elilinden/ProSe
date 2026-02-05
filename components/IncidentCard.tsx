"use client";

import React from "react";

export type Incident = {
  id: string;
  date?: string; // "2026-02-01" or "approx. Jan 2026"
  title: string; // short label
  details: string; // what happened
  evidence?: string; // texts, photos, witnesses
  impact?: string; // why it matters / harm / risk
};

type Props = {
  incident: Incident;
  onEdit?: (incident: Incident) => void;
  onDelete?: (id: string) => void;
};

export default function IncidentCard({ incident, onEdit, onDelete }: Props) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{incident.title}</div>
          <div className="small" style={{ marginTop: 4 }}>
            {incident.date ? `Date: ${incident.date}` : "Date: (not set)"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {onEdit && (
            <button className="btn" type="button" onClick={() => onEdit(incident)}>
              Edit
            </button>
          )}
          {onDelete && (
            <button className="btn" type="button" onClick={() => onDelete(incident.id)}>
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="hr" />

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div className="small" style={{ fontWeight: 900 }}>What happened</div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{incident.details}</div>
        </div>

        {incident.impact && (
          <div>
            <div className="small" style={{ fontWeight: 900 }}>Why it matters</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{incident.impact}</div>
          </div>
        )}

        {incident.evidence && (
          <div>
            <div className="small" style={{ fontWeight: 900 }}>Evidence</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{incident.evidence}</div>
          </div>
        )}
      </div>
    </div>
  );
}