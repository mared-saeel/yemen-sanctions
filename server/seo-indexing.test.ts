import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("SEO indexing assets", () => {
  it("exposes an Arabic-first title, canonical URL, and branded structured data", () => {
    const html = readFileSync(resolve(projectRoot, "client/index.html"), "utf8");

    expect(html).toContain("منصة يمن سانكشن | فحص العقوبات والامتثال");
    expect(html).toContain('rel="canonical" href="https://yemen-sanctions.com/"');
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"@type": "WebSite"');
    expect(html).toContain('"name": "منصة يمن سانكشن"');
    expect(html).toContain('"Yemen Sanctions"');
  });

  it("allows crawling and advertises the canonical sitemap", () => {
    const robots = readFileSync(resolve(projectRoot, "client/public/robots.txt"), "utf8");
    const sitemap = readFileSync(resolve(projectRoot, "client/public/sitemap.xml"), "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://yemen-sanctions.com/sitemap.xml");
    expect(sitemap).toContain("<loc>https://yemen-sanctions.com/</loc>");
  });
});
