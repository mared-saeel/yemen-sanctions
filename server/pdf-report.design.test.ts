import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportSource = readFileSync(resolve(process.cwd(), "server/pdf-report.ts"), "utf8");

describe("quiet compliance PDF design", () => {
  it("uses a restrained ink, gold and neutral palette", () => {
    expect(reportSource).toContain('const GOLD      = "#B7791F"');
    expect(reportSource).toContain('const INK       = "#1F2937"');
    expect(reportSource).toContain('const GRAY_HEAD = "#F5F6F8"');
  });

  it("places the official logo in the header and uses a neutral record identifier", () => {
    expect(reportSource).toContain('doc.image(LOGO_PATH, X + W - logoWidth');
    expect(reportSource).toContain('enText(doc, "RECORD UID"');
    expect(reportSource).not.toContain('WORLD-CHECK RECORD UID:');
    expect(reportSource).toContain('"SANCTIONS SCREENING REPORT"');
  });

  it("uses separate left-to-right and right-to-left panels instead of mixed cells", () => {
    expect(reportSource).toContain("function drawLanguagePanelV2");
    expect(reportSource).toContain("function splitValueByScriptForPdf");
    expect(reportSource).toContain("function drawNameCardV2");
    expect(reportSource).toContain("const drawPair =");
  });
});
