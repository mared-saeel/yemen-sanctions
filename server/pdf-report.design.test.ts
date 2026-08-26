import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportSource = readFileSync(resolve(process.cwd(), "server/pdf-report.ts"), "utf8");

describe("quiet compliance PDF design", () => {
  it("uses a restrained ink, gold and neutral palette", () => {
    expect(reportSource).toContain('const GOLD      = "#C17F3E"');
    expect(reportSource).toContain('const INK       = "#1F2937"');
    expect(reportSource).toContain('const GRAY_HEAD = "#F5F6F8"');
  });

  it("places the official logo in the header and uses a neutral record identifier", () => {
    expect(reportSource).toContain('doc.image(LOGO_PATH, X + W - logoWidth');
    expect(reportSource).toContain('enText(doc, "RECORD UID"');
    expect(reportSource).not.toContain('WORLD-CHECK RECORD UID:');
    expect(reportSource).toContain('"SANCTIONS SCREENING REPORT"');
  });

  it("uses a compact bilingual legal ledger instead of fragmented cards", () => {
    expect(reportSource).toContain("function drawLedgerSection");
    expect(reportSource).toContain("type BilingualLedgerRow");
    expect(reportSource).toContain("const drawSection =");
    expect(reportSource).toContain("function splitValueByScriptForPdf");
  });

  it("places Arabic below English in the same left-side ledger path", () => {
    expect(reportSource).toContain("Arabic remains in the same left-side content path as English");
    expect(reportSource).toContain('align: "left", features: AR_FEAT');
  });

  it("renders an unavailable Arabic value with a compatible neutral glyph instead of a missing-font box", () => {
    expect(reportSource).toContain('row.arValue === "—" ? FONT_EN : FONT_AR');
  });

  it("uses the platform gold accent in the basic exported report rather than blue", () => {
    expect(reportSource).toContain("const ACCENT    = GOLD");
    expect(reportSource).toContain("8.5, ACCENT");
  });
});
