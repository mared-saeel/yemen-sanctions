/**
 * PDF Report Generator
 * Generates a professional sanctions screening report in Arabic/English
 * using Puppeteer (HTML → PDF) for full RTL and Arabic font support.
 */
import type { Request, Response } from "express";
import puppeteer from "puppeteer-core";
import { getRecordById } from "./search-engine";
import { createContext } from "./_core/context";

const CHROMIUM_PATH = "/usr/bin/chromium-browser";

function buildHtml(record: Awaited<ReturnType<typeof getRecordById>>, userName: string): string {
  if (!record) return "";

  const reportDate = new Date().toLocaleString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const entityTypeAr: Record<string, string> = {
    individual: "فرد / Individual",
    organisation: "كيان / Organisation",
    vessel: "سفينة / Vessel",
    unspecified: "غير محدد / Unspecified",
  };

  const altNames = (record.alternativeNames as string[] | null) || [];
  const entityLabel = entityTypeAr[record.entityType || "unspecified"] || record.entityType || "—";

  const field = (label: string, value: string | null | undefined) => `
    <div class="field">
      <div class="field-label">${label}</div>
      <div class="field-value">${value || "—"}</div>
    </div>`;

  const halfField = (label: string, value: string | null | undefined) => `
    <div class="field half">
      <div class="field-label">${label}</div>
      <div class="field-value">${value || "—"}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير فحص العقوبات</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', 'Arial Unicode MS', Arial, sans-serif;
      direction: rtl;
      background: #ffffff;
      color: #1a1a2e;
      font-size: 13px;
      line-height: 1.6;
    }

    /* ── HEADER ── */
    .header {
      background: #1a1a2e;
      padding: 20px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-right { text-align: right; }
    .header-left { text-align: left; }
    .header-title-ar {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.5px;
    }
    .header-subtitle-ar {
      font-size: 11px;
      color: #C17F3E;
      margin-top: 2px;
    }
    .header-title-en {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      font-family: Arial, sans-serif;
    }
    .header-subtitle-en {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
      font-family: Arial, sans-serif;
    }
    .gold-bar {
      height: 4px;
      background: #C17F3E;
    }

    /* ── CONTENT ── */
    .content { padding: 24px 32px; }

    /* ── ALERT BANNER ── */
    .alert-banner {
      background: #fef2f2;
      border: 1.5px solid #fecaca;
      border-right: 4px solid #dc2626;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
      text-align: center;
    }
    .alert-title {
      font-size: 14px;
      font-weight: 700;
      color: #dc2626;
      margin-bottom: 4px;
    }
    .alert-subtitle {
      font-size: 11px;
      color: #991b1b;
      font-family: Arial, sans-serif;
    }

    /* ── META INFO ── */
    .meta-bar {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #6c757d;
    }
    .meta-bar span { display: block; margin-bottom: 2px; }

    /* ── SECTION HEADER ── */
    .section-header {
      background: #f1f5f9;
      border-right: 3px solid #C17F3E;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 12px;
      border-radius: 0 4px 4px 0;
    }

    /* ── FIELDS ── */
    .fields-row {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .field {
      background: #f8f9fa;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      flex: 1;
      min-width: 200px;
      margin-bottom: 12px;
    }
    .field.half { flex: 1; min-width: calc(50% - 6px); max-width: calc(50% - 6px); }
    .field.full { flex: 1 1 100%; max-width: 100%; }
    .field-label {
      font-size: 10px;
      color: #6c757d;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a2e;
      word-break: break-word;
    }

    /* ── NAME BOX ── */
    .name-box {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 12px;
    }
    .name-en {
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
      font-family: Arial, sans-serif;
      margin-bottom: 6px;
    }
    .name-ar {
      font-size: 15px;
      color: #6c757d;
    }
    .alt-names {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 8px;
    }

    /* ── SECTION SPACING ── */
    .section { margin-bottom: 24px; }

    /* ── NOTES ── */
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 14px 18px;
      font-size: 12px;
      color: #1a1a2e;
      line-height: 1.8;
    }

    /* ── FOOTER ── */
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 2px solid #C17F3E;
      text-align: center;
    }
    .footer-text {
      font-size: 10px;
      color: #6c757d;
      margin-bottom: 4px;
    }
    .footer-brand {
      font-size: 10px;
      color: #C17F3E;
      font-weight: 600;
      margin-top: 8px;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <div class="header-title-en">SanctionCheck</div>
      <div class="header-subtitle-en">Sanctions Screening Platform</div>
    </div>
    <div class="header-right">
      <div class="header-title-ar">تقرير فحص العقوبات الدولية</div>
      <div class="header-subtitle-ar">المستشار للاستشارات القانونية</div>
    </div>
  </div>
  <div class="gold-bar"></div>

  <div class="content">

    <!-- ALERT BANNER -->
    <div class="alert-banner">
      <div class="alert-title">⚠ كيان مدرج على قوائم العقوبات الدولية ⚠</div>
      <div class="alert-subtitle">SANCTIONED ENTITY — This entity appears on international sanctions lists</div>
    </div>

    <!-- META INFO -->
    <div class="meta-bar">
      <div>
        <span>تاريخ الفحص: ${reportDate}</span>
        <span>المستخدم: ${userName}</span>
      </div>
      <div style="text-align:left; direction:ltr;">
        <span>Record ID: ${record.referenceNumber || `ID-${record.id}`}</span>
        <span>Generated by SanctionCheck</span>
      </div>
    </div>

    <!-- PRIMARY NAMES -->
    <div class="section">
      <div class="section-header">الأسماء الأساسية &nbsp;/&nbsp; Primary Names</div>
      <div class="name-box">
        <div class="name-en">${record.nameEn || "—"}</div>
        ${record.nameAr ? `<div class="name-ar">${record.nameAr}</div>` : ""}
        ${altNames.length > 0 ? `<div class="alt-names">الأسماء البديلة: ${altNames.join(" | ")}</div>` : ""}
      </div>
    </div>

    <!-- ENTITY DETAILS -->
    <div class="section">
      <div class="section-header">تفاصيل الكيان &nbsp;/&nbsp; Entity Details</div>
      <div class="fields-row">
        ${halfField("نوع الكيان / Entity Type", entityLabel)}
        ${halfField("الجنسية / Nationality", record.nationality)}
      </div>
      ${record.dateOfBirth || record.placeOfBirth ? `
      <div class="fields-row">
        ${halfField("تاريخ الميلاد / Date of Birth", record.dateOfBirth)}
        ${halfField("مكان الميلاد / Place of Birth", record.placeOfBirth)}
      </div>` : ""}
    </div>

    <!-- LISTING INFORMATION -->
    <div class="section">
      <div class="section-header">معلومات الإدراج &nbsp;/&nbsp; Listing Information</div>
      <div class="fields-row">
        ${halfField("الجهة المدرجة / Issuing Body", record.issuingBody)}
        ${halfField("تاريخ الإدراج / Listing Date", record.listingDate)}
      </div>
      ${record.legalBasis ? `
      <div class="fields-row">
        ${field("السند القانوني / Legal Basis", record.legalBasis)}
      </div>` : ""}
      ${record.listingReason ? `
      <div class="fields-row">
        ${field("سبب الإدراج / Listing Reason", record.listingReason)}
      </div>` : ""}
      ${record.actionTaken ? `
      <div class="fields-row">
        ${field("الإجراء المتخذ / Action Taken", record.actionTaken)}
      </div>` : ""}
    </div>

    ${record.notes ? `
    <!-- NOTES -->
    <div class="section">
      <div class="section-header">ملاحظات &nbsp;/&nbsp; Notes</div>
      <div class="notes-box">${record.notes}</div>
    </div>` : ""}

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-text">هذا التقرير صادر عن منصة SanctionCheck التابعة للمستشار للاستشارات القانونية.</div>
      <div class="footer-text">المعلومات الواردة مستخرجة من قواعد بيانات العقوبات الدولية وهي لأغراض الامتثال والعناية الواجبة فقط.</div>
      <div class="footer-text" style="font-family: Arial, sans-serif; direction: ltr;">This report is for compliance and due diligence purposes only. Always verify with official sanctions lists.</div>
      <div class="footer-brand">SanctionCheck © ${new Date().getFullYear()} — المستشار للاستشارات القانونية</div>
    </div>

  </div>
</body>
</html>`;
}

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
let browserUseCount = 0;
const MAX_REUSE = 20;

async function getBrowser() {
  if (browserInstance && browserUseCount < MAX_REUSE) {
    browserUseCount++;
    return browserInstance;
  }
  // Close old browser if exists
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
  browserInstance = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
      "--disable-extensions",
      "--disable-background-networking",
    ],
    headless: true,
  });
  browserUseCount = 1;
  return browserInstance;
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

  const userName = ctx.user.name || (ctx.user as any).username || "—";
  const html = buildHtml(record, userName);

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set viewport for A4
    await page.setViewport({ width: 794, height: 1123 });

    // Load the HTML with a timeout - allow fonts to load
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait a bit for Google Fonts to render
    await new Promise(resolve => setTimeout(resolve, 1500));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    await page.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sanctions-report-${recordId}-${Date.now()}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    if (page) await page.close().catch(() => {});
    // Reset browser on error
    if (browserInstance) {
      await browserInstance.close().catch(() => {});
      browserInstance = null;
    }
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF report" });
  }
}
