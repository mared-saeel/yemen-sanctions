const HEADER_PATTERN = /^(name|اسم|الاسم|#)$/i;

export function extractBatchNames(rows: unknown[][]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rawValue = row?.[0];
    if (rawValue === null || rawValue === undefined) return;

    // UTF-8 CSV files may preserve a byte-order mark on the first header cell.
    const name = String(rawValue).replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
    if (!name || (index === 0 && HEADER_PATTERN.test(name))) return;

    const dedupeKey = name.toLocaleLowerCase();
    if (seen.has(dedupeKey)) return;

    seen.add(dedupeKey);
    names.push(name);
  });

  return names;
}
