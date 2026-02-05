"use client";

import React from "react";

type Props = {
  items: string[];
  title?: string;
  subtitle?: string;
};

export default function EvidenceChecklist({
  items,
  title = "Evidence checklist",
  subtitle = "Bring what you have. If you don’t have something, note it and don’t panic—just be honest about what exists.",
}: Props) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <div className="card">
      <div className="h2">{title}</div>
      <div className="small" style={{ marginTop: 6, marginBottom: 12 }}>
        {subtitle}
      </div>

      {safeItems.length === 0 ? (
        <div className="small">No evidence items listed yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {safeItems.map((item, idx) => (
            <label
              key={`${item}-${idx}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 14,
                background: "#fff",
              }}
            >
              <input type="checkbox" style={{ marginTop: 3 }} />
              <div style={{ lineHeight: 1.45 }}>
                <div style={{ fontWeight: 900 }}>{item}</div>
                <div className="small" style={{ marginTop: 2 }}>
                  If available: bring copies/screenshots + note dates and who sent/created it.
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="hr" />

      <div className="small">
        Pro tip: For each key event, try to match it with at least one supporting item (text, photo, witness, record).
      </div>
    </div>
  );
}