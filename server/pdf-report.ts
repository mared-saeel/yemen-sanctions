/**
 * PDF Report Generator
 * Generates a professional sanctions screening report in Arabic/English
 * using PDFKit with NotoSansArabic font for proper RTL rendering.
 */
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import path from "path";
import { getRecordById } from "./search-engine";
import { createContext } from "./_core/context";

const ARABIC_FONT = "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf";
const ARABIC_FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf";

// Golden brand color
const GOLD = "#C17F3E";
const DARK = "#1a1a2e";
const LIGHT_GRAY = "#f8f9fa";
const MID_GRAY = "#6c757d";
const BORDER = "#e2e8f0";
const RED_ALERT = "#dc2626";

function reverseArabic(text: string): string {
  // PDFKit doesn't natively support RTL, so we reverse Arabic text
  // and use RTL unicode markers for proper display
  if (!text) return "";
  return text;
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

function drawSection(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.save()
    .rect(40, y, doc.page.width - 80, 22)
    .fill("#f1f5f9")
    .restore();

  doc.font(ARABIC_FONT_BOLD)
    .fontSize(8)
    .fillColor(DARK)
    .text(title, 40, y + 6, {
      width: doc.page.width - 80,
      align: "right",
    });

  return y + 28;
}

function drawField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height = 40
): void {
  // Box
  doc.save()
    .rect(x, y, width, height)
    .fillAndStroke(LIGHT_GRAY, BORDER)
    .restore();

  // Label
  doc.font(ARABIC_FONT)
    .fontSize(7)
    .fillColor(MID_GRAY)
    .text(label, x + 6, y + 6, { width: width - 12, align: "right" });

  // Value
  doc.font(ARABIC_FONT_BOLD)
    .fontSize(9)
    .fillColor(DARK)
    .text(value || "—", x + 6, y + 18, { width: width - 12, align: "right" });
}

