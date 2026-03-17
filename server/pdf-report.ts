/**
 * PDF Report Generator — SanctionCheck Match Details Report
 * Professional design inspired by LSEG World-Check One format
 * Bilingual (Arabic/English) with proper RTL rendering
 */
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getRecordById } from "./search-engine";
import { createContext } from "./_core/context";

const __filename = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename);
const FONTS_DIR = path.join(__dirname_local, "fonts");
const FONT_ARABIC        = path.join(FONTS_DIR, "NotoSansArabic-Regular.ttf");
const FONT_ARABIC_BOLD   = path.join(FONTS_DIR, "NotoSansArabic-Bold.ttf");
const FONT_LATIN         = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FONT_LATIN_BOLD    = path.join(FONTS_DIR, "NotoSans-Bold.ttf");
const LOGO_PATH          = path.join(FONTS_DIR, "logo.png");

// RTL OpenType features
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AR: any[] = ['rtla', 'arab', 'init', 'medi', 'fina', 'isol'];

// ── Palette ──────────────────────────────────────────────────────────────────
const BLUE_HEADER  = "#1B3A6B";   // deep navy (like LSEG header)
const BLUE_SECTION = "#1B3A6B";   // section title background
const BLUE_LINK    = "#1B5EBF";   // hyperlink-style blue for names
const GOLD         = "#C17F3E";   // Al-Mustashar gold accent
const ROW_ALT      = "#F2F5FA";   // alternating row tint
const ROW_HEADER   = "#D9E3F0";   // table column header
const TEXT_DARK    = "#1A1A2E";
const TEXT_MID     = "#5A6A7A";
const TEXT_LIGHT   = "#8A9BB0";
const RED_ALERT    = "#C0392B";
const WHITE        = "#FFFFFF";
const BORDER_COLOR = "#C8D4E3";

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasArabic(t: string) { return /[\u0600-\u06FF]/.test(t); }
function hasLatin(t: string)  { return /[a-zA-Z]/.test(t); }

/** Write Arabic text with RTL features */
function ar(doc: PDFKit.PDFDocument, text: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).text(text, x, y, { align: "right", features: AR, ...opts });
}

/** Write Latin text */
function lat(doc: PDFKit.PDFDocument, text: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions = {}) {
  doc.text(text, x, y, { align: "left", ...opts });
}

/**
 * Smart text renderer: detects mixed Arabic+Latin and renders in two lines.
 * Returns the Y position after rendering.
 */
