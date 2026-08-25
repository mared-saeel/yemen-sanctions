/**
 * PDF Report Generator — SanctionCheck Match Details Report
 * Design: sanctions screening report style (single page, clean, no Confidential)
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

// Quiet compliance palette: one accent, one ink tone and one neutral table tone.
const GOLD      = "#B7791F";
const INK       = "#1F2937";
const BLUE      = GOLD;
const NAVY      = INK;
const GRAY_ROW  = "#FAFBFC";
const GRAY_HEAD = "#F5F6F8";
const BLACK     = INK;
const GRAY_MID  = "#667085";
const GRAY_LT   = "#98A2B3";
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
 * Use Cairo for every body value containing Arabic. Cairo includes both Arabic
 * and Latin glyphs, which prevents replacement boxes in bilingual fields.
 */
function bodyValueHeight(doc: PDFKit.PDFDocument, text: string, w: number, sz: number): number {
  const value = text && text !== "—" ? text : "—";
  const hasArabic = isAr(value);
  const hasLatin = /[a-zA-Z0-9]/.test(value);
  if (hasArabic && hasLatin) return mixedTextHeight(doc, value, w, sz);
  doc.font(hasArabic ? FONT_MIXED : FONT_EN).fontSize(sz);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Math.max(sz + 2, (doc as any).heightOfString(value, {
    align: hasArabic ? "right" : "left",
    features: hasArabic ? AR_FEAT : undefined,
    width: w,
    lineBreak: true,
    lineGap: 1,
  }));
}

function drawBodyValue(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number, y: number, w: number,
  sz: number,
  color = BLACK
): number {
  const value = text && text !== "—" ? text : "—";
  const hasArabic = isAr(value);
  const hasLatin = /[a-zA-Z0-9]/.test(value);
  if (hasArabic && hasLatin) {
    renderMixedRTL(doc, value, x, y, w, sz, color);
    return mixedTextHeight(doc, value, w, sz);
  }
  const height = bodyValueHeight(doc, value, w, sz);
  doc.font(hasArabic ? FONT_MIXED : FONT_EN).fontSize(sz).fillColor(value === "—" ? GRAY_MID : color);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).text(value, x, y, {
    align: hasArabic ? "right" : "left",
    features: hasArabic ? AR_FEAT : undefined,
    width: w,
    lineBreak: true,
    lineGap: 1,
  });
  return height;
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
  const lines = mixedTextLines(doc, text, w, sz);
  const lineHeight = sz + 5;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const groups: Array<{ isArabic: boolean; tokens: MixedToken[] }> = [];
    for (const token of lines[lineIndex]) {
      const last = groups[groups.length - 1];
      if (last && last.isArabic === token.isArabic) last.tokens.push(token);
      else groups.push({ isArabic: token.isArabic, tokens: [token] });
    }

    // Lines are authored in logical order, while the cell itself is RTL. Draw
    // groups from right to left so Arabic remains on the right and any Latin
    // abbreviation stays immediately to its left in readable visual order.
    let cursorX = x + w;
    for (const group of [...groups].reverse()) {
      const groupWidth = group.tokens.reduce((sum, token) => sum + token.width, 0);
      const groupStart = cursorX - groupWidth;
      if (group.isArabic) {
        let tokenX = cursorX;
        for (const token of group.tokens) {
          tokenX -= token.width;
          doc.font(FONT_MIXED).fontSize(sz).fillColor(color);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (doc as any).text(token.text, tokenX, y + lineIndex * lineHeight, { align: "right", features: AR_FEAT, width: token.width, lineBreak: false });
        }
      } else {
        let tokenX = groupStart;
        for (const token of group.tokens) {
          doc.font(FONT_EN).fontSize(sz).fillColor(color);
          doc.text(token.text, tokenX, y + lineIndex * lineHeight, { align: "left", width: token.width, lineBreak: false });
          tokenX += token.width;
        }
      }
      cursorX = groupStart;
    }
  }
}

type MixedToken = { text: string; isArabic: boolean; width: number };

/**
 * Splits text at script boundaries even when the source omits a space, such as
 * "SDGT/إرهابيون". The PDF renderer can then place each language segment in
 * the correct visual direction.
 */
export function tokenizeMixedTextForPdf(text: string): Array<{ text: string; isArabic: boolean }> {
  const fragments = text.match(/[\u0600-\u06FF]+|[A-Za-z0-9][A-Za-z0-9./:_-]*|[^\s]/g) ?? [];
  let previousWasArabic = true;

  return fragments.map((fragment) => {
    const containsArabic = isAr(fragment);
    const containsLatin = /[a-zA-Z0-9]/.test(fragment);
    const isArabicToken = containsArabic || (!containsLatin && previousWasArabic);
    previousWasArabic = isArabicToken;
    return { text: fragment, isArabic: isArabicToken };
  });
}

