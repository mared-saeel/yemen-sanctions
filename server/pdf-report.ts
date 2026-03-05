/**
 * PDF Report Generator
 * Generates a professional sanctions screening report in Arabic/English
 * using PDFKit with dual fonts: NotoSansArabic (Arabic) + NotoSans (English/Latin)
 *
 * Key fix: Arabic text requires `features: ['rtla', 'arab']` for correct RTL rendering
 * Alternative names: use NotoSans (Latin) for non-Arabic names to avoid boxes
 */
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getRecordById } from "./search-engine";
import { createContext } from "./_core/context";

// Font paths - bundled inside server/fonts/ for production compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename);
const FONTS_DIR = path.join(__dirname_local, "fonts");
const FONT_ARABIC = path.join(FONTS_DIR, "NotoSansArabic-Regular.ttf");
const FONT_ARABIC_BOLD = path.join(FONTS_DIR, "NotoSansArabic-Bold.ttf");
const FONT_LATIN = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FONT_LATIN_BOLD = path.join(FONTS_DIR, "NotoSans-Bold.ttf");
const LOGO_PATH = path.join(FONTS_DIR, "logo.png");

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

/**
 * Write text using the appropriate font based on content detection
 */
function writeAutoFont(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions = {},
  bold = false
) {
  if (isArabicText(text)) {
    doc.font(bold ? FONT_ARABIC_BOLD : FONT_ARABIC);
    writeArabic(doc, text, x, y, opts);
  } else {
    doc.font(bold ? FONT_LATIN_BOLD : FONT_LATIN);
    writeLatin(doc, text, x, y, opts);
  }
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

  // Value - auto-detect font based on content
  const displayValue = value || "—";
  doc.fontSize(9).fillColor(DARK);
  writeAutoFont(doc, displayValue, x + 6, y + 20, { width: width - 12 }, true);
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

    // Check if logo exists
    const logoExists = fs.existsSync(LOGO_PATH);

    // Generate PDF
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
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
    // Dark background for header
    doc.save()
      .rect(0, 0, pageWidth, 90)
      .fill(DARK)
      .restore();

    // Gold accent line at bottom of header
    doc.save()
      .rect(0, 90, pageWidth, 4)
      .fill(GOLD)
      .restore();

    // Logo on the LEFT side
    if (logoExists) {
      // Logo: white background circle/box behind it for contrast
      doc.save()
        .rect(30, 8, 74, 74)
        .fill("#ffffff")
        .restore();
      doc.image(LOGO_PATH, 32, 10, { width: 70, height: 70 });
    } else {
      // Fallback text logo
      doc.font(FONT_LATIN_BOLD).fontSize(18).fillColor("#ffffff");
      writeLatin(doc, "SanctionCheck", 40, 20, { width: 200 });
      doc.font(FONT_LATIN).fontSize(8).fillColor("#94a3b8");
      writeLatin(doc, "Sanctions Screening Platform", 40, 44, { width: 200 });
    }

    // Arabic title (right side) - Arabic font
    doc.font(FONT_ARABIC_BOLD).fontSize(16).fillColor("#ffffff");
    writeArabic(doc, "تقرير فحص العقوبات الدولية", 0, 18, { width: pageWidth - 40 });

    doc.font(FONT_ARABIC).fontSize(9).fillColor(GOLD);
    writeArabic(doc, "المستشار للاستشارات القانونية", 0, 44, { width: pageWidth - 40 });

    // Platform name below Arabic subtitle
    doc.font(FONT_LATIN).fontSize(7.5).fillColor("#94a3b8");
    writeLatin(doc, "SanctionCheck  |  Sanctions Screening Platform", 110, 65, { width: pageWidth - 150 });

    y = 110;

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

    // Alternative names - use auto font detection per name to avoid boxes
    const altNames = record.alternativeNames as string[] | null;
    if (altNames && altNames.length > 0) {
      // Filter out names that have unsupported characters (keep only Arabic and Latin)
      const cleanNames = altNames.map(name => {
        // Replace unsupported characters with space
        return name.replace(/[^\u0000-\u024F\u0600-\u06FF\u0750-\u077F\s]/g, '');
      }).filter(name => name.trim().length > 0);

      if (cleanNames.length > 0) {
        // Label
        doc.font(FONT_ARABIC).fontSize(7).fillColor(MID_GRAY);
        writeArabic(doc, "الأسماء البديلة:", 40, y, { width: contentWidth });
        y += 14;

        // Each name on its own with correct font
        const namesPerRow = 3;
        const nameWidth = (contentWidth - (namesPerRow - 1) * 6) / namesPerRow;

        for (let i = 0; i < Math.min(cleanNames.length, 12); i++) {
          const col = i % namesPerRow;
          const row = Math.floor(i / namesPerRow);
          const nx = 40 + col * (nameWidth + 6);
          const ny = y + row * 20;

          doc.save()
            .rect(nx, ny, nameWidth, 16)
            .fill("#f8f9fa")
            .restore();

          const name = cleanNames[i];
          doc.fontSize(7.5).fillColor(DARK);
          if (isArabicText(name)) {
            doc.font(FONT_ARABIC);
            writeArabic(doc, name, nx, ny + 3, { width: nameWidth, lineBreak: false });
          } else {
            doc.font(FONT_LATIN);
            writeLatin(doc, name, nx + 3, ny + 4, { width: nameWidth - 6, lineBreak: false });
          }
        }

        const rowCount = Math.ceil(Math.min(cleanNames.length, 12) / namesPerRow);
        y += rowCount * 20 + 8;
      }
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

      doc.fontSize(8.5).fillColor(DARK);
      writeAutoFont(doc, record.notes, 50, y + 10, { width: contentWidth - 20 });
      y += notesHeight + 8;
    }

    // ─── FOOTER (rendered on last page using bufferPages) ──────────────────────
    const range = doc.bufferedPageRange();
    const lastPageIdx = range.start + range.count - 1;
    doc.switchToPage(lastPageIdx);

    // Disable bottom margin to prevent new page creation when writing footer
    (doc.page as any).margins.bottom = 0;

    const footerY = doc.page.height - 70;

    // Footer separator and background
    doc.save();
    doc.strokeColor(GOLD).lineWidth(0.5)
      .moveTo(40, footerY - 8).lineTo(pageWidth - 40, footerY - 8).stroke();
    doc.rect(0, footerY - 8, pageWidth, 78).fill("#f8fafc");
    doc.restore();

    // Small logo in footer
    if (logoExists) {
      doc.image(LOGO_PATH, 40, footerY + 2, { width: 28, height: 28 });
    }

    // Arabic footer
    doc.font(FONT_ARABIC).fontSize(7).fillColor(MID_GRAY);
    writeArabic(
      doc,
      "هذا التقرير صادر عن منصة المستشار للاستشارات القانونية. المعلومات مستخرجة من قواعد بيانات العقوبات الدولية.",
      40, footerY + 2,
      { width: contentWidth, align: "center", lineBreak: false }
    );

    // English footer
    doc.font(FONT_LATIN).fontSize(7).fillColor(MID_GRAY);
    writeLatin(
      doc,
      "This report is for compliance and due diligence purposes only. Always verify with official sanctions lists before taking action.",
      40, footerY + 18,
      { width: contentWidth, align: "center", lineBreak: false }
    );

    // Copyright
    doc.font(FONT_LATIN).fontSize(6.5).fillColor(GOLD);
    writeLatin(
      doc,
      `SanctionCheck (c) ${new Date().getFullYear()} - Al-Mustashar Legal Consultancy`,
      40, footerY + 32,
      { width: contentWidth, align: "center", lineBreak: false }
    );

    doc.flushPages();
    doc.end();
  } catch (err) {
    console.error("[PDF Report Error]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  }
}
