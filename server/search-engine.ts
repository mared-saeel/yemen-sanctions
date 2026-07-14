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
import { comprehensiveNameScore, phoneticSimilarity, lastNameMatch } from "./advanced-search-engine";
import { multiWordMatch, calculatePriority } from "./multi-word-matcher";
import { smartWordMatch, calculateSmartPriority } from "./smart-word-matcher";
import { detectLanguage } from "./language-detector";

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
    .replace(/[^a-z0-9\s]/g, "") // Remove punctuation/symbols instead of converting to spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Normalize search text by removing punctuation, symbols, and special characters.
 * This allows "HUTHELE, Nasr Mohsen Ali" to match "HUTHELE Nasr Mohsen Ali"
 * Removes: dots, commas, hyphens, parentheses, quotes, etc.
 * Keeps: letters, numbers, and spaces
 */
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, "") // Remove all punctuation/symbols, keep Arabic/English/numbers/spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
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
 * IMPORTANT: For multi-word queries, the first word must match well, otherwise reduce score
 */
function tokenSimilarity(query: string, target: string): number {
  const qTokens = normalize(query).split(/\s+/).filter(Boolean);
  const tTokens = normalize(target).split(/\s+/).filter(Boolean);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  let totalScore = 0;
  for (let i = 0; i < qTokens.length; i++) {
    const qt = qTokens[i];
    let best = 0;
    for (const tt of tTokens) {
      const sim = levenshteinSimilarity(qt, tt);
      if (sim > best) best = sim;
    }
    
    // IMPORTANT: For the first word (given name), require higher match (0.75+)
    // This prevents "خميد" from matching "حمد" just because they're similar
    if (i === 0 && qTokens.length > 1 && best < 0.75) {
      best = best * 0.4; // Reduce score significantly if first word doesn't match well
    }
    
    totalScore += best;
  }
  return totalScore / qTokens.length;
}

/**
 * Fast bidirectional token overlap score using hash-based exact matching first,
 * then Levenshtein only for unmatched tokens. 10x faster than full Levenshtein.
 * Handles name order differences (e.g., "Ahmed Khaled Yahya AL-SHAHARE" vs "AL-SHAHARE AHMED KHALED YAHYA").
 */
function bidirectionalTokenScore(query: string, target: string, fuzzyThreshold = 0.75): number {
  const qTokens = normalize(query).split(/\s+/).filter(t => t.length >= 2);
  const tTokens = normalize(target).split(/\s+/).filter(t => t.length >= 2);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  // Step 1: Fast exact match using Set (O(n+m) instead of O(n×m))
  const tSet = new Set(tTokens);
  const qSet = new Set(qTokens);
  let qMatched = qTokens.filter(qt => tSet.has(qt)).length;
  let tMatched = tTokens.filter(tt => qSet.has(tt)).length;

  // Step 2: For unmatched tokens, use Levenshtein (only when needed)
  const unmatchedQ = qTokens.filter(qt => !tSet.has(qt));
  const unmatchedT = tTokens.filter(tt => !qSet.has(tt));

  if (unmatchedQ.length > 0 && unmatchedT.length > 0) {
    for (const qt of unmatchedQ) {
      for (const tt of unmatchedT) {
        if (levenshteinSimilarity(qt, tt) >= fuzzyThreshold) {
          qMatched++;
          break; // each query token can only match once
        }
      }
    }
    for (const tt of unmatchedT) {
      for (const qt of unmatchedQ) {
        if (levenshteinSimilarity(qt, tt) >= fuzzyThreshold) {
          tMatched++;
          break;
        }
      }
    }
  }

  const precision = qMatched / qTokens.length;
  const recall = tMatched / tTokens.length;

  if (precision + recall === 0) return 0;
  return (2.5 * precision * recall) / (1.5 * precision + recall);
}

// ─── Phrase Matching: Search for words in correct order ────────────────────────
/**
 * Checks if query words appear in the target in the same order.
 * e.g., "احمد الشرع" should match "احمد حسين الشرع" but not "الشرع احمد"
 */
