/**
 * Batch Screening Handler — COMPLETE REWRITE
 * 
 * تم إعادة كتابة النظام بالكامل:
 * 1. ✅ خوارزمية بحث محسّنة ومباشرة
 * 2. ✅ معايير مطابقة دقيقة وموثوقة
 * 3. ✅ معالجة متوازية محسّنة
 * 4. ✅ معالجة أخطاء شاملة
 * 5. ✅ أداء عالية جداً
 */

import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import { getDb } from "./db";
import { createContext } from "./_core/context";
import { createAuditLog } from "./db";
import { sanctionsRecords } from "../drizzle/schema";

// ─── In-memory job store ──────────────────────────────────────────────────────

interface BatchJob {
  id: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  total: number;
  processed: number;
  results: BatchRow[];
  matchCount: number;
  possibleCount: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

const jobs = new Map<string, BatchJob>();

// تنظيف الوظائف القديمة كل 5 دقائق
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 60 دقيقة
  jobs.forEach((job, id) => {
    if (job.createdAt < cutoff) {
      console.log(`[batch] Cleaning up expired job: ${id}`);
      jobs.delete(id);
    }
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

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshteinDist(a, b) / maxLen;
}

function wordTokens(text: string): string[] {
  return batchNormalize(text)
    .split(/\s+/)
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t));
}

function wordOverlapScore(nameA: string, nameB: string): number {
  const tokensA = wordTokens(nameA);
  const tokensB = wordTokens(nameB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matched = 0;
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      const sim = levenshteinSimilarity(ta, tb);
      if (sim >= 0.75) { matched++; break; }
    }
  }
  
  return matched / Math.max(tokensA.length, tokensB.length);
}

// ─── Direct batch search (no Fuse.js, direct DB) ─────────────────────────────

interface SanctionRecord {
  id: number;
  nameEn: string;
  nameAr: string;
  entityType: string;
  issuingBody: string;
  listingDate: string;
}

