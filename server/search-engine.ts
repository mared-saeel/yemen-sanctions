/**
 * Smart Search Engine
 * Combines Fuzzy Matching, Levenshtein Distance, and AI-powered semantic search
 * for the sanctions database.
 */
import Fuse from "fuse.js";
import levenshtein from "fast-levenshtein";
import { getDb } from "./db";
import { sanctionsRecords } from "../drizzle/schema";
import { like, or, eq, and, gte, lte, inArray, sql } from "drizzle-orm";

export interface SearchFilters {
  entityType?: "individual" | "organisation" | "vessel" | "unspecified" | null;
  nationality?: string | null;
  issuingBody?: string | null;
  listingReason?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface SearchResult {
  id: number;
  nameEn: string;
  nameAr: string | null;
  entityType: string;
  listingDate: string | null;
  listingReason: string | null;
  issuingBody: string | null;
  legalBasis: string | null;
  actionTaken: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  alternativeNames: string[];
  notes: string | null;
  referenceNumber: string | null;
  rawNotes: string | null;
  matchScore: number;
  matchType: "exact" | "fuzzy" | "phonetic" | "ai";
}

export interface SearchOptions {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  enableAI?: boolean;
  threshold?: number; // 0-1, lower = more strict
}

// ─── Arabic → Latin Transliteration ─────────────────────────────────────────

/**
 * Converts Arabic text to approximate Latin/English transliteration.
 * This allows Arabic queries to match English-stored names in the DB.
 * e.g. "الرضوان" → "alridhwan" / "alradwan"
 */
export function arabicToLatin(text: string): string {
  const map: Record<string, string> = {
    'ا': 'a', 'أ': 'a', 'إ': 'a', 'آ': 'a',
    'ب': 'b',
    'ت': 't',
    'ث': 'th',
    'ج': 'j',
    'ح': 'h',
    'خ': 'kh',
    'د': 'd',
    'ذ': 'dh',
    'ر': 'r',
    'ز': 'z',
    'س': 's',
    'ش': 'sh',
    'ص': 's',
    'ض': 'd',
    'ط': 't',
    'ظ': 'dh',
    'ع': '',
    'غ': 'gh',
    'ف': 'f',
    'ق': 'q',
    'ك': 'k',
    'ل': 'l',
    'م': 'm',
    'ن': 'n',
    'ه': 'h',
    'ة': 'h',
    'و': 'w',
    'ي': 'y',
    'ى': 'a',
    'ء': '',
    'ئ': 'y',
    'ؤ': 'w',
    'لا': 'la',
    'ال': 'al',
    ' ': ' ',
  };

  let result = '';
  let i = 0;
  while (i < text.length) {
    // Try two-char combos first (لا، ال)
    const two = text.slice(i, i + 2);
    if (map[two] !== undefined) {
      result += map[two];
      i += 2;
    } else {
      const ch = text[i];
      result += map[ch] !== undefined ? map[ch] : ch;
      i++;
    }
  }
  // Normalize spaces and remove diacritics residue
  return result
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Returns true if the text contains Arabic characters.
 */
function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// ─── Normalization helpers ────────────────────────────────────────────────────

function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[\u064B-\u065F]/g, "") // remove diacritics
    .trim()
    .toLowerCase();
}

function normalizeEnglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string): string {
  // Detect if Arabic
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) {
    return normalizeArabic(text);
  }
  return normalizeEnglish(text);
}

// ─── Levenshtein similarity ───────────────────────────────────────────────────

function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein.get(a, b);
  return 1 - dist / maxLen;
}
// ─── Token-based similarity ────────────────────────────────────────────────────

/**
 * One-directional token similarity: for each query token, find best match in target.
 * Order-independent.
 */
function tokenSimilarity(query: string, target: string): number {
  const qTokens = normalize(query).split(/\s+/).filter(Boolean);
  const tTokens = normalize(target).split(/\s+/).filter(Boolean);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  let totalScore = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const tt of tTokens) {
      const sim = levenshteinSimilarity(qt, tt);
      if (sim > best) best = sim;
    }
    totalScore += best;
  }
  return totalScore / qTokens.length;
}

/**
 * Bidirectional token overlap score.
 * Measures how many tokens from BOTH sides find a good match in the other side.
 * This handles name order differences (e.g., "Ahmed Khaled Yahya AL-SHAHARE" vs "AL-SHAHARE AHMED KHALED YAHYA").
 * Returns a score 0-1 based on weighted F1 of matched tokens.
 */
