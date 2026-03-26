/**
 * PDF Report Generator — SanctionCheck Match Details Report
 * Design: LSEG World-Check One style (single page, clean, no Confidential)
 * Fix: doc.page.margins.bottom = 0 before footer prevents extra blank page
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
const FONT_AR   = path.join(FONTS_DIR, "Scheherazade-Regular.ttf");
const FONT_AR_B = path.join(FONTS_DIR, "Scheherazade-Bold.ttf");
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

/** Section heading — bold uppercase */
function sectionHead(doc: PDFKit.PDFDocument, title: string, x: number, y: number, w: number): number {
  doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLACK);
  enText(doc, title, x, y, w);
  return y + 16;
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
  // Count Arabic chars vs Latin letters — if Arabic dominates, treat as Arabic
  const arChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const enLetters = (text.match(/[a-zA-Z]/g) || []).length;
  const arDominant = hasAr && arChars > enLetters;

  if (arDominant) {
    // Arabic-dominant text (may contain numbers/punctuation): render as Arabic
    doc.font(FONT_AR).fontSize(sz).fillColor(color);
    arText(doc, text, x, y, w);
    return y + sz + 2;
  } else if (hasAr && !arDominant) {
    // True mixed: English letters dominate, show English part then Arabic part
    const enPart = text.replace(/[\u0600-\u06FF\u0750-\u077F]/g, "").replace(/\s+/g, " ").trim();
    const arPart = text.replace(/[^\u0600-\u06FF\u0750-\u077F\s]/g, "").trim();
    let cy = y;
    if (enPart) {
      doc.font(FONT_EN).fontSize(sz).fillColor(color);
      enText(doc, enPart, x, cy, w);
      cy += sz + 3;
    }
    if (arPart) {
      doc.font(FONT_AR).fontSize(sz).fillColor(color);
      arText(doc, arPart, x, cy, w);
      cy += sz + 3;
    }
    return cy;
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
  sz = 8.5
): number {
  const valW = totalW - labelW;
  const hasAr = /[\u0600-\u06FF]/.test(value);
  const arCharsRow = (value.match(/[\u0600-\u06FF]/g) || []).length;
  const enLettersRow = (value.match(/[a-zA-Z]/g) || []).length;
  const arDominantRow = hasAr && arCharsRow > enLettersRow;
  const mixed = hasAr && !arDominantRow;
  const effectiveSz = sz;
  const rh = (mixed ? 2 : 1) * (effectiveSz + 4) + 10;

  // Background
  doc.save().rect(x, y, totalW, rh).fill(shade ? GRAY_ROW : WHITE).restore();
  // Border
  doc.save().strokeColor(BORDER).lineWidth(0.3)
    .rect(x, y, totalW, rh).stroke()
    .moveTo(x + labelW, y).lineTo(x + labelW, y + rh).stroke()
    .restore();

  // Label — English only, bold, small
  doc.font(FONT_EN_B).fontSize(sz - 1).fillColor(BLACK);
  enText(doc, label, x + 5, y + (rh / 2) - (effectiveSz / 2), labelW - 10);

  // Value
  renderValue(doc, value || "—", x + labelW + 5, y + (rh / 2) - (effectiveSz / 2), valW - 10, sz, BLACK);

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
        Author: "Yemen Sanctions Platform",
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
    let y = 40;

    // ── HEADER ─────────────────────────────────────────────────────────────────
    doc.font(FONT_EN_B).fontSize(16).fillColor(BLUE);
    enText(doc, "Yemen", X, y, 110);
    doc.font(FONT_EN_B).fontSize(16).fillColor(NAVY);
    enText(doc, "Sanctions", X + 80, y, 170);

    // Arabic name right side
    doc.font(FONT_AR_B).fontSize(12).fillColor(BLUE);
    arText(doc, "منصة العقوبات اليمنية", X, y + 3, W);
    y += 22;

    // Report title
    doc.font(FONT_EN_B).fontSize(11).fillColor(BLACK);
    enText(doc, "SANCTIONCHECK MATCH DETAILS REPORT", X, y, W);

    y += 16;
    hr(doc, y, X, X + W, BLACK, 0.8);
    y += 10;

    // ── RECORD UID ────────────────────────────────────────────────────────────
    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLACK);
    enText(doc, "WORLD-CHECK RECORD UID:", X, y, 175);
    doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLUE);
    enText(doc, uid, X + 170, y, 200);

    y += 16;
    hr(doc, y, X, X + W, BORDER, 0.4);
    y += 8;

    // ── META TABLE ────────────────────────────────────────────────────────────
    const now      = new Date();
    const dateStr  = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr  = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const userName = ctx.user.name || (ctx.user as { username?: string }).username || "—";

    const mH  = 32;
    const mCW = W / 2;
    const mLW = 100;

    doc.save().rect(X, y, W, mH).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.3)
      .rect(X, y, W, mH).stroke()
      .moveTo(X + mCW, y).lineTo(X + mCW, y + mH).stroke()
      .restore();

    const metaSz = 8.5;
    // Left column
    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Created & Screened", X + 5, y + 5, mLW);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, `${dateStr} ${timeStr}`, X + mLW + 3, y + 5, mCW - mLW - 8);

    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Printed By", X + 5, y + 19, mLW);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, userName, X + mLW + 3, y + 19, mCW - mLW - 8);

    // Right column
    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Date Printed", X + mCW + 5, y + 5, 85);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, `${dateStr}, ${timeStr}`, X + mCW + 90, y + 5, mCW - 94);

    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Assigned To", X + mCW + 5, y + 19, 85);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, userName, X + mCW + 90, y + 19, mCW - 94);

    y += mH + 16;

    // ── CASE AND COMPARISON DATA ──────────────────────────────────────────────
    y = sectionHead(doc, "CASE AND COMPARISON DATA", X, y, W);

    const c1 = 70;
    const c2 = (W - c1) / 2;
    const c3 = W - c1 - c2;

    // Column headers
    doc.save().rect(X, y, W, 16).fill(GRAY_HEAD).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.3)
      .rect(X, y, W, 16).stroke()
      .moveTo(X + c1, y).lineTo(X + c1, y + 16).stroke()
      .moveTo(X + c1 + c2, y).lineTo(X + c1 + c2, y + 16).stroke()
      .restore();
    doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK);
    enText(doc, "Client/Submitted Data", X + c1 + 5, y + 4, c2 - 10);
    enText(doc, "World-Check Data",      X + c1 + c2 + 5, y + 4, c3 - 10);
    y += 16;

    // Name row
    const submittedName = (req.query.submittedName as string) || record.nameEn || "—";
    const hasArName = isAr(record.nameAr || "");
    const nRH = hasArName ? 32 : 22;

    doc.save().rect(X, y, W, nRH).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.3)
      .rect(X, y, W, nRH).stroke()
      .moveTo(X + c1, y).lineTo(X + c1, y + nRH).stroke()
      .moveTo(X + c1 + c2, y).lineTo(X + c1 + c2, y + nRH).stroke()
      .restore();

    doc.font(FONT_EN_B).fontSize(8.5).fillColor(BLACK);
    enText(doc, "Name", X + 5, y + (nRH / 2) - 4, c1 - 10);

    // Submitted name — use Arabic font if Arabic-only
    if (isAr(submittedName) && !/[a-zA-Z0-9]/.test(submittedName)) {
      doc.font(FONT_AR).fontSize(8.5).fillColor(BLACK);
      arText(doc, submittedName, X + c1, y + 5, c2 - 5);
    } else {
      doc.font(FONT_EN).fontSize(8.5).fillColor(BLACK);
      enText(doc, submittedName, X + c1 + 5, y + 5, c2 - 10);
    }
    if (hasArName) {
      doc.font(FONT_AR).fontSize(8).fillColor(GRAY_MID);
      arText(doc, record.nameAr!, X + c1, y + 17, c2 - 5);
    }

    // World-Check name (blue bold) — use Arabic font if Arabic-only
    const wcName = record.nameEn || record.nameAr || "—";
    if (isAr(wcName) && !/[a-zA-Z0-9]/.test(wcName)) {
      doc.font(FONT_AR_B).fontSize(8.5).fillColor(BLUE);
      arText(doc, wcName, X + c1 + c2, y + 5, c3 - 5);
    } else {
      doc.font(FONT_EN_B).fontSize(8.5).fillColor(BLUE);
      enText(doc, wcName, X + c1 + c2 + 5, y + 5, c3 - 10);
    }
    if (hasArName) {
      doc.font(FONT_AR).fontSize(8).fillColor(GRAY_MID);
      arText(doc, record.nameAr!, X + c1 + c2, y + 17, c3 - 5);
    }
    y += nRH + 14;

    // ── KEY DATA ──────────────────────────────────────────────────────────────
    y = sectionHead(doc, "KEY DATA", X, y, W);

    const LW = 130;
    const typeMap: Record<string, string> = {
      individual: "Individual", organisation: "Organisation",
      vessel: "Vessel", unspecified: "Unspecified",
    };

    const keyRows: [string, string][] = [
      ["Dataset",       record.issuingBody || "—"],
      ["Category",      record.entityType ? (typeMap[record.entityType] || record.entityType) : "—"],
      ["Sub-Category",  record.entityType === "individual" ? "Individual" : (record.entityType || "—")],
      ["Name",          record.nameEn || record.nameAr || "—"],
      ["Gender",        "—"],
      ["Citizenship",   record.nationality || "—"],
      ["Date of Birth", record.dateOfBirth || "—"],
      ["Place of Birth",record.placeOfBirth || "—"],
      ["Listing Date",  record.listingDate || "—"],
      ["Issuing Body",  record.issuingBody || "—"],
    ];

    let shade = false;
    for (const [label, value] of keyRows) {
      y = tableRow(doc, label, value, X, y, LW, W, shade, 8.5);
      shade = !shade;
    }

    y += 14;

    // ── LISTING REASON ────────────────────────────────────────────────────────
    if (record.listingReason) {
      y = sectionHead(doc, "LISTING REASON", X, y, W);
      const lrText = record.listingReason;
      const hasArLR = /[\u0600-\u06FF]/.test(lrText);
      const hasEnLR = /[a-zA-Z0-9]/.test(lrText);
      const mixed = hasArLR && hasEnLR;
      const lrH = (mixed ? 2 : 1) * 14 + 12;
      doc.save().rect(X, y, W, lrH).fill(GRAY_ROW).restore();
      doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, lrH).stroke().restore();
      renderValue(doc, lrText, X + 5, y + 5, W - 10, 8.5, BLACK);
      y += lrH + 14;
    }

    // ── LEGAL BASIS ───────────────────────────────────────────────────────────
    if (record.legalBasis) {
      y = sectionHead(doc, "LEGAL BASIS", X, y, W);
      const lbH = 24;
      doc.save().rect(X, y, W, lbH).fill(GRAY_ROW).restore();
      doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, lbH).stroke().restore();
      renderValue(doc, record.legalBasis, X + 5, y + 7, W - 10, 8.5, BLACK);
      y += lbH + 14;
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
        doc.save().rect(X, y, W, 16).fill(GRAY_HEAD).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3)
          .rect(X, y, W, 16).stroke()
          .moveTo(X + aLW, y).lineTo(X + aLW, y + 16).stroke()
          .restore();
        doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK);
        enText(doc, "Aliases",                X + 5,       y + 4, aLW - 10);
        enText(doc, "Native Character Names", X + aLW + 5, y + 4, aLW - 10);
        y += 16;

        const latinNames  = clean.filter(n => !isAr(n));
        const arabicNames = clean.filter(n => isAr(n));
        const maxR = Math.max(latinNames.length, arabicNames.length, 1);

        for (let i = 0; i < Math.min(maxR, 8); i++) {
          const rh = 18;
          doc.save().rect(X, y, W, rh).fill(i % 2 === 0 ? GRAY_ROW : WHITE).restore();
          doc.save().strokeColor(BORDER).lineWidth(0.3)
            .rect(X, y, W, rh).stroke()
            .moveTo(X + aLW, y).lineTo(X + aLW, y + rh).stroke()
            .restore();

          if (latinNames[i]) {
            doc.font(FONT_EN).fontSize(8.5).fillColor(BLACK);
            enText(doc, latinNames[i], X + 5, y + 5, aLW - 10);
          }
          if (arabicNames[i]) {
            doc.font(FONT_AR).fontSize(8.5).fillColor(BLACK);
            arText(doc, arabicNames[i], X + aLW, y + 5, aLW - 5);
          }
          y += rh;
        }
        y += 10;
      }
    }

    // ── FOOTER — draw at absolute position at bottom of page ─────────────────
    // CRITICAL: Set bottom margin to 0 BEFORE drawing footer.
    // This prevents PDFKit from auto-adding a new page when the cursor
    // goes below the original bottom margin boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc.page as any).margins.bottom = 0;

    const footerY = PH - 78;
    const footerContentW = logoExists ? W - 65 : W;

    hr(doc, footerY, X, X + W, GRAY_MID, 0.4);

    // Disclaimer line 1 (English) — centered
    doc.font(FONT_EN).fontSize(7.5).fillColor(GRAY_LT);
    enText(doc,
      "This report is issued by Yemen Sanctions Platform. For compliance and due diligence purposes only.",
      X, footerY + 7, footerContentW, { align: "center" }
    );

    // Disclaimer line 2 (Arabic) — right-aligned
    doc.font(FONT_AR).fontSize(7.5).fillColor(GRAY_LT);
    arText(doc,
      "صادر عن منصة العقوبات اليمنية. للأغراض القانونية والامتثالية فقط.",
      X, footerY + 20, footerContentW
    );

    // Logo bottom-right
    if (logoExists) {
      doc.image(LOGO_PATH, X + W - 55, footerY - 3, { width: 52, height: 42 });
    } else {
      doc.font(FONT_AR_B).fontSize(9).fillColor(BLUE);
      arText(doc, "منصة العقوبات اليمنية", X, footerY + 12, W);
    }

    doc.end();
  } catch (err) {
    console.error("[PDF Report Error]", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF report" });
  }
}
