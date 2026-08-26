import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const exportMenuSource = readFileSync(resolve(process.cwd(), "client/src/components/ExportMenu.tsx"), "utf8");

describe("printed search-results export", () => {
  it("uses the same neutral grey table palette as the on-screen report", () => {
    expect(exportMenuSource).toContain("background: #F5F6F8");
    expect(exportMenuSource).toContain("border: 1px solid #C8CDD8");
    expect(exportMenuSource).toContain("background: #FAFBFC");
    expect(exportMenuSource).not.toContain("#3b82f6");
    expect(exportMenuSource).not.toContain("background: #1e293b");
  });
});
