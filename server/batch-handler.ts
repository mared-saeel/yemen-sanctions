/**
 * Batch Screening Handler — Async Job Architecture
 *
 * Flow:
 *  1. POST /api/batch/screen  → parse Excel, create job, start processing in background, return jobId immediately
 *  2. GET  /api/batch/status/:jobId → return { status, progress, results } — client polls this
 *  3. POST /api/batch/export  → accepts JSON results, returns Excel file
 *
 * This prevents HTTP timeouts for large files (200+ names) because the response
 * is returned immediately and processing happens asynchronously.
 */
import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import { searchSanctions } from "./search-engine";
import { createContext } from "./_core/context";
import { createAuditLog } from "./db";

// ─── In-memory job store ──────────────────────────────────────────────────────
// For a single-server deployment this is sufficient. Jobs expire after 30 min.

interface BatchJob {
  id: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;   // 0-100
  total: number;
  processed: number;
  results: BatchRow[];
  matchCount: number;
  possibleCount: number;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, BatchJob>();

// Cleanup jobs older than 30 minutes every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  jobs.forEach((job, id) => {
    if (job.createdAt < cutoff) jobs.delete(id);
  });
}, 5 * 60 * 1000);

function generateJobId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Batch-specific matching helpers ─────────────────────────────────────────

function batchNormalize(text: string): string {
  return text
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[\u064B-\u065F]/g, "")
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "شركة", "مؤسسة", "مجموعة", "عبد", "ابن", "بن", "ال", "محمد", "احمد",
  "the", "al", "el", "bin", "ibn", "and", "of", "for", "co", "ltd", "inc",
  "llc", "corp", "group", "company", "trading", "international",
]);

function levenshteinDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function wordOverlapScore(nameA: string, nameB: string): number {
  const tokensA = batchNormalize(nameA).split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  const tokensB = batchNormalize(nameB).split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matched = 0;
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      const maxLen = Math.max(ta.length, tb.length);
      if (maxLen === 0) continue;
      const sim = 1 - levenshteinDist(ta, tb) / maxLen;
      if (sim >= 0.80) { matched++; break; }
    }
  }
  return matched / Math.min(tokensA.length, tokensB.length);
}

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

// ─── Background processing function ──────────────────────────────────────────

async function processJobInBackground(
  jobId: string,
  names: { row: number; name: string }[],
  userId: number,
  companyId: number | undefined,
  userName: string | undefined,
  ipAddress: string,
  userAgent: string
) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = "processing";

    const results: BatchRow[] = [];

    // Process each name individually using DB-backed search (non-blocking)
    for (let i = 0; i < names.length; i++) {
      const { row, name } = names[i];

      // Use the same search engine as single-name search — DB queries, no in-memory Fuse
      const { results: candidates } = await searchSanctions({
        query: name,
        limit: 3,
        threshold: 0.55,
      });

      let status: BatchRow["status"] = "NO_MATCH";
      let chosenTop = candidates[0] ?? null;

      for (const candidate of candidates) {
        const candidateName = candidate.nameEn || candidate.nameAr || "";
        const overlap = wordOverlapScore(name, candidateName);
        const overlapAr = candidate.nameAr ? wordOverlapScore(name, candidate.nameAr) : 0;
        const bestOverlap = Math.max(overlap, overlapAr);
        const score = candidate.matchScore;

        if (score >= 90 && bestOverlap >= 0.40) {
          status = "MATCH";
          chosenTop = candidate;
          break;
        } else if (score >= 70 && bestOverlap >= 0.35) {
          status = "POSSIBLE_MATCH";
          chosenTop = candidate;
        }
      }

      results.push({
        rowNumber: row,
        submittedName: name,
        status,
        matchScore: chosenTop ? chosenTop.matchScore : 0,
        matchedName: chosenTop?.nameEn ?? null,
        matchedNameAr: chosenTop?.nameAr ?? null,
        entityType: chosenTop?.entityType ?? null,
        issuingBody: chosenTop?.issuingBody ?? null,
        listingDate: chosenTop?.listingDate ?? null,
        recordId: chosenTop?.id ?? null,
      });

      // Update progress after each name
      job.processed = i + 1;
      job.progress = Math.round(((i + 1) / job.total) * 100);
      // No explicit yield needed — await searchSanctions already yields to event loop
    }

    job.results = results;
    job.matchCount = results.filter(r => r.status === "MATCH").length;
    job.possibleCount = results.filter(r => r.status === "POSSIBLE_MATCH").length;
    job.status = "done";
    job.progress = 100;

    // Audit log
    await createAuditLog({
      userId,
      companyId,
      userName,
      action: "search",
      query: `batch:${names.length} names`,
      resultsCount: job.matchCount + job.possibleCount,
      ipAddress,
      userAgent,
    });

  } catch (err) {
    console.error("[batch-job]", err);
    const job = jobs.get(jobId);
    if (job) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Unknown error";
    }
  }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/** POST /api/batch/screen — accepts multipart Excel, returns jobId immediately */
export async function handleBatchScreen(req: Request, res: Response) {
  try {
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) return res.status(401).json({ error: "Unauthorized" });

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // Parse Excel — pass Buffer directly (ExcelJS accepts Node.js Buffer)
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return res.status(400).json({ error: "Empty workbook" });

    // Extract names from first column (skip header row)
    const names: { row: number; name: string }[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cell = row.getCell(1);
      const value = cell.text?.trim() || String(cell.value ?? "").trim();
      if (value && value.length > 0) {
        names.push({ row: rowNumber, name: value });
      }
    });

    if (names.length === 0) {
      return res.status(400).json({ error: "No names found in the first column" });
    }

    if (names.length > 1000) {
      return res.status(400).json({ error: "Maximum 1000 names per batch. Please split your file." });
    }

    // Create job
    const jobId = generateJobId();
    jobs.set(jobId, {
      id: jobId,
      status: "pending",
      progress: 0,
      total: names.length,
      processed: 0,
      results: [],
      matchCount: 0,
      possibleCount: 0,
      createdAt: Date.now(),
    });

    // Start background processing (non-blocking)
    processJobInBackground(
      jobId,
      names,
      Number(ctx.user.id),
      ctx.user.companyId != null ? Number(ctx.user.companyId) : undefined,
      ctx.user.name ?? undefined,
      ctx.req.headers["x-forwarded-for"] as string ?? "unknown",
      ctx.req.headers["user-agent"] ?? "unknown"
    );

    // Return jobId immediately — client will poll /api/batch/status/:jobId
    return res.json({ jobId, total: names.length });

  } catch (err) {
    console.error("[batch-screen]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** GET /api/batch/status/:jobId — returns job progress and results when done */
export async function handleBatchStatus(req: Request, res: Response) {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found or expired" });
  }

  return res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    total: job.total,
    processed: job.processed,
    results: job.status === "done" ? job.results : [],
    matchCount: job.matchCount,
    possibleCount: job.possibleCount,
    error: job.error,
  });
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

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B3A6B" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 22;

    for (const row of results) {
      const dataRow = ws.addRow({
        rowNumber:     row.rowNumber - 1,
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

      if (dataRow.number % 2 === 0) {
        dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          if (colNum !== 3) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9FA" } };
          }
        });
      }

      dataRow.alignment = { vertical: "middle" };
    }

    ws.autoFilter = { from: "A1", to: "J1" };

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

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="batch-screening-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[batch-export]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
