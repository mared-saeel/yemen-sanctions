/**
 * Smart Word Matcher - نظام بحث ذكي
 * يجد الأسماء المرتبطة بناءً على تطابق 2+ كلمات بغض النظر عن موضعها
 * 
 * المنطق:
 * - البحث عن "احمد عبد الله حسين الاحمر"
 * - إذا وجد 2+ كلمات متطابقة في أي مكان → ظهور النتيجة
 * - مثال: "حميد عبد الله حسين الاحمر" يطابق في 3 كلمات → ظهور
 */

export interface SmartMatchResult {
  matchedWords: number;
  totalQueryWords: number;
  matchScore: number;
  matchedWordsList: string[];
  unmatchedQueryWords: string[];
  matchType: "exact" | "multi-word" | "partial" | "none";
}

/**
 * تطبيع النص
 */
export function normalizeText(text: string): string {
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
 * استخراج الكلمات المهمة (بدون كلمات توقف)
 */
export function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    "شركة", "مؤسسة", "مجموعة", "ابن", "بن", "و", "أو", "في", "من", "إلى", "عن",
    "the", "al", "el", "bin", "ibn", "and", "or", "in", "of", "to", "for", "co", "ltd", "inc",
    "a", "an", "the", "is", "are", "be", "been", "being",
  ]);

  return normalizeText(text)
    .split(/\s+/)
    .filter(word => word.length >= 2 && !STOP_WORDS.has(word));
}

/**
 * حساب تشابه Levenshtein
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
 * البحث الذكي عن الكلمات المتطابقة
 * يجد أفضل تطابق لكل كلمة من الاستعلام في السجل
 */
export function smartWordMatch(
  queryText: string,
  recordNameEn: string,
  recordNameAr: string | null,
  similarityThreshold: number = 0.65
): SmartMatchResult {
  const queryKeywords = extractKeywords(queryText);
  const recordKeywordsEn = extractKeywords(recordNameEn);
  const recordKeywordsAr = recordNameAr ? extractKeywords(recordNameAr) : [];
  const allRecordKeywords = [...recordKeywordsEn, ...recordKeywordsAr];

  if (queryKeywords.length === 0 || allRecordKeywords.length === 0) {
    return {
      matchedWords: 0,
      totalQueryWords: queryKeywords.length,
      matchScore: 0,
      matchedWordsList: [],
      unmatchedQueryWords: queryKeywords,
      matchType: "none",
    };
  }

  const matchedWords: string[] = [];
  const unmatchedWords: string[] = [];
  const usedRecordIndices = new Set<number>();

  // البحث عن كل كلمة من الاستعلام في السجل
  for (const queryWord of queryKeywords) {
    let bestMatch: { index: number; word: string; similarity: number } | null = null;
    let bestScore = 0;

    // البحث عن أفضل تطابق
    for (let i = 0; i < allRecordKeywords.length; i++) {
      if (!usedRecordIndices.has(i)) {
        const similarity = levenshteinSimilarity(queryWord, allRecordKeywords[i]);
        
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = { index: i, word: allRecordKeywords[i], similarity };
        }
      }
    }

    // إذا وجدنا تطابق بنسبة كافية
    if (bestMatch && bestScore >= similarityThreshold) {
      matchedWords.push(queryWord);
      usedRecordIndices.add(bestMatch.index);
    } else {
      unmatchedWords.push(queryWord);
    }
  }

  // حساب النقاط والنوع
  const matchedCount = matchedWords.length;
  const totalQueryWords = queryKeywords.length;
  let matchScore = 0;
  let matchType: "exact" | "multi-word" | "partial" | "none" = "none";

  if (matchedCount === 0) {
    matchScore = 0;
    matchType = "none";
  } else if (matchedCount === totalQueryWords) {
    // جميع الكلمات متطابقة = 100% (exact)
    matchScore = 1.0;
    matchType = "exact";
  } else if (matchedCount >= 3) {
    // 3+ كلمات متطابقة = 90-98% (multi-word)
    matchScore = 0.90 + (matchedCount / totalQueryWords) * 0.08;
    matchType = "multi-word";
  } else if (matchedCount === 2) {
    // كلمتان متطابقتان = 75-85% (multi-word)
    matchScore = 0.75 + (matchedCount / totalQueryWords) * 0.10;
    matchType = "multi-word";
  } else if (matchedCount === 1) {
    // كلمة واحدة متطابقة = 40-50% (partial)
    matchScore = 0.40 + (matchedCount / totalQueryWords) * 0.10;
    matchType = "partial";
  }

  // تطبيع النقاط
  matchScore = Math.min(1.0, Math.max(0, matchScore));

  return {
    matchedWords: matchedCount,
    totalQueryWords,
    matchScore,
    matchedWordsList: matchedWords,
    unmatchedQueryWords: unmatchedWords,
    matchType,
  };
}

/**
 * حساب أولوية البحث
 * الأولويات:
 * - exact: 1000
 * - multi-word (3+ كلمات): 900
 * - multi-word (2 كلمات): 700
 * - partial (1 كلمة): 200
 */
export function calculateSmartPriority(matchResult: SmartMatchResult): number {
  const { matchedWords, totalQueryWords, matchType } = matchResult;

  if (matchType === "exact") return 1000;
  if (matchType === "multi-word") {
    if (matchedWords >= 4) return 950;
    if (matchedWords === 3) return 900;
    if (matchedWords === 2) return 700;
  }
  if (matchType === "partial") return 200;

  return 0;
}

/**
 * البحث الذكي الشامل
 * يجد جميع الأسماء المرتبطة بناءً على تطابق الكلمات
 */
export function findRelatedNames(
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
  matchResult: SmartMatchResult;
  priority: number;
}> {
  const results = [];

  for (const record of records) {
    const matchResult = smartWordMatch(queryText, record.nameEn, record.nameAr);

    // إذا تطابقت 2+ كلمات → إضافة النتيجة
    if (matchResult.matchedWords >= minMatchedWords) {
      const priority = calculateSmartPriority(matchResult);
      results.push({
        id: record.id,
        nameEn: record.nameEn,
        nameAr: record.nameAr,
        matchResult,
        priority,
      });
    }
  }

  // ترتيب النتائج حسب الأولوية (من الأعلى إلى الأقل)
  return results.sort((a, b) => {
    // أولاً: ترتيب حسب الأولوية
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    // ثانياً: ترتيب حسب نقاط المطابقة
    if (b.matchResult.matchScore !== a.matchResult.matchScore) {
      return b.matchResult.matchScore - a.matchResult.matchScore;
    }
    // ثالثاً: ترتيب حسب عدد الكلمات المتطابقة
    return b.matchResult.matchedWords - a.matchResult.matchedWords;
  });
}

/**
 * دالة مساعدة لتنسيق النتائج
 */
export function formatSmartMatchResult(result: SmartMatchResult): string {
  const percentage = Math.round(result.matchScore * 100);
  const matchTypeLabel: Record<string, string> = {
    exact: "تطابق تام",
    "multi-word": "تطابق متعدد",
    partial: "تطابق جزئي",
    none: "لا يوجد تطابق",
  };

  return `${matchTypeLabel[result.matchType]} (${percentage}%) - ${result.matchedWords} كلمات متطابقة`;
}
