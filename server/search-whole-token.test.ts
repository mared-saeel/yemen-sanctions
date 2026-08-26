import { describe, expect, it } from "vitest";
import { hasExactArabicQueryTokenForSearch, hasWholeNamePhraseForSearch } from "./search-engine";

describe("whole-name phrase matching", () => {
  it("matches a complete Arabic name token", () => {
    expect(hasWholeNamePhraseForSearch("محمد أمين مصطفى", "أمين")).toBe(true);
    expect(hasWholeNamePhraseForSearch("المجموعة الصناعية أمين", "امين")).toBe(true);
  });

  it("rejects Arabic substring false positives", () => {
    expect(hasWholeNamePhraseForSearch("شركة تأمين معدات السلامة", "أمين")).toBe(false);
    expect(hasWholeNamePhraseForSearch("لويس فرناندو داميني بوستيوس", "امين")).toBe(false);
  });

  it("keeps valid English partial phrases", () => {
    expect(hasWholeNamePhraseForSearch("DREW PROPERTIES CO LTD", "DREW PROPERTIES")).toBe(true);
  });

  it("requires an exact token for a short Arabic given name", () => {
    expect(hasExactArabicQueryTokenForSearch("محمد أمين مصطفى", "امين")).toBe(true);
    expect(hasExactArabicQueryTokenForSearch("رامين جلاليان", "امين")).toBe(false);
    expect(hasExactArabicQueryTokenForSearch("أمينة سادات", "امين")).toBe(false);
    expect(hasExactArabicQueryTokenForSearch("لويس داميني بوستيوس", "امين")).toBe(false);
  });
});
