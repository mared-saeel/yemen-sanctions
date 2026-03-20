/**
 * PDF Report Generator — SanctionCheck Match Details Report
 * Design: LSEG World-Check One style (single page, clean, no Confidential)
 */
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getRecordById } from "./search-engine";
import { createContext } from "./_core/context";

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);
const FONTS_DIR = path.join(__dir, "fonts");
const FONT_AR   = path.join(FONTS_DIR, "NotoSansArabic-Regular.ttf");
const FONT_AR_B = path.join(FONTS_DIR, "NotoSansArabic-Bold.ttf");
const FONT_EN   = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FONT_EN_B = path.join(FONTS_DIR, "NotoSans-Bold.ttf");
const LOGO_PATH = path.join(FONTS_DIR, "logo.png");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AR_FEAT: any[] = ["rtla", "arab", "init", "medi", "fina", "isol"];

const BLUE      = "#1B5EBF";
const NAVY      = "#1B3A6B";
const GRAY_ROW  = "#F2F3F5";
const GRAY_HEAD = "#D8DCE6";
const BLACK     = "#1A1A1A";
const GRAY_MID  = "#5A6070";
const GRAY_LT   = "#9098A8";
const WHITE     = "#FFFFFF";
const BORDER    = "#C8CDD8";

function isAr(t: string) { return /[\u0600-\u06FF]/.test(t); }

/** Draw Arabic text right-aligned */
function arText(doc: PDFKit.PDFDocument, t: string, x: number, y: number, w: number, opts: PDFKit.Mixins.TextOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).text(t, x, y, { align: "right", features: AR_FEAT, width: w, lineBreak: false, ...opts });
}

/** Draw English text left-aligned */
function enText(doc: PDFKit.PDFDocument, t: string, x: number, y: number, w: number, opts: PDFKit.Mixins.TextOptions = {}) {
  doc.text(t, x, y, { align: "left", width: w, lineBreak: false, ...opts });
}

/** Horizontal rule */
function hr(doc: PDFKit.PDFDocument, y: number, x1: number, x2: number, color = BORDER, lw = 0.5) {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x1, y).lineTo(x2, y).stroke().restore();
}

/** Section heading — bold uppercase, no background */
function sectionHead(doc: PDFKit.PDFDocument, title: string, x: number, y: number, w: number): number {
  doc.font(FONT_EN_B).fontSize(9).fillColor(BLACK);
  enText(doc, title, x, y, w);
  return y + 14;
}

/**
 * Render a value that may be Arabic, English, or mixed.
 * Returns the new Y after rendering.
 */
function renderValue(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number, y: number, w: number,
  sz: number,
  color = BLACK
): number {
  if (!text || text === "—") {
    doc.font(FONT_EN).fontSize(sz).fillColor(GRAY_MID);
    enText(doc, "—", x, y, w);
    return y + sz + 2;
  }
  const hasAr = /[\u0600-\u06FF]/.test(text);
  const hasEn = /[a-zA-Z0-9]/.test(text);

  if (hasAr && hasEn) {
    // Mixed: show English part first, then Arabic part below
    const enPart = text.replace(/[\u0600-\u06FF\u0750-\u077F]/g, "").replace(/\s+/g, " ").trim();
    const arPart = text.replace(/[^\u0600-\u06FF\u0750-\u077F\s]/g, "").trim();
    let cy = y;
    if (enPart) {
      doc.font(FONT_EN).fontSize(sz).fillColor(color);
      enText(doc, enPart, x, cy, w);
      cy += sz + 2;
    }
    if (arPart) {
      doc.font(FONT_AR).fontSize(sz).fillColor(color);
      arText(doc, arPart, x, cy, w);
      cy += sz + 2;
    }
    return cy;
  } else if (hasAr) {
    doc.font(FONT_AR).fontSize(sz).fillColor(color);
    arText(doc, text, x, y, w);
    return y + sz + 2;
  } else {
    doc.font(FONT_EN).fontSize(sz).fillColor(color);
    enText(doc, text, x, y, w);
    return y + sz + 2;
  }
}

/**
 * Draw a table row: label (left) | value (right)
 * Returns new Y after row.
 */
function tableRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number, y: number,
  labelW: number, totalW: number,
  shade: boolean,
  sz = 8
): number {
  const valW = totalW - labelW;
  const hasAr = /[\u0600-\u06FF]/.test(value);
  const hasEn = /[a-zA-Z0-9]/.test(value);
  const mixed = hasAr && hasEn;
  const rh = (mixed ? 2 : 1) * (sz + 3) + 8;

  // Background
  doc.save().rect(x, y, totalW, rh).fill(shade ? GRAY_ROW : WHITE).restore();
  // Border
  doc.save().strokeColor(BORDER).lineWidth(0.3)
    .rect(x, y, totalW, rh).stroke()
    .moveTo(x + labelW, y).lineTo(x + labelW, y + rh).stroke()
    .restore();

  // Label — English only, bold, small
  doc.font(FONT_EN_B).fontSize(sz - 1).fillColor(BLACK);
  enText(doc, label, x + 4, y + (rh / 2) - (sz / 2), labelW - 8);

  // Value
  renderValue(doc, value || "—", x + labelW + 4, y + (rh / 2) - (sz / 2), valW - 8, sz, BLACK);

  return y + rh;
}

export async function handleGeneratePdfReport(req: Request, res: Response) {
  try {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });

    const recordId = parseInt(req.params.id);
    if (isNaN(recordId)) return res.status(400).json({ error: "Invalid record ID" });

    const record = await getRecordById(recordId);
    if (!record) return res.status(404).json({ error: "Record not found" });

    const logoExists = fs.existsSync(LOGO_PATH);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 55, left: 45, right: 45 },
      info: {
        Title: `SanctionCheck Match Details Report — ${record.nameEn}`,
        Author: "Al-Mustashar Legal Consultancy",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `attachment; filename="sanctions-report-${record.referenceNumber || recordId}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const PW = doc.page.width;   // 595.28
    const PH = doc.page.height;  // 841.89
    const X  = 45;
    const W  = PW - 90;          // 505.28
    let y    = 40;

    // ── HEADER ────────────────────────────────────────────────────────────────
    // "Al-Mustashar" bold blue + "Legal Consultancy" gray
    doc.font(FONT_EN_B).fontSize(15).fillColor(BLUE);
    enText(doc, "Al-Mustashar", X, y, 160);
    doc.font(FONT_EN_B).fontSize(10).fillColor(NAVY);
    enText(doc, "Legal Consultancy", X + 115, y + 5, 160);

    // Arabic name right side
    doc.font(FONT_AR_B).fontSize(11).fillColor(BLUE);
    arText(doc, "المستشار للاستشارات القانونية", X, y + 3, W);

    y += 20;

    // Report title
    doc.font(FONT_EN_B).fontSize(11).fillColor(BLACK);
    enText(doc, "SANCTIONCHECK MATCH DETAILS REPORT", X, y, W);

    y += 14;
    hr(doc, y, X, X + W, BLACK, 0.8);
    y += 8;

    // ── RECORD UID ────────────────────────────────────────────────────────────
    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    doc.font(FONT_EN_B).fontSize(9).fillColor(BLACK);
    enText(doc, "WORLD-CHECK RECORD UID:", X, y, 170);
    doc.font(FONT_EN_B).fontSize(9).fillColor(BLUE);
    enText(doc, uid, X + 165, y, 200);

    y += 14;
    hr(doc, y, X, X + W, BORDER, 0.4);
    y += 6;

    // ── META TABLE (Created & Screened / Date Printed / Printed By / Assigned To) ──
    const now      = new Date();
    const dateStr  = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr  = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const userName = ctx.user.name || (ctx.user as { username?: string }).username || "—";

    const mH  = 28;
    const mCW = W / 2;
    const mLW = 95;

    doc.save().rect(X, y, W, mH).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.3)
      .rect(X, y, W, mH).stroke()
      .moveTo(X + mCW, y).lineTo(X + mCW, y + mH).stroke()
      .restore();

    const metaSz = 8;
    // Left column
    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Created & Screened", X + 4, y + 4, mLW);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, `${dateStr} ${timeStr}`, X + mLW + 2, y + 4, mCW - mLW - 6);

    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Printed By", X + 4, y + 16, mLW);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, userName, X + mLW + 2, y + 16, mCW - mLW - 6);

    // Right column
    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Date Printed", X + mCW + 4, y + 4, 80);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, `${dateStr}, ${timeStr}`, X + mCW + 84, y + 4, mCW - 88);

    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Assigned To", X + mCW + 4, y + 16, 80);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, userName, X + mCW + 84, y + 16, mCW - 88);

    y += mH + 12;

    // ── CASE AND COMPARISON DATA ──────────────────────────────────────────────
    y = sectionHead(doc, "CASE AND COMPARISON DATA", X, y, W);

    const c1 = 70;   // label col
    const c2 = (W - c1) / 2;  // client col
    const c3 = W - c1 - c2;   // world-check col

    // Column headers
    doc.save().rect(X, y, W, 14).fill(GRAY_HEAD).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.3)
      .rect(X, y, W, 14).stroke()
      .moveTo(X + c1, y).lineTo(X + c1, y + 14).stroke()
      .moveTo(X + c1 + c2, y).lineTo(X + c1 + c2, y + 14).stroke()
      .restore();
    doc.font(FONT_EN_B).fontSize(7.5).fillColor(BLACK);
    enText(doc, "Client/Submitted Data", X + c1 + 4, y + 3, c2 - 8);
    enText(doc, "World-Check Data",      X + c1 + c2 + 4, y + 3, c3 - 8);
    y += 14;

    // Name row
    const submittedName = (req.query.submittedName as string) || record.nameEn || "—";
    const hasArName = isAr(record.nameAr || "");
    const nRH = hasArName ? 28 : 20;

    doc.save().rect(X, y, W, nRH).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.3)
      .rect(X, y, W, nRH).stroke()
      .moveTo(X + c1, y).lineTo(X + c1, y + nRH).stroke()
      .moveTo(X + c1 + c2, y).lineTo(X + c1 + c2, y + nRH).stroke()
      .restore();

    doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK);
    enText(doc, "Name", X + 4, y + (nRH / 2) - 4, c1 - 8);

    // Submitted name (English)
    doc.font(FONT_EN).fontSize(8).fillColor(BLACK);
    enText(doc, submittedName, X + c1 + 4, y + 4, c2 - 8);
    if (hasArName) {
      doc.font(FONT_AR).fontSize(7.5).fillColor(GRAY_MID);
      arText(doc, record.nameAr!, X + c1, y + 14, c2 - 4);
    }

    // World-Check name (blue bold)
    doc.font(FONT_EN_B).fontSize(8).fillColor(BLUE);
    enText(doc, record.nameEn || "—", X + c1 + c2 + 4, y + 4, c3 - 8);
    if (hasArName) {
      doc.font(FONT_AR).fontSize(7.5).fillColor(GRAY_MID);
      arText(doc, record.nameAr!, X + c1 + c2, y + 14, c3 - 4);
    }
    y += nRH + 10;

    // ── KEY DATA ──────────────────────────────────────────────────────────────
    y = sectionHead(doc, "KEY DATA", X, y, W);

    const LW = 120;
    const typeMap: Record<string, string> = {
      individual: "Individual", organisation: "Organisation",
      vessel: "Vessel", unspecified: "Unspecified",
    };

    const keyRows: [string, string][] = [
      ["Dataset",       record.issuingBody || "—"],
      ["Category",      record.entityType ? (typeMap[record.entityType] || record.entityType) : "—"],
      ["Sub-Category",  record.entityType === "individual" ? "Individual" : (record.entityType || "—")],
      ["Name",          record.nameEn || "—"],
      ["Gender",        "—"],
      ["Citizenship",   record.nationality || "—"],
      ["Date of Birth", record.dateOfBirth || "—"],
      ["Place of Birth",record.placeOfBirth || "—"],
      ["Listing Date",  record.listingDate || "—"],
      ["Issuing Body",  record.issuingBody || "—"],
    ];

    let shade = false;
    for (const [label, value] of keyRows) {
      y = tableRow(doc, label, value, X, y, LW, W, shade, 8);
      shade = !shade;
    }

    y += 10;

    // ── LISTING REASON ────────────────────────────────────────────────────────
    if (record.listingReason) {
      y = sectionHead(doc, "LISTING REASON", X, y, W);
      const lrText = record.listingReason;
      const hasArLR = /[\u0600-\u06FF]/.test(lrText);
      const hasEnLR = /[a-zA-Z0-9]/.test(lrText);
      const mixed = hasArLR && hasEnLR;
      const lrH = (mixed ? 2 : 1) * 12 + 10;
      doc.save().rect(X, y, W, lrH).fill(GRAY_ROW).restore();
      doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, lrH).stroke().restore();
      renderValue(doc, lrText, X + 4, y + 4, W - 8, 8, BLACK);
      y += lrH + 10;
    }

    // ── LEGAL BASIS ───────────────────────────────────────────────────────────
    if (record.legalBasis) {
      y = sectionHead(doc, "LEGAL BASIS", X, y, W);
      const lbH = 20;
      doc.save().rect(X, y, W, lbH).fill(GRAY_ROW).restore();
      doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, lbH).stroke().restore();
      doc.font(FONT_EN).fontSize(8).fillColor(BLACK);
      enText(doc, record.legalBasis, X + 4, y + 5, W - 8);
      y += lbH + 10;
    }

    // ── ALIASES ───────────────────────────────────────────────────────────────
    const altNames = record.alternativeNames as string[] | null;
    if (altNames && altNames.length > 0) {
      const clean = altNames
        .map(n => n.replace(/[^\u0000-\u024F\u0600-\u06FF\u0750-\u077F\s]/g, "").trim())
        .filter(n => n.length > 0);

      if (clean.length > 0) {
        y = sectionHead(doc, "ALIASES", X, y, W);

        const aLW = W / 2;
        doc.save().rect(X, y, W, 14).fill(GRAY_HEAD).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3)
          .rect(X, y, W, 14).stroke()
          .moveTo(X + aLW, y).lineTo(X + aLW, y + 14).stroke()
          .restore();
        doc.font(FONT_EN_B).fontSize(7.5).fillColor(BLACK);
        enText(doc, "Aliases",                X + 4,       y + 3, aLW - 8);
        enText(doc, "Native Character Names", X + aLW + 4, y + 3, aLW - 8);
        y += 14;

        const latinNames  = clean.filter(n => !isAr(n));
        const arabicNames = clean.filter(n => isAr(n));
        const maxR = Math.max(latinNames.length, arabicNames.length, 1);

        for (let i = 0; i < Math.min(maxR, 8); i++) {
          const rh = 16;
          doc.save().rect(X, y, W, rh).fill(i % 2 === 0 ? GRAY_ROW : WHITE).restore();
          doc.save().strokeColor(BORDER).lineWidth(0.3)
            .rect(X, y, W, rh).stroke()
            .moveTo(X + aLW, y).lineTo(X + aLW, y + rh).stroke()
            .restore();

          if (latinNames[i]) {
            doc.font(FONT_EN).fontSize(8).fillColor(BLACK);
            enText(doc, latinNames[i], X + 4, y + 4, aLW - 8);
          }
          if (arabicNames[i]) {
            doc.font(FONT_AR).fontSize(8).fillColor(BLACK);
            arText(doc, arabicNames[i], X + aLW, y + 4, aLW - 4);
          }
          y += rh;
        }
        y += 10;
      }
    }

      // ── FOOTER — draw directly after content ────────────────────────────────
    y += 10;
    hr(doc, y, X, X + W, GRAY_MID, 0.4);

    // Disclaimer line 1 (English)
    doc.font(FONT_EN).fontSize(6.5).fillColor(GRAY_LT);
    enText(doc,
      "This report is issued by SanctionCheck — Al-Mustashar Legal Consultancy. For compliance and due diligence purposes only.",
      X, y + 5, W - 65);

    // Disclaimer line 2 (Arabic)
    doc.font(FONT_AR).fontSize(6.5).fillColor(GRAY_LT);
    arText(doc,
      "صادر عن منصة SanctionCheck — المستشار للاستشارات القانونية. للأغراض القانونية والامتثالية فقط.",
      X, y + 15, W - 65);

    // Logo bottom-right of footer area
    if (logoExists) {
      doc.image(LOGO_PATH, X + W - 55, y, { width: 52, height: 40 });
    } else {
      doc.font(FONT_EN_B).fontSize(8).fillColor(BLUE);
      arText(doc, "المستشار", X, y + 10, W);
    }

    doc.end();
  } catch (err) {
    console.error("[PDF Report Error]", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF report" });
  }
}
