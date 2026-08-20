import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const proxy = readFileSync(resolve(process.cwd(), "server/_core/storageProxy.ts"), "utf8");
const server = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");

describe("storage proxy registration", () => {
  it("registers the manuscript storage route before OAuth and static handling", () => {
    expect(proxy).toContain('app.get("/manus-storage/*"');
    expect(proxy).toContain("v1/storage/presign/get");
    expect(proxy).toContain("res.redirect(307, url)");
    expect(server.indexOf("registerStorageProxy(app);")).toBeLessThan(server.indexOf("registerOAuthRoutes(app);"));
  });
});
