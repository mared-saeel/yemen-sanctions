import { describe, expect, it } from "vitest";
import { buildListingContextRows, parseRawNotesForPdf, tokenizeMixedTextForPdf } from "./pdf-report";

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

  it("builds listing context only from available source-record fields", () => {
    expect(buildListingContextRows({
      listingReason: "عقوبات العراق IRAQ2",
      legalBasis: "UID: 7843",
      issuingBody: "OFAC",
    })).toEqual([
      ["Reason for Listing", "عقوبات العراق IRAQ2"],
      ["Legal Basis", "UID: 7843"],
      ["Issuing Body", "OFAC"],
    ]);
    expect(buildListingContextRows({ listingReason: null, legalBasis: "", issuingBody: undefined })).toEqual([]);
  });

  it("separates a Latin abbreviation from adjacent Arabic text for visual PDF rendering", () => {
    expect(tokenizeMixedTextForPdf("SDGT/إرهابيون معينون عالميًا")).toEqual([
      { text: "SDGT/", isArabic: false },
      { text: "إرهابيون", isArabic: true },
      { text: "معينون", isArabic: true },
      { text: "عالميًا", isArabic: true },
    ]);
  });
});
