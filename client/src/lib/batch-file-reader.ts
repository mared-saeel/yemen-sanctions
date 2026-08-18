import * as XLSX from "xlsx";

export function readBatchSpreadsheet(fileName: string, buffer: ArrayBuffer): unknown[][] {
  const isCsv = /\.csv$/i.test(fileName);
  const workbook = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), { type: "string" })
    : XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];
}
