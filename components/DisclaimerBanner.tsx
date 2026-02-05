"use client";

import React from "react";

type Props = {
  variant?: "warning" | "danger";
  title?: string;
  children?: React.ReactNode;
};

export default function DisclaimerBanner({
  variant = "warning",
  title = "Legal information only",
  children,
}: Props) {
  const className = variant === "danger" ? "banner-danger" : "banner-warning";

  return (
    <div className={className} role="note" aria-label={title}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ opacity: 0.95, lineHeight: 1.45 }}>
        {children ?? (
          <>
            Pro-se Prime provides general legal information and writing/organization help. It does not provide legal advice,
            does not create an attorney–client relationship, and does not guarantee outcomes. If you are in immediate danger,
            call local emergency services.
          </>
        )}
      </div>
    </div>
  );
}