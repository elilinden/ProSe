// lib/pdf/buildPdf.ts
"use client";

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

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addBullets(doc: jsPDF, items: string[], x: number, y: number, maxWidth: number, lineHeight: number) {
  for (const item of items) {
    const bullet = `• ${item}`;
    const lines = doc.splitTextToSize(bullet, maxWidth);
    doc.text(lines, x, y);
    y += lines.length * lineHeight;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }
  return y;
}

function addSectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  return y + 8;
}

export function buildOutputsPdf(payload: {
  outputs: OutputsForPdf;
  caseTitle?: string;
  jurisdiction?: string;
  track?: string;
  filename?: string;
}) {
  const { outputs, caseTitle, jurisdiction, track, filename } = payload;

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const marginX = 16;
  const maxWidth = 215.9 - marginX * 2; // letter width in mm ~ 215.9
  const lineHeight = 5.2;

  let y = 18;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Pro-se Prime — Oral Advocacy Packet", marginX, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const metaParts: string[] = [];
  if (caseTitle) metaParts.push(caseTitle);
  if (jurisdiction) metaParts.push(`Jurisdiction: ${jurisdiction}`);
  if (track) metaParts.push(`Track: ${track}`);
  if (metaParts.length) {
    y = addWrappedText(doc, metaParts.join(" | "), marginX, y, maxWidth, lineHeight);
    y += 4;
  }

  doc.setDrawColor(220);
  doc.line(marginX, y, marginX + maxWidth, y);
  y += 8;

  // 2-minute script
  y = addSectionTitle(doc, "2-Minute Oral Script", marginX, y);
  y = addWrappedText(doc, outputs.two_minute_script || "(none)", marginX, y, maxWidth, lineHeight);
  y += 8;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // 5-minute outline
  y = addSectionTitle(doc, "5-Minute Oral Outline", marginX, y);
  y = addBullets(doc, outputs.five_minute_outline || [], marginX, y, maxWidth, lineHeight);
  y += 6;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // Key facts
  y = addSectionTitle(doc, "Key Facts", marginX, y);
  y = addBullets(doc, outputs.key_facts_bullets || [], marginX, y, maxWidth, lineHeight);
  y += 6;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // Evidence checklist
  y = addSectionTitle(doc, "Evidence Checklist", marginX, y);
  y = addBullets(doc, outputs.evidence_checklist || [], marginX, y, maxWidth, lineHeight);
  y += 6;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // Gaps
  y = addSectionTitle(doc, "Gaps To Fill", marginX, y);
  const gaps = outputs.gaps_to_fill?.length ? outputs.gaps_to_fill : ["(No major gaps flagged.)"];
  y = addBullets(doc, gaps, marginX, y, maxWidth, lineHeight);
  y += 6;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // Next steps
  y = addSectionTitle(doc, "Next Steps (General)", marginX, y);
  y = addBullets(doc, outputs.next_steps_process || [], marginX, y, maxWidth, lineHeight);
  y += 8;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  // Disclaimer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  y = addSectionTitle(doc, "Disclaimer", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = addWrappedText(doc, outputs.disclaimer || "", marginX, y, maxWidth, 4.8);

  const outName = filename || "prose-prime-outputs.pdf";
  doc.save(outName);
}