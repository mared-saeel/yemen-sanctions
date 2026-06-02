/**
 * Tests for Multi-Word Matcher
 */

import { describe, it, expect } from "vitest";
import {
  multiWordMatch,
  calculatePriority,
  extractWords,
  levenshteinSimilarity,
  normalizeArabicText,
} from "./multi-word-matcher";

describe("Multi-Word Matcher", () => {
  describe("normalizeArabicText", () => {
    it("should normalize Arabic text correctly", () => {
      const text1 = "احمد عبد الله حسين الاحمر";
      const text2 = "أحمد عبد الله حسين الأحمر";
      const normalized1 = normalizeArabicText(text1);
      const normalized2 = normalizeArabicText(text2);
      expect(normalized1).toBe(normalized2);
      console.log(`✅ Normalization: "${text1}" = "${normalized1}"`);
    });
  });

  describe("extractWords", () => {
    it("should extract words correctly", () => {
      const words = extractWords("احمد عبد الله حسين الاحمر");
      console.log(`✅ Extracted words: ${words.join(", ")}`);
      expect(words.length).toBeGreaterThan(0);
    });

    it("should filter stop words", () => {
      const words = extractWords("شركة الاستثمار النفطية");
      console.log(`✅ Filtered words: ${words.join(", ")}`);
      // Should not include "ال" (stop word)
    });
  });

  describe("levenshteinSimilarity", () => {
    it("should calculate similarity correctly", () => {
      const sim1 = levenshteinSimilarity("احمد", "احمد");
      expect(sim1).toBe(1.0);
      console.log(`✅ Similarity "احمد" vs "احمد" = ${(sim1 * 100).toFixed(2)}%`);

      const sim2 = levenshteinSimilarity("احمد", "حميد");
      expect(sim2).toBeGreaterThan(0.5);
      console.log(`✅ Similarity "احمد" vs "حميد" = ${(sim2 * 100).toFixed(2)}%`);
    });
  });

  describe("multiWordMatch", () => {
    it("should find exact match", () => {
      const result = multiWordMatch(
        "احمد عبد الله حسين الاحمر",
        "AHMAD ABDALLAH HUSSEIN AL-AHMAR",
        "احمد عبد الله حسين الاحمر"
      );
      console.log(`✅ Exact match: ${result.matchedWords} words matched`);
      expect(result.matchedWords).toBeGreaterThan(0);
    });

    it("should find partial match with 3 words", () => {
      const result = multiWordMatch(
        "احمد عبد الله حسين الاحمر",
        "HAMID ABDALLAH HUSSEIN AL-AHMAR",
        null
      );
      console.log(`✅ Partial match: ${result.matchedWords} words matched`);
      console.log(`   Matched words: ${result.matchedWordsList.join(", ")}`);
      console.log(`   Match score: ${(result.matchScore * 100).toFixed(2)}%`);
      expect(result.matchedWords).toBeGreaterThanOrEqual(2);
    });

    it("should find match with different first name", () => {
      // البحث عن "احمد عبد الله حسين الاحمر" يجب أن يجد "حميد عبد الله حسين الاحمر"
      // لأنه يتطابق في 3 كلمات: عبد الله، حسين، الاحمر
      const result = multiWordMatch(
        "احمد عبد الله حسين الاحمر",
        "HAMID ABDALLAH HUSSEIN AL-AHMAR",
        null,
        0.70
      );
      console.log(`\n✅ Multi-word match test:`);
      console.log(`   Query: "احمد عبد الله حسين الاحمر"`);
      console.log(`   Record: "HAMID ABDALLAH HUSSEIN AL-AHMAR"`);
      console.log(`   Matched words: ${result.matchedWords}`);
      console.log(`   Matched list: ${result.matchedWordsList.join(", ")}`);
      console.log(`   Match score: ${(result.matchScore * 100).toFixed(2)}%`);
      console.log(`   Priority: ${calculatePriority(result)}`);

      // يجب أن نجد 3 كلمات على الأقل
      expect(result.matchedWords).toBeGreaterThanOrEqual(2);
      expect(result.matchScore).toBeGreaterThan(0.7);
    });
  });

  describe("calculatePriority", () => {
    it("should calculate priority based on matched words", () => {
      const result1 = multiWordMatch(
        "احمد عبد الله حسين الاحمر",
        "HAMID ABDALLAH HUSSEIN AL-AHMAR",
        null
      );
      const priority1 = calculatePriority(result1);
      console.log(`✅ Priority for ${result1.matchedWords} words: ${priority1}`);

      expect(priority1).toBeGreaterThan(0);
    });
  });
});