function autoText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions = {},
  bold = false,
  size = 9
): number {
  if (!text) return y;
  const af = bold ? FONT_ARABIC_BOLD : FONT_ARABIC;
  const lf = bold ? FONT_LATIN_BOLD  : FONT_LATIN;
  const w  = (opts.width as number) || 400;
  const arabicPart = text.replace(/[^\u0600-\u06FF\u0750-\u077F\s]/g, "").trim();
  const latinPart  = text
    .replace(/[\u0600-\u06FF\u0750-\u077F]/g, "")
    .replace(/[()\[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let cy = y;
  if (arabicPart && latinPart) {
    doc.font(lf).fontSize(size).fillColor(TEXT_DARK);
    doc.text(latinPart, x, cy, { align: "left", width: w, lineBreak: false });
    cy += size + 4;
    doc.font(af).fontSize(size).fillColor(TEXT_DARK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(arabicPart, x, cy, { align: "right", features: AR, width: w, lineBreak: false });
    cy += size + 4;
  } else if (arabicPart) {
    doc.font(af).fontSize(size).fillColor(TEXT_DARK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(arabicPart, x, cy, { align: "right", features: AR, width: w, ...opts });
    cy += size + 4;
  } else {
    doc.font(lf).fontSize(size).fillColor(TEXT_DARK);
    doc.text(latinPart || text, x, cy, { align: "left", width: w, ...opts });
    cy += size + 4;
  }
  return cy;
}

/** Draw a horizontal rule */
function hRule(doc: PDFKit.PDFDocument, y: number, x1 = 40, x2?: number, color = BORDER_COLOR, lw = 0.5) {
  const pw = doc.page.width;
  doc.save().strokeColor(color).lineWidth(lw)
    .moveTo(x1, y).lineTo(x2 ?? pw - 40, y).stroke().restore();
}

/**
 * Draw a section header bar (like LSEG "CASE AND COMPARISON DATA")
 */
function sectionHeader(doc: PDFKit.PDFDocument, titleEn: string, titleAr: string, y: number, pageWidth: number): number {
  const cw = pageWidth - 80;
  doc.save().rect(40, y, cw, 20).fill(BLUE_SECTION).restore();
  doc.font(FONT_LATIN_BOLD).fontSize(8).fillColor(WHITE);
  lat(doc, titleEn, 46, y + 6, { width: cw / 2 });
  doc.font(FONT_ARABIC_BOLD).fontSize(8).fillColor(WHITE);
  ar(doc, titleAr, 40, y + 6, { width: cw - 6 });
  return y + 26;
}

/**
 * Draw a two-column table row.
 * labelCol: left label cell width
 * valueCol: right value cell width
 */
function tableRow(
  doc: PDFKit.PDFDocument,
  labelEn: string,
  labelAr: string,
  value: string,
  x: number,
  y: number,
  labelW: number,
  valueW: number,
  rowH: number,
  shade: boolean
): number {
  const totalW = labelW + valueW;

  // Row background
  if (shade) {
    doc.save().rect(x, y, totalW, rowH).fill(ROW_ALT).restore();
  } else {
    doc.save().rect(x, y, totalW, rowH).fill(WHITE).restore();
  }

  // Cell borders
  doc.save().strokeColor(BORDER_COLOR).lineWidth(0.4)
    .rect(x, y, totalW, rowH).stroke()
    .moveTo(x + labelW, y).lineTo(x + labelW, y + rowH).stroke()
    .restore();

  // Label cell: English top, Arabic bottom
  doc.font(FONT_LATIN_BOLD).fontSize(7.5).fillColor(TEXT_DARK);
  lat(doc, labelEn, x + 5, y + 5, { width: labelW - 10, lineBreak: false });
  doc.font(FONT_ARABIC).fontSize(7).fillColor(TEXT_MID);
  ar(doc, labelAr, x, y + 16, { width: labelW - 5, lineBreak: false });

  // Value cell: smart font detection
  const vx = x + labelW + 5;
  const vw = valueW - 10;
  const display = value || "—";
  doc.fontSize(8.5);

  if (hasArabic(display) && hasLatin(display)) {
    // Mixed: two lines
    const arabicPart = display.replace(/[^\u0600-\u06FF\u0750-\u077F\s]/g, "").trim();
    const latinPart  = display.replace(/[\u0600-\u06FF\u0750-\u077F]/g, "").replace(/[()\[\]{}<>]/g, " ").replace(/\s+/g, " ").trim();
    doc.font(FONT_LATIN_BOLD).fontSize(8.5).fillColor(TEXT_DARK);
    lat(doc, latinPart, vx, y + 5, { width: vw, lineBreak: false });
    doc.font(FONT_ARABIC_BOLD).fontSize(8.5).fillColor(TEXT_DARK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).text(arabicPart, x + labelW, y + 18, { align: "right", features: AR, width: valueW - 5, lineBreak: false });
  } else if (hasArabic(display)) {
    doc.font(FONT_ARABIC_BOLD).fontSize(8.5).fillColor(TEXT_DARK);
    ar(doc, display, x + labelW, y + 5, { width: valueW - 5, lineBreak: false });
  } else {
    doc.font(FONT_LATIN_BOLD).fontSize(8.5).fillColor(TEXT_DARK);
    lat(doc, display, vx, y + 5, { width: vw, lineBreak: false });
  }

  return y + rowH;
}

/** Draw a full-width text row (for long values like listing reason) */
function tableRowFull(
  doc: PDFKit.PDFDocument,
  labelEn: string,
  labelAr: string,
  value: string,
  x: number,
  y: number,
  totalW: number,
  shade: boolean
): number {
  const labelH = 22;
  const display = value || "—";

  // Estimate value height
  const isMixed = hasArabic(display) && hasLatin(display);
  const lines = isMixed ? 2 : Math.max(1, Math.ceil(display.length / 85));
  const valueH = lines * 13 + 10;
  const rowH = labelH + valueH;

  // Background
  doc.save().rect(x, y, totalW, rowH).fill(shade ? ROW_ALT : WHITE).restore();
  doc.save().strokeColor(BORDER_COLOR).lineWidth(0.4).rect(x, y, totalW, rowH).stroke().restore();

  // Label row
  doc.save().rect(x, y, totalW, labelH).fill(ROW_HEADER).restore();
  doc.font(FONT_LATIN_BOLD).fontSize(7.5).fillColor(TEXT_DARK);
  lat(doc, labelEn, x + 5, y + 4, { width: totalW / 2, lineBreak: false });
  doc.font(FONT_ARABIC_BOLD).fontSize(7.5).fillColor(TEXT_DARK);
  ar(doc, labelAr, x, y + 4, { width: totalW - 5, lineBreak: false });

  // Value
  const vy = y + labelH + 4;
  autoText(doc, display, x + 5, vy, { width: totalW - 10 }, false, 8.5);

  return y + rowH + 4;
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function _handleGeneratePdfReport(req: Request, res: Response) {
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
      margins: { top: 40, bottom: 60, left: 40, right: 40 },
      bufferPages: true,
      info: {
        Title: `SanctionCheck Match Details Report — ${record.nameEn}`,
        Author: "Al-Mustashar Legal Consultancy",
        Subject: "Sanctions Screening Match Details Report",
        Creator: "SanctionCheck Platform",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `attachment; filename="sanctions-report-${recordId}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const pageWidth  = doc.page.width;   // 595
    const cw         = pageWidth - 80;   // content width
    let y            = 40;

    // ── HEADER ────────────────────────────────────────────────────────────────
    // Top navy bar
    doc.save().rect(0, 0, pageWidth, 72).fill(BLUE_HEADER).restore();

    // Logo (left)
    if (logoExists) {
      doc.save().rect(28, 8, 56, 56).fill(WHITE).restore();
      doc.image(LOGO_PATH, 30, 10, { width: 52, height: 52 });
    }

    // Title block (right of logo)
    doc.font(FONT_LATIN_BOLD).fontSize(13).fillColor(WHITE);
    lat(doc, "Al-Mustashar Legal Consultancy", 92, 12, { width: cw - 52 });
    doc.font(FONT_ARABIC_BOLD).fontSize(11).fillColor(GOLD);
    ar(doc, "المستشار للاستشارات القانونية", 40, 12, { width: cw });
    doc.font(FONT_LATIN_BOLD).fontSize(9.5).fillColor("#CBD5E1");
    lat(doc, "SANCTIONCHECK MATCH DETAILS REPORT", 92, 34, { width: cw - 52 });
    doc.font(FONT_ARABIC).fontSize(8).fillColor("#94A3B8");
    ar(doc, "تقرير تفاصيل تطابق فحص العقوبات", 40, 36, { width: cw });

    // "Confidential" badge (top right)
    doc.font(FONT_LATIN_BOLD).fontSize(7.5).fillColor("#FCA5A5");
    lat(doc, "CONFIDENTIAL", pageWidth - 120, 10, { width: 80, align: "right" });

    // Gold accent line
    doc.save().rect(0, 72, pageWidth, 3).fill(GOLD).restore();

    y = 82;

    // ── RECORD UID ROW ────────────────────────────────────────────────────────
    doc.save().rect(40, y, cw, 28).fill("#EEF3FB").restore();
    doc.save().strokeColor(BORDER_COLOR).lineWidth(0.5).rect(40, y, cw, 28).stroke().restore();

    const uid = record.referenceNumber || `SC-${String(record.id).padStart(7, "0")}`;
    doc.font(FONT_LATIN_BOLD).fontSize(8).fillColor(TEXT_MID);
    lat(doc, "RECORD UID:", 46, y + 5, { width: 90, lineBreak: false });
    doc.font(FONT_LATIN_BOLD).fontSize(9).fillColor(BLUE_LINK);
    lat(doc, uid, 110, y + 4, { width: 200, lineBreak: false });

    // Screened by + date (right side)
    const screenDate = new Date();
    const dateStr = screenDate.toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    });
    const timeStr = screenDate.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false
    });
    const userName = ctx.user.name || (ctx.user as { username?: string }).username || "—";

    doc.font(FONT_LATIN).fontSize(7.5).fillColor(TEXT_MID);
    lat(doc, `Screened: ${dateStr}  ${timeStr}`, pageWidth - 280, y + 5, { width: 200, align: "right", lineBreak: false });
    lat(doc, `By: ${userName}`, pageWidth - 280, y + 16, { width: 200, align: "right", lineBreak: false });

    y += 36;

    // ── CASE AND COMPARISON DATA ──────────────────────────────────────────────
    y = sectionHeader(doc, "CASE AND COMPARISON DATA", "بيانات الحالة والمقارنة", y, pageWidth);

    // Column headers
    const col1W = 100;
    const col2W = (cw - col1W) / 2;
    const col3W = (cw - col1W) / 2;

    doc.save().rect(40, y, cw, 18).fill(ROW_HEADER).restore();
    doc.save().strokeColor(BORDER_COLOR).lineWidth(0.4).rect(40, y, cw, 18).stroke()
      .moveTo(40 + col1W, y).lineTo(40 + col1W, y + 18).stroke()
      .moveTo(40 + col1W + col2W, y).lineTo(40 + col1W + col2W, y + 18).stroke()
      .restore();

    doc.font(FONT_LATIN_BOLD).fontSize(7.5).fillColor(TEXT_DARK);
    lat(doc, "", 46, y + 5, { width: col1W - 10, lineBreak: false });
    lat(doc, "Client / Submitted Data", 40 + col1W + 5, y + 5, { width: col2W - 10, lineBreak: false });
    lat(doc, "SanctionCheck Data", 40 + col1W + col2W + 5, y + 5, { width: col3W - 10, lineBreak: false });

    y += 18;

    // Name comparison row
    const submittedName = (req.query.submittedName as string) || record.nameEn || "—";
    const rowH1 = 28;
    doc.save().rect(40, y, cw, rowH1).fill(ROW_ALT).restore();
    doc.save().strokeColor(BORDER_COLOR).lineWidth(0.4).rect(40, y, cw, rowH1).stroke()
      .moveTo(40 + col1W, y).lineTo(40 + col1W, y + rowH1).stroke()
      .moveTo(40 + col1W + col2W, y).lineTo(40 + col1W + col2W, y + rowH1).stroke()
      .restore();

    doc.font(FONT_LATIN_BOLD).fontSize(7.5).fillColor(TEXT_DARK);
    lat(doc, "Name", 46, y + 10, { width: col1W - 10, lineBreak: false });

    // Submitted name with checkmark
    doc.font(FONT_LATIN).fontSize(8).fillColor(TEXT_DARK);
    lat(doc, submittedName, 40 + col1W + 5, y + 5, { width: col2W - 10, lineBreak: false });
    if (record.nameAr) {
      doc.font(FONT_ARABIC).fontSize(7.5).fillColor(TEXT_MID);
      ar(doc, record.nameAr, 40 + col1W, y + 16, { width: col2W - 5, lineBreak: false });
    }

    // Matched name (SanctionCheck data)
    doc.font(FONT_LATIN_BOLD).fontSize(8).fillColor(BLUE_LINK);
    lat(doc, record.nameEn || "—", 40 + col1W + col2W + 5, y + 5, { width: col3W - 10, lineBreak: false });
    if (record.nameAr) {
      doc.font(FONT_ARABIC).fontSize(7.5).fillColor(TEXT_MID);
      ar(doc, record.nameAr, 40 + col1W + col2W, y + 16, { width: col3W - 5, lineBreak: false });
    }

    y += rowH1 + 8;

    // ── SCREENING METADATA ────────────────────────────────────────────────────
    y = sectionHeader(doc, "SCREENING INFORMATION", "معلومات الفحص", y, pageWidth);

    const halfW = (cw - 4) / 2;

    // Row: Screened By + Date Screened
    let ry = y;
    ry = tableRow(doc, "Screened By", "فحص بواسطة", userName, 40, ry, 120, halfW - 120, 32, false);
    // Date + time (right column)
    tableRow(doc, "Date & Time Screened", "تاريخ ووقت الفحص",
      `${dateStr}  ${timeStr}`, 40 + halfW + 4, y, 140, halfW - 140, 32, false);
    y = ry;

    // Row: Platform + Record ID
    ry = tableRow(doc, "Platform", "المنصة", "SanctionCheck — Al-Mustashar", 40, y, 120, halfW - 120, 28, true);
    tableRow(doc, "Record ID", "رقم السجل", uid, 40 + halfW + 4, y, 140, halfW - 140, 28, true);
    y = ry + 8;

    // ── KEY DATA ──────────────────────────────────────────────────────────────
    y = sectionHeader(doc, "KEY DATA", "البيانات الأساسية", y, pageWidth);

    const entityTypeMap: Record<string, string> = {
      individual: "Individual", organisation: "Organisation",
      vessel: "Vessel", unspecified: "Unspecified",
    };

    let shade = false;
    const rows: [string, string, string][] = [
      ["Dataset / Programme", "البرنامج / القائمة", record.issuingBody || "—"],
      ["Category", "الفئة", record.entityType ? entityTypeMap[record.entityType] || record.entityType : "—"],
      ["Entity Type", "نوع الكيان", record.entityType ? entityTypeMap[record.entityType] || record.entityType : "—"],
      ["Name", "الاسم", record.nameEn || "—"],
      ["Nationality / Citizenship", "الجنسية", record.nationality || "—"],
      ["Date of Birth", "تاريخ الميلاد", record.dateOfBirth || "—"],
      ["Place of Birth", "مكان الميلاد", record.placeOfBirth || "—"],
      ["Listing Date", "تاريخ الإدراج", record.listingDate || "—"],
      ["Issuing Body", "الجهة المُدرِجة", record.issuingBody || "—"],
    ];

    for (const [en, ar_label, val] of rows) {
      y = tableRow(doc, en, ar_label, val, 40, y, 160, cw - 160, 30, shade);
      shade = !shade;
    }

    y += 8;

    // ── LISTING REASON (full width) ───────────────────────────────────────────
    if (record.listingReason) {
      y = sectionHeader(doc, "LISTING REASON", "سبب الإدراج", y, pageWidth);
      y = tableRowFull(doc, "Listing Reason", "سبب الإدراج", record.listingReason, 40, y, cw, false);
      y += 4;
    }

    // ── LEGAL BASIS ───────────────────────────────────────────────────────────
    if (record.legalBasis) {
      y = sectionHeader(doc, "LEGAL BASIS", "السند القانوني", y, pageWidth);
      y = tableRowFull(doc, "Legal Basis", "السند القانوني", record.legalBasis, 40, y, cw, false);
      y += 4;
    }

    // ── ALIASES ───────────────────────────────────────────────────────────────
    const altNames = record.alternativeNames as string[] | null;
    if (altNames && altNames.length > 0) {
      const cleanNames = altNames
        .map(n => n.replace(/[^\u0000-\u024F\u0600-\u06FF\u0750-\u077F\s]/g, ""))
        .filter(n => n.trim().length > 0);

      if (cleanNames.length > 0) {
        y = sectionHeader(doc, "ALIASES", "الأسماء البديلة", y, pageWidth);

        // Column headers
        doc.save().rect(40, y, cw, 18).fill(ROW_HEADER).restore();
        doc.save().strokeColor(BORDER_COLOR).lineWidth(0.4).rect(40, y, cw, 18).stroke().restore();
        doc.font(FONT_LATIN_BOLD).fontSize(7.5).fillColor(TEXT_DARK);
        lat(doc, "Aliases", 46, y + 5, { width: cw / 2, lineBreak: false });
        doc.font(FONT_ARABIC_BOLD).fontSize(7.5).fillColor(TEXT_DARK);
        ar(doc, "الأسماء البديلة والأسماء بالأحرف الأصلية", 40, y + 5, { width: cw - 6, lineBreak: false });
        y += 18;

        let aliasShade = false;
        for (const name of cleanNames.slice(0, 20)) {
          const rh = 22;
          doc.save().rect(40, y, cw, rh).fill(aliasShade ? ROW_ALT : WHITE).restore();
          doc.save().strokeColor(BORDER_COLOR).lineWidth(0.4).rect(40, y, cw, rh).stroke().restore();
          doc.fontSize(8.5);
          if (hasArabic(name) && hasLatin(name)) {
            const ap = name.replace(/[^\u0600-\u06FF\u0750-\u077F\s]/g, "").trim();
            const lp = name.replace(/[\u0600-\u06FF\u0750-\u077F]/g, "").replace(/[()\[\]{}<>]/g, " ").replace(/\s+/g, " ").trim();
            doc.font(FONT_LATIN).fillColor(TEXT_DARK);
            lat(doc, lp, 46, y + 4, { width: cw / 2, lineBreak: false });
            doc.font(FONT_ARABIC).fillColor(TEXT_DARK);
            ar(doc, ap, 40, y + 4, { width: cw - 6, lineBreak: false });
          } else if (hasArabic(name)) {
            doc.font(FONT_ARABIC).fillColor(TEXT_DARK);
            ar(doc, name, 40, y + 6, { width: cw - 6, lineBreak: false });
          } else {
            doc.font(FONT_LATIN).fillColor(TEXT_DARK);
            lat(doc, name, 46, y + 6, { width: cw - 10, lineBreak: false });
          }
          y += rh;
          aliasShade = !aliasShade;
        }
        y += 8;
      }
    }

    // ── NOTES ─────────────────────────────────────────────────────────────────
    if (record.notes) {
      y = sectionHeader(doc, "NOTES", "ملاحظات", y, pageWidth);
      y = tableRowFull(doc, "Notes", "ملاحظات", record.notes, 40, y, cw, false);
      y += 4;
    }

    // ── FOOTER (all pages) ────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      (doc.page as any).margins.bottom = 0;

      const fY = doc.page.height - 58;

      // Footer background
      doc.save().rect(0, fY - 4, pageWidth, 62).fill("#F0F4FA").restore();
      hRule(doc, fY - 4, 0, pageWidth, GOLD, 1.5);

      // Logo
      if (logoExists) {
        doc.image(LOGO_PATH, 40, fY + 4, { width: 36, height: 36 });
      }

      // Footer text
      doc.font(FONT_ARABIC).fontSize(7).fillColor(TEXT_MID);
      ar(doc, "هذا التقرير صادر عن منصة SanctionCheck — المستشار للاستشارات القانونية. للأغراض القانونية والامتثالية فقط.",
        40, fY + 4, { width: cw, align: "center", lineBreak: false });

      doc.font(FONT_LATIN).fontSize(7).fillColor(TEXT_MID);
      lat(doc, "This report is issued by SanctionCheck — Al-Mustashar Legal Consultancy. For compliance and due diligence purposes only.",
        40, fY + 17, { width: cw, align: "center", lineBreak: false });

      // Page number
      doc.font(FONT_LATIN).fontSize(7).fillColor(TEXT_LIGHT);
      lat(doc, `Page ${i - range.start + 1} of ${range.count}`,
        40, fY + 30, { width: cw, align: "center", lineBreak: false });

      // Screened by + date (bottom right)
      doc.font(FONT_LATIN).fontSize(6.5).fillColor(TEXT_LIGHT);
      lat(doc, `Screened by: ${userName}  |  ${dateStr} ${timeStr}`,
        40, fY + 42, { width: cw, align: "center", lineBreak: false });
    }

    // Remove trailing blank pages
    const finalRange = doc.bufferedPageRange();
    const lastIdx = finalRange.start + finalRange.count - 1;
    doc.switchToPage(lastIdx);
    // If last page has very little content (y < 150), remove it by not rendering footer there
    // Footer was already applied in the loop above, just flush and end
    doc.flushPages();
    doc.end();
  } catch (err) {
    console.error("[PDF Report Error]", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF report" });
  }
}

export { _handleGeneratePdfReport as handleGeneratePdfReport };
