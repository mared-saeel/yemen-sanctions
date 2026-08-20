import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const homePage = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("homepage public information", () => {
  it("keeps the public homepage in a fixed light theme with the contact email", () => {
    expect(homePage).toContain('className="min-h-screen bg-white text-slate-900"');
    expect(homePage).toContain("info@yemen-sanctions.com");
    expect(homePage).not.toContain("setIsDark");
  });

  it("links to the official remittance-tracking service and official banking sources", () => {
    expect(homePage).toContain("https://unmoneye.com/ar/remittance-tracker");
    expect(homePage).toContain("https://cby-ye.com/");
    expect(homePage).toContain("https://yba.org.ye/index.php/ar/");
  });

  it("labels editorial banking cards with their source and provides carousel controls", () => {
    expect(homePage).toContain("Editor-reviewed summaries");
    expect(homePage).toContain("المصدر الأصلي");
    expect(homePage).toContain("setActiveNews");
  });
});