function mixedTextLines(doc: PDFKit.PDFDocument, text: string, w: number, sz: number): MixedToken[][] {
  const tokens: MixedToken[] = [];
  for (const token of tokenizeMixedTextForPdf(text)) {
    doc.font(token.isArabic ? FONT_MIXED : FONT_EN).fontSize(sz);
    tokens.push({ text: token.text, isArabic: token.isArabic, width: doc.widthOfString(token.text) + 5 });
  }

  const lines: MixedToken[][] = [];
  let line: MixedToken[] = [];
  let lineWidth = 0;
  for (const token of tokens) {
    if (line.length && lineWidth + token.width > w) {
      lines.push(line);
      line = [token];
      lineWidth = token.width;
    } else {
      line.push(token);
      lineWidth += token.width;
    }
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [[]];
}

function mixedTextHeight(doc: PDFKit.PDFDocument, text: string, w: number, sz: number): number {
  return mixedTextLines(doc, text, w, sz).length * (sz + 5);
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
export function parseRawNotesForPdf(raw: string | null | undefined) {
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

/**
 * Builds the listing-context rows strictly from fields stored on the sanctions
 * record. Missing source fields are omitted rather than replaced with generated text.
 */
export function sanitizeListingContextTextForPdf(value: string | null | undefined): string {
  if (!value) return "";

  // Preserve the source content while removing isolated or enclosing brackets.
  // This prevents empty "( )" artifacts from disrupting mixed RTL/LTR text.
  return String(value)
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTechnicalSourceReference(value: string): boolean {
  return /^(?:UID|ID|REF(?:ERENCE)?|RECORD)\s*[:#-]\s*[A-Z0-9._-]+$/i.test(value.trim());
}

function splitListingProgramme(value: string): { programme: string | null; reason: string } {
  const match = value.match(/^([A-Z][A-Z0-9._-]{1,31})(?:\s*[/:\-]\s*|\s+)(.+)$/);
  if (!match) return { programme: null, reason: value };
  return { programme: match[1], reason: match[2].trim() };
}

export function buildListingContextRows(record: {
  listingReason?: string | null;
  legalBasis?: string | null;
  issuingBody?: string | null;
  referenceNumber?: string | null;
}): [string, string][] {
  // The compact label column follows the same English-only convention as KEY
  // DATA. Arabic remains in the section title; duplicating it in the narrow
  // column caused short labels to wrap and become visually misaligned.
  const rows: [string, string][] = [];
  const listingReason = sanitizeListingContextTextForPdf(record.listingReason);
  const legalBasis = sanitizeListingContextTextForPdf(record.legalBasis);
  const referenceNumber = sanitizeListingContextTextForPdf(record.referenceNumber);

  if (listingReason) {
    const { programme, reason } = splitListingProgramme(listingReason);
    if (programme) rows.push(["Listing Programme", programme]);
    if (reason) rows.push(["Reason for Listing", reason]);
  }

  if (legalBasis) {
    rows.push([isTechnicalSourceReference(legalBasis) ? "Source Reference" : "Legal Basis", legalBasis]);
  }

  if (referenceNumber && referenceNumber !== legalBasis) {
    rows.push(["Source Reference", referenceNumber]);
  }

  const issuingBody = sanitizeListingContextTextForPdf(record.issuingBody);
  if (issuingBody) rows.push(["Issuing Body", issuingBody]);
  return rows;
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
  // A restrained accent rule identifies the section without adding a colored band.
  doc.save().strokeColor(GOLD).lineWidth(1.1).moveTo(x, y + 14).lineTo(x + 30, y + 14).stroke().restore();
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
  return y + drawBodyValue(doc, text, x, y, w, sz, color);
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
  const effectiveSz = sz;
  const cellPadY = 5;
  const rh = tableRowHeight(doc, value, labelW, totalW, effectiveSz);

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
      doc.font(FONT_AR_B).fontSize(sz - 1).fillColor(BLACK);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).text(arPart, x + 5, labelY + lineH + 2, { align: "right", features: AR_FEAT, width: labelW - 10, lineBreak: false });
    }
  } else {
    doc.font(FONT_EN_B).fontSize(sz - 1).fillColor(BLACK);
    enText(doc, label, x + 5, y + (rh / 2) - (effectiveSz / 2), labelW - 10);
  }

  // Value — a single renderer keeps Arabic, English and bilingual text safe.
  drawBodyValue(doc, value || "—", x + labelW + 5, y + cellPadY, valW - 10, sz, BLACK);

  return y + rh;
}

function tableRowHeight(doc: PDFKit.PDFDocument, value: string, labelW: number, totalW: number, sz: number): number {
  const valW = totalW - labelW;
  // 22pt preserves bilingual labels while avoiding an orphan continuation page for short records.
  return Math.max(22, Math.ceil(bodyValueHeight(doc, value || "—", valW - 10, sz)) + 10);
}

async function handleGeneratePdfReportLegacy(req: Request, res: Response) {
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
      bufferPages: true,
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
    const CONTENT_BOTTOM = PH - 76;
    let y = 34;

    // -- HEADER -----------------------------------------------------------------
    const headerLogoWidth = logoExists ? 52 : 0;
    const headerTextWidth = W - headerLogoWidth - (logoExists ? 10 : 0);
    if (logoExists) {
      doc.image(LOGO_PATH, X + W - headerLogoWidth, y - 2, { width: headerLogoWidth, height: 42 });
    }

    doc.font(FONT_EN_B).fontSize(15).fillColor(INK);
    enText(doc, "Yemen Sanctions", X, y, 180);
    doc.font(FONT_AR_B).fontSize(10.5).fillColor(GOLD);
    arText(doc, "منصة العقوبات اليمنية", X, y + 3, headerTextWidth);

    y += 21;
    doc.font(FONT_EN_B).fontSize(10.5).fillColor(INK);
    enText(doc, "SANCTIONS SCREENING REPORT", X, y, 240);
    doc.font(FONT_AR_B).fontSize(9.5).fillColor(INK);
    arText(doc, "تقرير فحص العقوبات", X, y + 1, headerTextWidth);

    y += 17;
    hr(doc, y, X, X + W, BLACK, 0.8);
    y += 10;

    // -- RECORD UID ------------------------------------------------------------
    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    doc.font(FONT_EN_B).fontSize(9.5).fillColor(BLACK);
    enText(doc, "RECORD UID", X, y, 95);
    doc.font(FONT_EN_B).fontSize(9.5).fillColor(GOLD);
    enText(doc, uid, X + 92, y, 200);
    doc.font(FONT_AR_B).fontSize(8.5).fillColor(GRAY_MID);
    arText(doc, "معرّف السجل", X, y + 1, W);

    /** Start an explicit continuation page instead of allowing an accidental overflow. */
    const startContinuationPage = (sectionTitle: string) => {
      doc.addPage();
      y = 40;
      const continuationLogoWidth = logoExists ? 36 : 0;
      const continuationTextWidth = W - continuationLogoWidth - (logoExists ? 8 : 0);
      if (logoExists) {
        doc.image(LOGO_PATH, X + W - continuationLogoWidth, y - 1, { width: continuationLogoWidth, height: 29 });
      }
      doc.font(FONT_EN_B).fontSize(10).fillColor(INK);
      enText(doc, "Yemen Sanctions", X, y, 120);
      doc.font(FONT_AR_B).fontSize(8.5).fillColor(GOLD);
      arText(doc, "منصة العقوبات اليمنية", X, y + 1, continuationTextWidth);
      y += 16;
      doc.font(FONT_EN_B).fontSize(8).fillColor(GRAY_MID);
      enText(doc, `SANCTIONS SCREENING REPORT — ${uid}`, X, y, continuationTextWidth);
      y += 13;
      hr(doc, y, X, X + W, BORDER, 0.4);
      y += 8;
      const titleParts = sectionTitle.split(" / ");
      const continuationTitle = titleParts.length === 2
        ? `${titleParts[0]} (cont.) / ${titleParts[1]}`
        : `${sectionTitle} (cont.)`;
      y = sectionHead(doc, continuationTitle, X, y, W);
    };

    const ensureSpace = (requiredHeight: number, sectionTitle: string) => {
      if (y + requiredHeight > CONTENT_BOTTOM) startContinuationPage(sectionTitle);
    };

    y += 12;
    hr(doc, y, X, X + W, BORDER, 0.4);
    y += 8;

    // -- META TABLE ------------------------------------------------------------
    const now      = new Date();
    const dateStr  = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr  = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const userName = ctx.user.name || (ctx.user as { username?: string }).username || "—";

    const mH  = 30;
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

    y += mH + 12;

    // -- CASE AND COMPARISON DATA ----------------------------------------------
    y = sectionHead(doc, "CASE AND COMPARISON DATA / بيانات المقارنة", X, y, W);

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
    enText(doc, "Sanctions Record Data", X + c1 + c2 + 5, y + 4, c3 - 10);
    y += 16;

    // Name row
    const submittedName = (req.query.submittedName as string) || record.nameEn || "—";
    const hasArName = isAr(record.nameAr || "");
    const wcName = record.nameEn || record.nameAr || "—";
    const submittedH = bodyValueHeight(doc, submittedName, c2 - 10, 8.5)
      + (hasArName ? bodyValueHeight(doc, record.nameAr!, c2 - 10, 8) + 2 : 0);
    const worldCheckH = bodyValueHeight(doc, wcName, c3 - 10, 8.5)
      + (hasArName && wcName !== record.nameAr ? bodyValueHeight(doc, record.nameAr!, c3 - 10, 8) + 2 : 0);
    const nRH = Math.max(24, Math.ceil(Math.max(submittedH, worldCheckH) + 10));

    doc.save().rect(X, y, W, nRH).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.3)
      .rect(X, y, W, nRH).stroke()
      .moveTo(X + c1, y).lineTo(X + c1, y + nRH).stroke()
      .moveTo(X + c1 + c2, y).lineTo(X + c1 + c2, y + nRH).stroke()
      .restore();

    doc.font(FONT_EN_B).fontSize(8.5).fillColor(BLACK);
    enText(doc, "Name", X + 5, y + (nRH / 2) - 4, c1 - 10);

    // Submitted name — central renderer supports Arabic, English and bilingual values.
    const submittedDrawH = drawBodyValue(doc, submittedName, X + c1 + 5, y + 5, c2 - 10, 8.5, BLACK);
    if (hasArName) {
      drawBodyValue(doc, record.nameAr!, X + c1 + 5, y + 7 + submittedDrawH, c2 - 10, 8, GRAY_MID);
    }

    // Listed sanctions record name (blue)
    const worldCheckDrawH = drawBodyValue(doc, wcName, X + c1 + c2 + 5, y + 5, c3 - 10, 8.5, BLUE);
    if (hasArName && wcName !== record.nameAr) {
      drawBodyValue(doc, record.nameAr!, X + c1 + c2 + 5, y + 7 + worldCheckDrawH, c3 - 10, 8, GRAY_MID);
    }
    y += nRH + 10;

    // -- KEY DATA --------------------------------------------------------------
    const LW = 130;
    const typeMap: Record<string, string> = {
      individual: "Individual", organisation: "Organisation",
      vessel: "Vessel", unspecified: "Unspecified",
    };

    const keyRows: [string, string][] = [
      ["Dataset",       record.issuingBody || "—"],
      ["Category",      record.entityType ? (typeMap[record.entityType] || record.entityType) : "—"],
      ["Name",          record.nameEn || record.nameAr || "—"],
      ["Citizenship",   record.nationality || "—"],
      ["Date of Birth", record.dateOfBirth || "—"],
      ["Place of Birth",record.placeOfBirth || "—"],
      ["Listing Date",  record.listingDate || "—"],
      ["Issuing Body",  record.issuingBody || "—"],
    ];

    ensureSpace(16 + tableRowHeight(doc, keyRows[0][1], LW, W, 8.5), "KEY DATA / البيانات الجوهرية");
    y = sectionHead(doc, "KEY DATA / البيانات الجوهرية", X, y, W);

    let shade = false;
    for (const [label, value] of keyRows) {
      ensureSpace(tableRowHeight(doc, value, LW, W, 8.5), "KEY DATA / البيانات الجوهرية");
      y = tableRow(doc, label, value, X, y, LW, W, shade, 8.5);
      shade = !shade;
    }

    y += 10;

    // -- LISTING CONTEXT -------------------------------------------------------
    // This section is populated only with factual fields present in the source record.
    const listingContextRows = buildListingContextRows(record);
    if (listingContextRows.length > 0) {
      ensureSpace(16 + tableRowHeight(doc, listingContextRows[0][1], LW, W, 8.5), "LISTING CONTEXT / سياق الإدراج");
      y = sectionHead(doc, "LISTING CONTEXT / سياق الإدراج", X, y, W);
      let contextShade = false;
      for (const [label, value] of listingContextRows) {
        ensureSpace(tableRowHeight(doc, value, LW, W, 8.5), "LISTING CONTEXT / سياق الإدراج");
        y = tableRow(doc, label, value, X, y, LW, W, contextShade, 8.5);
        contextShade = !contextShade;
      }
      y += 10;
    }

    // -- ALIASES ---------------------------------------------------------------
    const altNames = record.alternativeNames as string[] | null;
    if (altNames && altNames.length > 0) {
      const clean = altNames
        .map(n => n.replace(/[^\u0000-\u024F\u0600-\u06FF\u0750-\u077F\s]/g, "").trim())
        .filter(n => n.length > 0);

      if (clean.length > 0) {
        const aLW = W / 2;
        const latinNames  = clean.filter(n => !isAr(n));
        const arabicNames = clean.filter(n => isAr(n));
        const firstAliasH = Math.max(
          18,
          Math.ceil(Math.max(
            latinNames?.[0] ? bodyValueHeight(doc, latinNames[0], aLW - 10, 8.5) : 0,
            arabicNames?.[0] ? bodyValueHeight(doc, arabicNames[0], aLW - 10, 8.5) : 0,
          )) + 10,
        );
        ensureSpace(32 + firstAliasH, "ALIASES");
        y = sectionHead(doc, "ALIASES", X, y, W);
        doc.save().rect(X, y, W, 16).fill(GRAY_HEAD).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3)
          .rect(X, y, W, 16).stroke()
          .moveTo(X + aLW, y).lineTo(X + aLW, y + 16).stroke()
          .restore();
        doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK);
        enText(doc, "Aliases",                X + 5,       y + 4, aLW - 10);
        enText(doc, "Native Character Names", X + aLW + 5, y + 4, aLW - 10);
        y += 16;
        const maxR = Math.max(latinNames.length, arabicNames.length, 1);

        for (let i = 0; i < maxR; i++) {
          const rh = Math.max(
            18,
            Math.ceil(Math.max(
              latinNames[i] ? bodyValueHeight(doc, latinNames[i], aLW - 10, 8.5) : 0,
              arabicNames[i] ? bodyValueHeight(doc, arabicNames[i], aLW - 10, 8.5) : 0,
            )) + 10,
          );
          ensureSpace(rh, "ALIASES");
          doc.save().rect(X, y, W, rh).fill(i % 2 === 0 ? GRAY_ROW : WHITE).restore();
          doc.save().strokeColor(BORDER).lineWidth(0.3)
            .rect(X, y, W, rh).stroke()
            .moveTo(X + aLW, y).lineTo(X + aLW, y + rh).stroke()
            .restore();

          if (latinNames[i]) {
            drawBodyValue(doc, latinNames[i], X + 5, y + 5, aLW - 10, 8.5, BLACK);
          }
          if (arabicNames[i]) {
            drawBodyValue(doc, arabicNames[i], X + aLW + 5, y + 5, aLW - 10, 8.5, BLACK);
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
      ["Action Taken", record.actionTaken || "—"],
    ].filter(([, v]) => v && v !== "—") as [string, string][];

    if (addlRows.length > 0) {
      ensureSpace(16 + tableRowHeight(doc, addlRows[0][1], LW, W, 8.5), "ADDITIONAL INFORMATION");
      y = sectionHead(doc, "ADDITIONAL INFORMATION", X, y, W);
      let shade2 = false;
      for (const [label, value] of addlRows) {
        ensureSpace(tableRowHeight(doc, value, LW, W, 8.5), "ADDITIONAL INFORMATION");
        y = tableRow(doc, label, value, X, y, LW, W, shade2, 8.5);
        shade2 = !shade2;
      }
      y += 10;
    }

    // -- ALTERNATIVE NAMES (from rawNotes, merged) -----------------------------
    if (allAltNames.length > 0 && (!altNames || altNames.length === 0)) {
      // Only show this section if ALIASES section above was empty
      const cleanAll = allAltNames
        .map(n => n.replace(/[^\u0000-\u024F\u0600-\u06FF\u0750-\u077F\s]/g, "").trim())
        .filter(n => n.length > 0);
      if (cleanAll.length > 0) {
        const aLW2 = W / 2;
        const latinAll = cleanAll.filter(n => !isAr(n));
        const arabicAll = cleanAll.filter(n => isAr(n));
        const firstAliasH = Math.max(
          18,
          Math.ceil(Math.max(
            latinAll?.[0] ? bodyValueHeight(doc, latinAll[0], aLW2 - 10, 8.5) : 0,
            arabicAll?.[0] ? bodyValueHeight(doc, arabicAll[0], aLW2 - 10, 8.5) : 0,
          )) + 10,
        );
        ensureSpace(32 + firstAliasH, "ALIASES");
        y = sectionHead(doc, "ALIASES", X, y, W);
        doc.save().rect(X, y, W, 16).fill(GRAY_HEAD).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, 16).stroke().moveTo(X + aLW2, y).lineTo(X + aLW2, y + 16).stroke().restore();
        doc.font(FONT_EN_B).fontSize(8).fillColor(BLACK);
        enText(doc, "Aliases", X + 5, y + 4, aLW2 - 10);
        enText(doc, "Native Character Names", X + aLW2 + 5, y + 4, aLW2 - 10);
        y += 16;
        const maxR2 = Math.max(latinAll.length, arabicAll.length, 1);
        for (let i = 0; i < maxR2; i++) {
          const rh = Math.max(
            18,
            Math.ceil(Math.max(
              latinAll[i] ? bodyValueHeight(doc, latinAll[i], aLW2 - 10, 8.5) : 0,
              arabicAll[i] ? bodyValueHeight(doc, arabicAll[i], aLW2 - 10, 8.5) : 0,
            )) + 10,
          );
          ensureSpace(rh, "ALIASES");
          doc.save().rect(X, y, W, rh).fill(i % 2 === 0 ? GRAY_ROW : WHITE).restore();
          doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, rh).stroke().moveTo(X + aLW2, y).lineTo(X + aLW2, y + rh).stroke().restore();
          if (latinAll[i]) drawBodyValue(doc, latinAll[i], X + 5, y + 5, aLW2 - 10, 8.5, BLACK);
          if (arabicAll[i]) drawBodyValue(doc, arabicAll[i], X + aLW2 + 5, y + 5, aLW2 - 10, 8.5, BLACK);
          y += rh;
        }
        y += 10;
      }
    }

    // -- ADDRESSES -------------------------------------------------------------
    if (parsed.addresses.length > 0) {
      const firstAddressH = Math.max(22, Math.ceil(bodyValueHeight(doc, parsed.addresses[0], W - 10, 8)) + 10);
      ensureSpace(16 + firstAddressH, "ADDRESSES");
      y = sectionHead(doc, `ADDRESSES (${parsed.addresses.length})`, X, y, W);
      for (let i = 0; i < parsed.addresses.length; i++) {
        const addr = parsed.addresses[i];
        const addrH = Math.max(22, Math.ceil(bodyValueHeight(doc, addr, W - 10, 8)) + 10);
        ensureSpace(addrH, "ADDRESSES");
        doc.save().rect(X, y, W, addrH).fill(i % 2 === 0 ? GRAY_ROW : WHITE).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, addrH).stroke().restore();
        drawBodyValue(doc, addr, X + 5, y + 5, W - 10, 8, BLACK);
        y += addrH;
      }
      y += 14;
    }
    // -- NOTES ---------------------------------------------------------------------------
    if (mergedNotes) {
      const noteSz = 8.5;
      const noteLines = mergedNotes.split(/\n+/).map(l => l.trim()).filter(Boolean);
      if (y + 42 > CONTENT_BOTTOM) startContinuationPage("NOTES / ملاحظات");
      else y = sectionHead(doc, "NOTES / ملاحظات", X, y, W);

      for (let li = 0; li < noteLines.length; li++) {
        const line = noteLines[li];
        const rowH = Math.max(22, Math.ceil(bodyValueHeight(doc, line, W - 10, noteSz)) + 10);
        ensureSpace(rowH, "NOTES / ملاحظات");
        doc.save().rect(X, y, W, rowH).fill(li % 2 === 0 ? GRAY_ROW : WHITE).restore();
        doc.save().strokeColor(BORDER).lineWidth(0.3).rect(X, y, W, rowH).stroke().restore();
        drawBodyValue(doc, line, X + 5, y + 5, W - 10, noteSz, GRAY_MID);
        y += rowH;
      }
      y += 14;
    }

    // -- FOOTER -- apply the current footer style on every generated page.
    const pageRange = doc.bufferedPageRange();
    const footerY = PH - 64;
    const footerContentW = W;
    for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex++) {
      doc.switchToPage(pageIndex);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc.page as any).margins.bottom = 0;
      hr(doc, footerY, X, X + W, GRAY_MID, 0.4);
      doc.font(FONT_EN).fontSize(7.5).fillColor(GRAY_LT);
      enText(doc,
        "This report is issued by Yemen Sanctions Platform. For compliance and due diligence purposes only.",
        X, footerY + 7, footerContentW, { align: "center" }
      );
      drawBodyValue(doc, "صادر عن منصة العقوبات اليمنية. للأغراض القانونية والامتثالية فقط.", X, footerY + 20, footerContentW, 7.5, GRAY_LT);
      doc.font(FONT_EN).fontSize(7).fillColor(GRAY_LT);
      enText(doc, `Page ${pageIndex + 1} of ${pageRange.count}`, X, footerY + 34, footerContentW, { align: "center" });
    }

    doc.end();
  } catch (err) {
    console.error("[PDF Report Error]", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF report" });
  }
}

