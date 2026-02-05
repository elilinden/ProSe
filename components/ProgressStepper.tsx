"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Step = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

type Props = {
  steps?: Step[];
  activeId?: string; // optional manual override
};

const defaultSteps: Step[] = [
  { id: "intake", label: "Intake", href: "/intake", description: "Quick overview & facts" },
  { id: "coach", label: "Coach", href: "/coach", description: "AI follow-up questions" },
  { id: "outputs", label: "Outputs", href: "/outputs", description: "Scripts, outline, checklist" },
  { id: "review", label: "Review", href: "/review", description: "Tighten & finalize" },
];

function inferActiveId(pathname: string): string {
  if (pathname.startsWith("/intake")) return "intake";
  if (pathname.startsWith("/coach")) return "coach";
  if (pathname.startsWith("/outputs")) return "outputs";
  if (pathname.startsWith("/review")) return "review";
  return "";
}

export default function ProgressStepper({ steps = defaultSteps, activeId }: Props) {
  const pathname = usePathname();
  const active = activeId ?? inferActiveId(pathname);

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Progress</div>

      <div style={{ display: "grid", gap: 10 }}>
        {steps.map((s, idx) => {
          const isActive = s.id === active;

          return (
            <Link
              key={s.id}
              href={s.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                border: isActive ? "1px solid #93c5fd" : "1px solid var(--border, #e5e7eb)",
                background: isActive ? "#eff6ff" : "#fff",
                borderRadius: 14,
                padding: 12,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    border: isActive ? "1px solid #60a5fa" : "1px solid #d1d5db",
                    background: isActive ? "#dbeafe" : "#f9fafb",
                    flex: "0 0 auto",
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 900 }}>{s.label}</div>
                  {s.description ? (
                    <div className="small" style={{ marginTop: 2, opacity: 0.8 }}>
                      {s.description}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="small" style={{ opacity: 0.7 }}>
                {isActive ? "Current" : "Open"}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}