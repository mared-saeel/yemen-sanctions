import { describe, expect, it } from "vitest";
import { formatSanctionsRecord, actionToText } from "../shared/record-formatter";
import { visualOrderForTest } from "./pdf-bidi";

const ofac = {
  nameEn: "GRAND TARGET HEAVY EQUIPMENT",
  listingReason: "برنامج العقوبات: IRAN-EO13902 | السند القانوني: Executive Order 13902 (Iran)",
  legalBasis: "Entity ID: 59111 | Identity ID: 50550 | List ID (SDN List): 61786",
  actionTaken: "تجميد الأموال والأصول (Block)",
  issuingBody: "OFAC",
  rawNotes: [
    "العناوين:",
    "- عنوان 1: الدولة: United Arab Emirates؛ نظام الكتابة: Latin؛ معرّف العنوان: 91120",
    "وثائق الهوية:",
    "- وثيقة 2 (معرّف الوثيقة: 54088): معرّف الوثيقة: 54088؛ المعرّف المرجعي: 91504؛ النوع: License؛ Name \\1d: 91358؛ الاسم: GRAND TARGET؛ رقم الوثيقة: 787212؛ الوثيقة سارية: true؛ دولة الإصدار: United Arab Emirates",
  ].join("\n"),
};

describe("formatSanctionsRecord", () => {
  it("separates programme, list, legal basis and source reference without internal IDs", () => {
    const f = formatSanctionsRecord(ofac);
    const ctx = Object.fromEntries(f.listingContext.map(i => [i.key, i.value]));
    const all = JSON.stringify(f);
    expect(Object.values(ctx)).toContain("IRAN-EO13902");
    expect(Object.values(ctx)).toContain("Executive Order 13902 (Iran)");
    expect(all).toContain("OFAC Entity ID: 59111");
    expect(all).not.toContain("Identity ID");
    expect(all).not.toContain("61786");
    // Only the structured boolean `valid` may hold true/false; no displayed text may.
    expect(all.replace(/"valid":(true|false|null)/g, "")).not.toMatch(/\btrue\b|\bfalse\b/);
  });

  it("moves identity documents out of addresses", () => {
    const f = formatSanctionsRecord(ofac);
    expect(f.identityDocuments.some(d => d.number === "787212")).toBe(true);
    expect(f.addresses).toEqual(["United Arab Emirates"]);
    const all = JSON.stringify(f);
    expect(all).not.toContain("54088");
    expect(all).not.toContain("91120");
    expect(all).not.toMatch(/\\1d|Name \\/);
  });

  it("splits the bilingual action into Arabic and English parts", () => {
    const f = formatSanctionsRecord(ofac);
    expect(f.actions.map(actionToText)).toContain("تجميد الأموال والأصول — Block");
  });

  it("keeps local Arabic legal basis and normalises the listing date", () => {
    const f = formatSanctionsRecord({
      nameAr: "عبدالخالق بدر الدين الحوثي",
      listingDate: "27/5/2021م",
      legalBasis: "قرار رقم 14 لعام 2021م",
      issuingBody: "المحامي العام الأول",
    });
    expect(f.listingDate).toBe("27/5/2021");
    expect(f.listingContext.map(i => i.value)).toContain("قرار رقم 14 لعام 2021م");
  });
});

describe("PDF bidi visual order", () => {
  it("keeps numbers and dates in logical order inside Arabic text", () => {
    const v = visualOrderForTest("قرار رقم 14 لعام 2021م");
    expect(v).toContain("14");
    expect(v).toContain("2021");
    expect(visualOrderForTest("بتاريخ 30/4/2019")).toContain("30/4/2019");
  });

  it("does not reverse brackets around Latin text", () => {
    expect(visualOrderForTest("تجميد الأموال (Block)")).toContain("(Block)");
    expect(visualOrderForTest("Executive Order 13902 (Iran)")).toBe("Executive Order 13902 (Iran)");
  });
});