type SingleLanguagePanelRow = { label: string; value: string };

export function splitValueByScriptForPdf(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw || raw === "—") return { english: "—", arabic: "—" };

  const tokens = tokenizeMixedTextForPdf(raw);
  const join = (parts: string[]) => parts.join(" ")
    .replace(/\s+([,.;:،])/g, "$1")
    .replace(/([(/])\s+/g, "$1")
    .replace(/\s+([/)])/g, "$1")
    .trim();

  const arabic = join(tokens.filter((token) => token.isArabic).map((token) => token.text));
  const english = join(tokens.filter((token) => !token.isArabic).map((token) => token.text));
  return { english: english || "—", arabic: arabic || "—" };
}

function measureSingleLanguageValueForPdf(
  doc: PDFKit.PDFDocument,
  value: string,
  width: number,
  isRtl: boolean,
  size = 8.5,
) {
  doc.font(isRtl ? FONT_AR : FONT_EN).fontSize(size);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Math.max(size + 3, (doc as any).heightOfString(value || "—", {
    width,
    align: isRtl ? "right" : "left",
    features: isRtl ? AR_FEAT : undefined,
    lineGap: 1,
  }));
}

function panelRowHeightV2(
  doc: PDFKit.PDFDocument,
  row: SingleLanguagePanelRow,
  width: number,
  isRtl: boolean,
) {
  return Math.max(38, Math.ceil(measureSingleLanguageValueForPdf(doc, row.value, width - 18, isRtl) + 25));
}