function bidirectionalTokenScore(query: string, target: string, fuzzyThreshold = 0.75): number {
  const qTokens = normalize(query).split(/\s+/).filter(t => t.length >= 2);
  const tTokens = normalize(target).split(/\s+/).filter(t => t.length >= 2);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  // Count how many query tokens have a good match in target
  let qMatched = 0;
  for (const qt of qTokens) {
    const bestMatch = Math.max(...tTokens.map(tt => levenshteinSimilarity(qt, tt)));
    if (bestMatch >= fuzzyThreshold) qMatched++;
  }

  // Count how many target tokens have a good match in query
  let tMatched = 0;
  for (const tt of tTokens) {
    const bestMatch = Math.max(...qTokens.map(qt => levenshteinSimilarity(qt, tt)));
    if (bestMatch >= fuzzyThreshold) tMatched++;
  }

  const precision = qMatched / qTokens.length; // how much of query is covered
  const recall = tMatched / tTokens.length;    // how much of target is covered

  if (precision + recall === 0) return 0;
  // F1-like score, weighted toward precision (query coverage is more important)
  return (2.5 * precision * recall) / (1.5 * precision + recall);
}

// ─── Score a single record ────────────────────────────────────────────────────

function scoreRecord(
  query: string,
  record: typeof sanctionsRecords.$inferSelect
): { score: number; matchType: SearchResult["matchType"] } {
  const nQuery = normalize(query);
  const rawQuery = query.toLowerCase().trim();
  const nNameEn = normalize(record.nameEn || "");
  const rawNameEn = (record.nameEn || "").toLowerCase().trim();
  const nNameAr = normalize(record.nameAr || "");
  const altNames = (record.alternativeNames as string[] | null) || [];
  const nAltNames = altNames.map((n) => normalize(n));
  const rawAltNames = altNames.map((n) => n.toLowerCase().trim());

  // Transliteration: if query is Arabic, also compare against English name via transliteration
  const queryIsArabic = isArabic(query);
  const transQuery = queryIsArabic ? arabicToLatin(query) : null;

  // 1. Exact match (highest priority)
  if (nNameEn === nQuery || nNameAr === nQuery || rawNameEn === rawQuery) {
    return { score: 1.0, matchType: "exact" };
  }
  if (nAltNames.some((n) => n === nQuery) || rawAltNames.some((n) => n === rawQuery)) {
    return { score: 0.98, matchType: "exact" };
  }

  // 2. Contains match
  if (nNameEn.includes(nQuery) || nNameAr.includes(nQuery) || rawNameEn.includes(rawQuery)) {
    return { score: 0.92, matchType: "exact" };
  }
  if (nAltNames.some((n) => n.includes(nQuery)) || rawAltNames.some((n) => n.includes(rawQuery))) {
    return { score: 0.88, matchType: "exact" };
  }

  // 3. Token-based similarity (one-directional)
  const enTokenScore = Math.max(
    tokenSimilarity(query, record.nameEn || ""),
    tokenSimilarity(rawQuery, rawNameEn)
  );
  const arTokenScore = tokenSimilarity(query, record.nameAr || "");
  const altTokenScore = Math.max(0, ...altNames.map((n) => tokenSimilarity(query, n)));

  // 3b. Bidirectional token score (handles different word order)
  const biEn = Math.max(
    bidirectionalTokenScore(query, record.nameEn || ""),
    bidirectionalTokenScore(rawQuery, rawNameEn)
  );
  const biAr = bidirectionalTokenScore(query, record.nameAr || "");
  const biAlt = Math.max(0, ...altNames.map((n) => bidirectionalTokenScore(query, n)));

  // 3c. Transliteration-based token similarity (Arabic query vs English name)
  let transTokenScore = 0;
  let transBiScore = 0;
  if (transQuery) {
    transTokenScore = Math.max(
      tokenSimilarity(transQuery, record.nameEn || ""),
      tokenSimilarity(transQuery, rawNameEn)
    );
    const transAltScore = Math.max(0, ...altNames.map((n) => tokenSimilarity(transQuery, n)));
    transTokenScore = Math.max(transTokenScore, transAltScore);

    // Bidirectional transliteration score
    transBiScore = Math.max(
      bidirectionalTokenScore(transQuery, record.nameEn || ""),
      bidirectionalTokenScore(transQuery, rawNameEn),
      ...altNames.map((n) => bidirectionalTokenScore(transQuery, n))
    );
  }

  const tokenScore = Math.max(enTokenScore, arTokenScore, altTokenScore, transTokenScore);
  const biScore = Math.max(biEn, biAr, biAlt, transBiScore);

  // 4. Full Levenshtein
  const levEn = Math.max(
    levenshteinSimilarity(nQuery, nNameEn),
    levenshteinSimilarity(rawQuery, rawNameEn)
  );
  const levAr = levenshteinSimilarity(nQuery, nNameAr);
  const levTrans = transQuery
    ? Math.max(
        levenshteinSimilarity(transQuery, rawNameEn),
        levenshteinSimilarity(transQuery, nNameEn)
      )
    : 0;
  const levScore = Math.max(levEn, levAr, levTrans);

  // Combine: bidirectional token score gets highest weight since it handles order-independent matching
  const finalScore = Math.max(
    biScore * 0.95,       // bidirectional token overlap (best for multi-word names)
    tokenScore * 0.85,   // one-directional token
    levScore * 0.75      // full string levenshtein
  );

  if (finalScore >= 0.9) return { score: finalScore, matchType: "exact" };
  if (finalScore >= 0.6) return { score: finalScore, matchType: "fuzzy" };
  return { score: finalScore, matchType: "fuzzy" };
}

