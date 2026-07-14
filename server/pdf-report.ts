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
// bidi-js removed — PDFKit with NotoSansArabic handles Arabic natively when text is passed directly

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);
const FONTS_DIR = path.join(__dir, "fonts");
const FONT_AR     = path.join(FONTS_DIR, "NotoSansArabic-Regular.ttf");
const FONT_AR_B   = path.join(FONTS_DIR, "NotoSansArabic-Bold.ttf");
const FONT_EN     = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FONT_EN_B   = path.join(FONTS_DIR, "NotoSans-Bold.ttf");
// Cairo supports both Arabic and Latin/digits — used for mixed-language text
const FONT_MIXED  = path.join(FONTS_DIR, "Cairo-Regular.ttf");
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

/**
 * Draw Arabic text right-aligned.
 * PDFKit + NotoSansArabic handles Arabic shaping natively — no BiDi reordering needed.
 * Just pass the text directly with align:right and Arabic OpenType features.
 */
function arText(doc: PDFKit.PDFDocument, t: string, x: number, y: number, w: number, opts: PDFKit.Mixins.TextOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).text(t, x, y, { align: "right", features: AR_FEAT, width: w, lineBreak: false, ...opts });
}

/**
 * Render mixed Arabic+English text by splitting into word-groups and rendering each
 * group with the appropriate font. Groups are reversed for RTL visual order.
 * Arabic words use FONT_AR, English/numeric words use FONT_EN.
 */
function renderMixedRTL(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number, y: number, w: number,
  sz: number,
  color = BLACK
): void {
  // Normalize multiple spaces to single space
  const cleanText = text.replace(/\s+/g, ' ').trim();
  // Split into tokens by spaces
  const tokens = cleanText.split(' ');
  const groups: { text: string; isAr: boolean }[] = [];
  let cur: { text: string; isAr: boolean } | null = null;

  for (const token of tokens) {
    if (!token) continue;
    // Token is Arabic if it contains Arabic chars
    // Neutral punctuation (()[]{}) with no EN chars: inherit from previous group
    const arChars = (token.match(/[\u0600-\u06FF]/g) || []).length;
    const enChars = (token.match(/[a-zA-Z0-9]/g) || []).length;
    const prevIsAr: boolean = cur !== null ? cur.isAr : false;
    const tokenIsAr: boolean = arChars > 0 || (enChars === 0 && prevIsAr);
    if (!cur) {
      cur = { text: token, isAr: tokenIsAr };
    } else if (tokenIsAr === cur.isAr) {
      cur.text += ' ' + token;
    } else {
      groups.push(cur);
      cur = { text: token, isAr: tokenIsAr };
    }
  }
  if (cur && cur.text.trim()) groups.push(cur);

  // Reverse groups for RTL visual order (Arabic first from right)
  groups.reverse();

  // Post-process: split leading/trailing parentheses from Arabic groups
  // so they render with FONT_EN (which supports them) instead of FONT_AR
  const finalGroups: { text: string; isAr: boolean }[] = [];
  for (const g of groups) {
    if (g.isAr) {
      const m = g.text.match(/^([\(\[\{]*)((?:[\s\S])*?)([\)\]\}]*)$/);
      if (m) {
        const lead = m[1], core = m[2].trim(), trail = m[3];
        if (trail) finalGroups.push({ text: trail, isAr: false });
        if (core) finalGroups.push({ text: core, isAr: true });
        if (lead) finalGroups.push({ text: lead, isAr: false });
      } else {
        finalGroups.push(g);
      }
    } else {
      finalGroups.push(g);
    }
  }

  // Measure widths
  const widths: number[] = [];
  for (const g of finalGroups) {
    doc.font(g.isAr ? FONT_AR : FONT_EN).fontSize(sz);
    widths.push(doc.widthOfString(g.text.trim()) + 6);
  }

  // Render right-to-left
  let curX = x + w;
  for (let i = 0; i < finalGroups.length; i++) {
    const g = finalGroups[i];
    const gW = widths[i];
    curX -= gW;
    if (g.isAr) {
      doc.font(FONT_AR).fontSize(sz).fillColor(color);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).text(g.text.trim(), curX, y, { align: 'right', features: AR_FEAT, width: gW, lineBreak: false });
    } else {
      doc.font(FONT_EN).fontSize(sz).fillColor(color);
      doc.text(g.text.trim(), curX, y, { align: 'left', width: gW, lineBreak: false });
    }
  }
}