function phraseMatchScore(query: string, target: string): number {
  const qTokens = normalize(query).split(/\s+/).filter(t => t.length >= 2);
  const tTokens = normalize(target).split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length === 0 || tTokens.length === 0) return 0;
  if (qTokens.length === 1) return 0; // Single word: use other scoring methods
  
  // IMPORTANT: For multi-word queries, check if first word matches first word of target
  // This prevents "خميد الاحمر" from matching "نجم حمد الاحمد" just because last words match
  if (qTokens.length > 1 && tTokens.length > 0) {
    const firstQToken = qTokens[0];
    const firstTToken = tTokens[0];
    const firstWordSimilarity = levenshteinSimilarity(firstQToken, firstTToken);
    
    // If first word doesn't match well (< 0.75), don't give high score
    if (firstWordSimilarity < 0.75) {
      return 0; // Reject this match - first word doesn't match
    }
  }
  
  // Find positions of query tokens in target (greedy: first match after previous)
  const positions: number[] = [];
  let lastPos = -1;
  for (const qToken of qTokens) {
    let found = false;
    for (let i = lastPos + 1; i < tTokens.length; i++) {
      if (levenshteinSimilarity(qToken, tTokens[i]) >= 0.80) {
        positions.push(i);
        lastPos = i;
        found = true;
        break;
      }
    }
    if (!found) return 0; // Token not found after previous position
  }
  
  // All query tokens found in order! Now calculate score based on span
  // span = distance from first to last token
  const span = positions[positions.length - 1] - positions[0] + 1;
  const maxSpan = tTokens.length;
  
  // Score: higher if tokens are closer together
  // span=1 (consecutive): 0.95
  // span=2 (one word between): 0.90
  // span=3 (two words between): 0.85
  // etc.
  const spanScore = Math.max(0.75, 1 - ((span - 1) / maxSpan) * 0.3);
  return spanScore;
}

// ─── Last-Word Priority: Prioritize matching the last word (surname) ────────────
/**
 * Gives higher priority to matching the last word (usually the surname).
 * e.g., "الشرع" in "احمد حسين الشرع" is the most important word
 */
function lastWordPriorityScore(query: string, target: string): number {
  const qTokens = normalize(query).split(/\s+/).filter(t => t.length >= 2);
  const tTokens = normalize(target).split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length === 0 || tTokens.length === 0) return 0;
  
  const lastQToken = qTokens[qTokens.length - 1];
  const lastTToken = tTokens[tTokens.length - 1];
  
  // Check if last words match
  const lastWordSimilarity = levenshteinSimilarity(lastQToken, lastTToken);
  
  if (lastWordSimilarity >= 0.85) {
    // IMPORTANT: For multi-word queries, also check if first word matches well
    if (qTokens.length > 1 && tTokens.length > 0) {
      const firstQToken = qTokens[0];
      const firstTToken = tTokens[0];
      const firstWordSimilarity = levenshteinSimilarity(firstQToken, firstTToken);
      
      // If first word doesn't match well (< 0.75), don't give high score
      if (firstWordSimilarity < 0.75) {
        return 0; // Reject this match - first word doesn't match
      }
    }
    
    // Last words match! Now check if other query words are in target
    let otherMatches = 0;
    for (let i = 0; i < qTokens.length - 1; i++) {
      for (let j = 0; j < tTokens.length - 1; j++) {
        if (levenshteinSimilarity(qTokens[i], tTokens[j]) >= 0.75) {
          otherMatches++;
          break;
        }
      }
    }
    
    // Give high score if last word matches
    const otherScore = otherMatches / Math.max(1, qTokens.length - 1);
    return 0.82 + (otherScore * 0.18); // 0.82-1.0 range
  }
  
  return 0;
}

// ─── Proximity Scoring: Bonus for words that are close together ────────────────
/**
 * Gives bonus points when query words appear close to each other in target.
 * e.g., "حميد الاحمر" should match "حميد عبدالله حسين الاحمر" with good score
 */
