import { once } from "node:events";
import fs from "node:fs";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRecordById: vi.fn(),
  createContext: vi.fn(),
}));

vi.mock("./search-engine", () => ({ getRecordById: mocks.getRecordById }));
vi.mock("./_core/context", () => ({ createContext: mocks.createContext }));

import { handleGeneratePdfReport } from "./pdf-report";

describe("PDF report rendering", () => {
  it("renders a bilingual record without failing and returns a real PDF stream", async () => {
    const notes = process.env.PDF_LONG_TEST
      ? Array.from(
          { length: 14 },
          (_, index) => `ملاحظة تفصيلية رقم ${index + 1}: يجب مراجعة reference SC-${1042 + index} مع البيانات الداعمة قبل اتخاذ أي إجراء امتثالي.`,
        ).join("\n")
      : "ملاحظة عربية مع reference SC-1042 لاختبار عرض النص المختلط بصورة سليمة.";

    mocks.createContext.mockResolvedValue({ user: { name: "Compliance User" } });
    mocks.getRecordById.mockResolvedValue({
      id: 101,
      nameEn: "SUWAID & SONS EXCHANGE",
      nameAr: "سويد وأولاده للصرافة",
      entityType: "organisation",
      listingDate: "2024-06-12",
      listingReason: "SDGT/إرهابيون معينون عالميًا",
      issuingBody: "Official Sanctions Dataset",
      legalBasis: "قرار إداري تجريبي للتأكد من دعم العربية والإنجليزية.",
      actionTaken: "تتطلب النتيجة مراجعة يدوية قبل اتخاذ أي إجراء.",
      nationality: "اليمن",
      dateOfBirth: null,
      placeOfBirth: "صنعاء",
      alternativeNames: ["SUWAID EXCHANGE", "سويد للصرافة"],
      notes,
      referenceNumber: "SC-1042",
      rawNotes: null,
    });

    const res = new PassThrough() as PassThrough & {
      setHeader: ReturnType<typeof vi.fn>;
      status: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
      headersSent: boolean;
    };
    res.setHeader = vi.fn();
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn();
    res.headersSent = false;

    const chunks: Buffer[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    const finished = once(res, "finish");

    await handleGeneratePdfReport(
      { params: { id: "101" }, query: { submittedName: "سويد للصرافة" } } as never,
      res as never,
    );
    await finished;

    const output = Buffer.concat(chunks);
    if (process.env.PDF_TEST_OUTPUT) fs.writeFileSync(process.env.PDF_TEST_OUTPUT, output);
    expect(output.subarray(0, 4).toString()).toBe("%PDF");
    expect(output.length).toBeGreaterThan(5_000);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.json).not.toHaveBeenCalled();
  });
});
