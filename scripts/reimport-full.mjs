/**
 * سكريبت إعادة استيراد البيانات من LIST.xlsx بدون حدود الاقتطاع
 * يحدّث عمودَي notes و rawNotes فقط للسجلات الموجودة
 */
import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

// تحميل متغيرات البيئة
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const XLSX_PATH = "/home/ubuntu/upload/LIST.xlsx";
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

function extractFullNotes(str) {
  if (!str) return null;
  const notesIdx = str.indexOf("ملاحظات:");
  if (notesIdx === -1) return null;
  const afterNotes = str.slice(notesIdx + "ملاحظات:".length).trim();
  const knownKeys = ["الجنسية:", "تاريخ الميلاد:", "مكان الميلاد:", "أسماء بديلة:", "الرقم المرجعي:", "العنوان:"];
  let endIdx = afterNotes.length;
  for (const key of knownKeys) {
    const idx1 = afterNotes.indexOf("| " + key);
    if (idx1 !== -1 && idx1 < endIdx) endIdx = idx1;
    const idx2 = afterNotes.indexOf("|" + key);
    if (idx2 !== -1 && idx2 < endIdx) endIdx = idx2;
  }
  return afterNotes.slice(0, endIdx).trim() || null;
}

console.log("Reading Excel file...");
const buf = readFileSync(XLSX_PATH);
const wb = read(buf, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { defval: null });
console.log(`Total rows: ${rows.length}`);

const conn = await mysql.createConnection(DB_URL);

let updated = 0;
let skipped = 0;
const BATCH = 500;

console.log("Updating notes and rawNotes in database...");

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const promises = batch.map(async (row) => {
    const nameEn = String(row["الاسم"] || "").trim();
    if (!nameEn) { skipped++; return; }

    const rawNotes = row["الملاحظات"] ? String(row["الملاحظات"]) : null;
    const notes = extractFullNotes(rawNotes);

    // تحديث السجل بناءً على الاسم الإنجليزي
    const [result] = await conn.execute(
      "UPDATE sanctions_records SET notes = ?, rawNotes = ? WHERE nameEn = ?",
      [notes, rawNotes, nameEn]
    );
    if (result.affectedRows > 0) updated++;
    else skipped++;
  });

  await Promise.all(promises);

  if ((i + BATCH) % 5000 === 0 || i + BATCH >= rows.length) {
    console.log(`Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} | Updated: ${updated} | Skipped: ${skipped}`);
  }
}

await conn.end();
console.log(`\nDone! Updated: ${updated} records, Skipped: ${skipped}`);