/** Draw English text left-aligned */
function enText(doc: PDFKit.PDFDocument, t: string, x: number, y: number, w: number, opts: PDFKit.Mixins.TextOptions = {}) {
  doc.text(t, x, y, { align: "left", width: w, lineBreak: false, ...opts });
}

/** Horizontal rule */
function hr(doc: PDFKit.PDFDocument, y: number, x1: number, x2: number, color = BORDER, lw = 0.5) {
  doc.save().strokeColor(color).lineWidth(lw).moveTo(x1, y).lineTo(x2, y).stroke().restore();
}

/** Parse rawNotes string into structured fields for PDF report */
function parseRawNotesForPdf(raw: string | null | undefined) {
  if (!raw) return { nationality: null as string | null, dateOfBirth: null as string | null, placeOfBirth: null as string | null, alternativeNames: [] as string[], notes: null as string | null, referenceNumber: null as string | null, addresses: [] as string[] };
  const str = String(raw);
  const natMatch = str.match(/الجنسية:\s*([^|]+)/);
  const dobMatch = str.match(/تاريخ الميلاد:\s*([^|]+)/);
  const pobMatch = str.match(/مكان الميلاد:\s*([^|]+)/);
  const altMatch = str.match(/أسماء بديلة:\s*([^|]+)/);
  const refMatch = str.match(/الرقم المرجعي:\s*([^|]+)/);
  const addrMatches = str.match(/العنوان:\s*([^|]+)/g);

  // استخراج الملاحظات الكاملة: كل شيء بعد "ملاحظات:" حتى نهاية النص أو مفتاح معروف آخر
  let notes: string | null = null;
  const notesIdx = str.indexOf('ملاحظات:');
  if (notesIdx !== -1) {
    const afterNotes = str.slice(notesIdx + 'ملاحظات:'.length).trim();
    const knownKeys = ['الجنسية:', 'تاريخ الميلاد:', 'مكان الميلاد:', 'أسماء بديلة:', 'الرقم المرجعي:', 'العنوان:'];
    let endIdx = afterNotes.length;
    for (const key of knownKeys) {
      const idx1 = afterNotes.indexOf('| ' + key);
      if (idx1 !== -1 && idx1 < endIdx) endIdx = idx1;
      const idx2 = afterNotes.indexOf('|' + key);
      if (idx2 !== -1 && idx2 < endIdx) endIdx = idx2;
    }
    notes = afterNotes.slice(0, endIdx).trim() || null;
  }

  return {
    nationality: natMatch ? natMatch[1].trim() : null,
    dateOfBirth: dobMatch ? dobMatch[1].trim() : null,
    placeOfBirth: pobMatch ? pobMatch[1].trim() : null,
    alternativeNames: altMatch ? altMatch[1].split(',').map((n: string) => n.trim()).filter(Boolean) : [] as string[],
    notes,
    referenceNumber: refMatch ? refMatch[1].trim() : null,
    addresses: addrMatches ? addrMatches.map((a: string) => a.replace(/العنوان:\s*/, '').trim()) : [] as string[],
  };
}

/** Section heading — bold uppercase.
 * If the title contains Arabic characters, the Arabic part is rendered with FONT_AR_B
 * and the English part with FONT_EN_B so no boxes appear.
 */