function panelHeightV2(
  doc: PDFKit.PDFDocument,
  rows: SingleLanguagePanelRow[],
  width: number,
  isRtl: boolean,
) {
  return 32 + rows.reduce((total, row) => total + panelRowHeightV2(doc, row, width, isRtl), 0);
}

function drawSectionBandV2(
  doc: PDFKit.PDFDocument,
  enTitle: string,
  arTitle: string,
  x: number,
  y: number,
  width: number,
) {
  const height = 25;
  doc.save().rect(x, y, width, height).fill(GRAY_HEAD).restore();
  doc.save().rect(x, y, 4, height).fill(GOLD).restore();
  doc.font(FONT_EN_B).fontSize(9).fillColor(INK);
  enText(doc, enTitle, x + 11, y + 8, width / 2 - 16);
  doc.font(FONT_AR_B).fontSize(9).fillColor(INK);
  arText(doc, arTitle, x + width / 2, y + 8, width / 2 - 11);
  return y + height + 8;
}

function drawLanguagePanelV2(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: SingleLanguagePanelRow[],
  x: number,
  y: number,
  width: number,
  isRtl: boolean,
) {
  const height = panelHeightV2(doc, rows, width, isRtl);
  doc.save().rect(x, y, width, height).fill(WHITE).strokeColor(BORDER).lineWidth(0.5).stroke().restore();
  doc.save().rect(x, y, width, 32).fill(GRAY_HEAD).restore();
  doc.save().rect(isRtl ? x + width - 4 : x, y, 4, 32).fill(GOLD).restore();
  doc.font(isRtl ? FONT_AR_B : FONT_EN_B).fontSize(8.5).fillColor(INK);
  if (isRtl) arText(doc, title, x + 10, y + 10, width - 20);
  else enText(doc, title, x + 10, y + 10, width - 20);

  let rowY = y + 32;
  rows.forEach((row, index) => {
    const rowHeight = panelRowHeightV2(doc, row, width, isRtl);
    if (index % 2 === 0) doc.save().rect(x, rowY, width, rowHeight).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.25).moveTo(x, rowY + rowHeight).lineTo(x + width, rowY + rowHeight).stroke().restore();

    doc.font(isRtl ? FONT_AR_B : FONT_EN_B).fontSize(7.2).fillColor(GRAY_MID);
    if (isRtl) arText(doc, row.label, x + 9, rowY + 7, width - 18);
    else enText(doc, row.label, x + 9, rowY + 7, width - 18);

    doc.font(isRtl ? FONT_AR : FONT_EN).fontSize(8.5).fillColor(row.value === "—" ? GRAY_LT : INK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(row.value || "—", x + 9, rowY + 18, {
      width: width - 18,
      align: isRtl ? "right" : "left",
      features: isRtl ? AR_FEAT : undefined,
      lineGap: 1,
    });
    rowY += rowHeight;
  });
  return height;
}

function drawNameCardV2(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  isRtl: boolean,
  accent = INK,
) {
  const valueHeight = measureSingleLanguageValueForPdf(doc, value, width - 22, isRtl, 9.2);
  const height = Math.max(56, Math.ceil(valueHeight + 35));
  doc.save().rect(x, y, width, height).fill(WHITE).strokeColor(BORDER).lineWidth(0.5).stroke().restore();
  doc.save().rect(isRtl ? x + width - 4 : x, y, 4, height).fill(accent).restore();
  doc.font(isRtl ? FONT_AR_B : FONT_EN_B).fontSize(7.5).fillColor(accent);
  if (isRtl) arText(doc, label, x + 11, y + 9, width - 22);
  else enText(doc, label, x + 11, y + 9, width - 22);
  doc.font(isRtl ? FONT_AR : FONT_EN).fontSize(9.2).fillColor(value === "—" ? GRAY_LT : INK);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).text(value || "—", x + 11, y + 24, {
    width: width - 22,
    align: isRtl ? "right" : "left",
    features: isRtl ? AR_FEAT : undefined,
    lineGap: 1,
  });
  return height;
}

