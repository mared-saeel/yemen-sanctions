/**
 * Import sanctions data from Excel file into the database.
 * Run: node scripts/import-sanctions.mjs
 */
import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "dotenv";

config();

const EXCEL_PATH = "/home/ubuntu/upload/LIST.xlsx";
const BATCH_SIZE = 200;

function normalizeEntityType(type) {
  if (!type) return "unspecified";
  const t = String(type).trim().toLowerCase();
  if (t.includes("فرد") || t.includes("individual")) return "individual";
  if (t.includes("كيان") || t.includes("organisation") || t.includes("organization")) return "organisation";
  if (t.includes("سفينة") || t.includes("vessel")) return "vessel";
  return "unspecified";
}

function parseNotes(rawNotes) {
  if (!rawNotes) return {};
  const result = {
    nationality: null,
    dateOfBirth: null,
    placeOfBirth: null,
    alternativeNames: [],
    notes: null,
    referenceNumber: null,
  };

  const str = String(rawNotes);

  const natMatch = str.match(/الجنسية:\s*([^\|]+)/);
  if (natMatch) result.nationality = natMatch[1].trim();

  const dobMatch = str.match(/تاريخ الميلاد:\s*([^\|]+)/);
  if (dobMatch) result.dateOfBirth = dobMatch[1].trim();

  const pobMatch = str.match(/مكان الميلاد:\s*([^\|]+)/);
  if (pobMatch) result.placeOfBirth = pobMatch[1].trim();

  const altMatch = str.match(/أسماء بديلة:\s*([^\|]+)/);
  if (altMatch) {
    result.alternativeNames = altMatch[1]
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
  }

  const notesMatch = str.match(/ملاحظات:\s*([^\|]+)/);
  if (notesMatch) result.notes = notesMatch[1].trim();

  const refMatch = str.match(/الرقم المرجعي:\s*([^\|]+)/);
  if (refMatch) result.referenceNumber = refMatch[1].trim();

  return result;
}

function buildSearchIndex(record) {
  const parts = [
    record.nameEn || "",
    record.nameAr || "",
    record.nationality || "",
    record.placeOfBirth || "",
    record.notes || "",
    record.listingReason || "",
    ...(record.alternativeNames || []),
  ];
  return parts.join(" ").toLowerCase().substring(0, 3000);
}

async function insertBatch(conn, batch) {
  if (batch.length === 0) return;
  const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const values = [];
  for (const r of batch) {
    values.push(
      r.nameEn,
      r.nameAr,
      r.entityType,
      r.listingDate,
      r.listingReason,
      r.issuingBody,
      r.legalBasis,
      r.actionTaken,
      r.nationality,
      r.dateOfBirth,
      r.placeOfBirth,
      JSON.stringify(r.alternativeNames),
      r.notes,
      r.referenceNumber,
      r.rawNotes,
      r.searchIndex
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

async function main() {
  console.log("📂 Reading Excel file...");
  const buf = readFileSync(EXCEL_PATH);
  const wb = read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json(ws, { defval: null });
  console.log(`✅ Loaded ${rows.length} rows from Excel`);

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Clear existing data
  console.log("🗑️  Clearing existing sanctions data...");
  await conn.query("DELETE FROM sanctions_records");

  console.log("📥 Importing records in batches of", BATCH_SIZE, "...");
  let imported = 0;
  let batch = [];

  for (const row of rows) {
    const rawNotes = row["الملاحظات"] || "";
    const parsed = parseNotes(rawNotes);

    const record = {
      nameEn: String(row["الاسم"] || "").trim().substring(0, 512),
      nameAr: row["الاسم بالعربية"] ? String(row["الاسم بالعربية"]).trim().substring(0, 512) : null,
      entityType: normalizeEntityType(row["الصفة"]),
      listingDate: row["تاريخ الإدراج"] ? String(row["تاريخ الإدراج"]).trim().substring(0, 30) : null,
      listingReason: row["سبب الإدراج"] ? String(row["سبب الإدراج"]).trim().substring(0, 255) : null,
      issuingBody: row["الجهة المدرجة"] ? String(row["الجهة المدرجة"]).trim().substring(0, 100) : null,
      legalBasis: row["سند الإدراج"] ? String(row["سند الإدراج"]).trim().substring(0, 255) : null,
      actionTaken: row["الإجراء المتخذ"] ? String(row["الإجراء المتخذ"]).trim().substring(0, 512) : null,
      nationality: parsed.nationality ? parsed.nationality.substring(0, 255) : null,
      dateOfBirth: parsed.dateOfBirth ? parsed.dateOfBirth.substring(0, 50) : null,
      placeOfBirth: parsed.placeOfBirth ? parsed.placeOfBirth.substring(0, 512) : null,
      alternativeNames: parsed.alternativeNames || [],
      notes: parsed.notes ? parsed.notes.substring(0, 1000) : null,
      referenceNumber: parsed.referenceNumber ? parsed.referenceNumber.substring(0, 100) : null,
      rawNotes: rawNotes ? String(rawNotes).substring(0, 5000) : null,
    };

    record.searchIndex = buildSearchIndex(record);
    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(conn, batch);
      imported += batch.length;
      batch = [];
      process.stdout.write(`\r   ✅ Imported: ${imported}/${rows.length} (${Math.round(imported/rows.length*100)}%)`);
    }
  }

  if (batch.length > 0) {
    await insertBatch(conn, batch);
    imported += batch.length;
  }

  console.log(`\n\n🎉 Successfully imported ${imported} records!`);
  await conn.end();
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
