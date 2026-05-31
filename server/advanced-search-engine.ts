/**
 * Advanced Search Engine with Phonetic Matching
 * Supports Arabic phonetic matching, typo tolerance, and intelligent ranking
 */

// ─── Arabic Phonetic Matching (Soundex-like for Arabic) ─────────────────────

/**
 * Converts Arabic text to phonetic code for fuzzy matching
 * Handles common Arabic letter confusions:
 * - ح (haa) vs خ (khaa) - both are 'h' sounds
 * - ق (qaaf) vs ك (kaaf) - both are 'k' sounds
 * - ص (saad) vs س (seen) - both are 's' sounds
 * - ض (daad) vs د (daal) - both are 'd' sounds
 * - ظ (dhaa) vs ذ (dhal) - both are 'dh' sounds
 * - ع (ayn) vs غ (ghain) - both are guttural
 * - ة (taa marbuta) vs ه (haa) - both are 'h' at end
 */
export function arabicPhoneticCode(text: string): string {
  // Normalize the text
  let normalized = text.trim().toLowerCase();
  
  // Remove diacritics
  normalized = normalized.replace(/[\u064B-\u065F]/g, '');
  
  // Group similar-sounding letters
  const phoneticMap: Record<string, string> = {
    // Similar sounding letters
    'ح': 'h', 'خ': 'h', // both 'h' sounds
    'ق': 'k', 'ك': 'k', // both 'k' sounds
    'ص': 's', 'س': 's', // both 's' sounds
    'ض': 'd', 'د': 'd', // both 'd' sounds
    'ظ': 'z', 'ذ': 'z', // both 'dh' sounds
    'ع': '', 'غ': 'g', // guttural sounds
    'ة': 'h', 'ه': 'h', // both 'h' sounds
    'ا': 'a', 'أ': 'a', 'إ': 'a', 'آ': 'a', // all 'a' sounds
    'ى': 'a', // alef maksura
    'ئ': 'y', 'ي': 'y', // both 'y' sounds
    'ؤ': 'w', 'و': 'w', // both 'w' sounds
    
    // Other letters
    'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ر': 'r', 'ز': 'z',
    'ش': 'sh', 'ف': 'f', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ء': '', // hamza is ignored
    ' ': ' ', // keep spaces
  };
  
  let phonetic = '';
  for (const char of normalized) {
    phonetic += phoneticMap[char] || char;
  }
  
  // Remove consecutive duplicates
  phonetic = phonetic.replace(/(.)\1+/g, '$1');
  
  return phonetic;
}

/**
 * Calculates phonetic similarity between two Arabic words
 * Returns 0-1 score
 */
export function phoneticSimilarity(text1: string, text2: string): number {
  const code1 = arabicPhoneticCode(text1);
  const code2 = arabicPhoneticCode(text2);
  
  if (code1 === code2) return 1.0;
  if (code1.length === 0 || code2.length === 0) return 0;
  
  // Calculate Levenshtein distance on phonetic codes
  const maxLen = Math.max(code1.length, code2.length);
  const distance = levenshteinDistance(code1, code2);
  
  return Math.max(0, 1 - (distance / maxLen));
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const d: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) d[i][0] = i;
  for (let j = 0; j <= len2; j++) d[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return d[len1][len2];
}

// ─── Intelligent Name Matching ─────────────────────────────────────────────

/**
 * Calculates how well a query matches a name
 * Considers:
 * 1. Exact word matches (highest priority)
 * 2. Phonetic matches (handles typos)
 * 3. Partial word matches
 * 4. Word order
 */
export function intelligentNameMatch(query: string, name: string): number {
  const queryWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const nameWords = name.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length === 0 || nameWords.length === 0) return 0;
  
  let totalScore = 0;
  let matchedWords = 0;
  
  // For each query word, find the best match in name
  for (let qIdx = 0; qIdx < queryWords.length; qIdx++) {
    const qWord = queryWords[qIdx];
    let bestScore = 0;
    let bestNIdx = -1;
    
    for (let nIdx = 0; nIdx < nameWords.length; nIdx++) {
      const nWord = nameWords[nIdx];
      
      // Exact match (highest priority)
      if (qWord === nWord) {
        bestScore = Math.max(bestScore, 1.0);
        bestNIdx = nIdx;
        continue;
      }
      
      // Phonetic match (handles typos) - MUCH HIGHER PRIORITY
      const phoneticScore = phoneticSimilarity(qWord, nWord);
      if (phoneticScore > 0.55) {
        // IMPORTANT: For the first word (given name), require higher phonetic match (0.75+)
        // This prevents "خميد" from matching "الاحمد" just because both have similar sounds
        if (qIdx === 0 && phoneticScore < 0.75) {
          // First word requires higher phonetic match
          continue;
        }
        // Give very high score for phonetic matches
        bestScore = Math.max(bestScore, 0.99 * phoneticScore);
        bestNIdx = nIdx;
        continue;
      }
      
      // Partial word match (prefix/suffix)
      if (nWord.startsWith(qWord) || qWord.startsWith(nWord)) {
        const ratio = Math.min(qWord.length, nWord.length) / Math.max(qWord.length, nWord.length);
        if (ratio > 0.6) {
          bestScore = Math.max(bestScore, 0.75 * ratio);
          bestNIdx = nIdx;
        }
      }
    }
    
    if (bestScore > 0.55) {
      matchedWords++;
      totalScore += bestScore;
    }
  }
  
  // Calculate final score
  if (matchedWords === 0) return 0;
  
  const matchRatio = matchedWords / queryWords.length;
  const avgScore = totalScore / queryWords.length;
  
  // Boost score if all query words matched
  if (matchedWords === queryWords.length) {
    return Math.min(1.0, avgScore * 1.15);
  }
  
  return avgScore * matchRatio;
}