async function handleGeneratePdfReportCardsDraft(req: Request, res: Response) {
  try {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });

    const recordId = parseInt(req.params.id);
    if (Number.isNaN(recordId)) return res.status(400).json({ error: "Invalid record ID" });
    const record = await getRecordById(recordId);
    if (!record) return res.status(404).json({ error: "Record not found" });

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 34, bottom: 46, left: 40, right: 40 },
      bufferPages: true,
      info: { Title: `Sanctions Screening Report — ${record.nameEn}`, Author: "Yemen Sanctions Platform" },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="sanctions-report-${record.referenceNumber || recordId}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const X = 40;
    const W = doc.page.width - 80;
    const PH = doc.page.height;
    const CONTENT_BOTTOM = PH - 72;
    const logoExists = fs.existsSync(LOGO_PATH);
    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    const userName = ctx.user.name || (ctx.user as { username?: string }).username || "—";
    const now = new Date();
    const printedDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const submitted = String(req.query.submittedName || record.nameEn || "—");
    const submittedParts = splitValueByScriptForPdf(submitted);
    const nameEnParts = splitValueByScriptForPdf(record.nameEn || "");
    const nameArParts = splitValueByScriptForPdf(record.nameAr || "");
    const reasonParts = splitValueByScriptForPdf(record.listingReason || "");
    const legalParts = splitValueByScriptForPdf(record.legalBasis || "");
    const actionParts = splitValueByScriptForPdf(record.actionTaken || "");
    const notesParts = splitValueByScriptForPdf(record.notes || record.rawNotes || "");
    const coreNameParts = splitValueByScriptForPdf(record.nameEn || record.nameAr || "");
    const nationalityParts = splitValueByScriptForPdf(record.nationality || "");
    const birthPlaceParts = splitValueByScriptForPdf(record.placeOfBirth || "");
    const altNames = ((record.alternativeNames as string[] | null) || []).map((name) => splitValueByScriptForPdf(name));
    const enAliases = altNames.map((name) => name.english).filter((name) => name !== "—").join("\n") || "—";
    const arAliases = altNames.map((name) => name.arabic).filter((name) => name !== "—").join("\n") || "—";
    const gap = 14;
    const columnW = (W - gap) / 2;
    let y = 34;

    const drawHeader = (isContinuation = false) => {
      const logoWidth = logoExists ? (isContinuation ? 33 : 48) : 0;
      const headerHeight = isContinuation ? 39 : 62;
      if (logoExists) doc.image(LOGO_PATH, X + W - logoWidth, y, { width: logoWidth, height: isContinuation ? 28 : 40 });
      doc.font(FONT_EN_B).fontSize(isContinuation ? 10 : 15).fillColor(INK);
      enText(doc, "Yemen Sanctions", X, y + 2, 190);
      doc.font(FONT_AR_B).fontSize(isContinuation ? 8.5 : 10.5).fillColor(GOLD);
      arText(doc, "منصة العقوبات اليمنية", X + W - logoWidth - 210, y + 4, 200);
      doc.font(FONT_EN_B).fontSize(isContinuation ? 7.5 : 9).fillColor(INK);
      enText(doc, isContinuation ? `RECORD UID  ${uid}` : "SANCTIONS SCREENING REPORT", X, y + (isContinuation ? 18 : 25), 240);
      doc.font(FONT_AR_B).fontSize(isContinuation ? 7.5 : 8.5).fillColor(GRAY_MID);
      arText(doc, isContinuation ? "تقرير فحص العقوبات" : "تقرير فحص العقوبات", X + W - logoWidth - 210, y + (isContinuation ? 18 : 26), 200);
      doc.save().rect(X, y + headerHeight - 3, W, 3).fill(GOLD).restore();
      y += headerHeight + 10;
    };

    const startContinuation = () => {
      doc.addPage();
      y = 34;
      drawHeader(true);
    };

    const ensure = (height: number) => {
      if (y + height > CONTENT_BOTTOM) startContinuation();
    };

    const drawPair = (
      sectionEn: string,
      sectionAr: string,
      leftTitle: string,
      leftRows: SingleLanguagePanelRow[],
      rightTitle: string,
      rightRows: SingleLanguagePanelRow[],
    ) => {
      const leftHeight = panelHeightV2(doc, leftRows, columnW, false);
      const rightHeight = panelHeightV2(doc, rightRows, columnW, true);
      const needed = 33 + Math.max(leftHeight, rightHeight) + 12;
      ensure(needed);
      y = drawSectionBandV2(doc, sectionEn, sectionAr, X, y, W);
      const panelY = y;
      drawLanguagePanelV2(doc, leftTitle, leftRows, X, panelY, columnW, false);
      drawLanguagePanelV2(doc, rightTitle, rightRows, X + columnW + gap, panelY, columnW, true);
      y += Math.max(leftHeight, rightHeight) + 13;
    };

    drawHeader();
    const metaH = 33;
    doc.save().rect(X, y, W, metaH).fill(GRAY_HEAD).strokeColor(BORDER).lineWidth(0.4).stroke().restore();
    doc.font(FONT_EN_B).fontSize(7.3).fillColor(GRAY_MID);
    enText(doc, "RECORD UID", X + 10, y + 7, 80);
    enText(doc, "PREPARED BY", X + W / 2 + 4, y + 7, 90);
    doc.font(FONT_EN_B).fontSize(8.5).fillColor(GOLD);
    enText(doc, uid, X + 10, y + 18, W / 2 - 20);
    doc.font(FONT_EN).fontSize(8.5).fillColor(INK);
    enText(doc, userName, X + W / 2 + 4, y + 18, W / 2 - 14);
    doc.font(FONT_AR_B).fontSize(7.5).fillColor(GRAY_MID);
    arText(doc, "تاريخ التقرير", X + W - 120, y + 7, 110);
    doc.font(FONT_EN).fontSize(8.2).fillColor(INK);
    enText(doc, printedDate, X + W - 115, y + 18, 105, { align: "right" });
    y += metaH + 12;

    y = drawSectionBandV2(doc, "MATCH OVERVIEW", "ملخص المطابقة", X, y, W);
    const submittedEnHeight = drawNameCardV2(doc, "SUBMITTED NAME", submittedParts.english, X, y, columnW, false);
    const submittedArHeight = drawNameCardV2(doc, "الاسم محل الفحص", submittedParts.arabic, X + columnW + gap, y, columnW, true);
    y += Math.max(submittedEnHeight, submittedArHeight) + 8;
    const listedEnHeight = drawNameCardV2(doc, "LISTED RECORD NAME", nameEnParts.english || coreNameParts.english, X, y, columnW, false, GOLD);
    const listedArHeight = drawNameCardV2(doc, "الاسم المدرج", nameArParts.arabic || coreNameParts.arabic, X + columnW + gap, y, columnW, true, GOLD);
    y += Math.max(listedEnHeight, listedArHeight) + 13;

    const typeMap: Record<string, string> = { individual: "Individual", organisation: "Organisation", vessel: "Vessel", unspecified: "Unspecified" };
    drawPair(
      "RECORD PROFILE", "ملف السجل",
      "SOURCE RECORD", [
        { label: "DATASET", value: splitValueByScriptForPdf(record.issuingBody || "").english },
        { label: "ENTITY TYPE", value: typeMap[record.entityType || ""] || String(record.entityType || "—") },
        { label: "LISTING DATE", value: String(record.listingDate || "—") },
        { label: "SOURCE REFERENCE", value: uid },
      ],
      "البيانات العربية", [
        { label: "الاسم", value: nameArParts.arabic },
        { label: "الجنسية", value: nationalityParts.arabic },
        { label: "مكان الميلاد", value: birthPlaceParts.arabic },
        { label: "تاريخ الميلاد", value: splitValueByScriptForPdf(record.dateOfBirth || "").arabic },
      ],
    );

    const listingRows = buildListingContextRows(record).reduce((map, [label, value]) => ({ ...map, [label]: value }), {} as Record<string, string>);
    drawPair(
      "LISTING CONTEXT", "سياق الإدراج",
      "SOURCE CONTEXT", [
        { label: "LISTING PROGRAMME", value: splitValueByScriptForPdf(listingRows["Listing Programme"] || "").english },
        { label: "REASON FOR LISTING", value: reasonParts.english },
        { label: "LEGAL BASIS", value: legalParts.english },
        { label: "SOURCE REFERENCE", value: splitValueByScriptForPdf(listingRows["Source Reference"] || uid).english },
        { label: "ISSUING BODY", value: splitValueByScriptForPdf(record.issuingBody || "").english },
        { label: "ACTION REQUIRED", value: actionParts.english },
        { label: "NOTES", value: notesParts.english },
      ],
      "التفاصيل العربية", [
        { label: "سبب الإدراج", value: reasonParts.arabic },
        { label: "الأساس القانوني", value: legalParts.arabic },
        { label: "الإجراء المطلوب", value: actionParts.arabic },
        { label: "ملاحظات", value: notesParts.arabic },
      ],
    );

    if (enAliases !== "—" || arAliases !== "—") {
      drawPair(
        "ALTERNATIVE NAMES", "الأسماء البديلة",
        "LATIN ALIASES", [{ label: "NAMES", value: enAliases }],
        "الأسماء العربية", [{ label: "الأسماء", value: arAliases }],
      );
    }

    const footerY = PH - 58;
    const pageRange = doc.bufferedPageRange();
    for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex++) {
      doc.switchToPage(pageIndex);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc.page as any).margins.bottom = 0;
      hr(doc, footerY, X, X + W, BORDER, 0.45);
      doc.font(FONT_EN).fontSize(6.8).fillColor(GRAY_LT);
      enText(doc, "For compliance and due-diligence purposes only.", X, footerY + 8, W / 2 - 10);
      doc.font(FONT_AR).fontSize(6.8).fillColor(GRAY_LT);
      arText(doc, "للاستخدام في أغراض الامتثال والعناية الواجبة فقط.", X + W / 2, footerY + 8, W / 2 - 4);
      doc.font(FONT_EN).fontSize(6.8).fillColor(GRAY_LT);
      enText(doc, `Page ${pageIndex + 1} of ${pageRange.count}`, X, footerY + 22, W, { align: "center" });
    }
    doc.end();
  } catch (error) {
    console.error("[PDF Report Error]", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF report" });
  }
}