function sectionHead(doc: PDFKit.PDFDocument, title: string, x: number, y: number, w: number): number {
  const hasArabic = /[\u0600-\u06FF]/.test(title);
  if (hasArabic) {
    // Split on " / " separator: e.g. "NOTES / ملاحظات" → ["NOTES", "ملاحظات"]
    const parts = title.split(' / ');
    if (parts.length === 2) {
      const enPart = parts[0].trim();
      const arPart = parts[1].trim();
      // Render English part left-aligned
      doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLACK);
      doc.text(enPart, x, y, { align: 'left', width: w / 2, lineBreak: false });
      // Render Arabic part right-aligned
      doc.font(FONT_AR_B).fontSize(9.5).fillColor(BLACK);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).text(arPart, x + w / 2, y, { align: 'right', features: AR_FEAT, width: w / 2, lineBreak: false });
    } else {
      // Fallback: render whole title with mixed renderer
      renderMixedRTL(doc, title, x, y, w, 9.5, BLACK);
    }
  } else {
    doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLACK);
    enText(doc, title, x, y, w);
  }
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
  // Pure Arabic (no Latin letters at all) → use Arabic font directly
  // Any mix of Arabic + Latin → always use mixed renderer to avoid font fallback issues
  const arDominant = hasAr && enLetters === 0;

  if (arDominant) {
    // Pure Arabic text: render directly with Arabic font (no BiDi needed)
    doc.font(FONT_AR).fontSize(sz).fillColor(color);
    arText(doc, text, x, y, w);
    return y + sz + 2;
  } else if (hasAr) {
    // Mixed Arabic+English: split into word-groups and render each with correct font
    renderMixedRTL(doc, text, x, y, w, sz, color);
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
  sz = 8.5
): number {
  const valW = totalW - labelW;
  const hasAr = /[\u0600-\u06FF]/.test(value);
  const arCharsRow = (value.match(/[\u0600-\u06FF]/g) || []).length;
  const enLettersRow = (value.match(/[a-zA-Z]/g) || []).length;
  const arDominantRow = hasAr && arCharsRow > enLettersRow;
  const mixed = hasAr && !arDominantRow;
  const effectiveSz = sz;
  // For Arabic text, increase row height to accommodate proper text rendering
  const rh = (arDominantRow || mixed ? 3 : 1) * (effectiveSz + 4) + 10;

  // Background
  doc.save().rect(x, y, totalW, rh).fill(shade ? GRAY_ROW : WHITE).restore();
  // Border
  doc.save().strokeColor(BORDER).lineWidth(0.3)
    .rect(x, y, totalW, rh).stroke()
    .moveTo(x + labelW, y).lineTo(x + labelW, y + rh).stroke()
    .restore();

  // Label — may be mixed Arabic/English (e.g. "Nationality / الجنسية")
  const labelHasAr = /[\u0600-\u06FF]/.test(label);
  if (labelHasAr) {
    // Mixed label: split into EN part and AR part, render on two lines
    const slashIdx = label.indexOf(" / ");
    const enPart = slashIdx >= 0 ? label.slice(0, slashIdx).trim() : label;
    const arPart = slashIdx >= 0 ? label.slice(slashIdx + 3).trim() : "";
    const lineH = effectiveSz + 2;
    const totalLabelH = arPart ? lineH * 2 + 2 : lineH;
    const labelY = y + (rh - totalLabelH) / 2;
    // EN part
    doc.font(FONT_EN_B).fontSize(sz - 1).fillColor(BLACK);
    enText(doc, enPart, x + 5, labelY, labelW - 10);
    // AR part
    if (arPart) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).text(arPart, x + 5, labelY + lineH + 2, { align: "right", features: AR_FEAT, width: labelW - 10, lineBreak: false,
        font: FONT_AR_B, fontSize: sz - 1, fillColor: BLACK });
      doc.font(FONT_AR_B).fontSize(sz - 1).fillColor(BLACK);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).text(arPart, x + 5, labelY + lineH + 2, { align: "right", features: AR_FEAT, width: labelW - 10, lineBreak: false });
    }
  } else {
    doc.font(FONT_EN_B).fontSize(sz - 1).fillColor(BLACK);
    enText(doc, label, x + 5, y + (rh / 2) - (effectiveSz / 2), labelW - 10);
  }

  // Value — handle Arabic text specially
  if (arDominantRow) {
    // Pure Arabic: use Arabic font directly
    doc.font(FONT_AR).fontSize(sz).fillColor(BLACK);
    arText(doc, value || "—", x + labelW, y + 5, valW - 10);
  } else {
    renderValue(doc, value || "—", x + labelW + 5, y + (rh / 2) - (effectiveSz / 2), valW - 10, sz, BLACK);
  }

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

    // -- HEADER -----------------------------------------------------------------
    doc.font(FONT_EN_B).fontSize(16).fillColor(BLUE);
    enText(doc, "Yemen", X, y, 110);
    doc.font(FONT_EN_B).fontSize(16).fillColor(NAVY);
    enText(doc, "Sanctions", X + 55, y, 170);

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

    // -- RECORD UID ------------------------------------------------------------
    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLACK);
    enText(doc, "WORLD-CHECK RECORD UID:", X, y, 175);
    doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLUE);
    enText(doc, uid, X + 170, y, 200);

    y += 16;
    hr(doc, y, X, X + W, BORDER, 0.4);
    y += 8;

    // -- META TABLE ------------------------------------------------------------
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
    enText(doc, dateStr, X + mLW + 3, y + 5, mCW - mLW - 8);

    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Printed By", X + 5, y + 19, mLW);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, userName, X + mLW + 3, y + 19, mCW - mLW - 8);

    // Right column
    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Date Printed", X + mCW + 5, y + 5, 85);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, dateStr, X + mCW + 90, y + 5, mCW - 94);

    doc.font(FONT_EN_B).fontSize(metaSz).fillColor(BLACK);
    enText(doc, "Assigned To", X + mCW + 5, y + 19, 85);
    doc.font(FONT_EN).fontSize(metaSz).fillColor(BLACK);
    enText(doc, userName, X + mCW + 90, y + 19, mCW - 94);

    y += mH + 16;

    // -- CASE AND COMPARISON DATA ----------------------------------------------
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

    // -- KEY DATA --------------------------------------------------------------
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

    // -- LISTING REASON --------------------------------------------------------
    if (record.listingReason) {
      y = sectionHead(doc, "LISTING REASON", X, y, W);
      const lrText = record.listingReason;
      const hasArLR = /[\u0600-\u06FF]/.test(lrText);
      // For Arabic text, use pure Arabic rendering to avoid BiDi issues
      if (hasArLR) {
        doc.font(FONT_AR).fontSize(8.5).fillColor(BLACK);
        const lrH = 28;
        doc.save().rect(X, y, W, lrH).fill(GRAY_ROW).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, lrH).stroke().restore();
        // Use arText for proper Arabic rendering
        arText(doc, lrText, X, y + 5, W - 10);
        y += lrH + 14;
      } else {
        const hasEnLR = /[a-zA-Z0-9]/.test(lrText);
        const mixed = hasArLR && hasEnLR;
        const lrH = (mixed ? 2 : 1) * 14 + 12;
        doc.save().rect(X, y, W, lrH).fill(GRAY_ROW).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, lrH).stroke().restore();
        renderValue(doc, lrText, X + 5, y + 5, W - 10, 8.5, BLACK);
        y += lrH + 14;
      }
    }

    // -- LEGAL BASIS -----------------------------------------------------------
    if (record.legalBasis) {
      y = sectionHead(doc, "LEGAL BASIS", X, y, W);
      const lbH = 24;
      doc.save().rect(X, y, W, lbH).fill(GRAY_ROW).restore();
      doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, lbH).stroke().restore();
      renderValue(doc, record.legalBasis, X + 5, y + 7, W - 10, 8.5, BLACK);
      y += lbH + 14;
    }

    // -- ALIASES ---------------------------------------------------------------
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

        for (let i = 0; i < maxR; i++) {
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

    // -- ADDITIONAL INFORMATION (from rawNotes) ------------------------------
    const parsed = parseRawNotesForPdf(record.rawNotes);

    // Merge parsed fields with DB fields
    const mergedNationality = record.nationality || parsed.nationality;
    const mergedDob = record.dateOfBirth || parsed.dateOfBirth;
    const mergedPob = record.placeOfBirth || parsed.placeOfBirth;
    const mergedRef = record.referenceNumber || parsed.referenceNumber;
    // Use notes field, or parsed notes from rawNotes
    // If rawNotes doesn't contain structured keys (like "الجنسية:"), use it directly as notes
    let mergedNotes = record.notes || parsed.notes;
    if (!mergedNotes && record.rawNotes) {
      const knownStructuredKeys = ['الجنسية:', 'تاريخ الميلاد:', 'مكان الميلاد:', 'أسماء بديلة:', 'الرقم المرجعي:', 'العنوان:', 'ملاحظات:'];
      const isStructured = knownStructuredKeys.some(k => record.rawNotes!.includes(k));
      if (!isStructured) {
        // rawNotes is free-form text — use it directly as notes
        mergedNotes = record.rawNotes;
      }
    }
    const dbAltArr = (record.alternativeNames as string[] | null) || [];
    const allAltNames = Array.from(new Set([...dbAltArr, ...parsed.alternativeNames]));

    // Update KEY DATA rows with merged values
    // (already rendered above — add ADDITIONAL INFO section below)

    // -- ADDITIONAL INFORMATION ------------------------------------------------
    const addlRows: [string, string][] = [
      ["Nationality", mergedNationality || "—"],
      ["Date of Birth", mergedDob || "—"],
      ["Place of Birth", mergedPob || "—"],
      ["Reference Number", mergedRef || "—"],
      ["Action Taken", record.actionTaken || "—"],
    ].filter(([, v]) => v && v !== "—") as [string, string][];

    if (addlRows.length > 0) {
      y = sectionHead(doc, "ADDITIONAL INFORMATION", X, y, W);
      let shade2 = false;
      for (const [label, value] of addlRows) {
        // Check if row will overflow the page
        const hasArVal = /[\u0600-\u06FF]/.test(value);
        const arCharsVal = (value.match(/[\u0600-\u06FF]/g) || []).length;
        const enLettersVal = (value.match(/[a-zA-Z]/g) || []).length;
        const mixedVal = hasArVal && !(hasArVal && arCharsVal > enLettersVal);
        const rowH = (mixedVal ? 2 : 1) * (8.5 + 4) + 10;
        if (y + rowH > PH - 80) {
          doc.addPage();
          y = 40;
        }
        y = tableRow(doc, label, value, X, y, LW, W, shade2, 8.5);
        shade2 = !shade2;
      }
      y += 14;
    }

    // -- ALTERNATIVE NAMES (from rawNotes, merged) -----------------------------
    if (allAltNames.length > 0 && (!altNames || altNames.length === 0)) {
      // Only show this section if ALIASES section above was empty
      const cleanAll = allAltNames
        .map(n => n.replace(/[^\u0000-\u024F\u0600-\u06FF\u0750-\u077F\s]/g, "").trim())
        .filter(n => n.length > 0);
      if (cleanAll.length > 0) {
        y = sectionHead(doc, "ALIASES", X, y, W);
        const aLW2 = W / 2;
        doc.save().rect(X, y, W, 16).fill(GRAY_HEAD).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, 16).stroke().moveTo(X + aLW2, y).lineTo(X + aLW2, y + 16).stroke().restore();
        doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK);
        enText(doc, "Aliases", X + 5, y + 4, aLW2 - 10);
        enText(doc, "Native Character Names", X + aLW2 + 5, y + 4, aLW2 - 10);
        y += 16;
        const latinAll = cleanAll.filter(n => !isAr(n));
        const arabicAll = cleanAll.filter(n => isAr(n));
        const maxR2 = Math.max(latinAll.length, arabicAll.length, 1);
        for (let i = 0; i < maxR2; i++) {
          const rh = 18;
          doc.save().rect(X, y, W, rh).fill(i % 2 === 0 ? GRAY_ROW : WHITE).restore();
          doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, rh).stroke().moveTo(X + aLW2, y).lineTo(X + aLW2, y + rh).stroke().restore();
          if (latinAll[i]) { doc.font(FONT_EN).fontSize(8.5).fillColor(BLACK); enText(doc, latinAll[i], X + 5, y + 5, aLW2 - 10); }
          if (arabicAll[i]) { doc.font(FONT_AR).fontSize(8.5).fillColor(BLACK); arText(doc, arabicAll[i], X + aLW2, y + 5, aLW2 - 5); }
          y += rh;
        }
        y += 10;
      }
    }

    // -- ADDRESSES -------------------------------------------------------------
    if (parsed.addresses.length > 0) {
      y = sectionHead(doc, `ADDRESSES (${parsed.addresses.length})`, X, y, W);
      for (let i = 0; i < parsed.addresses.length; i++) {
        const addr = parsed.addresses[i];
        const addrH = 22;
        doc.save().rect(X, y, W, addrH).fill(i % 2 === 0 ? GRAY_ROW : WHITE).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, addrH).stroke().restore();
        renderValue(doc, addr, X + 5, y + 6, W - 10, 8, BLACK);
        y += addrH;
      }
      y += 14;
    }
    // -- NOTES ---------------------------------------------------------------------------
    if (mergedNotes) {
      // إضافة صفحة جديدة إذا لم يكن هناك مساحة كافية
      if (y + 60 > PH - 80) {
        doc.addPage();
        y = 40;
      }
      y = sectionHead(doc, "NOTES / ملاحظات", X, y, W);
      const noteSz = 8.5;
      const noteW = W - 20;
      const noteLines = mergedNotes.split('\n').filter(l => l.trim());
      const lineH = noteSz + 6;

      // Helper: measure width of a word (Arabic or English)
      const wordWidth = (word: string, sz: number): number => {
        const arChars = (word.match(/[\u0600-\u06FF]/g) || []).length;
        const enChars = (word.match(/[a-zA-Z0-9]/g) || []).length;
        const isAr = arChars > 0;
        doc.font(isAr ? FONT_AR : FONT_EN).fontSize(sz);
        return doc.widthOfString(word) + 4;
      };

      // Helper: split a long mixed text into visual lines that fit within maxW
      const wrapMixedToLines = (text: string, sz: number, maxW: number): string[] => {
        const words = text.split(' ').filter(Boolean);
        const lines: string[] = [];
        let current = '';
        let currentW = 0;
        for (const word of words) {
          const wW = wordWidth(word, sz) + 4; // +4 for space
          if (current === '') {
            current = word;
            currentW = wW;
          } else if (currentW + wW <= maxW) {
            current += ' ' + word;
            currentW += wW;
          } else {
            lines.push(current);
            current = word;
            currentW = wW;
          }
        }
        if (current) lines.push(current);
        return lines.length > 0 ? lines : [text];
      };

      for (let li = 0; li < noteLines.length; li++) {
        const line = noteLines[li].trim();
        if (!line) continue;

        const hasArLine = /[\u0600-\u06FF]/.test(line);
        const arCharsLine = (line.match(/[\u0600-\u06FF]/g) || []).length;
        const enLettersLine = (line.match(/[a-zA-Z]/g) || []).length;
        const arDomLine = hasArLine && arCharsLine > enLettersLine;
        const isMixedLine = hasArLine && enLettersLine > 0;

        // For mixed text: split into visual lines using EN font width estimation
        // For Arabic-dominant: use PDFKit's built-in wrapping
        // For English-only: use PDFKit's built-in wrapping
        let subLines: string[];
        if (isMixedLine) {
          // Split using per-word width measurement for accurate mixed-text wrapping
          subLines = wrapMixedToLines(line, noteSz, noteW - 10);
        } else {
          subLines = [line];
        }

        for (let si = 0; si < subLines.length; si++) {
          const subLine = subLines[si];
          const rowH = lineH + 4;

          // صفحة جديدة إذا لزم
          if (y + rowH > PH - 80) {
            doc.addPage();
            y = 40;
            y = sectionHead(doc, "NOTES (cont.) / ملاحظات", X, y, W);
          }

          // خلفية متناوبة
          const bgIdx = li + si;
          doc.save().rect(X, y, W, rowH).fill(bgIdx % 2 === 0 ? GRAY_ROW : WHITE).restore();
          doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, rowH).stroke().restore();

          // رسم النص مع الخط الصحيح
          if (isMixedLine) {
            // نص مختلط: استخدم renderMixedRTL لرسم كل كلمة بالخط المناسب
            // X=بداية الخلية, W=عرضها الكامل لضمان بدء النص من الحد الأيمن الصحيح
            renderMixedRTL(doc, subLine, X, y + 5, W, noteSz, GRAY_MID);
          } else if (arDomLine) {
            doc.font(FONT_AR).fontSize(noteSz).fillColor(GRAY_MID);
            (doc as any).text(subLine, X + 5, y + 5, { align: "right", features: AR_FEAT, width: noteW, lineBreak: true });
          } else {
            doc.font(FONT_EN).fontSize(noteSz).fillColor(GRAY_MID);
            doc.text(subLine, X + 5, y + 5, { align: "left", width: noteW, lineBreak: true });
          }
          y += rowH;
        }
      }
      y += 14;
    }

    // -- FOOTER -- draw at absolute position at bottom of page --
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
