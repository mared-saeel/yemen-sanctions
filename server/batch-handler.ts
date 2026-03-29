/**
 * Batch Screening Handler
 * Processes an uploaded Excel file, screens each name against the sanctions DB,
 * and returns results as JSON (for the UI) or exports them as Excel.
 */
import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import { searchSanctions } from "./search-engine";
import { createContext } from "./_core/context";
import { createAuditLog } from "./db";

export interface BatchRow {
  rowNumber: number;
  submittedName: string;
  status: "MATCH" | "POSSIBLE_MATCH" | "NO_MATCH";
  matchScore: number;
  matchedName: string | null;
  matchedNameAr: string | null;
  entityType: string | null;
  issuingBody: string | null;
  listingDate: string | null;
  recordId: number | null;
}

/** POST /api/batch/screen — accepts multipart Excel, returns JSON results */
export async function handleBatchScreen(req: Request, res: Response) {
  try {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // Parse Excel
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength);
    await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return res.status(400).json({ error: "Empty workbook" });

    // Extract names from first column (skip header row)
    const names: { row: number; name: string }[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const cell = row.getCell(1);
      const value = cell.text?.trim() || String(cell.value ?? "").trim();
      if (value && value.length > 0) {
        names.push({ row: rowNumber, name: value });
      }
    });

    if (names.length === 0) {
      return res.status(400).json({ error: "No names found in the first column" });
    }

    if (names.length > 600) {
      return res.status(400).json({ error: "Maximum 500 names per batch. Please split your file." });
    }

    // Screen each name
    const results: BatchRow[] = [];
    for (const { row, name } of names) {
      const searchResult = await searchSanctions({
        query: name,
        limit: 1,
        threshold: 0.35,
      });

      const top = searchResult.results[0];
      let status: BatchRow["status"] = "NO_MATCH";
      if (top) {
        if (top.matchScore >= 0.85) status = "MATCH";
        else if (top.matchScore >= 0.55) status = "POSSIBLE_MATCH";
      }

      results.push({
        rowNumber: row,
        submittedName: name,
        status,
        matchScore: top ? Math.round(top.matchScore * 100) : 0,
        matchedName: top?.nameEn ?? null,
        matchedNameAr: top?.nameAr ?? null,
        entityType: top?.entityType ?? null,
        issuingBody: top?.issuingBody ?? null,
        listingDate: top?.listingDate ?? null,
        recordId: top?.id ?? null,
      });
    }

    // Audit log
    const matchCount = results.filter(r => r.status === "MATCH").length;
    const possibleCount = results.filter(r => r.status === "POSSIBLE_MATCH").length;
    await createAuditLog({
      userId: ctx.user.id,
      companyId: ctx.user.companyId ?? undefined,
      userName: ctx.user.name ?? undefined,
      action: "search",
      query: `batch:${names.length} names`,
      resultsCount: matchCount + possibleCount,
      ipAddress: ctx.req.headers["x-forwarded-for"] as string ?? "unknown",
      userAgent: ctx.req.headers["user-agent"] ?? "unknown",
    });

    return res.json({ results, total: names.length, matchCount, possibleCount });
  } catch (err) {
    console.error("[batch-screen]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** POST /api/batch/export — accepts JSON results, returns Excel file */
export async function handleBatchExport(req: Request, res: Response) {
  try {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });

    const { results } = req.body as { results: BatchRow[] };
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: "Invalid results data" });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Yemen Sanctions Platform";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Batch Screening Results");

    // Column definitions
    ws.columns = [
      { header: "#",                 key: "rowNumber",     width: 6  },
      { header: "Submitted Name",    key: "submittedName", width: 35 },
      { header: "Status",            key: "status",        width: 18 },
      { header: "Match Score (%)",   key: "matchScore",    width: 16 },
      { header: "Matched Name (EN)", key: "matchedName",   width: 35 },
      { header: "Matched Name (AR)", key: "matchedNameAr", width: 35 },
      { header: "Entity Type",       key: "entityType",    width: 16 },
      { header: "Issuing Body",      key: "issuingBody",   width: 20 },
      { header: "Listing Date",      key: "listingDate",   width: 14 },
      { header: "Record ID",         key: "recordId",      width: 12 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B3A6B" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 22;

    // Add data rows with conditional coloring
    for (const row of results) {
      const dataRow = ws.addRow({
        rowNumber:     row.rowNumber - 1, // user-facing row (1-based, minus header)
        submittedName: row.submittedName,
        status:        row.status.replace("_", " "),
        matchScore:    row.matchScore,
        matchedName:   row.matchedName ?? "—",
        matchedNameAr: row.matchedNameAr ?? "—",
        entityType:    row.entityType ?? "—",
        issuingBody:   row.issuingBody ?? "—",
        listingDate:   row.listingDate ?? "—",
        recordId:      row.recordId ?? "—",
      });

      // Color status cell
      const statusCell = dataRow.getCell("status");
      if (row.status === "MATCH") {
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE8E8" } };
        statusCell.font = { bold: true, color: { argb: "FFC0392B" } };
      } else if (row.status === "POSSIBLE_MATCH") {
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
        statusCell.font = { bold: true, color: { argb: "FF856404" } };
      } else {
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
        statusCell.font = { bold: true, color: { argb: "FF1B5E20" } };
      }

      // Alternate row shading
      if (dataRow.number % 2 === 0) {
        dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          if (colNum !== 3) { // skip status cell (already colored)
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9FA" } };
          }
        });
      }

      dataRow.alignment = { vertical: "middle" };
    }

    // Auto-filter
    ws.autoFilter = { from: "A1", to: "J1" };

    // Summary sheet
    const summary = workbook.addWorksheet("Summary");
    const total = results.length;
    const matchCount = results.filter(r => r.status === "MATCH").length;
    const possibleCount = results.filter(r => r.status === "POSSIBLE_MATCH").length;
    const noMatchCount = results.filter(r => r.status === "NO_MATCH").length;

    summary.addRow(["Yemen Sanctions Platform — Batch Screening Report"]);
    summary.addRow([]);
    summary.addRow(["Generated:", new Date().toLocaleString("en-GB")]);
    summary.addRow([]);
    summary.addRow(["Metric", "Count", "Percentage"]);
    summary.addRow(["Total Names Screened", total, "100%"]);
    summary.addRow(["MATCH", matchCount, total > 0 ? `${Math.round(matchCount / total * 100)}%` : "0%"]);
    summary.addRow(["POSSIBLE MATCH", possibleCount, total > 0 ? `${Math.round(possibleCount / total * 100)}%` : "0%"]);
    summary.addRow(["NO MATCH", noMatchCount, total > 0 ? `${Math.round(noMatchCount / total * 100)}%` : "0%"]);

    const titleRow = summary.getRow(1);
    titleRow.font = { bold: true, size: 14, color: { argb: "FF1B3A6B" } };
    const headerRow2 = summary.getRow(5);
    headerRow2.font = { bold: true };
    summary.getColumn(1).width = 30;
    summary.getColumn(2).width = 15;
    summary.getColumn(3).width = 15;

    // Stream response
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",
      `attachment; filename="batch-screening-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[batch-export]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
