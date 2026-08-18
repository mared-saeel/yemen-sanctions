import { describe, expect, it } from "vitest";
import { readBatchSpreadsheet } from "./batch-file-reader";

describe("readBatchSpreadsheet", () => {
  it("preserves UTF-8 Arabic CSV text before name extraction", () => {
    const csv = "الاسم\nحميد عبدالله الاحمر\n";
    const rows = readBatchSpreadsheet("names.csv", new TextEncoder().encode(csv).buffer);
    expect(rows).toEqual([["الاسم"], ["حميد عبدالله الاحمر"]]);
  });
});
