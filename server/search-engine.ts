/**
 * Smart Search Engine - DB-Direct Edition
 * Uses optimized SQL queries with LIKE on indexed columns.
 * No in-memory loading - works within 1GB RAM constraint.
 */
import Fuse from "fuse.js";
import { getDb } from "./db";
import { sanctionsRecords } from "../drizzle/schema";
import { eq, and, or, gte, lte, like, sql } from "drizzle-orm";

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
  threshold?: number;
}

// ─── Normalization ────────────────────────────────────────────────────────────
function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[\u064B-\u065F]/g, "")
    .trim()
    .toLowerCase();
}

function normalize(text: string): string {
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) return normalizeArabic(text);
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Main Search ──────────────────────────────────────────────────────────────
export async function searchSanctions(options: SearchOptions): Promise<{
  results: SearchResult[];
  total: number;
  queryTime: number;
}> {
  const { query, filters = {}, limit = 20, offset = 0 } = options;

  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, queryTime: 0 };
  }

  const start = Date.now();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const trimmedQuery = query.trim();
  const nQuery = normalize(trimmedQuery);

  // Build filter conditions
  const filterConditions: ReturnType<typeof eq>[] = [];
  if (filters.entityType) filterConditions.push(eq(sanctionsRecords.entityType, filters.entityType));
  if (filters.issuingBody) filterConditions.push(eq(sanctionsRecords.issuingBody, filters.issuingBody));
  if (filters.nationality) filterConditions.push(like(sanctionsRecords.nationality, `%${filters.nationality}%`));
  if (filters.listingReason) filterConditions.push(like(sanctionsRecords.listingReason, `%${filters.listingReason}%`));
  if (filters.dateFrom) filterConditions.push(gte(sanctionsRecords.listingDate, filters.dateFrom));
  if (filters.dateTo) filterConditions.push(lte(sanctionsRecords.listingDate, filters.dateTo));

  // Step 1: Fast LIKE search - use searchIndex column which is pre-built
  const searchTerms = Array.from(new Set([
    trimmedQuery,
    nQuery,
    ...trimmedQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 3),
    ...nQuery.split(/\s+/).filter(t => t.length >= 3),
  ])).slice(0, 6); // limit to 6 terms to avoid slow queries

  const likeConditions = searchTerms.flatMap((term) => [
    like(sanctionsRecords.nameEn, `%${term}%`),
    like(sanctionsRecords.nameAr, `%${term}%`),
    like(sanctionsRecords.searchIndex, `%${term}%`),
  ]);

  const whereClause = filterConditions.length > 0
    ? and(...filterConditions, or(...likeConditions))
    : or(...likeConditions);

  // Fetch candidates - limit to 300 for fast scoring
  const candidates = await db
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
    .where(whereClause)
    .limit(300);

  // Step 2: Score with Fuse.js (small dataset, fast)
  const fuse = new Fuse(candidates, {
    keys: [
      { name: "nameEn", weight: 3 },
      { name: "nameAr", weight: 3 },
      { name: "alternativeNames", weight: 2 },
    ],
    threshold: 0.5,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const fuseResults = fuse.search(trimmedQuery);
  let fuseResultsNorm: typeof fuseResults = [];
  if (nQuery !== trimmedQuery.toLowerCase()) {
    fuseResultsNorm = fuse.search(nQuery);
  }

  // Merge scores
  const scoreMap = new Map<number, { record: typeof candidates[0]; score: number }>();

  // First add all candidates with base score from LIKE match
  for (const c of candidates) {
    const nameEnLower = (c.nameEn || "").toLowerCase();
    const nameArNorm = normalize(c.nameAr || "");
    const lowerQ = trimmedQuery.toLowerCase();

    let score = 0.5; // base score for LIKE match
    if (nameEnLower === lowerQ || nameArNorm === nQuery) score = 1.0;
    else if (nameEnLower.includes(lowerQ) || nameArNorm.includes(nQuery)) score = 0.9;
    else if (nameEnLower.startsWith(lowerQ) || nameArNorm.startsWith(nQuery)) score = 0.85;

    scoreMap.set(c.id, { record: c, score });
  }

  // Boost with Fuse scores
  for (const fr of [...fuseResults, ...fuseResultsNorm]) {
    const fuseScore = fr.score !== undefined ? 1 - fr.score : 0.5;
    const existing = scoreMap.get(fr.item.id);
    if (existing && fuseScore > existing.score) {
      scoreMap.set(fr.item.id, { record: existing.record, score: fuseScore });
    }
  }

  // Build results
  const results: SearchResult[] = [];
  for (const [, { record, score }] of Array.from(scoreMap.entries())) {
    if (score < 0.3) continue;
    results.push({
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
      matchType: score >= 0.9 ? "exact" : "fuzzy",
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  const total = results.length;
  const paginated = results.slice(offset, offset + limit);
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${forgeApiKey}` },
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
  const result = await db.select().from(sanctionsRecords).where(eq(sanctionsRecords.id, id)).limit(1);
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
    db.selectDistinct({ val: sanctionsRecords.issuingBody }).from(sanctionsRecords).where(sql`${sanctionsRecords.issuingBody} IS NOT NULL`).limit(100),
    db.selectDistinct({ val: sanctionsRecords.listingReason }).from(sanctionsRecords).where(sql`${sanctionsRecords.listingReason} IS NOT NULL`).limit(200),
    db.selectDistinct({ val: sanctionsRecords.nationality }).from(sanctionsRecords).where(sql`${sanctionsRecords.nationality} IS NOT NULL`).limit(300),
  ]);
  return {
    issuingBodies: bodies.map((b) => b.val!).filter(Boolean).sort(),
    listingReasons: reasons.map((r) => r.val!).filter(Boolean).sort(),
    nationalities: nats.map((n) => n.val!).filter(Boolean).sort(),
  };
}

export function invalidateSearchCache() {
  // No-op in DB-direct mode
}
