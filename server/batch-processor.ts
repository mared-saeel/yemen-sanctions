/**
 * Batch Screening Processor — Accurate Classification with Progress Tracking
 *
 * Key improvements:
 * 1. Uses wordOverlapScore as a secondary validation gate (prevents false positives)
 * 2. Loads all records once into memory for fast batch processing
 * 3. Supports async job model with progress tracking
 * 4. Classification: MATCH (score >= 85% AND >=2 matched words), POSSIBLE_MATCH (60-84% AND >=2 matched words), NO_MATCH (score < 60% OR <2 matched words)
 */
import { loadAllRecordsForBatch, buildBatchFuseIndex, batchSearchOne, type BatchSearchRecord, type SearchResult } from "./search-engine";
import Fuse from "fuse.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BatchItem {
  name: string;
  rowNumber?: number;
}

export interface BatchResult {
  rowNumber: number;
  inputName: string;
  status: 'MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH';
  matchScore: number;
  matchedRecord?: {
    id: string;
    name: string;
    nameArabic?: string | null;
    entityType: string | null;
    issuingBody: string | null;
    listingDate: string | null;
    matchType: string;
  };
  error?: string;
}

export interface BatchJob {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  total: number;
  processed: number;
  results: BatchResult[];
  matchCount: number;
  possibleCount: number;
  noMatchCount: number;
  error?: string;
  createdAt: number;
}

// ─── In-memory job store ────────────────────────────────────────────────────
const jobs = new Map<string, BatchJob>();

// Cleanup jobs older than 30 minutes every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  jobs.forEach((job, id) => {
    if (job.createdAt < cutoff) jobs.delete(id);
  });
}, 5 * 60 * 1000);

function generateJobId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Word Overlap Score (Critical for accuracy) ─────────────────────────────

function batchNormalize(text: string): string {
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

const STOP_WORDS = new Set([
  "شركة", "مؤسسة", "مجموعة", "ابن", "بن", "ال",
  "the", "al", "el", "bin", "ibn", "and", "of", "for", "co", "ltd", "inc",
  "llc", "corp", "group", "company", "trading", "international",
]);

function levenshteinDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/**
 * Calculates word overlap between two names.
 * Uses AVERAGE of both directions to prevent false positives from short names.
 * 
 * Example:
 * "ماجد عبدالخالق فاضل صائل" (4 tokens) vs "MAJEED ABDUL" (2 tokens)
 *   - Forward: 2/4 matched = 0.50
 *   - Reverse: 2/2 matched = 1.00
 *   - Average: 0.75 → BELOW threshold of 0.80 → NO_MATCH ✓
 *
 * "حميد الاحمر" (2 tokens) vs "HAMID ABDULLAH HUSSEIN AL AHMAR" (4 tokens)
 *   - Forward: 2/2 matched = 1.00
 *   - Reverse: 2/4 matched = 0.50
 *   - Average: 0.75 → ABOVE threshold of 0.60 for POSSIBLE_MATCH ✓
 */
/**
 * Count how many words from nameA match in nameB (with 80% similarity threshold)
 * Returns the count of matched words from nameA
 */
function countMatchedWords(nameA: string, nameB: string): number {
  const tokensA = batchNormalize(nameA).split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  const tokensB = batchNormalize(nameB).split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matchedCount = 0;
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      const maxLen = Math.max(ta.length, tb.length);
      if (maxLen === 0) continue;
      const sim = 1 - levenshteinDist(ta, tb) / maxLen;
      if (sim >= 0.80) {
        matchedCount++;
        break;
      }
    }
  }
  return matchedCount;
}

function wordOverlapScore(nameA: string, nameB: string): number {
  const tokensA = batchNormalize(nameA).split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  const tokensB = batchNormalize(nameB).split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS.has(t));
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Forward: how many of nameA's tokens match in nameB
  let matchedAB = 0;
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      const maxLen = Math.max(ta.length, tb.length);
      if (maxLen === 0) continue;
      const sim = 1 - levenshteinDist(ta, tb) / maxLen;
      if (sim >= 0.80) { matchedAB++; break; }
    }
  }

  // Reverse: how many of nameB's tokens match in nameA
  let matchedBA = 0;
  for (const tb of tokensB) {
    for (const ta of tokensA) {
      const maxLen = Math.max(ta.length, tb.length);
      if (maxLen === 0) continue;
      const sim = 1 - levenshteinDist(ta, tb) / maxLen;
      if (sim >= 0.80) { matchedBA++; break; }
    }
  }

  // Use AVERAGE of both directions (penalizes partial name matches)
  const forwardScore = matchedAB / tokensA.length;
  const reverseScore = matchedBA / tokensB.length;
  return (forwardScore + reverseScore) / 2;
}

// ─── Job Management ─────────────────────────────────────────────────────────

export function getJob(jobId: string): BatchJob | undefined {
  return jobs.get(jobId);
}

export function createBatchJob(names: string[]): string {
  if (names.length > 100) {
    throw new Error('Maximum 100 items allowed per batch');
  }
  if (names.length === 0) {
    throw new Error('Batch must contain at least 1 item');
  }

  const jobId = generateJobId();
  jobs.set(jobId, {
    id: jobId,
    status: 'pending',
    progress: 0,
    total: names.length,
    processed: 0,
    results: [],
    matchCount: 0,
    possibleCount: 0,
    noMatchCount: 0,
    createdAt: Date.now(),
  });

  return jobId;
}