// ─── Main search function ─────────────────────────────────────────────────────

export async function searchSanctions(options: SearchOptions): Promise<{
  results: SearchResult[];
  total: number;
  queryTime: number;
}> {
  const start = Date.now();
  const {
    query,
    filters = {},
    limit = 20,
    offset = 0,
    threshold = 0.35,
  } = options;

  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, queryTime: 0 };
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const trimmedQuery = query.trim();
  const nQuery = normalize(trimmedQuery);

  // Build filter conditions
  const conditions = [];
  if (filters.entityType) {
    conditions.push(eq(sanctionsRecords.entityType, filters.entityType));
  }
  if (filters.nationality) {
    conditions.push(like(sanctionsRecords.nationality, `%${filters.nationality}%`));
  }
  if (filters.issuingBody) {
    conditions.push(eq(sanctionsRecords.issuingBody, filters.issuingBody));
  }
  if (filters.listingReason) {
    conditions.push(like(sanctionsRecords.listingReason, `%${filters.listingReason}%`));
  }
  if (filters.dateFrom) {
    conditions.push(gte(sanctionsRecords.listingDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(sanctionsRecords.listingDate, filters.dateTo));
  }

  // Step 1: Fast DB pre-filter using LIKE for candidate retrieval
  // Use both normalized query tokens AND original query tokens to maximize recall
  const nSearchTerms = nQuery.split(/\s+/).filter((t) => t.length >= 2);
  // Also use original (non-normalized) terms for English queries
  const rawTerms = trimmedQuery
    .toLowerCase()
    .split(/[\s.,;:!?()\[\]{}'"]+ /)
    .filter((t) => t.length >= 2);
  // Transliteration terms: if Arabic query, convert to Latin and split
  const transTerms = isArabic(trimmedQuery)
    ? arabicToLatin(trimmedQuery).split(/\s+/).filter((t) => t.length >= 2)
    : [];
  // Combine all sets, deduplicate
  const allTerms = Array.from(new Set([...nSearchTerms, ...rawTerms, ...transTerms]));

  // Filter out stop words but keep all meaningful tokens
  const stopWords = new Set(['co', 'ltd', 'inc', 'llc', 'plc', 'pte', 'the', 'and', 'for', 'of', 'al', 'el']);
  const meaningfulTerms = allTerms.filter((t) => t.length >= 3 && !stopWords.has(t));
  const termsToSearch = meaningfulTerms.length > 0 ? meaningfulTerms : allTerms;

  // Each token is searched independently with OR — ensures we find records even if word order differs
  const likeConditions = termsToSearch.flatMap((term) => [
    like(sanctionsRecords.nameEn, `%${term}%`),
    like(sanctionsRecords.nameAr, `%${term}%`),
    like(sanctionsRecords.searchIndex, `%${term}%`),
  ]);

  // Also add a full-phrase LIKE for the original query (handles exact company names)
  const fullPhraseLike = [
    like(sanctionsRecords.nameEn, `%${trimmedQuery}%`),
    like(sanctionsRecords.nameAr, `%${trimmedQuery}%`),
    like(sanctionsRecords.searchIndex, `%${trimmedQuery}%`),
  ];

  const allLikeConditions = [...likeConditions, ...fullPhraseLike];

  const whereClause =
    conditions.length > 0
      ? and(...conditions, or(...allLikeConditions))
      : or(...allLikeConditions);

  // Fetch candidates (max 2000 for scoring)
  const candidates = await db
    .select()
    .from(sanctionsRecords)
    .where(whereClause)
    .limit(2000);

  // Step 2: Score candidates using fuzzy matching
  const scored: SearchResult[] = [];
  for (const record of candidates) {
    const { score, matchType } = scoreRecord(trimmedQuery, record);
    if (score >= threshold) {
      scored.push({
        id: record.id,
        nameEn: record.nameEn,
        nameAr: record.nameAr,
        entityType: record.entityType,
        listingDate: record.listingDate,
        listingReason: record.listingReason,
        issuingBody: record.issuingBody,
        legalBasis: record.legalBasis,
        actionTaken: record.actionTaken,
        nationality: record.nationality,
        dateOfBirth: record.dateOfBirth,
        placeOfBirth: record.placeOfBirth,
        alternativeNames: (record.alternativeNames as string[]) || [],
        notes: record.notes,
        referenceNumber: record.referenceNumber,
        rawNotes: record.rawNotes,
        matchScore: Math.round(score * 100),
        matchType,
      });
    }
  }

  // Step 3: If not enough results, do a broader Fuse.js search
  if (scored.length < 5) {
    const allRecords = await db
      .select({
        id: sanctionsRecords.id,
        nameEn: sanctionsRecords.nameEn,
        nameAr: sanctionsRecords.nameAr,
        entityType: sanctionsRecords.entityType,
        listingDate: sanctionsRecords.listingDate,
        listingReason: sanctionsRecords.listingReason,
        issuingBody: sanctionsRecords.issuingBody,
        legalBasis: sanctionsRecords.legalBasis,
        actionTaken: sanctionsRecords.actionTaken,
        nationality: sanctionsRecords.nationality,
        dateOfBirth: sanctionsRecords.dateOfBirth,
        placeOfBirth: sanctionsRecords.placeOfBirth,
        alternativeNames: sanctionsRecords.alternativeNames,
        notes: sanctionsRecords.notes,
        referenceNumber: sanctionsRecords.referenceNumber,
        rawNotes: sanctionsRecords.rawNotes,
      })
      .from(sanctionsRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(5000);

    const fuse = new Fuse(allRecords, {
      keys: [
        { name: "nameEn", weight: 2 },
        { name: "nameAr", weight: 2 },
        { name: "alternativeNames", weight: 1.5 },
      ],
      threshold: 0.5,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    const fuseResults = fuse.search(trimmedQuery);
    for (const fr of fuseResults) {
      const existing = scored.find((s) => s.id === fr.item.id);
      if (!existing) {
        const fuseScore = fr.score !== undefined ? 1 - fr.score : 0.5;
        scored.push({
          id: fr.item.id,
          nameEn: fr.item.nameEn,
          nameAr: fr.item.nameAr,
          entityType: fr.item.entityType,
          listingDate: fr.item.listingDate,
          listingReason: fr.item.listingReason,
          issuingBody: fr.item.issuingBody,
          legalBasis: fr.item.legalBasis,
          actionTaken: fr.item.actionTaken,
          nationality: fr.item.nationality,
          dateOfBirth: fr.item.dateOfBirth,
          placeOfBirth: fr.item.placeOfBirth,
          alternativeNames: (fr.item.alternativeNames as string[]) || [],
          notes: fr.item.notes,
          referenceNumber: fr.item.referenceNumber,
          rawNotes: fr.item.rawNotes,
          matchScore: Math.round(fuseScore * 100),
          matchType: "fuzzy",
        });
      }
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.matchScore - a.matchScore);

  const total = scored.length;
  const paginated = scored.slice(offset, offset + limit);
  const queryTime = Date.now() - start;

  return { results: paginated, total, queryTime };
}

// ─── Batch-optimized search (loads DB once, searches in memory) ──────────────

export interface BatchSearchRecord {
  id: number;
  nameEn: string;
  nameAr: string | null;
  entityType: string;
  listingDate: string | null;
  listingReason: string | null;
  issuingBody: string | null;
  legalBasis: string | null;
  actionTaken: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  alternativeNames: string[];
  notes: string | null;
  referenceNumber: string | null;
  rawNotes: string | null;
}

/**
 * Load all sanctions records once for batch processing.
 * Call this ONCE before processing a batch, then pass the result to batchSearchOne.
 */
export async function loadAllRecordsForBatch(): Promise<BatchSearchRecord[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      id: sanctionsRecords.id,
      nameEn: sanctionsRecords.nameEn,
      nameAr: sanctionsRecords.nameAr,
      entityType: sanctionsRecords.entityType,
      listingDate: sanctionsRecords.listingDate,
      listingReason: sanctionsRecords.listingReason,
      issuingBody: sanctionsRecords.issuingBody,
      legalBasis: sanctionsRecords.legalBasis,
      actionTaken: sanctionsRecords.actionTaken,
      nationality: sanctionsRecords.nationality,
      dateOfBirth: sanctionsRecords.dateOfBirth,
      placeOfBirth: sanctionsRecords.placeOfBirth,
      alternativeNames: sanctionsRecords.alternativeNames,
      notes: sanctionsRecords.notes,
      referenceNumber: sanctionsRecords.referenceNumber,
      rawNotes: sanctionsRecords.rawNotes,
    })
    .from(sanctionsRecords);
  return rows.map(r => ({
    ...r,
    alternativeNames: (r.alternativeNames as string[] | null) || [],
  }));
}

/**
 * Build a Fuse.js index once from the loaded records.
 * Reuse this index for all names in the batch.
 */
export function buildBatchFuseIndex(records: BatchSearchRecord[]): Fuse<BatchSearchRecord> {
  return new Fuse(records, {
    keys: [
      { name: "nameEn", weight: 2 },
      { name: "nameAr", weight: 2 },
      { name: "alternativeNames", weight: 1.5 },
    ],
    threshold: 0.5,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

/**
 * Search a single name against the pre-loaded records + Fuse index.
 * No DB calls — pure in-memory scoring.
 */
export function batchSearchOne(
  query: string,
  allRecords: BatchSearchRecord[],
  fuseIndex: Fuse<BatchSearchRecord>,
  threshold = 0.60,
  limit = 3
): SearchResult[] {
  if (!query || query.trim().length < 2) return [];

  const trimmedQuery = query.trim();

  // Step 1: fast pre-filter using normalized string includes
  const nQuery = normalize(trimmedQuery);
  const rawQuery = trimmedQuery.toLowerCase();
  // Transliteration: if Arabic query, also search English names via transliteration
  const transQuery = isArabic(trimmedQuery) ? arabicToLatin(trimmedQuery) : null;

  const candidates: BatchSearchRecord[] = [];
  for (const record of allRecords) {
    const nEn = normalize(record.nameEn || "");
    const nAr = normalize(record.nameAr || "");
    const nAlts = (record.alternativeNames || []).map(n => normalize(n));
    const rawEn = (record.nameEn || "").toLowerCase();

    // Check if any token from the query appears in the record name
    const queryTokens = nQuery.split(/\s+/).filter(t => t.length >= 2);
    const rawTokens = rawQuery.split(/[\s.,;:!?()\[\]{}'"]+ /).filter(t => t.length >= 2);
    const transTokens = transQuery ? transQuery.split(/\s+/).filter(t => t.length >= 2) : [];
    const allTokens = Array.from(new Set([...queryTokens, ...rawTokens, ...transTokens]));

    const hasMatch = allTokens.some(t =>
      nEn.includes(t) || nAr.includes(t) || rawEn.includes(t) ||
      nAlts.some(a => a.includes(t))
    );
    if (hasMatch) candidates.push(record);
  }

  // Step 2: score candidates
  const scored: SearchResult[] = [];
  for (const record of candidates) {
    const { score, matchType } = scoreRecord(trimmedQuery, record as typeof sanctionsRecords.$inferSelect);
    if (score >= threshold) {
      scored.push({
        id: record.id,
        nameEn: record.nameEn,
        nameAr: record.nameAr,
        entityType: record.entityType,
        listingDate: record.listingDate,
        listingReason: record.listingReason,
        issuingBody: record.issuingBody,
        legalBasis: record.legalBasis,
        actionTaken: record.actionTaken,
        nationality: record.nationality,
        dateOfBirth: record.dateOfBirth,
        placeOfBirth: record.placeOfBirth,
        alternativeNames: record.alternativeNames || [],
        notes: record.notes,
        referenceNumber: record.referenceNumber,
        rawNotes: record.rawNotes,
        matchScore: Math.round(score * 100),
        matchType,
      });
    }
  }

  // Step 3: if not enough, use Fuse index (already built, no DB call)
  if (scored.length < 5) {
    // For Arabic queries: also search using transliterated version to find English-only records
    const fuseQueries = [trimmedQuery];
    if (transQuery) fuseQueries.push(transQuery);

    const seenIds = new Set(scored.map(s => s.id));
    for (const fq of fuseQueries) {
      const fuseResults = fuseIndex.search(fq);
      for (const fr of fuseResults) {
        if (seenIds.has(fr.item.id)) continue;
        const fuseScore = fr.score !== undefined ? 1 - fr.score : 0.5;
        if (fuseScore >= threshold) {
          seenIds.add(fr.item.id);
          scored.push({
            id: fr.item.id,
            nameEn: fr.item.nameEn,
            nameAr: fr.item.nameAr,
            entityType: fr.item.entityType,
            listingDate: fr.item.listingDate,
            listingReason: fr.item.listingReason,
            issuingBody: fr.item.issuingBody,
            legalBasis: fr.item.legalBasis,
            actionTaken: fr.item.actionTaken,
            nationality: fr.item.nationality,
            dateOfBirth: fr.item.dateOfBirth,
            placeOfBirth: fr.item.placeOfBirth,
            alternativeNames: fr.item.alternativeNames || [],
            notes: fr.item.notes,
            referenceNumber: fr.item.referenceNumber,
            rawNotes: fr.item.rawNotes,
            matchScore: Math.round(fuseScore * 100),
            matchType: "fuzzy",
          });
        }
      }
    }
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored.slice(0, limit);
}

// ─── AI-enhanced search ───────────────────────────────────────────────────────

export async function aiEnhancedSearch(
  query: string,
  forgeApiUrl: string,
  forgeApiKey: string
): Promise<{ expandedQuery: string; suggestions: string[]; explanation: string }> {
  try {
    const response = await fetch(`${forgeApiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${forgeApiKey}`,
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You are a sanctions screening assistant. Given a search query for a sanctions database, 
            provide alternative spellings, transliterations, and related search terms.
            Respond in JSON format with: { "expandedQuery": "...", "suggestions": ["...", "..."], "explanation": "..." }
            Keep suggestions relevant and focused on name variations.`,
          },
          {
            role: "user",
            content: `Search query: "${query}"\nProvide alternative spellings and name variations for sanctions screening.`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error("AI API error");
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as { expandedQuery?: string; suggestions?: string[]; explanation?: string };
    return {
      expandedQuery: parsed.expandedQuery || query,
      suggestions: parsed.suggestions || [],
      explanation: parsed.explanation || "",
    };
  } catch {
    return { expandedQuery: query, suggestions: [], explanation: "" };
  }
}

// ─── Get record by ID ─────────────────────────────────────────────────────────

export async function getRecordById(id: number): Promise<typeof sanctionsRecords.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(sanctionsRecords)
    .where(eq(sanctionsRecords.id, id))
    .limit(1);
  return result[0] || null;
}

// ─── Get filter options ───────────────────────────────────────────────────────

export async function getFilterOptions(): Promise<{
  issuingBodies: string[];
  listingReasons: string[];
  nationalities: string[];
}> {
  const db = await getDb();
  if (!db) return { issuingBodies: [], listingReasons: [], nationalities: [] };

  const [bodies, reasons, nats] = await Promise.all([
    db
      .selectDistinct({ val: sanctionsRecords.issuingBody })
      .from(sanctionsRecords)
      .where(sql`${sanctionsRecords.issuingBody} IS NOT NULL`)
      .limit(100),
    db
      .selectDistinct({ val: sanctionsRecords.listingReason })
      .from(sanctionsRecords)
      .where(sql`${sanctionsRecords.listingReason} IS NOT NULL`)
      .limit(200),
    db
      .selectDistinct({ val: sanctionsRecords.nationality })
      .from(sanctionsRecords)
      .where(sql`${sanctionsRecords.nationality} IS NOT NULL`)
      .limit(300),
  ]);

  return {
    issuingBodies: bodies.map((b) => b.val!).filter(Boolean).sort(),
    listingReasons: reasons.map((r) => r.val!).filter(Boolean).sort(),
    nationalities: nats.map((n) => n.val!).filter(Boolean).sort(),
  };
}
