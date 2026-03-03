/**
 * Excel Import Handler
 * Handles multipart file upload, parses Excel, and inserts sanctions records.
 */
import type { Request, Response } from "express";
import { read, utils } from "xlsx";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { importLogs } from "../drizzle/schema";
import { getDb } from "./db";

const BATCH_SIZE = 300;

function normalizeEntityType(type: unknown): "individual" | "organisation" | "vessel" | "unspecified" {
  if (!type) return "unspecified";
  const t = String(type).trim().toLowerCase();
  if (t.includes("فرد") || t.includes("individual")) return "individual";
  if (t.includes("كيان") || t.includes("organisation") || t.includes("organization")) return "organisation";
  if (t.includes("سفينة") || t.includes("vessel")) return "vessel";
  return "unspecified";
}

function parseNotes(rawNotes: unknown) {
  const result: {
    nationality: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    alternativeNames: string[];
    notes: string | null;
    referenceNumber: string | null;
  } = {
    nationality: null,
    dateOfBirth: null,
    placeOfBirth: null,
    alternativeNames: [],
    notes: null,
    referenceNumber: null,
  };

  if (!rawNotes) return result;
  const str = String(rawNotes);

  const natMatch = str.match(/الجنسية:\s*([^|]+)/);
  if (natMatch) result.nationality = natMatch[1].trim();

  const dobMatch = str.match(/تاريخ الميلاد:\s*([^|]+)/);
  if (dobMatch) result.dateOfBirth = dobMatch[1].trim();

  const pobMatch = str.match(/مكان الميلاد:\s*([^|]+)/);
  if (pobMatch) result.placeOfBirth = pobMatch[1].trim();

  const altMatch = str.match(/أسماء بديلة:\s*([^|]+)/);
  if (altMatch) {
    result.alternativeNames = altMatch[1].split(",").map((n: string) => n.trim()).filter(Boolean);
  }

  const notesMatch = str.match(/ملاحظات:\s*([^|]+)/);
  if (notesMatch) result.notes = notesMatch[1].trim();

  const refMatch = str.match(/الرقم المرجعي:\s*([^|]+)/);
  if (refMatch) result.referenceNumber = refMatch[1].trim();

  return result;
}

function buildSearchIndex(record: Record<string, unknown>): string {
  const parts = [
    record.nameEn || "",
    record.nameAr || "",
    record.nationality || "",
    record.placeOfBirth || "",
    record.notes || "",
    record.listingReason || "",
    ...((record.alternativeNames as string[]) || []),
  ];
  return parts.join(" ").toLowerCase().substring(0, 3000);
}

async function insertBatch(conn: mysql.Connection, batch: Record<string, unknown>[]) {
  if (batch.length === 0) return;
  const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const values: unknown[] = [];
  for (const r of batch) {
    values.push(
      r.nameEn, r.nameAr, r.entityType, r.listingDate,
      r.listingReason, r.issuingBody, r.legalBasis, r.actionTaken,
      r.nationality, r.dateOfBirth, r.placeOfBirth,
      JSON.stringify(r.alternativeNames),
      r.notes, r.referenceNumber, r.rawNotes, r.searchIndex
    );
  }
  await conn.query(
    `INSERT INTO sanctions_records 
      (nameEn, nameAr, entityType, listingDate, listingReason, issuingBody, legalBasis, actionTaken, 
       nationality, dateOfBirth, placeOfBirth, alternativeNames, notes, referenceNumber, rawNotes, searchIndex)
     VALUES ${placeholders}`,
    values
  );
}

type AuthedRequest = Request & { user?: { id: number; name?: string | null } };

