"use client";

import React, { useMemo } from "react";

export type TimelineItem = {
  id: string;
  date: string; // "2026-02-01" or "Late Jan 2026"
  event: string;
};

type Props = {
  value: TimelineItem[];
  onChange: (next: TimelineItem[]) => void;

  title?: string;
  subtitle?: string;

  minItems?: number;
  maxItems?: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function TimelineEditor({
  value,
  onChange,
  title = "Timeline",
  subtitle = "Add key events in order. Approximate dates are okay.",
  minItems = 1,
  maxItems = 30,
}: Props) {
  const items = Array.isArray(value) ? value : [];

  const canAdd = items.length < maxItems;
  const canRemove = items.length > minItems;

  const sortedHint = useMemo(() => {
    // We can't perfectly sort fuzzy dates; just detect if it "looks" unordered based on YYYY-MM-DD.
    const isoDates = items
      .map((x) => x.date.trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (isoDates.length < 3) return null;

    const isNondecreasing = isoDates.every((d, i) => (i === 0 ? true : d >= isoDates[i - 1]));
    return isNondecreasing ? null : "Tip: some ISO dates look out of order. Consider reordering.";
  }, [items]);

  function addItem() {
    if (!canAdd) return;
    onChange([
      ...items,
      {
        id: uid(),
        date: "",
        event: "",
      },
    ]);
  }

  function updateItem(id: string, patch: Partial<TimelineItem>) {
    onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removeItem(id: string) {
    if (!canRemove) return;
    onChange(items.filter((x) => x.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const nextIdx = clamp(idx + dir, 0, items.length - 1);
    if (nextIdx === idx) return;

    const copy = [...items];
    const [picked] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, picked);
    onChange(copy);
  }

  function normalizeWhitespace() {
    const next = items.map((x) => ({
      ...x,
      date: x.date.replace(/\s+/g, " ").trim(),
      event: x.event.replace(/\s+/g, " ").trim(),
    }));
    onChange(next);
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
          <div className="small" style={{ marginTop: 6, opacity: 0.8 }}>
            {subtitle}
          </div>
          {sortedHint ? (
            <div className="small" style={{ marginTop: 6, color: "#92400e" }}>
              {sortedHint}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={normalizeWhitespace}>
            Clean up
          </button>
          <button className="btn btn-primary" type="button" onClick={addItem} disabled={!canAdd}>
            Add event
          </button>
        </div>
      </div>

      <div className="hr" style={{ marginTop: 12, marginBottom: 12 }} />

      {items.length === 0 ? (
        <div className="small">No timeline entries yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 14,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div className="small" style={{ fontWeight: 900 }}>
                  Event {idx + 1}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={() => move(item.id, -1)} disabled={idx === 0}>
                    Up
                  </button>
                  <button className="btn" type="button" onClick={() => move(item.id, 1)} disabled={idx === items.length - 1}>
                    Down
                  </button>
                  <button className="btn" type="button" onClick={() => removeItem(item.id)} disabled={!canRemove}>
                    Remove
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div className="small" style={{ fontWeight: 900 }}>Date (or approximate)</div>
                  <input
                    className="input"
                    value={item.date}
                    onChange={(e) => updateItem(item.id, { date: e.target.value })}
                    placeholder="YYYY-MM-DD or 'Late Jan 2026'"
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div className="small" style={{ fontWeight: 900 }}>What happened</div>
                  <textarea
                    className="textarea"
                    value={item.event}
                    onChange={(e) => updateItem(item.id, { event: e.target.value })}
                    placeholder="One event per line item. Keep it factual."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="hr" style={{ marginTop: 12, marginBottom: 12 }} />

      <div className="small" style={{ opacity: 0.8 }}>
        Tip: If you don’t know the exact date, write “approx.” and describe how you remember it (e.g., “week after New Year”).
      </div>
    </div>
  );
}