function proximityScore(query: string, target: string): number {
  const qTokens = normalize(query).split(/\s+/).filter(t => t.length >= 2);
  const tTokens = normalize(target).split(/\s+/).filter(t => t.length >= 2);
  
  if (qTokens.length === 0 || tTokens.length === 0) return 0;
  if (qTokens.length === 1) return 0; // No proximity for single word
  
  // IMPORTANT: For multi-word queries, check if first word matches first word of target
  if (qTokens.length > 1 && tTokens.length > 0) {
    const firstQToken = qTokens[0];
    const firstTToken = tTokens[0];
    const firstWordSimilarity = levenshteinSimilarity(firstQToken, firstTToken);
    
    // If first word doesn't match well (< 0.75), don't give high score
    if (firstWordSimilarity < 0.75) {
      return 0; // Reject this match - first word doesn't match
    }
  }
  
  // Find positions of query tokens in target
  const positions: number[] = [];
  for (const qToken of qTokens) {
    for (let i = 0; i < tTokens.length; i++) {
      if (levenshteinSimilarity(qToken, tTokens[i]) >= 0.75) {
        positions.push(i);
        break;
      }
    }
  }
  
  if (positions.length < qTokens.length) return 0; // Not all tokens found
  
  // Calculate average distance between consecutive positions
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i++) {
    totalDistance += positions[i] - positions[i - 1];
  }
  const avgDistance = totalDistance / (positions.length - 1);
  
  // Closer words = higher score
  // If avgDistance = 1 (consecutive), score = 0.95
  // If avgDistance = 5, score = 0.6
  const proximityBonus = Math.max(0.5, 1 - (avgDistance - 1) * 0.1);
  return proximityBonus;
}

// ─── Score a single record ────────────────────────────────────────────────────