type FormalReportField = { label: string; value: string };

function formalFieldHeight(doc: PDFKit.PDFDocument, field: FormalReportField, width: number, rtl: boolean) {
  const valueHeight = measureSingleLanguageValueForPdf(doc, field.value, width - 24, rtl, 9);
  return Math.max(47, Math.ceil(valueHeight + 29));
}

function formalGroupHeight(doc: PDFKit.PDFDocument, fields: FormalReportField[], width: number, rtl: boolean) {
  return 30 + fields.reduce((sum, field) => sum + formalFieldHeight(doc, field, width, rtl), 0) + 12;
}

function drawFormalSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number,
  y: number,
  width: number,
  rtl: boolean,
) {
  doc.save().rect(rtl ? x + width - 4 : x, y, 4, 18).fill(GOLD).restore();
  doc.font(rtl ? FONT_AR_B : FONT_EN_B).fontSize(9).fillColor(INK);
  if (rtl) arText(doc, title, x + 10, y + 4, width - 18);
  else enText(doc, title, x + 10, y + 4, width - 18);
  doc.save().strokeColor(BORDER).lineWidth(0.5).moveTo(x, y + 23).lineTo(x + width, y + 23).stroke().restore();
  return y + 30;
}

function drawFormalFields(
  doc: PDFKit.PDFDocument,
  fields: FormalReportField[],
  x: number,
  y: number,
  width: number,
  rtl: boolean,
) {
  let cursorY = y;
  fields.forEach((field, index) => {
    const height = formalFieldHeight(doc, field, width, rtl);
    if (index % 2 === 0) doc.save().rect(x, cursorY, width, height).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.35).moveTo(x, cursorY + height).lineTo(x + width, cursorY + height).stroke().restore();
    doc.font(rtl ? FONT_AR_B : FONT_EN_B).fontSize(7.2).fillColor(GRAY_MID);
    if (rtl) arText(doc, field.label, x + 12, cursorY + 7, width - 24);
    else enText(doc, field.label, x + 12, cursorY + 7, width - 24);
    doc.font(rtl ? FONT_AR : FONT_EN).fontSize(9).fillColor(field.value === "—" ? GRAY_LT : INK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(field.value || "—", x + 12, cursorY + 20, {
      width: width - 24,
      align: rtl ? "right" : "left",
      features: rtl ? AR_FEAT : undefined,
      lineGap: 1,
    });
    cursorY += height;
  });
  return cursorY + 12;
}

function drawFormalHeader(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  logoExists: boolean,
  uid: string,
  compact = false,
) {
  const logoWidth = logoExists ? (compact ? 31 : 48) : 0;
  const logoHeight = compact ? 27 : 40;
  const headerHeight = compact ? 44 : 76;
  if (logoExists) doc.image(LOGO_PATH, x + width - logoWidth, y, { width: logoWidth, height: logoHeight });
  doc.font(FONT_EN_B).fontSize(compact ? 9.5 : 14).fillColor(INK);
  enText(doc, "Yemen Sanctions", x, y + 2, 190);
  doc.font(FONT_AR_B).fontSize(compact ? 8.5 : 10).fillColor(GOLD);
  arText(doc, "منصة العقوبات اليمنية", x + width - logoWidth - 220, y + 4, 210);
  doc.font(FONT_EN_B).fontSize(compact ? 7.4 : 9).fillColor(GRAY_MID);
  enText(doc, compact ? `RECORD UID  ${uid}` : "SANCTIONS SCREENING REPORT", x, y + (compact ? 18 : 27), 250);
  doc.font(FONT_AR_B).fontSize(compact ? 7.4 : 8.5).fillColor(GRAY_MID);
  arText(doc, "تقرير فحص العقوبات", x + width - logoWidth - 220, y + (compact ? 18 : 27), 210);
  doc.save().rect(x, y + headerHeight - 3, width, 3).fill(GOLD).restore();
  return y + headerHeight + 10;
}