export async function handleGeneratePdfReport(req: Request, res: Response) {
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
      Author: "المستشار للاستشارات القانونية",
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
    .rect(0, 0, pageWidth, 80)
    .fill(DARK)
    .restore();

  // Gold accent line
  doc.save()
    .rect(0, 80, pageWidth, 4)
    .fill(GOLD)
    .restore();

  // Platform title (left side)
  doc.font(ARABIC_FONT_BOLD)
    .fontSize(18)
    .fillColor("#ffffff")
    .text("SanctionCheck", 40, 22, { align: "left", width: 200 });

  doc.font(ARABIC_FONT)
    .fontSize(8)
    .fillColor("#94a3b8")
    .text("Sanctions Screening Platform", 40, 44, { align: "left", width: 200 });

  // Arabic title (right side)
  doc.font(ARABIC_FONT_BOLD)
    .fontSize(14)
    .fillColor("#ffffff")
    .text("تقرير فحص العقوبات الدولية", 0, 20, {
      align: "right",
      width: pageWidth - 40,
    });

  doc.font(ARABIC_FONT)
    .fontSize(8)
    .fillColor(GOLD)
    .text("المستشار للاستشارات القانونية", 0, 42, {
      align: "right",
      width: pageWidth - 40,
    });

  y = 100;

  // ─── ALERT BANNER ─────────────────────────────────────────────────────────
  doc.save()
    .rect(40, y, contentWidth, 36)
    .fillAndStroke("#fef2f2", "#fecaca")
    .restore();

  doc.save()
    .rect(40, y, 4, 36)
    .fill(RED_ALERT)
    .restore();

  doc.font(ARABIC_FONT_BOLD)
    .fontSize(10)
    .fillColor(RED_ALERT)
    .text("⚠  كيان مدرج على قوائم العقوبات الدولية  ⚠", 40, y + 8, {
      align: "center",
      width: contentWidth,
    });

  doc.font(ARABIC_FONT)
    .fontSize(7.5)
    .fillColor("#991b1b")
    .text("SANCTIONED ENTITY — This entity appears on international sanctions lists", 40, y + 22, {
      align: "center",
      width: contentWidth,
    });

  y += 50;

  // ─── REPORT META INFO ─────────────────────────────────────────────────────
  const reportDate = new Date().toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  doc.save()
    .rect(40, y, contentWidth, 28)
    .fill("#fffbeb")
    .restore();

  doc.font(ARABIC_FONT)
    .fontSize(7.5)
    .fillColor(MID_GRAY)
    .text(`تاريخ الفحص: ${reportDate}`, 0, y + 8, { align: "right", width: pageWidth - 50 });

  doc.font(ARABIC_FONT)
    .fontSize(7.5)
    .fillColor(MID_GRAY)
    .text(`رقم السجل: ${record.referenceNumber || `ID-${record.id}`}`, 50, y + 8, { align: "left", width: 200 });

  doc.font(ARABIC_FONT)
    .fontSize(7.5)
    .fillColor(MID_GRAY)
    .text(`المستخدم: ${ctx.user.name || ctx.user.username || "—"}`, 50, y + 18, { align: "left", width: 200 });

  y += 40;

  // ─── PRIMARY NAMES SECTION ────────────────────────────────────────────────
  y = drawSection(doc, "الأسماء الأساسية  /  Primary Names", y);

  // Name box full width
  doc.save()
    .rect(40, y, contentWidth, 50)
    .fillAndStroke("#ffffff", BORDER)
    .restore();

  doc.font(ARABIC_FONT_BOLD)
    .fontSize(14)
    .fillColor(DARK)
    .text(record.nameEn || "—", 40, y + 8, { width: contentWidth - 10, align: "right" });

  if (record.nameAr) {
    doc.font(ARABIC_FONT)
      .fontSize(10)
      .fillColor(MID_GRAY)
      .text(record.nameAr, 40, y + 30, { width: contentWidth - 10, align: "right" });
  }

  y += 58;

  // Alternative names
  const altNames = record.alternativeNames as string[] | null;
  if (altNames && altNames.length > 0) {
    doc.font(ARABIC_FONT)
      .fontSize(7.5)
      .fillColor(MID_GRAY)
      .text("الأسماء البديلة: " + altNames.join(" | "), 40, y, {
        width: contentWidth,
        align: "right",
      });
    y += 18;
  }

  y += 6;

  // ─── ENTITY DETAILS SECTION ───────────────────────────────────────────────
  y = drawSection(doc, "تفاصيل الكيان  /  Entity Details", y);

  const entityTypeAr: Record<string, string> = {
    individual: "فرد / Individual",
    organisation: "كيان / Organisation",
    vessel: "سفينة / Vessel",
    unspecified: "غير محدد / Unspecified",
  };

  const halfW = (contentWidth - 8) / 2;

  // Row 1: Entity Type + Nationality
  drawField(doc, "نوع الكيان / Entity Type",
    entityTypeAr[record.entityType || "unspecified"] || record.entityType || "—",
    40, y, halfW);
  drawField(doc, "الجنسية / Nationality",
    record.nationality || "—",
    40 + halfW + 8, y, halfW);
  y += 48;

  // Row 2: Date of Birth + Place of Birth
  if (record.dateOfBirth || record.placeOfBirth) {
    drawField(doc, "تاريخ الميلاد / Date of Birth",
      record.dateOfBirth || "—",
      40, y, halfW);
    drawField(doc, "مكان الميلاد / Place of Birth",
      record.placeOfBirth || "—",
      40 + halfW + 8, y, halfW);
    y += 48;
  }

  y += 6;

  // ─── LISTING INFORMATION SECTION ──────────────────────────────────────────
  y = drawSection(doc, "معلومات الإدراج  /  Listing Information", y);

  // Issuing Body + Listing Date
  drawField(doc, "الجهة المدرجة / Issuing Body",
    record.issuingBody || "—",
    40, y, halfW);
  drawField(doc, "تاريخ الإدراج / Listing Date",
    record.listingDate || "—",
    40 + halfW + 8, y, halfW);
  y += 48;

  // Legal Basis full width
  if (record.legalBasis) {
    drawField(doc, "السند القانوني / Legal Basis",
      record.legalBasis,
      40, y, contentWidth, 40);
    y += 48;
  }

  // Listing Reason full width
  if (record.listingReason) {
    const reasonHeight = Math.max(40, Math.ceil(record.listingReason.length / 80) * 14 + 24);
    drawField(doc, "سبب الإدراج / Listing Reason",
      record.listingReason,
      40, y, contentWidth, reasonHeight);
    y += reasonHeight + 8;
  }

  // Action Taken full width
  if (record.actionTaken) {
    const actionHeight = Math.max(40, Math.ceil(record.actionTaken.length / 80) * 14 + 24);
    drawField(doc, "الإجراء المتخذ / Action Taken",
      record.actionTaken,
      40, y, contentWidth, actionHeight);
    y += actionHeight + 8;
  }

  // Notes
  if (record.notes) {
    y = drawSection(doc, "ملاحظات  /  Notes", y);
    const notesHeight = Math.max(40, Math.ceil(record.notes.length / 90) * 14 + 24);
    doc.save()
      .rect(40, y, contentWidth, notesHeight)
      .fillAndStroke("#fffbeb", "#fde68a")
      .restore();
    doc.font(ARABIC_FONT)
      .fontSize(8.5)
      .fillColor(DARK)
      .text(record.notes, 50, y + 10, { width: contentWidth - 20, align: "right" });
    y += notesHeight + 8;
  }

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 60;

  drawHorizontalLine(doc, footerY - 8, GOLD);

  doc.save()
    .rect(0, footerY, pageWidth, 60)
    .fill("#f8fafc")
    .restore();

  doc.font(ARABIC_FONT)
    .fontSize(7)
    .fillColor(MID_GRAY)
    .text(
      "هذا التقرير صادر عن منصة SanctionCheck التابعة للمستشار للاستشارات القانونية. المعلومات الواردة مستخرجة من قواعد بيانات العقوبات الدولية.",
      40, footerY + 6,
      { width: contentWidth, align: "center" }
    );

  doc.font(ARABIC_FONT)
    .fontSize(7)
    .fillColor(MID_GRAY)
    .text(
      "This report is for compliance and due diligence purposes only. Always verify with official sanctions lists before taking action.",
      40, footerY + 20,
      { width: contentWidth, align: "center" }
    );

  doc.font(ARABIC_FONT)
    .fontSize(6.5)
    .fillColor(GOLD)
    .text(
      `SanctionCheck © ${new Date().getFullYear()} — المستشار للاستشارات القانونية`,
      40, footerY + 38,
      { width: contentWidth, align: "center" }
    );

  doc.end();
}
