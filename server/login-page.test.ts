import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const loginPage = readFileSync(resolve(process.cwd(), "client/src/pages/LoginPage.tsx"), "utf8");

describe("login page branding", () => {
  it("uses the durable local Al-Mustashar logo in both desktop and mobile layouts", () => {
    expect(loginPage).toContain('const LOGO_URL = "/almustashar-logo.png";');
    expect(loginPage).toContain('alt="المستشار"');
    expect(loginPage).not.toContain("private-us-east-1.manuscdn.com");
  });
});