export async function handleImportSanctions(req: AuthedRequest, res: Response) {
  const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const importMode = (req.body?.importMode as string) || "append";
  const userId = req.user?.id ?? null;
  const userName = req.user?.name ?? null;

  // Create import log entry
  const db = await getDb();
  let importLogId: number | null = null;

  if (db) {
    const result = await db.insert(importLogs).values({
      userId,
      userName,
      fileName: file.originalname,
      importMode: importMode as "append" | "replace",
      status: "processing",
    });
    // drizzle mysql returns insertId on the result
    importLogId = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0) || null;
  }

  // Parse Excel
  let rows: Record<string, unknown>[];
  try {
    const wb = read(file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];
  } catch {
    if (db && importLogId) {
      await db.update(importLogs)
        .set({ status: "failed", errorMessage: "Failed to parse Excel file", completedAt: new Date() })
        .where(eq(importLogs.id, importLogId));
    }
    return res.status(400).json({ error: "Failed to parse Excel file. Make sure it is a valid .xlsx or .xls file." });
  }

  if (rows.length === 0) {
    if (db && importLogId) {
      await db.update(importLogs)
        .set({ status: "failed", errorMessage: "File is empty", completedAt: new Date() })
        .where(eq(importLogs.id, importLogId));
    }
    return res.status(400).json({ error: "The Excel file is empty." });
  }

  // Update total rows
  if (db && importLogId) {
    await db.update(importLogs)
      .set({ totalRows: rows.length })
      .where(eq(importLogs.id, importLogId));
  }

  // Connect to DB for bulk insert
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    // If replace mode, clear existing records first
    if (importMode === "replace") {
      await conn.query("DELETE FROM sanctions_records");
    }

    let imported = 0;
    let skipped = 0;
    let batch: Record<string, unknown>[] = [];

    for (const row of rows) {
      const rawNotes = row["الملاحظات"] || "";
      const parsed = parseNotes(rawNotes);

      // Skip rows with no name
      const nameEn = String(row["الاسم"] || "").trim();
      if (!nameEn) { skipped++; continue; }

      const record: Record<string, unknown> = {
        nameEn: nameEn.substring(0, 512),
        nameAr: row["الاسم بالعربية"] ? String(row["الاسم بالعربية"]).trim().substring(0, 512) : null,
        entityType: normalizeEntityType(row["الصفة"]),
        listingDate: row["تاريخ الإدراج"] ? String(row["تاريخ الإدراج"]).trim().substring(0, 30) : null,
        listingReason: row["سبب الإدراج"] ? String(row["سبب الإدراج"]).trim().substring(0, 255) : null,
        issuingBody: row["الجهة المدرجة"] ? String(row["الجهة المدرجة"]).trim().substring(0, 100) : null,
        legalBasis: row["سند الإدراج"] ? String(row["سند الإدراج"]).trim().substring(0, 255) : null,
        actionTaken: row["الإجراء المتخذ"] ? String(row["الإجراء المتخذ"]).trim().substring(0, 512) : null,
        nationality: parsed.nationality?.substring(0, 255) ?? null,
        dateOfBirth: parsed.dateOfBirth?.substring(0, 50) ?? null,
        placeOfBirth: parsed.placeOfBirth?.substring(0, 512) ?? null,
        alternativeNames: parsed.alternativeNames || [],
        notes: parsed.notes?.substring(0, 1000) ?? null,
        referenceNumber: parsed.referenceNumber?.substring(0, 100) ?? null,
        rawNotes: rawNotes ? String(rawNotes).substring(0, 5000) : null,
      };
      record.searchIndex = buildSearchIndex(record);
      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        await insertBatch(conn, batch);
        imported += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      await insertBatch(conn, batch);
      imported += batch.length;
    }

    // Update import log as completed
    if (db && importLogId) {
      await db.update(importLogs)
        .set({ status: "completed", importedRows: imported, skippedRows: skipped, completedAt: new Date() })
        .where(eq(importLogs.id, importLogId));
    }

    return res.json({
      success: true,
      imported,
      skipped,
      total: rows.length,
      importMode,
      message: `تم استيراد ${imported} سجل بنجاح${skipped > 0 ? ` (تم تخطي ${skipped} صف فارغ)` : ""}`,
    });

  } catch (err) {
    console.error("[Import] Error:", err);
    if (db && importLogId) {
      await db.update(importLogs)
        .set({ status: "failed", errorMessage: String(err), completedAt: new Date() })
        .where(eq(importLogs.id, importLogId));
    }
    return res.status(500).json({ error: "Import failed: " + String(err) });
  } finally {
    await conn.end();
  }
}

export async function handleGetImportLogs(req: Request, res: Response) {
  const db = await getDb();
  if (!db) return res.json({ logs: [] });

  const { desc } = await import("drizzle-orm");
  const logs = await db.select().from(importLogs).orderBy(desc(importLogs.createdAt)).limit(20);
  return res.json({ logs });
}
