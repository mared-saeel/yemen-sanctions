/**
 * Multi-Word Matcher Engine - Version 2
 * خوارزمية محسّنة لتطابق الكلمات المتعددة
 * 
 * الهدف: عند البحث عن "احمد عبد الله حسين الاحمر"
 * يجب أن يظهر "حميد عبد الله حسين الاحمر" لأنه يتطابق في 3 كلمات
 */

export interface WordMatchResult {
  matchedWords: number;
  totalQueryWords: number;
  totalRecordWords: number;
  matchScore: number;
  matchedWordsList: string[];
  unmatchedQueryWords: string[];
}

/**
 * تطبيع النص العربي
 */
export function normalizeArabicText(text: string): string {
  return text
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[\u064B-\u065F]/g, "")
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * استخراج الكلمات من النص
 */
export function extractWords(text: string): string[] {
  const STOP_WORDS = new Set([
    "شركة", "مؤسسة", "مجموعة", "عبد", "ابن", "بن", "ال", "و", "أو", "في", "من", "إلى", "عن",
    "the", "al", "el", "bin", "ibn", "and", "or", "in", "of", "to", "for", "co", "ltd", "inc",
  ]);

  return normalizeArabicText(text)
    .split(/\s+/)
    .filter(word => word.length >= 2 && !STOP_WORDS.has(word));
}

/**
 * حساب تشابه Levenshtein بين كلمتين
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * حساب تشابه Levenshtein كنسبة مئوية
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshteinDistance(a, b) / maxLen;
}

/**
 * البحث عن كلمة في قائمة كلمات مع تسامح معين
 */
export function findMatchingWord(
  queryWord: string,
  recordWords: string[],
  threshold: number = 0.70
): { word: string; similarity: number } | null {
  let bestMatch: { word: string; similarity: number } | null = null;
  let bestScore = 0;

  for (const recordWord of recordWords) {
    const similarity = levenshteinSimilarity(queryWord, recordWord);
    
    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestMatch = { word: recordWord, similarity };
    }
  }

  return bestMatch;
}

/**
 * خوارزمية تطابق الكلمات المتعددة - محسّنة
 * تحسب عدد الكلمات المتطابقة بين الاستعلام والسجل
 */
export function multiWordMatch(
  queryText: string,
  recordNameEn: string,
  recordNameAr: string | null,
  similarityThreshold: number = 0.70
): WordMatchResult {
  const queryWords = extractWords(queryText);
  const recordWordsEn = extractWords(recordNameEn);
  const recordWordsAr = recordNameAr ? extractWords(recordNameAr) : [];
  const allRecordWords = [...recordWordsEn, ...recordWordsAr];

  if (queryWords.length === 0 || allRecordWords.length === 0) {
    return {
      matchedWords: 0,
      totalQueryWords: queryWords.length,
      totalRecordWords: allRecordWords.length,
      matchScore: 0,
      matchedWordsList: [],
      unmatchedQueryWords: queryWords,
    };
  }

  const matchedWords: string[] = [];
  const unmatchedWords: string[] = [];
  const usedRecordIndices = new Set<number>();

  // البحث عن كل كلمة من الاستعلام في السجل
  for (const queryWord of queryWords) {
    let found = false;

    // أولاً: بحث دقيق (100%)
    for (let i = 0; i < allRecordWords.length; i++) {
      if (!usedRecordIndices.has(i) && queryWord === allRecordWords[i]) {
        matchedWords.push(queryWord);
        usedRecordIndices.add(i);
        found = true;
        break;
      }
    }

    // ثانياً: بحث تقريبي إذا لم نجد تطابق دقيق
    if (!found) {
      let bestMatch: { index: number; word: string; similarity: number } | null = null;
      let bestScore = 0;

      for (let i = 0; i < allRecordWords.length; i++) {
        if (!usedRecordIndices.has(i)) {
          const similarity = levenshteinSimilarity(queryWord, allRecordWords[i]);
          
          if (similarity > bestScore && similarity >= similarityThreshold) {
            bestScore = similarity;
            bestMatch = { index: i, word: allRecordWords[i], similarity };
          }
        }
      }

      if (bestMatch) {
        matchedWords.push(queryWord);
        usedRecordIndices.add(bestMatch.index);
        found = true;
      }
    }

    if (!found) {
      unmatchedWords.push(queryWord);
    }
  }

  // حساب النقاط
  const matchedCount = matchedWords.length;
  const totalQueryWords = queryWords.length;

  let matchScore = 0;

  if (matchedCount === 0) {
    matchScore = 0;
  } else if (matchedCount === totalQueryWords) {
    // جميع الكلمات متطابقة = 100%
    matchScore = 1.0;
  } else if (matchedCount >= 4) {
    // 4+ كلمات متطابقة = 95-100%
    matchScore = 0.95 + (matchedCount / totalQueryWords) * 0.05;
  } else if (matchedCount === 3) {
    // 3 كلمات متطابقة = 90-95%
    matchScore = 0.90 + (matchedCount / totalQueryWords) * 0.05;
  } else if (matchedCount === 2) {
    // كلمتان متطابقتان = 80-90%
    matchScore = 0.80 + (matchedCount / totalQueryWords) * 0.10;
  } else if (matchedCount === 1) {
    // كلمة واحدة متطابقة = 50-60%
    matchScore = 0.50 + (matchedCount / totalQueryWords) * 0.10;
  }

  // تطبيع النقاط
  matchScore = Math.min(1.0, Math.max(0, matchScore));

  return {
    matchedWords: matchedCount,
    totalQueryWords,
    totalRecordWords: allRecordWords.length,
    matchScore,
    matchedWordsList: matchedWords,
    unmatchedQueryWords: unmatchedWords,
  };
}

/**
 * حساب أولوية البحث بناءً على عدد الكلمات المتطابقة
 */
export function calculatePriority(matchResult: WordMatchResult): number {
  const { matchedWords, totalQueryWords } = matchResult;

  if (matchedWords === 0) return 0;
  if (matchedWords === totalQueryWords) return 1000;
  if (matchedWords >= 4) return 900;
  if (matchedWords === 3) return 800;
  if (matchedWords === 2) return 500;
  if (matchedWords === 1) return 100;

  return 0;
}

/**
 * دالة شاملة للبحث عن تطابق الكلمات المتعددة
 */
export function findMultiWordMatches(
  queryText: string,
  records: Array<{
    id: number;
    nameEn: string;
    nameAr: string | null;
  }>,
  minMatchedWords: number = 2
): Array<{
  id: number;
  nameEn: string;
  nameAr: string | null;
  matchResult: WordMatchResult;
  priority: number;
}> {
  const results = [];

  for (const record of records) {
    const matchResult = multiWordMatch(queryText, record.nameEn, record.nameAr);

    if (matchResult.matchedWords >= minMatchedWords) {
      const priority = calculatePriority(matchResult);
      results.push({
        id: record.id,
        nameEn: record.nameEn,
        nameAr: record.nameAr,
        matchResult,
        priority,
      });
    }
  }

  // ترتيب النتائج حسب الأولوية
  return results.sort((a, b) => b.priority - a.priority);
}