async function handleGeneratePdfReportFormalDraft(req: Request, res: Response) {
  try {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });
    const recordId = parseInt(req.params.id);
    if (Number.isNaN(recordId)) return res.status(400).json({ error: "Invalid record ID" });
    const record = await getRecordById(recordId);
    if (!record) return res.status(404).json({ error: "Record not found" });

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 34, bottom: 48, left: 46, right: 46 },
      bufferPages: true,
      info: { Title: `Sanctions Screening Report — ${record.nameEn}`, Author: "Yemen Sanctions Platform" },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="sanctions-report-${record.referenceNumber || recordId}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const X = 46;
    const W = doc.page.width - 92;
    const PH = doc.page.height;
    const CONTENT_BOTTOM = PH - 72;
    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    const logoExists = fs.existsSync(LOGO_PATH);
    const preparedBy = ctx.user.name || (ctx.user as { username?: string }).username || "—";
    const printedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const submitted = String(req.query.submittedName || record.nameEn || "—");
    const submittedParts = splitValueByScriptForPdf(submitted);
    const nameParts = splitValueByScriptForPdf(record.nameEn || record.nameAr || "");
    const arabicName = splitValueByScriptForPdf(record.nameAr || "").arabic;
    const sourceParts = splitValueByScriptForPdf(record.issuingBody || "");
    const nationalityParts = splitValueByScriptForPdf(record.nationality || "");
    const birthPlaceParts = splitValueByScriptForPdf(record.placeOfBirth || "");
    const reasonParts = splitValueByScriptForPdf(record.listingReason || "");
    const legalParts = splitValueByScriptForPdf(record.legalBasis || "");
    const actionParts = splitValueByScriptForPdf(record.actionTaken || "");
    const notesParts = splitValueByScriptForPdf(record.notes || record.rawNotes || "");
    const listingRows = buildListingContextRows(record).reduce((map, [label, value]) => ({ ...map, [label]: value }), {} as Record<string, string>);
    const altParts = ((record.alternativeNames as string[] | null) || []).map((name) => splitValueByScriptForPdf(name));
    const enAliases = altParts.map((name) => name.english).filter((name) => name !== "—").join("\n") || "—";
    const arAliases = altParts.map((name) => name.arabic).filter((name) => name !== "—").join("\n") || "—";
    const entityType = ({ individual: "Individual", organisation: "Organisation", vessel: "Vessel", unspecified: "Unspecified" } as Record<string, string>)[record.entityType || ""] || String(record.entityType || "—");
    let y = 34;

    const startPage = () => {
      doc.addPage();
      y = drawFormalHeader(doc, X, 34, W, logoExists, uid, true);
    };
    const ensureGroup = (height: number) => {
      if (y + height > CONTENT_BOTTOM) startPage();
    };
    const drawGroup = (title: string, fields: FormalReportField[], rtl: boolean) => {
      const height = formalGroupHeight(doc, fields, W, rtl);
      ensureGroup(height);
      y = drawFormalSectionTitle(doc, title, X, y, W, rtl);
      y = drawFormalFields(doc, fields, X, y, W, rtl);
    };

    y = drawFormalHeader(doc, X, y, W, logoExists, uid);
    doc.save().rect(X, y, W, 42).fill(GRAY_HEAD).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.4).rect(X, y, W, 42).stroke().restore();
    doc.font(FONT_EN_B).fontSize(7.3).fillColor(GRAY_MID);
    enText(doc, "RECORD UID", X + 12, y + 8, 95);
    enText(doc, "PREPARED BY", X + W / 2 - 40, y + 8, 100);
    doc.font(FONT_EN_B).fontSize(9).fillColor(GOLD);
    enText(doc, uid, X + 12, y + 21, 130);
    doc.font(FONT_EN).fontSize(8.5).fillColor(INK);
    enText(doc, preparedBy, X + W / 2 - 40, y + 21, 125);
    doc.font(FONT_AR_B).fontSize(7.4).fillColor(GRAY_MID);
    arText(doc, "تاريخ التقرير", X + W - 120, y + 8, 108);
    doc.font(FONT_EN).fontSize(8.5).fillColor(INK);
    enText(doc, printedDate, X + W - 116, y + 21, 104, { align: "right" });
    y += 57;

    drawGroup("SUBMITTED NAME", [{ label: "NAME USED FOR SCREENING", value: submittedParts.english }], false);
    if (submittedParts.arabic !== "—") drawGroup("الاسم المستخدم في الفحص", [{ label: "الاسم", value: submittedParts.arabic }], true);
    drawGroup("LISTED RECORD", [{ label: "OFFICIAL LISTED NAME", value: nameParts.english }], false);
    if (arabicName !== "—") drawGroup("السجل المدرج", [{ label: "الاسم العربي المدرج", value: arabicName }], true);

    drawGroup("RECORD INFORMATION", [
      { label: "DATASET", value: sourceParts.english },
      { label: "ENTITY TYPE", value: entityType },
      { label: "LISTING DATE", value: String(record.listingDate || "—") },
      { label: "SOURCE REFERENCE", value: uid },
      { label: "ISSUING BODY", value: sourceParts.english },
    ], false);

    const arabicProfile: FormalReportField[] = [
      { label: "الاسم", value: arabicName },
      { label: "الجنسية", value: nationalityParts.arabic },
      { label: "مكان الميلاد", value: birthPlaceParts.arabic },
    ].filter((field) => field.value !== "—");
    if (arabicProfile.length) drawGroup("البيانات التعريفية", arabicProfile, true);

    drawGroup("LISTING CONTEXT", [
      { label: "LISTING PROGRAMME", value: splitValueByScriptForPdf(listingRows["Listing Programme"] || "").english },
      { label: "REASON FOR LISTING", value: reasonParts.english },
      { label: "LEGAL BASIS", value: legalParts.english },
      { label: "ACTION REQUIRED", value: actionParts.english },
      { label: "NOTES", value: notesParts.english },
    ], false);

    const arabicContext: FormalReportField[] = [
      { label: "سبب الإدراج", value: reasonParts.arabic },
      { label: "الأساس القانوني", value: legalParts.arabic },
      { label: "الإجراء المطلوب", value: actionParts.arabic },
      { label: "ملاحظات", value: notesParts.arabic },
    ].filter((field) => field.value !== "—");
    if (arabicContext.length) drawGroup("سياق الإدراج", arabicContext, true);

    if (enAliases !== "—") drawGroup("ALTERNATIVE NAMES", [{ label: "LATIN ALIASES", value: enAliases }], false);
    if (arAliases !== "—") drawGroup("الأسماء البديلة", [{ label: "الأسماء العربية", value: arAliases }], true);

    const footerY = PH - 56;
    const pages = doc.bufferedPageRange();
    for (let pageIndex = 0; pageIndex < pages.count; pageIndex++) {
      doc.switchToPage(pageIndex);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc.page as any).margins.bottom = 0;
      hr(doc, footerY, X, X + W, BORDER, 0.4);
      doc.font(FONT_EN).fontSize(6.7).fillColor(GRAY_LT);
      enText(doc, "For compliance and due-diligence purposes only.", X, footerY + 8, W / 2 - 5);
      doc.font(FONT_AR).fontSize(6.7).fillColor(GRAY_LT);
      arText(doc, "للاستخدام في أغراض الامتثال والعناية الواجبة فقط.", X + W / 2, footerY + 8, W / 2 - 5);
      doc.font(FONT_EN).fontSize(6.7).fillColor(GRAY_LT);
      enText(doc, `Page ${pageIndex + 1} of ${pages.count}`, X, footerY + 22, W, { align: "center" });
    }
    doc.end();
  } catch (error) {
    console.error("[PDF Report Error]", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF report" });
  }
}

type BilingualLedgerRow = {
  enLabel: string;
  enValue: string;
  arLabel: string;
  arValue: string;
};

function ledgerRowHeight(doc: PDFKit.PDFDocument, row: BilingualLedgerRow, halfWidth: number) {
  const enHeight = measureSingleLanguageValueForPdf(doc, row.enValue, halfWidth - 26, false, 8.8);
  const arHeight = measureSingleLanguageValueForPdf(doc, row.arValue, halfWidth - 26, true, 8.8);
  return Math.max(66, Math.ceil(enHeight + arHeight + 37));
}

function ledgerSectionHeight(doc: PDFKit.PDFDocument, rows: BilingualLedgerRow[], halfWidth: number) {
  return 31 + rows.reduce((sum, row) => sum + ledgerRowHeight(doc, row, halfWidth), 0) + 12;
}

