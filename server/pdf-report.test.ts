import { describe, expect, it } from "vitest";
import { parseRawNotesForPdf } from "./pdf-report";

describe("PDF report note parsing", () => {
  it("retains the full free-form bilingual note without dropping Arabic or Latin text", () => {
    const note = "مراجعة مطلوبة قبل اتخاذ أي إجراء. Verify reference SC-1042 and passport data.";
    const parsed = parseRawNotesForPdf(note);

    expect(parsed.notes).toBeNull();
    expect(parsed.nationality).toBeNull();
  });

  it("extracts structured Arabic fields and preserves the complete notes value", () => {
    const parsed = parseRawNotesForPdf(
      "الجنسية: اليمن | تاريخ الميلاد: 01 Jan 1980 | ملاحظات: نص عربي مع reference SC-1042 ويجب عرضه كاملاً | الرقم المرجعي: SC-1042",
    );

    expect(parsed.nationality).toBe("اليمن");
    expect(parsed.dateOfBirth).toBe("01 Jan 1980");
    expect(parsed.referenceNumber).toBe("SC-1042");
    expect(parsed.notes).toBe("نص عربي مع reference SC-1042 ويجب عرضه كاملاً");
  });
});