async function batchSearchDirect(
  query: string,
  allRecords: SanctionRecord[]
): Promise<{ record: SanctionRecord; score: number }[]> {
  const nQuery = batchNormalize(query);
  const queryTokens = wordTokens(query);

  if (queryTokens.length === 0) return [];

  const scored: { record: SanctionRecord; score: number }[] = [];

  for (const record of allRecords) {
    const nameEn = record.nameEn || "";
    const nameAr = record.nameAr || "";

    // 1. Exact match (highest priority)
    if (batchNormalize(nameEn) === nQuery || batchNormalize(nameAr) === nQuery) {
      scored.push({ record, score: 100 });
      continue;
    }

    // 2. Word overlap score (high priority)
    const overlapEn = wordOverlapScore(query, nameEn);
    const overlapAr = wordOverlapScore(query, nameAr);
    const bestOverlap = Math.max(overlapEn, overlapAr);

    if (bestOverlap >= 0.85) {
      scored.push({ record, score: Math.round(bestOverlap * 100) });
      continue;
    }

    // 3. Levenshtein similarity on full names
    const simEn = levenshteinSimilarity(nQuery, batchNormalize(nameEn));
    const simAr = levenshteinSimilarity(nQuery, batchNormalize(nameAr));
    const bestSim = Math.max(simEn, simAr);

    if (bestSim >= 0.70) {
      scored.push({ record, score: Math.round(bestSim * 100) });
      continue;
    }

    // 4. Token-based matching (lower priority)
    if (bestOverlap >= 0.50) {
      scored.push({ record, score: Math.round(bestOverlap * 100) });
    }
  }

  // Sort by score descending and return top 5
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
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
    job.startedAt = Date.now();

    const results: BatchRow[] = [];
    const PARALLEL_BATCH_SIZE = 20;

    console.log(`[batch-${jobId}] Starting processing of ${names.length} names`);

    // Load all records once
    let allRecords: SanctionRecord[] = [];
    try {
      console.log(`[batch-${jobId}] Loading records for batch processing...`);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const records = await db.select({
        id: sanctionsRecords.id,
        nameEn: sanctionsRecords.nameEn,
        nameAr: sanctionsRecords.nameAr,
        entityType: sanctionsRecords.entityType,
        issuingBody: sanctionsRecords.issuingBody,
        listingDate: sanctionsRecords.listingDate,
      }).from(sanctionsRecords);

      allRecords = records as SanctionRecord[];
      console.log(`[batch-${jobId}] Loaded ${allRecords.length} records`);
    } catch (err) {
      console.error(`[batch-${jobId}] Failed to load records`, err);
      throw new Error("Failed to load sanctions database");
    }

    // Process names in parallel batches
    for (let i = 0; i < names.length; i += PARALLEL_BATCH_SIZE) {
      const batch = names.slice(i, i + PARALLEL_BATCH_SIZE);

      try {
        const batchResults = await Promise.all(
          batch.map(async ({ row, name }) => {
            try {
              // Direct search in memory
              const candidates = await batchSearchDirect(name, allRecords);

              let status: BatchRow["status"] = "NO_MATCH";
              let chosenTop = candidates[0] ?? null;

              // Determine status based on score and overlap
              for (const { record, score } of candidates) {
                const candidateName = record.nameEn || record.nameAr || "";
                const overlap = wordOverlapScore(name, candidateName);
                const overlapAr = record.nameAr ? wordOverlapScore(name, record.nameAr) : 0;
                const bestOverlap = Math.max(overlap, overlapAr);

                // MATCH: score >= 85 AND overlap >= 0.40
                if (score >= 85 && bestOverlap >= 0.40) {
                  status = "MATCH";
                  chosenTop = { record, score };
                  break;
                }
                // POSSIBLE_MATCH: score >= 70 AND overlap >= 0.30
                else if (score >= 70 && bestOverlap >= 0.30) {
                  status = "POSSIBLE_MATCH";
                  chosenTop = { record, score };
                  // Don't break, keep looking for better match
                }
              }

              return {
                rowNumber: row,
                submittedName: name,
                status,
                matchScore: chosenTop ? chosenTop.score : 0,
                matchedName: chosenTop?.record.nameEn ?? null,
                matchedNameAr: chosenTop?.record.nameAr ?? null,
                entityType: chosenTop?.record.entityType ?? null,
                issuingBody: chosenTop?.record.issuingBody ?? null,
                listingDate: chosenTop?.record.listingDate ?? null,
                recordId: chosenTop?.record.id ?? null,
              };
            } catch (err) {
              console.error(`[batch-${jobId}] Error processing name: ${name}`, err);
              return {
                rowNumber: row,
                submittedName: name,
                status: "NO_MATCH" as const,
                matchScore: 0,
                matchedName: null,
                matchedNameAr: null,
                entityType: null,
                issuingBody: null,
                listingDate: null,
                recordId: null,
              };
            }
          })
        );

        results.push(...batchResults);

        // Update progress
        job.processed = Math.min(i + PARALLEL_BATCH_SIZE, names.length);
        job.progress = Math.round((job.processed / job.total) * 100);

        console.log(`[batch-${jobId}] Progress: ${job.processed}/${job.total} (${job.progress}%)`);

        // Small delay between batches
        if (i + PARALLEL_BATCH_SIZE < names.length) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      } catch (batchErr) {
        console.error(`[batch-${jobId}] Batch processing error`, batchErr);
      }
    }

    job.results = results;
    job.matchCount = results.filter(r => r.status === "MATCH").length;
    job.possibleCount = results.filter(r => r.status === "POSSIBLE_MATCH").length;
    job.status = "done";
    job.progress = 100;
    job.completedAt = Date.now();

    console.log(`[batch-${jobId}] Completed: ${job.matchCount} matches, ${job.possibleCount} possible`);

    // Create audit log
    try {
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
    } catch (auditErr) {
      console.error(`[batch-${jobId}] Failed to create audit log`, auditErr);
    }

  } catch (err) {
    console.error(`[batch-${jobId}] Fatal error`, err);
    const job = jobs.get(jobId);
    if (job) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Unknown error during processing";
      job.completedAt = Date.now();
    }
  }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/** POST /api/batch/screen — Accept Excel file, return jobId immediately */
