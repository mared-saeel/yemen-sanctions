/**
 * PDF Report Generator
 * Generates a professional sanctions screening report in Arabic/English
 * using PDFKit with dual fonts: NotoSansArabic (Arabic) + NotoSans (English/Latin)
 *
 * Key fix: Arabic text requires `features: ['rtla', 'arab']` for correct RTL rendering
 */
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import { getRecordById } from "./search-engine";
import { createContext } from "./_core/context";

// Font paths - bundled inside server/fonts/ for production compatibility
// Use import.meta.url since this is an ES module (no __dirname available)
const __filename = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename);
const FONTS_DIR = path.join(__dirname_local, "fonts");
const FONT_ARABIC = path.join(FONTS_DIR, "NotoSansArabic-Regular.ttf");
const FONT_ARABIC_BOLD = path.join(FONTS_DIR, "NotoSansArabic-Bold.ttf");
const FONT_LATIN = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FONT_LATIN_BOLD = path.join(FONTS_DIR, "NotoSans-Bold.ttf");

// RTL OpenType features required for correct Arabic rendering in PDFKit
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ARABIC_FEATURES: any[] = ['rtla', 'arab', 'init', 'medi', 'fina', 'isol'];

// Brand colors
const GOLD = "#C17F3E";
const DARK = "#1a1a2e";
const LIGHT_GRAY = "#f8f9fa";
const MID_GRAY = "#6c757d";
const BORDER = "#e2e8f0";
const RED_ALERT = "#dc2626";

/**
 * Detect if text is primarily Arabic (RTL)
 */
function isArabicText(text: string): boolean {
  if (!text) return false;
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F]/g) || []).length;
  return arabicChars > text.length * 0.3;
}

/**
 * Write Arabic text with proper RTL features
 */
function writeArabic(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).text(text, x, y, {
    align: "right",
    features: ARABIC_FEATURES,
    ...opts,
  });
}

/**
 * Write Latin/English text
 */
function writeLatin(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions = {}
) {
  doc.text(text, x, y, {
    align: "left",
    ...opts,
  });
}

function drawHorizontalLine(doc: PDFKit.PDFDocument, y: number, color = BORDER) {
  doc.save()
    .strokeColor(color)
    .lineWidth(0.5)
    .moveTo(40, y)
    .lineTo(doc.page.width - 40, y)
    .stroke()
    .restore();
}

function drawSection(doc: PDFKit.PDFDocument, titleAr: string, titleEn: string, y: number): number {
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 80;

  doc.save()
    .rect(40, y, contentWidth, 24)
    .fill("#f1f5f9")
    .restore();

  // Arabic title (right)
  doc.font(FONT_ARABIC_BOLD).fontSize(8).fillColor(DARK);
  writeArabic(doc, titleAr, 40, y + 7, { width: contentWidth });

  // English title (left)
  doc.font(FONT_LATIN).fontSize(7.5).fillColor(MID_GRAY);
  writeLatin(doc, titleEn, 50, y + 8, { width: 200 });

  return y + 30;
}

function drawField(
  doc: PDFKit.PDFDocument,
  labelAr: string,
  labelEn: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height = 44
): void {
  // Box background
  doc.save()
    .rect(x, y, width, height)
    .fillAndStroke(LIGHT_GRAY, BORDER)
    .restore();

  // Arabic label (right)
  doc.font(FONT_ARABIC).fontSize(6.5).fillColor(MID_GRAY);
  writeArabic(doc, labelAr, x + 6, y + 5, { width: width - 12 });

  // English label (left)
  doc.font(FONT_LATIN).fontSize(6).fillColor(MID_GRAY);
  writeLatin(doc, labelEn, x + 6, y + 6, { width: width - 12 });

  // Value - use correct font based on content
  const isArabic = isArabicText(value);
  const displayValue = value || "—";

  if (isArabic) {
    doc.font(FONT_ARABIC_BOLD).fontSize(9).fillColor(DARK);
    writeArabic(doc, displayValue, x + 6, y + 20, { width: width - 12 });
  } else {
    doc.font(FONT_LATIN_BOLD).fontSize(9).fillColor(DARK);
    writeLatin(doc, displayValue, x + 6, y + 20, { width: width - 12 });
  }
}