// ─── Last Name Priority Matching ─────────────────────────────────────────

/**
 * Prioritizes matching of the last word (surname)
 * In Arabic names, the last word is often the most important
 */
export function lastNameMatch(query: string, name: string): number {
  const queryWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const nameWords = name.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length === 0 || nameWords.length === 0) return 0;
  
  const lastQueryWord = queryWords[queryWords.length - 1];
  const lastNameWord = nameWords[nameWords.length - 1];
  
  // Exact match on last word
  if (lastQueryWord === lastNameWord) return 1.0;
  
  // Phonetic match on last word
  const phoneticScore = phoneticSimilarity(lastQueryWord, lastNameWord);
  if (phoneticScore > 0.7) return 0.99 * phoneticScore;
  
  // Partial match on last word
  if (lastNameWord.startsWith(lastQueryWord) || lastQueryWord.startsWith(lastNameWord)) {
    const ratio = Math.min(lastQueryWord.length, lastNameWord.length) / Math.max(lastQueryWord.length, lastNameWord.length);
    if (ratio > 0.6) return 0.85 * ratio;
  }
  
  return 0;
}

// ─── Comprehensive Scoring ─────────────────────────────────────────────────

/**
 * Comprehensive scoring that combines multiple matching strategies
 * Returns a score from 0 to 1
 */
export function comprehensiveNameScore(query: string, name: string): number {
  // Empty checks
  if (!query || !name || query.trim().length === 0 || name.trim().length === 0) {
    return 0;
  }
  
  // Normalize
  const nQuery = query.trim().toLowerCase();
  const nName = name.trim().toLowerCase();
  
  // 1. Exact match (highest priority)
  if (nQuery === nName) return 1.0;
  
  // IMPORTANT: Check if first word matches before giving high scores
  // This prevents "خميد الاحمر" from matching "نجم حمد الاحمد" just because last words are similar
  const queryWords = nQuery.split(/\s+/).filter(w => w.length > 0);
  const nameWords = nName.split(/\s+/).filter(w => w.length > 0);
  
  // If query has multiple words, check if first word matches reasonably
  if (queryWords.length > 1 && nameWords.length > 0) {
    const firstQueryWord = queryWords[0];
    const firstNameWord = nameWords[0];
    const firstWordPhonetic = phoneticSimilarity(firstQueryWord, firstNameWord);
    
    // If first words don't match well (< 0.70), don't give very high scores
    if (firstWordPhonetic < 0.70) {
      // First word doesn't match well - reduce priority of last-name-only matches
      // Only proceed if we have strong evidence elsewhere
    }
  }
  
  // 2. Last name match (very high priority for Arabic names)
  const lastNameScore = lastNameMatch(query, name);
  if (lastNameScore > 0.95) {
    // IMPORTANT: For multi-word queries, also check first word before returning high score
    if (queryWords.length > 1 && nameWords.length > 0) {
      const firstQueryWord = queryWords[0];
      const firstNameWord = nameWords[0];
      const firstWordPhonetic = phoneticSimilarity(firstQueryWord, firstNameWord);
      // Only return high score if first word also matches reasonably (> 0.70)
      if (firstWordPhonetic < 0.70) {
        // First word doesn't match - reduce the score
        return lastNameScore * 0.6; // Reduce score significantly
      }
    }
    return lastNameScore;
  }
  
  // 3. Intelligent name matching (considers all words)
  const intelligentScore = intelligentNameMatch(query, name);
  if (intelligentScore > 0.95) return intelligentScore;
  
  // 3b. Phonetic matching (handles typos) - GIVE PRIORITY OVER INTELLIGENT MATCHING
  const phoneticScore = phoneticSimilarity(query, name);
  if (phoneticScore > 0.75) return 0.99 * phoneticScore; // Very high score for phonetic matches
  
  // 4. Contains check
  if (nName.includes(nQuery) || nQuery.includes(nName)) {
    const ratio = Math.min(nQuery.length, nName.length) / Math.max(nQuery.length, nName.length);
    if (ratio > 0.65) return 0.85 * ratio;
  }
  
  // Return the best score - PHONETIC MATCHING HAS PRIORITY
  if (phoneticScore > 0.65) return 0.95 * phoneticScore;
  return Math.max(intelligentScore * 0.8, phoneticScore * 0.9);
}

export default {
  arabicPhoneticCode,
  phoneticSimilarity,
  intelligentNameMatch,
  lastNameMatch,
  comprehensiveNameScore,
};
