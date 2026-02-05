"use client";

import React, { useState } from "react";
import jsPDF from "jspdf";

export type OutputsForPdf = {
  two_minute_script: string;
  five_minute_outline: string[];
  key_facts_bullets: string[];
  evidence_checklist: string[];
  gaps_to_fill: string[];
  next_steps_process: string[];
  disclaimer: string;
};

type Props = {
  outputs: OutputsForPdf | null;
  filename?: string;
};

export default function DownloadPdfButton({ outputs, filename = "prose-prime-outputs.pdf" }: Props) {
  const [busy, setBusy] = useState(false);

  function addSection(doc: jsPDF, title: string, bodyLines: string[], x: number, y: number, maxWidth: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const tLines = doc.splitTextToSize(title, maxWidth);
    doc.text(tLines, x, y);
    y += tLines.length * 14 + 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const joined = bodyLines.join("\n");
    const lines = doc.splitTextToSize(joined, maxWidth);

    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - 44) {
        doc.addPage();
        y = 44;
      }
      doc.text(line, x, y);
      y += 14;
    }

    y += 10;
    return y;
  }

  async function onDownload() {
    if (!outputs || busy) return;

    setBusy(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const x = 44;
      let y = 44;
      const maxWidth = doc.internal.pageSize.getWidth() - x * 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Pro-se Prime Outputs Packet", x, y);
      y += 24;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Generated: ${new Date().toLocaleString()} • Legal information only (not legal advice)`,
        x,
        y
      );
      y += 18;

      doc.setDrawColor(229, 231, 235);
      doc.line(x, y, doc.internal.pageSize.getWidth() - x, y);
      y += 18;

      y = addSection(doc, "2-Minute Oral Script", [outputs.two_minute_script || ""], x, y, maxWidth);

      y = addSection(
        doc,
        "5-Minute Oral Outline",
        (outputs.five_minute_outline || []).map((s) => `• ${s}`),
        x,
        y,
        maxWidth
      );

      y = addSection(
        doc,
        "Key Facts",
        (outputs.key_facts_bullets || []).map((s) => `• ${s}`),
        x,
        y,
        maxWidth
      );

      y = addSection(
        doc,
        "Evidence Checklist",
        (outputs.evidence_checklist || []).map((s) => `□ ${s}`),
        x,
        y,
        maxWidth
      );

      y = addSection(
        doc,
        "Gaps to Fill",
        (outputs.gaps_to_fill || []).length
          ? outputs.gaps_to_fill.map((s) => `• ${s}`)
          : ["No major gaps flagged."],
        x,
        y,
        maxWidth
      );

      y = addSection(
        doc,
        "Next Steps (General)",
        (outputs.next_steps_process || []).map((s) => `• ${s}`),
        x,
        y,
        maxWidth
      );

      y = addSection(doc, "Disclaimer", [outputs.disclaimer || ""], x, y, maxWidth);

      doc.save(filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-primary" onClick={onDownload} disabled={!outputs || busy} type="button">
      {busy ? "Preparing PDF…" : "Download PDF"}
    </button>
  );
}