export async function handleGeneratePdfReport(req: Request, res: Response) {
  try {
    // Auth check
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const recordId = parseInt(req.params.id);
    if (isNaN(recordId)) {
      return res.status(400).json({ error: "Invalid record ID" });
    }

    const record = await getRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }

    // Generate PDF
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: `Sanctions Screening Report - ${record.nameEn}`,
        Author: "Al-Mustashar Legal Consultancy",
        Subject: "Sanctions Screening Report",
        Creator: "SanctionCheck Platform",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sanctions-report-${recordId}-${Date.now()}.pdf"`
    );
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 80;
    let y = 40;

    // ─── HEADER BANNER ────────────────────────────────────────────────────────
    doc.save()
      .rect(0, 0, pageWidth, 82)
      .fill(DARK)
      .restore();

    // Gold accent line
    doc.save()
      .rect(0, 82, pageWidth, 4)
      .fill(GOLD)
      .restore();

    // Platform title (left side) - English font
    doc.font(FONT_LATIN_BOLD).fontSize(18).fillColor("#ffffff");
    writeLatin(doc, "SanctionCheck", 40, 20, { width: 200 });

    doc.font(FONT_LATIN).fontSize(8).fillColor("#94a3b8");
    writeLatin(doc, "Sanctions Screening Platform", 40, 44, { width: 200 });

    // Arabic title (right side) - Arabic font
    doc.font(FONT_ARABIC_BOLD).fontSize(14).fillColor("#ffffff");
    writeArabic(doc, "تقرير فحص العقوبات الدولية", 0, 20, { width: pageWidth - 40 });

    doc.font(FONT_ARABIC).fontSize(8).fillColor(GOLD);
    writeArabic(doc, "المستشار للاستشارات القانونية", 0, 44, { width: pageWidth - 40 });

    y = 102;

    // ─── ALERT BANNER ─────────────────────────────────────────────────────────
    doc.save()
      .rect(40, y, contentWidth, 38)
      .fillAndStroke("#fef2f2", "#fecaca")
      .restore();

    doc.save()
      .rect(40, y, 4, 38)
      .fill(RED_ALERT)
      .restore();

    // Arabic alert
    doc.font(FONT_ARABIC_BOLD).fontSize(10).fillColor(RED_ALERT);
    writeArabic(doc, "كيان مدرج على قوائم العقوبات الدولية", 40, y + 6, {
      align: "center",
      width: contentWidth,
    });

    // English alert
    doc.font(FONT_LATIN).fontSize(7.5).fillColor("#991b1b");
    writeLatin(doc, "SANCTIONED ENTITY — This entity appears on international sanctions lists", 40, y + 23, {
      align: "center",
      width: contentWidth,
    });

    y += 52;

    // ─── REPORT META INFO ─────────────────────────────────────────────────────
    const reportDate = new Date().toLocaleDateString("ar-SA", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    doc.save()
      .rect(40, y, contentWidth, 30)
      .fill("#fffbeb")
      .restore();

    // Date (Arabic)
    doc.font(FONT_ARABIC).fontSize(7.5).fillColor(MID_GRAY);
    writeArabic(doc, `تاريخ الفحص: ${reportDate}`, 0, y + 10, { width: pageWidth - 50 });

    // Record ID (Latin)
    doc.font(FONT_LATIN).fontSize(7.5).fillColor(MID_GRAY);
    writeLatin(doc, `Record ID: ${record.referenceNumber || `ID-${record.id}`}`, 50, y + 5, { width: 200 });

    // User
    const userName = ctx.user.name || (ctx.user as { username?: string }).username || "—";
    const isArabicName = isArabicText(userName);
    if (isArabicName) {
      doc.font(FONT_ARABIC).fontSize(7.5).fillColor(MID_GRAY);
      writeArabic(doc, `المستخدم: ${userName}`, 50, y + 18, { width: 200 });
    } else {
      doc.font(FONT_LATIN).fontSize(7.5).fillColor(MID_GRAY);
      writeLatin(doc, `User: ${userName}`, 50, y + 18, { width: 200 });
    }

    y += 44;

    // ─── PRIMARY NAMES SECTION ────────────────────────────────────────────────
    y = drawSection(doc, "الأسماء الأساسية", "Primary Names", y);

    // Name box full width
    doc.save()
      .rect(40, y, contentWidth, 56)
      .fillAndStroke("#ffffff", BORDER)
      .restore();

    // English name (Latin font - large)
    doc.font(FONT_LATIN_BOLD).fontSize(14).fillColor(DARK);
    writeLatin(doc, record.nameEn || "—", 46, y + 8, { width: contentWidth - 12 });

    // Arabic name (Arabic font)
    if (record.nameAr) {
      doc.font(FONT_ARABIC).fontSize(11).fillColor(MID_GRAY);
      writeArabic(doc, record.nameAr, 40, y + 32, { width: contentWidth - 10 });
    }

    y += 64;

    // Alternative names
    const altNames = record.alternativeNames as string[] | null;
    if (altNames && altNames.length > 0) {
      doc.font(FONT_ARABIC).fontSize(7.5).fillColor(MID_GRAY);
      writeArabic(doc, "الأسماء البديلة: " + altNames.join(" | "), 40, y, {
        width: contentWidth,
      });
      y += 18;
    }

    y += 6;

    // ─── ENTITY DETAILS SECTION ───────────────────────────────────────────────
    y = drawSection(doc, "تفاصيل الكيان", "Entity Details", y);

    const entityTypeEn: Record<string, string> = {
      individual: "Individual",
      organisation: "Organisation",
      vessel: "Vessel",
      unspecified: "Unspecified",
    };

    const halfW = (contentWidth - 8) / 2;
    const entityType = record.entityType || "unspecified";

    // Row 1: Entity Type + Nationality
    drawField(doc, "نوع الكيان", "Entity Type",
      entityTypeEn[entityType] || entityType,
      40, y, halfW);
    drawField(doc, "الجنسية", "Nationality",
      record.nationality || "—",
      40 + halfW + 8, y, halfW);
    y += 52;

    // Row 2: Date of Birth + Place of Birth
    if (record.dateOfBirth || record.placeOfBirth) {
      drawField(doc, "تاريخ الميلاد", "Date of Birth",
        record.dateOfBirth || "—",
        40, y, halfW);
      drawField(doc, "مكان الميلاد", "Place of Birth",
        record.placeOfBirth || "—",
        40 + halfW + 8, y, halfW);
      y += 52;
    }

    y += 6;

    // ─── LISTING INFORMATION SECTION ──────────────────────────────────────────
    y = drawSection(doc, "معلومات الإدراج", "Listing Information", y);

    // Issuing Body + Listing Date
    drawField(doc, "الجهة المدرجة", "Issuing Body",
      record.issuingBody || "—",
      40, y, halfW);
    drawField(doc, "تاريخ الإدراج", "Listing Date",
      record.listingDate || "—",
      40 + halfW + 8, y, halfW);
    y += 52;

    // Legal Basis full width
    if (record.legalBasis) {
      drawField(doc, "السند القانوني", "Legal Basis",
        record.legalBasis,
        40, y, contentWidth, 44);
      y += 52;
    }

    // Listing Reason full width
    if (record.listingReason) {
      const reasonHeight = Math.max(44, Math.ceil(record.listingReason.length / 80) * 14 + 28);
      drawField(doc, "سبب الإدراج", "Listing Reason",
        record.listingReason,
        40, y, contentWidth, reasonHeight);
      y += reasonHeight + 8;
    }

    // Action Taken full width
    if (record.actionTaken) {
      const actionHeight = Math.max(44, Math.ceil(record.actionTaken.length / 80) * 14 + 28);
      drawField(doc, "الإجراء المتخذ", "Action Taken",
        record.actionTaken,
        40, y, contentWidth, actionHeight);
      y += actionHeight + 8;
    }

    // Notes
    if (record.notes) {
      y = drawSection(doc, "ملاحظات", "Notes", y);
      const notesHeight = Math.max(44, Math.ceil(record.notes.length / 90) * 14 + 28);
      doc.save()
        .rect(40, y, contentWidth, notesHeight)
        .fillAndStroke("#fffbeb", "#fde68a")
        .restore();

      const isArabicNotes = isArabicText(record.notes);
      if (isArabicNotes) {
        doc.font(FONT_ARABIC).fontSize(8.5).fillColor(DARK);
        writeArabic(doc, record.notes, 50, y + 10, { width: contentWidth - 20 });
      } else {
        doc.font(FONT_LATIN).fontSize(8.5).fillColor(DARK);
        writeLatin(doc, record.notes, 50, y + 10, { width: contentWidth - 20 });
      }
      y += notesHeight + 8;
    }

    // ─── FOOTER ───────────────────────────────────────────────────────────────
    // Use bufferPages to render footer on the last page without creating new pages
    const footerY = doc.page.height - 70;

    // Always render footer - use absolute position on current page
    drawHorizontalLine(doc, footerY - 8, GOLD);

    doc.save()
      .rect(0, footerY, pageWidth, 70)
      .fill("#f8fafc")
      .restore();

    // Arabic footer - use pure Arabic text (no mixed Latin/Arabic in same string)
    doc.font(FONT_ARABIC).fontSize(7).fillColor(MID_GRAY);
    writeArabic(
      doc,
      "هذا التقرير صادر عن منصة المستشار للاستشارات القانونية. المعلومات مستخرجة من قواعد بيانات العقوبات الدولية.",
      40, footerY + 5,
      { width: contentWidth, align: "center", lineBreak: false }
    );

    // English footer
    doc.font(FONT_LATIN).fontSize(7).fillColor(MID_GRAY);
    writeLatin(
      doc,
      "This report is for compliance and due diligence purposes only. Always verify with official sanctions lists before taking action.",
      40, footerY + 20,
      { width: contentWidth, align: "center", lineBreak: false }
    );

    // Copyright
    doc.font(FONT_LATIN).fontSize(6.5).fillColor(GOLD);
    writeLatin(
      doc,
      `SanctionCheck (c) ${new Date().getFullYear()} - Al-Mustashar Legal Consultancy`,
      40, footerY + 40,
      { width: contentWidth, align: "center", lineBreak: false }
    );

    doc.end();
  } catch (err) {
    console.error("[PDF Report Error]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  }
}
