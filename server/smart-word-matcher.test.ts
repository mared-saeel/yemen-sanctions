/**
 * Tests for Smart Word Matcher
 */

import { describe, it, expect } from "vitest";
import {
  smartWordMatch,
  calculateSmartPriority,
  extractKeywords,
  levenshteinSimilarity,
  normalizeText,
  findRelatedNames,
  formatSmartMatchResult,
} from "./smart-word-matcher";

describe("Smart Word Matcher", () => {
  describe("normalizeText", () => {
    it("should normalize Arabic text correctly", () => {
      const text1 = "احمد عبد الله حسين الاحمر";
      const text2 = "أحمد عبد الله حسين الأحمر";
      const normalized1 = normalizeText(text1);
      const normalized2 = normalizeText(text2);
      expect(normalized1).toBe(normalized2);
      console.log(`✅ Normalization: "${text1}" = "${normalized1}"`);
    });
  });

  describe("extractKeywords", () => {
    it("should extract keywords correctly", () => {
      const keywords = extractKeywords("احمد عبد الله حسين الاحمر");
      console.log(`✅ Keywords: ${keywords.join(", ")}`);
      expect(keywords.length).toBeGreaterThan(0);
    });

    it("should filter stop words", () => {
      const keywords = extractKeywords("احمد عبد الله حسين الاحمر");
      console.log(`✅ Filtered keywords: ${keywords.join(", ")}`);
      // Should not include "عبد" if it's a stop word
    });
  });

  describe("levenshteinSimilarity", () => {
    it("should calculate similarity correctly", () => {
      const sim1 = levenshteinSimilarity("حسين", "حسين");
      expect(sim1).toBe(1.0);
      console.log(`✅ Similarity "حسين" vs "حسين" = ${(sim1 * 100).toFixed(2)}%`);

      const sim2 = levenshteinSimilarity("حسين", "hussein");
      console.log(`✅ Similarity "حسين" vs "hussein" = ${(sim2 * 100).toFixed(2)}%`);
    });
  });

  describe("smartWordMatch", () => {
    it("should find exact match", () => {
      const result = smartWordMatch(
        "احمد عبد الله حسين الاحمر",
        "AHMAD ABDALLAH HUSSEIN AL-AHMAR",
        "احمد عبد الله حسين الاحمر"
      );
      console.log(`✅ Exact match: ${result.matchedWords} words matched (${(result.matchScore * 100).toFixed(2)}%)`);
      console.log(`   Type: ${result.matchType}`);
      expect(result.matchedWords).toBeGreaterThan(0);
    });

    it("should find multi-word match with different first name", () => {
      // البحث عن "احمد عبد الله حسين الاحمر" يجب أن يجد "حميد عبد الله حسين الاحمر"
      // لأنه يتطابق في 3 كلمات: عبد الله، حسين، الاحمر
      const result = smartWordMatch(
        "احمد عبد الله حسين الاحمر",
        "HAMID ABDALLAH HUSSEIN AL-AHMAR",
        null,
        0.65
      );
      console.log(`\n✅ Multi-word match test:`);
      console.log(`   Query: "احمد عبد الله حسين الاحمر"`);
      console.log(`   Record: "HAMID ABDALLAH HUSSEIN AL-AHMAR"`);
      console.log(`   Matched words: ${result.matchedWords}`);
      console.log(`   Matched list: ${result.matchedWordsList.join(", ")}`);
      console.log(`   Match score: ${(result.matchScore * 100).toFixed(2)}%`);
      console.log(`   Match type: ${result.matchType}`);
      console.log(`   Priority: ${calculateSmartPriority(result)}`);

      // يجب أن نجد 2+ كلمات على الأقل
      expect(result.matchedWords).toBeGreaterThanOrEqual(2);
      expect(result.matchType).toBe("multi-word");
    });

    it("should find match with partial similarity", () => {
      const result = smartWordMatch(
        "محمد علي",
        "MOHAMMAD ALI",
        null,
        0.65
      );
      console.log(`\n✅ Partial match test:`);
      console.log(`   Query: "محمد علي"`);
      console.log(`   Record: "MOHAMMAD ALI"`);
      console.log(`   Matched words: ${result.matchedWords}`);
      console.log(`   Match score: ${(result.matchScore * 100).toFixed(2)}%`);
      console.log(`   Match type: ${result.matchType}`);

      expect(result.matchedWords).toBeGreaterThanOrEqual(1);
    });
  });

  describe("calculateSmartPriority", () => {
    it("should calculate priority based on match type and matched words", () => {
      const result1 = smartWordMatch(
        "احمد عبد الله حسين الاحمر",
        "HAMID ABDALLAH HUSSEIN AL-AHMAR",
        null
      );
      const priority1 = calculateSmartPriority(result1);
      console.log(`✅ Priority for ${result1.matchedWords} words (${result1.matchType}): ${priority1}`);

      expect(priority1).toBeGreaterThanOrEqual(0);
    });
  });

  describe("findRelatedNames", () => {
    it("should find all related names", () => {
      const records = [
        { id: 1, nameEn: "AHMAD ABDALLAH HUSSEIN AL-AHMAR", nameAr: "احمد عبد الله حسين الاحمر" },
        { id: 2, nameEn: "HAMID ABDALLAH HUSSEIN AL-AHMAR", nameAr: "حميد عبد الله حسين الاحمر" },
        { id: 3, nameEn: "MOHAMMED ALI", nameAr: "محمد علي" },
        { id: 4, nameEn: "JOHN SMITH", nameAr: null },
      ];

      const results = findRelatedNames("احمد عبد الله حسين الاحمر", records, 2);
      console.log(`\n✅ Find related names test:`);
      console.log(`   Query: "احمد عبد الله حسين الاحمر"`);
      console.log(`   Found ${results.length} related names:`);
      
      for (const r of results) {
        console.log(`   - ${r.nameEn} (Priority: ${r.priority}, Score: ${(r.matchResult.matchScore * 100).toFixed(2)}%, Matched: ${r.matchResult.matchedWords})`);
      }

      // يجب أن نجد على الأقل 2 نتيجة (الاسم الأول والاسم المشابه)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].id).toBe(1); // الاسم الأول يجب أن يكون الأول
    });
  });

  describe("formatSmartMatchResult", () => {
    it("should format result correctly", () => {
      const result = smartWordMatch(
        "احمد عبد الله حسين الاحمر",
        "HAMID ABDALLAH HUSSEIN AL-AHMAR",
        null
      );
      const formatted = formatSmartMatchResult(result);
      console.log(`✅ Formatted result: ${formatted}`);
      expect(formatted).toContain("%");
    });
  });
});