export async function handleBatchScreen(req: Request, res: Response) {
  try {
    // Verify authentication
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) {
      console.log("[batch-screen] Unauthorized request");
      return res.status(401).json({ error: "Unauthorized - Please log in" });
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      console.log("[batch-screen] No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log(`[batch-screen] Processing file: ${file.originalname} (${file.size} bytes)`);

    // Verify file type
    if (!file.originalname.endsWith(".xlsx") && !file.originalname.endsWith(".xls")) {
      return res.status(400).json({ error: "Invalid file type - Please upload an Excel file (.xlsx or .xls)" });
    }

    // Verify file size
    if (file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large - Maximum 50MB" });
    }

    // Parse Excel
    let workbook;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch (parseErr) {
      console.error("[batch-screen] Failed to parse Excel file", parseErr);
      return res.status(400).json({ error: "Invalid Excel file - Please ensure the file is not corrupted" });
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: "Empty workbook - Please add data to the first sheet" });
    }

    // Extract names from first column (skip header)
    const names: { row: number; name: string }[] = [];
    try {
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const cell = row.getCell(1);
        const value = cell.text?.trim() || String(cell.value ?? "").trim();
        if (value && value.length > 0) {
          names.push({ row: rowNumber, name: value });
        }
      });
    } catch (extractErr) {
      console.error("[batch-screen] Failed to extract names", extractErr);
      return res.status(400).json({ error: "Failed to read Excel file" });
    }

    if (names.length === 0) {
      return res.status(400).json({ error: "No names found - Please add names in the first column starting from row 2" });
    }

    if (names.length > 500) {
      return res.status(400).json({ error: `Too many names (${names.length}) - Maximum 500 names per batch` });
    }

    console.log(`[batch-screen] Extracted ${names.length} names from file`);

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

    console.log(`[batch-screen] Created job: ${jobId}`);

    // Start background processing
    processJobInBackground(
      jobId,
      names,
      Number(ctx.user.id),
      ctx.user.companyId != null ? Number(ctx.user.companyId) : undefined,
      ctx.user.name ?? undefined,
      (req.headers["x-forwarded-for"] as string) ?? "unknown",
      (req.headers["user-agent"] as string) ?? "unknown"
    ).catch(err => {
      console.error(`[batch-screen] Background processing error for job ${jobId}`, err);
    });

    // Return jobId immediately
    return res.json({ jobId, total: names.length });

  } catch (err) {
    console.error("[batch-screen] Unexpected error", err);
    return res.status(500).json({ 
      error: "Internal server error - Please try again later",
      details: process.env.NODE_ENV === "development" ? (err instanceof Error ? err.message : String(err)) : undefined
    });
  }
}

/** GET /api/batch/status/:jobId — Return job progress and results when done */
export async function handleBatchStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: "Missing jobId parameter" });
    }

    const job = jobs.get(jobId);

    if (!job) {
      console.log(`[batch-status] Job not found: ${jobId}`);
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
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (err) {
    console.error("[batch-status] Error", err);
    return res.status(500).json({ error: "Failed to get job status" });
  }
}

/** POST /api/batch/export — Accept JSON results, return Excel file */
export async function handleBatchExport(req: Request, res: Response) {
  try {
    // Verify authentication
    const ctx = await createContext({ req, res } as Parameters<typeof createContext>[0]);
    if (!ctx.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { results } = req.body as { results: BatchRow[] };
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: "Invalid results data" });
    }

    if (results.length === 0) {
      return res.status(400).json({ error: "No results to export" });
    }

    console.log(`[batch-export] Exporting ${results.length} results`);

    // Create Excel workbook
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
      { header: "Issuing Body",      key: "issuingBody",   width: 16 },
      { header: "Listing Date",      key: "listingDate",   width: 16 },
    ];

    // Add data rows
    for (const row of results) {
      ws.addRow(row);
    }

    // Style header
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333333" } };

    // Generate Excel
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=batch-screening-results.xlsx");
    res.send(buffer);

  } catch (err) {
    console.error("[batch-export] Error", err);
    return res.status(500).json({ error: "Failed to export results" });
  }
}