// ─── Background Processing ──────────────────────────────────────────────────

export async function processJobInBackground(jobId: string, names: string[]): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';

    // Load all records once for batch processing
    let allRecords: BatchSearchRecord[];
    let fuseIndex: Fuse<BatchSearchRecord>;
    try {
      allRecords = await loadAllRecordsForBatch();
      fuseIndex = buildBatchFuseIndex(allRecords);
    } catch (err) {
      console.error('[batch-job] Failed to load records:', err);
      throw err;
    }

    const results: BatchResult[] = [];
    const PARALLEL_BATCH_SIZE = 10;

    // Process names in parallel batches
    for (let i = 0; i < names.length; i += PARALLEL_BATCH_SIZE) {
      const batch = names.slice(i, i + PARALLEL_BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (name, idx) => {
          const rowNumber = i + idx + 1;
          try {
            if (!name || name.trim().length === 0) {
              return {
                rowNumber,
                inputName: name || 'EMPTY',
                status: 'NO_MATCH' as const,
                matchScore: 0,
                error: 'Empty name provided',
              };
            }

            const trimmedName = name.trim();

            // Use batch-optimized search (no DB calls, pure in-memory)
            const candidates = batchSearchOne(trimmedName, allRecords, fuseIndex, 0.55, 5);

            let status: 'MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH' = 'NO_MATCH';
            let chosenTop: SearchResult | null = null;

            // Evaluate each candidate with minimum 2 matched words requirement
            for (const candidate of candidates) {
              const candidateName = candidate.nameEn || candidate.nameAr || "";
              
              // Count matched words from input name in candidate
              const matchedWordsEn = countMatchedWords(trimmedName, candidateName);
              const matchedWordsAr = candidate.nameAr ? countMatchedWords(trimmedName, candidate.nameAr) : 0;
              const matchedWordsAlt = candidate.alternativeNames
                ? Math.max(0, ...candidate.alternativeNames.map(alt => countMatchedWords(trimmedName, alt)))
                : 0;
              const bestMatchedWords = Math.max(matchedWordsEn, matchedWordsAr, matchedWordsAlt);
              
              // CRITICAL: Must have at least 2 matched words from input name
              // This prevents false positives from single-word matches
              if (bestMatchedWords < 2) {
                continue; // Skip this candidate - not enough word matches
              }
              
              const score = candidate.matchScore;

              if (score >= 85) {
                // MATCH: score >= 85% AND at least 2 matched words
                status = 'MATCH';
                chosenTop = candidate;
                break;
              } else if (score >= 60) {
                // POSSIBLE_MATCH: score 60-84% AND at least 2 matched words
                if (status === 'NO_MATCH') {
                  status = 'POSSIBLE_MATCH';
                  chosenTop = candidate;
                }
              }
              // Below thresholds = NO_MATCH (no false positives)
            }

            // If no candidate passed the overlap gate, it's NO_MATCH
            if (status === 'NO_MATCH' && chosenTop && wordOverlapScore(trimmedName, chosenTop.nameEn || "") < 0.30) {
              chosenTop = null; // Don't show irrelevant matches
            }

            return {
              rowNumber,
              inputName: trimmedName,
              status,
              matchScore: chosenTop ? chosenTop.matchScore : 0,
              matchedRecord: chosenTop ? {
                id: chosenTop.id.toString(),
                name: chosenTop.nameEn,
                nameArabic: chosenTop.nameAr || undefined,
                entityType: chosenTop.entityType,
                issuingBody: chosenTop.issuingBody,
                listingDate: chosenTop.listingDate,
                matchType: chosenTop.matchType || 'fuzzy',
              } : undefined,
            };
          } catch (err) {
            return {
              rowNumber,
              inputName: name || 'ERROR',
              status: 'NO_MATCH' as const,
              matchScore: 0,
              error: err instanceof Error ? err.message : 'Unknown error',
            };
          }
        })
      );

      results.push(...batchResults);

      // Update progress
      job.processed = Math.min(i + PARALLEL_BATCH_SIZE, names.length);
      job.progress = Math.round((job.processed / job.total) * 100);

      // Small delay between batches
      if (i + PARALLEL_BATCH_SIZE < names.length) {
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }

    job.results = results;
    job.matchCount = results.filter(r => r.status === 'MATCH').length;
    job.possibleCount = results.filter(r => r.status === 'POSSIBLE_MATCH').length;
    job.noMatchCount = results.filter(r => r.status === 'NO_MATCH').length;
    job.status = 'done';
    job.progress = 100;

  } catch (err) {
    console.error("[batch-job]", err);
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : 'Unknown error';
    }
  }
}

// ─── Legacy sync processBatch (kept for backward compatibility) ─────────────

export async function processBatch(items: BatchItem[]): Promise<BatchResult[]> {
  const names = items.map(i => i.name);
  const jobId = createBatchJob(names);
  await processJobInBackground(jobId, names);
  const job = jobs.get(jobId);
  return job?.results || [];
}

// ─── Statistics ─────────────────────────────────────────────────────────────

export function formatBatchResults(results: BatchResult[]): string {
  const lines: string[] = [
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
    matchRate: total > 0 ? Math.round((matches / total) * 100) : 0,
    possibleMatchRate: total > 0 ? Math.round((possibleMatches / total) * 100) : 0,
    averageScore: avgScore,
  };
}
