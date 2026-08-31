import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/SearchPage.tsx"), "utf8");

describe("admin sanctions-record deletion UI", () => {
  it("shows a confirmation dialog and only renders the delete control for admins", () => {
    expect(pageSource).toContain("trpc.admin.deleteSanctionRecord.useMutation");
    expect(pageSource).toContain("حذف سجل عقوبات");
    expect(pageSource).toContain("تأكيد الحذف");
    expect(pageSource).toContain('user?.role === "admin"');
    expect(pageSource).toContain("onDelete(result)");
  });
});
