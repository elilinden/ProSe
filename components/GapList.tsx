"use client";

import React from "react";

type Props = {
  gaps: string[];
  title?: string;
  subtitle?: string;
};

export default function GapList({
  gaps,
  title = "Gaps to fill",
  subtitle = "These are the missing pieces that will make your story clearer and more court-ready.",
}: Props) {
  const safeGaps = Array.isArray(gaps) ? gaps.filter(Boolean) : [];

  return (
    <div className="card">
      <div className="h2">{title}</div>
      <div className="small" style={{ marginTop: 6, marginBottom: 12 }}>
        {subtitle}
      </div>

      {safeGaps.length === 0 ? (
        <div className="small">No gaps detected. Nice.</div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
          {safeGaps.map((g, idx) => (
            <li key={`${idx}-${g}`} style={{ lineHeight: 1.45 }}>
              <span style={{ fontWeight: 800 }}>{g}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="hr" />

      <div className="small">
        You can go back to the Coach page and answer these one by one—then regenerate Outputs.
      </div>
    </div>
  );
}