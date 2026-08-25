import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appLayout = readFileSync(resolve(process.cwd(), "client/src/components/AppLayout.tsx"), "utf8");
const searchPage = readFileSync(resolve(process.cwd(), "client/src/pages/SearchPage.tsx"), "utf8");

describe("search workspace layout", () => {
  it("keeps the main application shell left-to-right so search settings remain on the left", () => {
    expect(appLayout).toContain('className="flex h-screen bg-background overflow-hidden" dir="ltr"');
    expect(searchPage.indexOf("{/* Left Sidebar - Filters */}")).toBeLessThan(searchPage.indexOf("{/* Main Content */}"));
  });
});
