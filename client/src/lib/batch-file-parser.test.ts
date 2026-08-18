import { describe, expect, it } from "vitest";
import { extractBatchNames } from "./batch-file-parser";

describe("extractBatchNames", () => {
  it("skips a recognised first-row header and blank values", () => {
    expect(extractBatchNames([["\uFEFFالاسم"], ["حميد عبدالله حسين الاحمر"], [""], [null]])).toEqual([
      "حميد عبدالله حسين الاحمر",
    ]);
  });

  it("normalises whitespace and removes duplicate names without altering Arabic or English text", () => {
    expect(extractBatchNames([
      ["Name"],
      ["  AL-TIKRITI   SADDAM HUSSEIN  "],
      ["AL-TIKRITI SADDAM HUSSEIN"],
      ["سويد   للصرافة"],
    ])).toEqual([
      "AL-TIKRITI SADDAM HUSSEIN",
      "سويد للصرافة",
    ]);
  });
});