function drawLedgerSection(
  doc: PDFKit.PDFDocument,
  enTitle: string,
  arTitle: string,
  rows: BilingualLedgerRow[],
  x: number,
  y: number,
  width: number,
) {
  const halfWidth = width;
  doc.save().rect(x, y, width, 33).fill(GRAY_HEAD).restore();
  doc.save().rect(x, y, 4, 33).fill(GOLD).restore();
  doc.font(FONT_EN_B).fontSize(8.8).fillColor(INK);
  enText(doc, enTitle, x + 12, y + 7, halfWidth - 24);
  doc.font(FONT_AR_B).fontSize(8.8).fillColor(INK);
  // Arabic remains in the same left-side content path as English, not a mirrored column.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).text(arTitle, x + 12, y + 18, { align: "left", features: AR_FEAT, width: halfWidth - 24, lineBreak: false });
  let cursorY = y + 40;

  rows.forEach((row, index) => {
    const height = ledgerRowHeight(doc, row, halfWidth);
    if (index % 2 === 0) doc.save().rect(x, cursorY, width, height).fill(GRAY_ROW).restore();
    doc.save().strokeColor(BORDER).lineWidth(0.35)
      .moveTo(x, cursorY + height).lineTo(x + width, cursorY + height)
      .stroke().restore();

    doc.font(FONT_EN_B).fontSize(6.9).fillColor(GRAY_MID);
    enText(doc, row.enLabel, x + 12, cursorY + 7, halfWidth - 24);
    doc.font(FONT_EN).fontSize(8.8).fillColor(row.enValue === "—" ? GRAY_LT : INK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(row.enValue || "—", x + 12, cursorY + 19, { width: halfWidth - 24, align: "left", lineGap: 1 });

    const enHeight = measureSingleLanguageValueForPdf(doc, row.enValue, halfWidth - 24, false, 8.8);
    doc.font(FONT_AR_B).fontSize(6.9).fillColor(GRAY_MID);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(row.arLabel, x + 12, cursorY + 23 + enHeight, { align: "left", features: AR_FEAT, width: halfWidth - 24, lineBreak: false });
    doc.font(row.arValue === "—" ? FONT_EN : FONT_AR).fontSize(8.8).fillColor(row.arValue === "—" ? GRAY_LT : INK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(row.arValue || "—", x + 12, cursorY + 35 + enHeight, {
      width: halfWidth - 24,
      align: "left",
      features: row.arValue === "—" ? undefined : AR_FEAT,
      lineGap: 1,
    });
    cursorY += height;
  });
  return cursorY + 12;
}

export async function handleGeneratePdfReport(req: Request, res: Response) {
  try {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });
    const recordId = parseInt(req.params.id);
    if (Number.isNaN(recordId)) return res.status(400).json({ error: "Invalid record ID" });
    const record = await getRecordById(recordId);
    if (!record) return res.status(404).json({ error: "Record not found" });

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 34, bottom: 48, left: 46, right: 46 },
      bufferPages: true,
      info: { Title: `Sanctions Screening Report — ${record.nameEn}`, Author: "Yemen Sanctions Platform" },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="sanctions-report-${record.referenceNumber || recordId}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const X = 46;
    const W = doc.page.width - 92;
    const HALF = W / 2;
    const PH = doc.page.height;
    const CONTENT_BOTTOM = PH - 72;
    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    const logoExists = fs.existsSync(LOGO_PATH);
    const preparedBy = ctx.user.name || (ctx.user as { username?: string }).username || "—";
    const printedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const submitted = splitValueByScriptForPdf(String(req.query.submittedName || record.nameEn || "—"));
    const recordName = splitValueByScriptForPdf(record.nameEn || record.nameAr || "");
    const recordArabicName = splitValueByScriptForPdf(record.nameAr || "").arabic;
    const source = splitValueByScriptForPdf(record.issuingBody || "");
    const nationality = splitValueByScriptForPdf(record.nationality || "");
    const birthPlace = splitValueByScriptForPdf(record.placeOfBirth || "");
    const listingReason = splitValueByScriptForPdf(record.listingReason || "");
    const legalBasis = splitValueByScriptForPdf(record.legalBasis || "");
    const actionTaken = splitValueByScriptForPdf(record.actionTaken || "");
    const notes = splitValueByScriptForPdf(record.notes || record.rawNotes || "");
    const listing = buildListingContextRows(record).reduce((map, [label, value]) => ({ ...map, [label]: value }), {} as Record<string, string>);
    const aliases = ((record.alternativeNames as string[] | null) || []).map((name) => splitValueByScriptForPdf(name));
    const enAliases = aliases.map((name) => name.english).filter((name) => name !== "—").join("\n") || "—";
    const arAliases = aliases.map((name) => name.arabic).filter((name) => name !== "—").join("\n") || "—";
    const entityType = ({ individual: "Individual", organisation: "Organisation", vessel: "Vessel", unspecified: "Unspecified" } as Record<string, string>)[record.entityType || ""] || String(record.entityType || "—");
    let y = 34;

    const startContinuation = () => {
      doc.addPage();
      y = drawFormalHeader(doc, X, 34, W, logoExists, uid, true);
    };
    const drawSection = (enTitle: string, arTitle: string, rows: BilingualLedgerRow[]) => {
      const required = ledgerSectionHeight(doc, rows, HALF);
      if (y + required > CONTENT_BOTTOM) startContinuation();
      y = drawLedgerSection(doc, enTitle, arTitle, rows, X, y, W);
    };

    y = drawFormalHeader(doc, X, y, W, logoExists, uid);
    doc.save().rect(X, y, W, 41).fill(GRAY_HEAD).strokeColor(BORDER).lineWidth(0.4).stroke().restore();
    doc.font(FONT_EN_B).fontSize(7.1).fillColor(GRAY_MID);
    enText(doc, "RECORD UID", X + 12, y + 8, 95);
    enText(doc, "PREPARED BY", X + HALF - 35, y + 8, 98);
    doc.font(FONT_EN_B).fontSize(8.9).fillColor(GOLD);
    enText(doc, uid, X + 12, y + 21, 110);
    doc.font(FONT_EN).fontSize(8.3).fillColor(INK);
    enText(doc, preparedBy, X + HALF - 35, y + 21, 120);
    doc.font(FONT_AR_B).fontSize(7.2).fillColor(GRAY_MID);
    arText(doc, "تاريخ التقرير", X + W - 124, y + 8, 112);
    doc.font(FONT_EN).fontSize(8.3).fillColor(INK);
    enText(doc, printedDate, X + W - 120, y + 21, 108, { align: "right" });
    y += 57;

    drawSection("MATCH OVERVIEW", "ملخص المطابقة", [
      { enLabel: "SUBMITTED NAME", enValue: submitted.english, arLabel: "الاسم محل الفحص", arValue: submitted.arabic },
      { enLabel: "LISTED RECORD NAME", enValue: recordName.english, arLabel: "الاسم المدرج", arValue: recordArabicName },
    ]);

    drawSection("RECORD INFORMATION", "بيانات السجل", [
      { enLabel: "DATASET", enValue: source.english, arLabel: "الاسم العربي", arValue: recordArabicName },
      { enLabel: "ENTITY TYPE", enValue: entityType, arLabel: "الجنسية", arValue: nationality.arabic },
      { enLabel: "LISTING DATE", enValue: String(record.listingDate || "—"), arLabel: "مكان الميلاد", arValue: birthPlace.arabic },
      { enLabel: "SOURCE REFERENCE", enValue: uid, arLabel: "تاريخ الميلاد", arValue: splitValueByScriptForPdf(record.dateOfBirth || "").arabic },
      { enLabel: "ISSUING BODY", enValue: source.english, arLabel: "الجهة المصدرة", arValue: source.arabic },
    ]);

    drawSection("LISTING CONTEXT", "سياق الإدراج", [
      { enLabel: "LISTING PROGRAMME", enValue: splitValueByScriptForPdf(listing["Listing Programme"] || "").english, arLabel: "سبب الإدراج", arValue: listingReason.arabic },
      { enLabel: "REASON FOR LISTING", enValue: listingReason.english, arLabel: "الأساس القانوني", arValue: legalBasis.arabic },
      { enLabel: "LEGAL BASIS", enValue: legalBasis.english, arLabel: "الإجراء المطلوب", arValue: actionTaken.arabic },
      { enLabel: "ACTION REQUIRED", enValue: actionTaken.english, arLabel: "ملاحظات", arValue: notes.arabic },
      { enLabel: "NOTES", enValue: notes.english, arLabel: "المرجع المصدر", arValue: splitValueByScriptForPdf(listing["Source Reference"] || uid).arabic },
    ]);

    if (enAliases !== "—" || arAliases !== "—") {
      drawSection("ALTERNATIVE NAMES", "الأسماء البديلة", [
        { enLabel: "LATIN ALIASES", enValue: enAliases, arLabel: "الأسماء العربية", arValue: arAliases },
      ]);
    }

    const footerY = PH - 56;
    const pages = doc.bufferedPageRange();
    for (let pageIndex = 0; pageIndex < pages.count; pageIndex++) {
      doc.switchToPage(pageIndex);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc.page as any).margins.bottom = 0;
      hr(doc, footerY, X, X + W, BORDER, 0.4);
      doc.font(FONT_EN).fontSize(6.7).fillColor(GRAY_LT);
      enText(doc, "For compliance and due-diligence purposes only.", X, footerY + 8, HALF - 5);
      doc.font(FONT_AR).fontSize(6.7).fillColor(GRAY_LT);
      arText(doc, "للاستخدام في أغراض الامتثال والعناية الواجبة فقط.", X + HALF, footerY + 8, HALF - 5);
      doc.font(FONT_EN).fontSize(6.7).fillColor(GRAY_LT);
      enText(doc, `Page ${pageIndex + 1} of ${pages.count}`, X, footerY + 22, W, { align: "center" });
    }
    doc.end();
  } catch (error) {
    console.error("[PDF Report Error]", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF report" });
  }
}
