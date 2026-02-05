"use client";

import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode; // buttons/links on the right
  children: React.ReactNode;
  variant?: "default" | "warn";
};

export default function OutputPanel({
  title,
  subtitle,
  rightActions,
  children,
  variant = "default",
}: Props) {
  const border =
    variant === "warn" ? "1px solid #fde68a" : "1px solid var(--border, #e5e7eb)";
  const bg = variant === "warn" ? "#fffbeb" : "#fff";

  return (
    <section
      className="card"
      style={{
        border,
        background: bg,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{title}</div>
          {subtitle ? (
            <div className="small" style={{ marginTop: 6, opacity: 0.8 }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {rightActions ? <div style={{ display: "flex", gap: 8 }}>{rightActions}</div> : null}
      </div>

      <div className="hr" style={{ marginTop: 12, marginBottom: 12 }} />

      <div>{children}</div>
    </section>
  );
}