function scoreRecord(
  query: string,
  record: typeof sanctionsRecords.$inferSelect
): { score: number; matchType: SearchResult["matchType"] } {
  const nQuery = normalize(query);
  const rawQuery = query.toLowerCase().trim();
  const searchQuery = normalizeSearchText(query); // Remove punctuation/symbols
  const nNameEn = normalize(record.nameEn || "");
  const rawNameEn = (record.nameEn || "").toLowerCase().trim();
  const searchNameEn = normalizeSearchText(record.nameEn || ""); // Remove punctuation/symbols
  const nNameAr = normalize(record.nameAr || "");
  const altNames = (record.alternativeNames as string[] | null) || [];
  const nAltNames = altNames.map((n) => normalize(n));
  const rawAltNames = altNames.map((n) => n.toLowerCase().trim());
  const searchAltNames = altNames.map((n) => normalizeSearchText(n)); // Remove punctuation/symbols

  // Transliteration: if query is Arabic, also compare against English name via transliteration
  const queryIsArabic = isArabic(query);
  const transQuery = queryIsArabic ? arabicToLatin(query) : null;

  // STRICT CHECK: Extract first word from query and names
  const queryWords = query.trim().split(/\s+/).filter(w => w.length > 0);
  const nameEnWords = (record.nameEn || "").trim().split(/\s+/).filter(w => w.length > 0);
  const nameArWords = (record.nameAr || "").trim().split(/\s+/).filter(w => w.length > 0);

  // CRITICAL: If query is Arabic, only search in Arabic names. If English, only in English names.
  // This prevents "محمود" from matching "MOHAMMAD" when they're not the same person
  const queryIsArabicLang = /[\u0600-\u06FF]/.test(query);
  const queryIsEnglishLang = /[a-zA-Z]/.test(query);
  const queryIsCyrillicLang = /[\u0400-\u04FF]/.test(query);
  
  // Check if record names contain Cyrillic (Russian, etc.)
  const nameEnHasCyrillic = /[\u0400-\u04FF]/.test(record.nameEn || "");
  const nameArHasCyrillic = /[\u0400-\u04FF]/.test(record.nameAr || "");
  const altNameHasCyrillic = altNames.some(n => /[\u0400-\u04FF]/.test(n));
  
  // If query is Arabic, reject any record with Cyrillic names (Russian, etc.)
  if (queryIsArabicLang && !queryIsEnglishLang && (nameEnHasCyrillic || nameArHasCyrillic || altNameHasCyrillic)) {
    return { score: 0, matchType: "fuzzy" }; // Reject: Arabic query but Cyrillic names
  }
  
  // If query is pure Arabic but record has no Arabic name, reject immediately
  if (queryIsArabicLang && !queryIsEnglishLang && nameArWords.length === 0) {
    return { score: 0, matchType: "fuzzy" }; // Reject: Arabic query but no Arabic name
  }
  
  // If query is pure English but record has no English name, reject immediately
  if (queryIsEnglishLang && !queryIsArabicLang && nameEnWords.length === 0) {
    return { score: 0, matchType: "fuzzy" }; // Reject: English query but no English name
  }
  
  // If query is Cyrillic, reject Arabic and English queries
  if (queryIsCyrillicLang && (queryIsArabicLang || queryIsEnglishLang)) {
    // Mixed script query - treat as English
  }

  // 0. Exact match with normalized search text (highest priority - before everything else)
  // This ensures "HUTHELE, Nasr Mohsen Ali" matches exactly "HUTHELE NASR MOHSEN ALI"
  if (searchNameEn === searchQuery) {
    return { score: 1.0, matchType: "exact" };
  }
  if (searchAltNames.some((n) => n === searchQuery)) {
    return { score: 0.99, matchType: "exact" };
  }

  // 1. Exact match (highest priority)
  if (nNameEn === nQuery || nNameAr === nQuery || rawNameEn === rawQuery) {
    return { score: 1.0, matchType: "exact" };
  }
  if (nAltNames.some((n) => n === nQuery) || rawAltNames.some((n) => n === rawQuery)) {
    return { score: 0.98, matchType: "exact" };
  }

  // 2. Contains match (bidirectional: query in name OR name in query)
  // LANGUAGE-AWARE: If query is Arabic, only search in Arabic names. If English, only in English names.
  let queryInName = false;
  let nameInQuery = false;
  
  if (queryIsArabicLang && !queryIsEnglishLang) {
    // Arabic query: only search in Arabic names
    queryInName = nNameAr.includes(nQuery);
    nameInQuery = nQuery.includes(nNameAr);
  } else if (queryIsEnglishLang && !queryIsArabicLang) {
    // English query: only search in English names
    queryInName = nNameEn.includes(nQuery) || rawNameEn.includes(rawQuery) || searchNameEn.includes(searchQuery);
    nameInQuery = nQuery.includes(nNameEn) || rawQuery.includes(rawNameEn) || searchQuery.includes(searchNameEn);
  } else {
    // Mixed or unknown: search in both
    queryInName = nNameEn.includes(nQuery) || nNameAr.includes(nQuery) || rawNameEn.includes(rawQuery) || searchNameEn.includes(searchQuery);
    nameInQuery = nQuery.includes(nNameEn) || nQuery.includes(nNameAr) || rawQuery.includes(rawNameEn) || searchQuery.includes(searchNameEn);
  }
  
  if (queryInName || nameInQuery) {
    // If it's a bidirectional match (name contains query AND query contains name = exact match)
    if (queryInName && nameInQuery) {
      return { score: 0.98, matchType: "exact" };
    }
    // If query is in name, give high score
    return { score: 0.92, matchType: "exact" };
  }
  
  const altQueryInName = nAltNames.some((n) => n.includes(nQuery)) || rawAltNames.some((n) => n.includes(rawQuery)) || searchAltNames.some((n) => n.includes(searchQuery));
  const altNameInQuery = nAltNames.some((n) => nQuery.includes(n)) || rawAltNames.some((n) => rawQuery.includes(n)) || searchAltNames.some((n) => searchQuery.includes(n));
  
  if (altQueryInName || altNameInQuery) {
    return { score: 0.88, matchType: "exact" };
  }

  // 3. Token-based similarity (one-directional)
  // LANGUAGE-AWARE: Only compare with matching language names
  let enTokenScore = 0;
  let arTokenScore = 0;
  
  if (!queryIsArabicLang || queryIsEnglishLang) {
    // English query or mixed: can use English names
    enTokenScore = Math.max(
      tokenSimilarity(query, record.nameEn || ""),
      tokenSimilarity(rawQuery, rawNameEn),
      tokenSimilarity(searchQuery, searchNameEn)
    );
  }
  
  if (!queryIsEnglishLang || queryIsArabicLang) {
    // Arabic query or mixed: can use Arabic names
    arTokenScore = tokenSimilarity(query, record.nameAr || "");
  }
  const altTokenScore = Math.max(0, ...altNames.map((n) => tokenSimilarity(query, n)));

  // 3b. Bidirectional token score (handles different word order)
  // LANGUAGE-AWARE: Only compare with matching language names
  let biEn = 0;
  let biAr = 0;
  
  if (!queryIsArabicLang || queryIsEnglishLang) {
    // English query or mixed: can use English names
    biEn = Math.max(
      bidirectionalTokenScore(query, record.nameEn || ""),
      bidirectionalTokenScore(rawQuery, rawNameEn),
      bidirectionalTokenScore(searchQuery, searchNameEn)
    );
  }
  
  if (!queryIsEnglishLang || queryIsArabicLang) {
    // Arabic query or mixed: can use Arabic names
    biAr = bidirectionalTokenScore(query, record.nameAr || "");
  }
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

  // 3d. NEW: Phrase Matching (words in correct order)
  const phraseEn = Math.max(
    phraseMatchScore(query, record.nameEn || ""),
    phraseMatchScore(rawQuery, rawNameEn),
    phraseMatchScore(searchQuery, searchNameEn)
  );
  const phraseAr = phraseMatchScore(query, record.nameAr || "");
  const phraseAlt = Math.max(0, ...altNames.map((n) => phraseMatchScore(query, n)));
  const phraseScore = Math.max(phraseEn, phraseAr, phraseAlt);

  // 3e. NEW: Last-Word Priority (surname matching)
  const lastWordEn = Math.max(
    lastWordPriorityScore(query, record.nameEn || ""),
    lastWordPriorityScore(rawQuery, rawNameEn),
    lastWordPriorityScore(searchQuery, searchNameEn)
  );
  const lastWordAr = lastWordPriorityScore(query, record.nameAr || "");
  const lastWordAlt = Math.max(0, ...altNames.map((n) => lastWordPriorityScore(query, n)));
  const lastWordScore = Math.max(lastWordEn, lastWordAr, lastWordAlt);

  // 3f. NEW: Proximity Scoring (words close together)
  const proximityEn = Math.max(
    proximityScore(query, record.nameEn || ""),
    proximityScore(rawQuery, rawNameEn),
    proximityScore(searchQuery, searchNameEn)
  );
  const proximityAr = proximityScore(query, record.nameAr || "");
  const proximityAlt = Math.max(0, ...altNames.map((n) => proximityScore(query, n)));
  const proxScore = Math.max(proximityEn, proximityAr, proximityAlt);

  const tokenScore = Math.max(enTokenScore, arTokenScore, altTokenScore, transTokenScore);
  const biScore = Math.max(biEn, biAr, biAlt, transBiScore);

  // 3g. NEW: Smart Multi-Word Matching (2+ words matching = high priority)
  // LANGUAGE-AWARE: Only match with same language
  let smartMultiWordScore = 0;
  // Note: queryIsEnglishLang is already defined above
  
  // Only search in Arabic names if query is Arabic
  if (!queryIsEnglishLang) {
    const smartMatchResultAr = smartWordMatch(query, "", record.nameAr || "", 0.65);
    if (smartMatchResultAr.matchedWords >= 2) {
      smartMultiWordScore = Math.max(smartMultiWordScore, smartMatchResultAr.matchScore);
    }
  }
  
  // Only search in English names if query is English
  if (queryIsEnglishLang) {
    const smartMatchResultEn = smartWordMatch(query, record.nameEn || "", null, 0.65);
    if (smartMatchResultEn.matchedWords >= 2) {
      smartMultiWordScore = Math.max(smartMultiWordScore, smartMatchResultEn.matchScore);
    }
  }
  
  // If query is mixed or fallback: search both
  else {
    // Mixed or fallback: search both
    const smartMatchResultEn = smartWordMatch(query, record.nameEn || "", "", 0.65);
    const smartMatchResultAr = smartWordMatch(query, "", record.nameAr || "", 0.65);
    const smartMatchResults = [smartMatchResultEn, smartMatchResultAr];
    
    for (const matchResult of smartMatchResults) {
      if (matchResult.matchedWords >= 2) {
        smartMultiWordScore = Math.max(smartMultiWordScore, matchResult.matchScore);
      }
    }
  }
  
  // 3h. Legacy Multi-Word Matching
  let multiWordScore = 0;
  const matchResultEn = multiWordMatch(query, record.nameEn || "", null, 0.70);
  const matchResultAr = multiWordMatch(query, "", record.nameAr || "", 0.70);
  const matchResults = [matchResultEn, matchResultAr];
  
  for (const matchResult of matchResults) {
    if (matchResult.matchedWords >= 2) {
      multiWordScore = Math.max(multiWordScore, matchResult.matchScore);
    }
  }

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

  // Combine: NEW algorithm with smart multi-word matching as primary
  let finalScore: number;
  
  if (smartMultiWordScore > 0) {
    finalScore = smartMultiWordScore * 0.99;
  } else if (multiWordScore > 0) {
    finalScore = multiWordScore * 0.98;
  } else if (phraseScore > 0) {
    finalScore = phraseScore * 0.95;
  } else if (lastWordScore > 0) {
    finalScore = lastWordScore * 0.92;
  } else if (proxScore > 0) {
    finalScore = proxScore * 0.90;
  } else if (biScore > 0.75) {
    finalScore = biScore * 0.85;
  } else if (levScore > 0.75) {
    finalScore = levScore * 0.70;
  } else {
    // STRICT: Only accept very high token scores (>0.95) to avoid false positives
    // This prevents matching "محمد" alone from giving high scores
    finalScore = tokenScore > 0.95 ? tokenScore * 0.50 : 0;
  }

  // FINAL CHECK: If score is high but first words don't match, reduce score significantly
  // This prevents false positives like "محمود مقبل" matching "MOHAMMAD SADIQ"
  if (finalScore > 0.70 && queryWords.length > 0 && nameEnWords.length > 0) {
    const queryFirstWord = normalize(queryWords[0]);
    const nameFirstWord = normalize(nameEnWords[0]);
    const firstWordSimilarity = levenshteinSimilarity(queryFirstWord, nameFirstWord);
    
    // If first words don't match well (< 0.70), reduce score to reject
    if (firstWordSimilarity < 0.70) {
      finalScore = 0; // Reject this match
    }
  }

  // NEW: Use comprehensive scoring as final fallback
  const comprehensiveScore = comprehensiveNameScore(query, record.nameEn || "");
  const comprehensiveScoreAr = comprehensiveNameScore(query, record.nameAr || "");
  const comprehensiveAltScore = Math.max(0, ...altNames.map((n) => comprehensiveNameScore(query, n)));
  let finalComprehensiveScore = Math.max(comprehensiveScore, comprehensiveScoreAr, comprehensiveAltScore);
  
  // STRICT: Apply first word check to comprehensive score too
  if (finalComprehensiveScore > 0.70 && queryWords.length > 0 && nameEnWords.length > 0) {
    const queryFirstWord = normalize(queryWords[0]);
    const nameFirstWord = normalize(nameEnWords[0]);
    const firstWordSimilarity = levenshteinSimilarity(queryFirstWord, nameFirstWord);
    
    // If first words don't match well, reject comprehensive score
    if (firstWordSimilarity < 0.70) {
      finalComprehensiveScore = 0;
    }
  }
  
  // If comprehensive scoring gives a better result, use it
  if (finalComprehensiveScore > finalScore) {
    finalScore = finalComprehensiveScore;
  }
  
  // STRICT THRESHOLDS: Prevent false positives
  // - 0.90+: Exact match (very high confidence)
  // - 0.80-0.89: Fuzzy match (high confidence)
  // - 0.70-0.79: Phonetic match (medium confidence)
  // - Below 0.70: No match (reject to avoid false positives)
  if (finalScore >= 0.90) return { score: Math.min(1.0, finalScore), matchType: "exact" };
  if (finalScore >= 0.80) return { score: Math.min(1.0, finalScore), matchType: "fuzzy" };
  if (finalScore >= 0.70) return { score: Math.min(1.0, finalScore), matchType: "phonetic" };
  return { score: 0, matchType: "fuzzy" }; // Reject low scores to prevent false positives
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
    threshold = 0.85,
  } = options;

  if (!query || query.trim().length < 2) {
    return { results: [], total: 0, queryTime: 0 };
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const trimmedQuery = query.trim();
  const nQuery = normalize(trimmedQuery);
  const normalizedQuery = normalizeSearchText(trimmedQuery); // Remove punctuation/symbols for DB search

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
  // Two-phase approach: First try full-phrase match, then fall back to token-based search
  
  const nQuery_lower = nQuery.toLowerCase();
  const rawQuery_lower = trimmedQuery.toLowerCase();
  
  // Phase 1: Try full-phrase match first (highest priority)
  // Use both original query and normalized query (without punctuation/symbols)
  const fullPhraseLike = [
    like(sanctionsRecords.nameEn, `%${trimmedQuery}%`),
    like(sanctionsRecords.nameEn, `%${normalizedQuery}%`),
    like(sanctionsRecords.nameAr, `%${trimmedQuery}%`),
    like(sanctionsRecords.nameAr, `%${normalizedQuery}%`),
    like(sanctionsRecords.searchIndex, `%${trimmedQuery}%`),
    like(sanctionsRecords.searchIndex, `%${normalizedQuery}%`),
  ];
  
  const fullPhraseWhere =
    conditions.length > 0
      ? and(...conditions, or(...fullPhraseLike))
      : or(...fullPhraseLike);
  
  // Try full-phrase search first
  let candidates = await db
    .select()
    .from(sanctionsRecords)
    .where(fullPhraseWhere)
    .limit(2000);
  
  // Phase 2: If no results from full-phrase, fall back to token-based search
  if (candidates.length === 0) {
    const nSearchTerms = nQuery.split(/\s+/).filter((t) => t.length >= 2);
    // Also use original (non-normalized) terms for English queries
    const rawTerms = trimmedQuery
      .toLowerCase()
      .split(/[\s.,;:!?()[\]{}'"-]+/)
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

    const allLikeConditions = [...likeConditions, ...fullPhraseLike];

    const whereClause =
      conditions.length > 0
        ? and(...conditions, or(...allLikeConditions))
        : or(...allLikeConditions);

    // Fetch candidates (max 2000 for scoring)
    candidates = await db
      .select()
      .from(sanctionsRecords)
      .where(whereClause)
      .limit(2000);
  }

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
        matchScore: Math.round(Math.min(1.0, score) * 100),
        matchType,
      });
    }
  }

  // Step 3: If not enough results, do a broader Fuse.js search (limited to 1000 records max to avoid memory issues)
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
      .limit(1000); // Reduced from 5000 to 1000 to save memory and improve performance

    const fuse = new Fuse(allRecords, {
      keys: [
        { name: "nameEn", weight: 2 },
        { name: "nameAr", weight: 2 },
        { name: "alternativeNames", weight: 1.5 },
      ],
      threshold: 0.4, // Lowered from 0.5 to be more strict
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
          matchScore: Math.round(Math.min(1.0, fuseScore) * 100),
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
        matchScore: Math.round(Math.min(1.0, score) * 100),
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
            matchScore: Math.round(Math.min(1.0, fuseScore) * 100),
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
