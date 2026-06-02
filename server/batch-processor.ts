import { getDb } from './db';
import { sanctionsRecords } from '../drizzle/schema';
import { searchSanctions } from './search-engine';
import { eq } from 'drizzle-orm';

export interface BatchItem {
  name: string;
  language?: 'ar' | 'en' | 'auto';
}

export interface BatchResult {
  inputName: string;
  status: 'MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH';
  matchScore: number;
  matchedRecord?: {
    id: string;
    name: string;
    nameArabic?: string | null;
    matchType: string;
  };
  error?: string;
}

/**
 * معالج الباتشينج الجديد
 * - حد أقصى 100 اسم
 * - معالجة متوازية محسّنة
 * - دقة عالية
 */
export async function processBatch(items: BatchItem[]): Promise<BatchResult[]> {
  // التحقق من الحد الأقصى
  if (items.length > 100) {
    throw new Error('Maximum 100 items allowed per batch');
  }

  if (items.length === 0) {
    throw new Error('Batch must contain at least 1 item');
  }

  // معالجة متوازية (20 اسم في كل دفعة)
  const batchSize = 20;
  const results: BatchResult[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => processSingleItem(item))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * معالجة اسم واحد
 */
async function processSingleItem(item: BatchItem): Promise<BatchResult> {
  try {
    // التحقق من صحة الاسم
    if (!item.name || item.name.trim().length === 0) {
      return {
        inputName: item.name || 'EMPTY',
        status: 'NO_MATCH',
        matchScore: 0,
        error: 'Empty name provided',
      };
    }

    const trimmedName = item.name.trim();

    // البحث عن الاسم
    const { results: searchResults } = await searchSanctions({
      query: trimmedName,
      limit: 1, // نريد أفضل نتيجة فقط
      threshold: 0.70, // حد أدنى 70%
    });

    if (!searchResults || searchResults.length === 0) {
      return {
        inputName: trimmedName,
        status: 'NO_MATCH',
        matchScore: 0,
      };
    }

    const topResult = searchResults[0];
    const matchScore = Math.min(1.0, topResult.matchScore || 0) * 100;

    // تحديد حالة المطابقة
    let status: 'MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH';
    if (matchScore >= 90) {
      status = 'MATCH';
    } else if (matchScore >= 70) {
      status = 'POSSIBLE_MATCH';
    } else {
      status = 'NO_MATCH';
    }

    return {
      inputName: trimmedName,
      status,
      matchScore: Math.round(matchScore),
      matchedRecord: {
        id: topResult.id.toString(),
        name: topResult.nameEn,
        nameArabic: topResult.nameAr || undefined,
        matchType: topResult.matchType || 'fuzzy'
      },
    };
  } catch (error) {
    return {
      inputName: item.name || 'ERROR',
      status: 'NO_MATCH',
      matchScore: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * تصدير نتائج الباتشينج
/**
 * تصدير نتائج الباتشينج
 */
export function formatBatchResults(results: BatchResult[]): string { const lines: string[] = [
    'Batch Processing Results',
    '='.repeat(80),
    `Total Items: ${results.length}`,
    `Matches: ${results.filter((r) => r.status === 'MATCH').length}`,
    `Possible Matches: ${results.filter((r) => r.status === 'POSSIBLE_MATCH').length}`,
    `No Matches: ${results.filter((r) => r.status === 'NO_MATCH').length}`,
    '='.repeat(80),
    '',
  ];

  results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.inputName}`);
    lines.push(`   Status: ${result.status}`);
    lines.push(`   Score: ${result.matchScore}%`);

    if (result.matchedRecord) {
      lines.push(`   Matched: ${result.matchedRecord.name}`);
      if (result.matchedRecord.nameArabic) {
        lines.push(`   Arabic: ${result.matchedRecord.nameArabic}`);
      }
    }

    if (result.error) {
      lines.push(`   Error: ${result.error}`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * حساب إحصائيات الباتشينج
 */
export function getBatchStatistics(results: BatchResult[]) {
  const total = results.length;
  const matches = results.filter((r) => r.status === 'MATCH').length;
  const possibleMatches = results.filter((r) => r.status === 'POSSIBLE_MATCH').length;
  const noMatches = results.filter((r) => r.status === 'NO_MATCH').length;
  const errors = results.filter((r) => r.error).length;

  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.matchScore, 0) / results.length)
      : 0;

  return {
    total,
    matches,
    possibleMatches,
    noMatches,
    errors,
    matchRate: Math.round((matches / total) * 100),
    possibleMatchRate: Math.round((possibleMatches / total) * 100),
    averageScore: avgScore,
  };
}
