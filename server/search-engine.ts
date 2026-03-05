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

// ─── Token-based similarity ───────────────────────────────────────────────────

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

// ─── Score a single record ────────────────────────────────────────────────────

function scoreRecord(
  query: string,
  record: typeof sanctionsRecords.$inferSelect
): { score: number; matchType: SearchResult["matchType"] } {
  const nQuery = normalize(query);
  // Also normalize with raw lowercase for English (no special char removal)
  const rawQuery = query.toLowerCase().trim();
  const nNameEn = normalize(record.nameEn || "");
  const rawNameEn = (record.nameEn || "").toLowerCase().trim();
  const nNameAr = normalize(record.nameAr || "");
  const altNames = (record.alternativeNames as string[] | null) || [];
  const nAltNames = altNames.map((n) => normalize(n));
  const rawAltNames = altNames.map((n) => n.toLowerCase().trim());

  // 1. Exact match (highest priority) - both normalized and raw
  if (nNameEn === nQuery || nNameAr === nQuery || rawNameEn === rawQuery) {
    return { score: 1.0, matchType: "exact" };
  }
  if (nAltNames.some((n) => n === nQuery) || rawAltNames.some((n) => n === rawQuery)) {
    return { score: 0.98, matchType: "exact" };
  }

  // 2. Contains match - both normalized and raw
  if (nNameEn.includes(nQuery) || nNameAr.includes(nQuery) || rawNameEn.includes(rawQuery)) {
    return { score: 0.92, matchType: "exact" };
  }
  if (nAltNames.some((n) => n.includes(nQuery)) || rawAltNames.some((n) => n.includes(rawQuery))) {
    return { score: 0.88, matchType: "exact" };
  }

  // 3. Token-based similarity (use both raw and normalized)
  const enTokenScore = Math.max(
    tokenSimilarity(query, record.nameEn || ""),
    tokenSimilarity(rawQuery, rawNameEn)
  );
  const arTokenScore = tokenSimilarity(query, record.nameAr || "");
  const altTokenScore = Math.max(0, ...altNames.map((n) => tokenSimilarity(query, n)));

  const tokenScore = Math.max(enTokenScore, arTokenScore, altTokenScore);

  // 4. Full Levenshtein on full name (both normalized and raw)
  const levEn = Math.max(
    levenshteinSimilarity(nQuery, nNameEn),
    levenshteinSimilarity(rawQuery, rawNameEn)
  );
  const levAr = levenshteinSimilarity(nQuery, nNameAr);
  const levScore = Math.max(levEn, levAr);

  const finalScore = Math.max(tokenScore * 0.85, levScore * 0.75);

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
    .split(/[\s.,;:!?()\[\]{}'"]+/)
    .filter((t) => t.length >= 2);
  // Combine both sets, deduplicate
  const allTerms = Array.from(new Set([...nSearchTerms, ...rawTerms]));

  // For short queries (1-2 meaningful words), also try the full query as a phrase
  const meaningfulTerms = allTerms.filter((t) => t.length >= 3 && !['co', 'ltd', 'inc', 'llc', 'plc', 'pte', 'the', 'and', 'for', 'of'].includes(t));
  const termsToSearch = meaningfulTerms.length > 0 ? meaningfulTerms : allTerms;

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
