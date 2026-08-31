import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const searchPage = readFileSync(resolve(process.cwd(), "client/src/pages/SearchPage.tsx"), "utf8");
const appLayout = readFileSync(resolve(process.cwd(), "client/src/components/AppLayout.tsx"), "utf8");

describe("search UI redesign guardrails", () => {
  it("preserves the existing search request and matching threshold", () => {
    expect(searchPage).toContain("searchMutation.mutate({");
    expect(searchPage).toContain("query: query.trim()");
    expect(searchPage).toContain("threshold: 0.35");
    expect(searchPage).toContain("limit: 20");
  });

  it("keeps the original platform logo and adds the operational review UI", () => {
    expect(appLayout).toMatch(/logo\.png|logoUrl|logo/i);
    expect(appLayout).toContain("منصة العقوبات اليمنية");
    expect(appLayout).toContain('dir="rtl"');
    expect(searchPage).toContain("البحث في قوائم العقوبات");
    expect(searchPage).toContain("<table");
    expect(searchPage).toContain("ملخص الفحص اليومي");
    expect(searchPage).toContain("نوع التطابق");
    expect(searchPage).toContain("تطابق عالي");
    expect(searchPage).toContain("تطابق محتمل");
  });
});
