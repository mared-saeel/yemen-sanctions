import { describe, expect, it } from "vitest";
import { batchSearchOne, buildBatchFuseIndex, type BatchSearchRecord } from "./search-engine";

const compoundArabicRecord: BatchSearchRecord = {
  id: 77,
  nameEn: "HAMID ABDULLAH AL AHMAR",
  nameAr: "حميد عبد الله الاحمر",
  entityType: "individual",
  listingDate: "2024-01-01",
  listingReason: null,
  issuingBody: "OFAC",
  legalBasis: null,
  actionTaken: null,
  nationality: "اليمن",
  dateOfBirth: null,
  placeOfBirth: null,
  alternativeNames: [],
  notes: null,
  referenceNumber: "TEST-77",
  rawNotes: null,
};

describe("batchSearchOne Arabic compound names", () => {
  it("retrieves a record when عبدالله is written as عبد الله in the source", () => {
    const records = [compoundArabicRecord];
    const results = batchSearchOne("حميد عبدالله الاحمر", records, buildBatchFuseIndex(records), 0.55, 5);

    expect(results).toEqual([
      expect.objectContaining({ id: 77, nameAr: "حميد عبد الله الاحمر" }),
    ]);
    expect(results[0].matchScore).toBeGreaterThanOrEqual(70);
  });
});
