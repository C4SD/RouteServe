/**
 * Order-invariant facility name matcher.
 *
 * Handles all real-world naming variants simultaneously:
 *   "General Hospital XYZ" = "XYZ General Hospital" (rearranged)
 *                          = "GH XYZ"               (acronym + word)
 *                          = "gh xyz"               (acronym + lowercase)
 *                          = "Genral Hosptal XYZ"   (typos + rearranged)
 *
 * Three passes, final score = max(pass1, pass2, pass3):
 *   1. Token-set Jaccard   — order-invariant word overlap
 *   2. Acronym expansion   — expands abbreviated tokens against candidate words
 *   3. Sorted Levenshtein  — typo tolerance on sorted token string
 */

import { similarityScore } from './fuzzy-match';

export interface FacilityMatch {
  id: string;
  name: string;
  score: number;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  matchMethod: 'exact' | 'token-set' | 'acronym' | 'fuzzy';
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(' ').filter(Boolean);
}

function sortedTokenStr(s: string): string {
  return tokens(s).sort().join(' ');
}

// ─── Pass 1: Token-set Jaccard ────────────────────────────────────────────────
// Sorts both strings' token sets before comparison, so word order is irrelevant.

function tokenSetScore(input: string, candidate: string): number {
  const a = new Set(tokens(input));
  const b = new Set(tokens(candidate));
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter(t => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Pass 2: Acronym expansion ────────────────────────────────────────────────
// Each input token is matched against candidate words either by:
//   (a) exact word match, or
//   (b) matching the first letters of consecutive candidate words (acronym)
// Order-invariance is achieved by sorting input tokens before matching.

function acronymScore(input: string, candidate: string): number {
  const inputToks = tokens(input);
  const candToks = tokens(candidate);
  if (inputToks.length === 0 || candToks.length === 0) return 0;

  // Fast path: full acronym — all input tokens joined == all candidate initials
  // e.g. "ghxyz" == first letters of "general hospital xyz"
  const candInitials = candToks.map(t => t[0]).join('');
  const inputCompact = inputToks.join('');
  if (candInitials === inputCompact) return 0.95;

  // Token-level match (sorted input for order-invariance)
  const sortedInput = [...inputToks].sort();
  const usedCandIdx = new Set<number>();
  let matched = 0;

  for (const tok of sortedInput) {
    // (a) Exact word match against any unused candidate token
    let found = false;
    for (let i = 0; i < candToks.length; i++) {
      if (!usedCandIdx.has(i) && candToks[i] === tok) {
        usedCandIdx.add(i);
        matched++;
        found = true;
        break;
      }
    }
    if (found) continue;

    // (b) Acronym match: tok == first letters of tok.length consecutive candidate words
    if (tok.length >= 2) {
      for (let start = 0; start <= candToks.length - tok.length; start++) {
        if (usedCandIdx.has(start)) continue;
        const slice = candToks.slice(start, start + tok.length);
        if (slice.some((_, k) => usedCandIdx.has(start + k))) continue;
        if (slice.map(t => t[0]).join('') === tok) {
          for (let k = start; k < start + tok.length; k++) usedCandIdx.add(k);
          matched++;
          break;
        }
      }
    }
  }

  if (matched === 0) return 0;
  // All input tokens accounted for → high confidence match
  if (matched === sortedInput.length) return 0.9;
  return matched / Math.max(sortedInput.length, candToks.length);
}

// ─── Pass 3: Sorted-token Levenshtein ─────────────────────────────────────────
// Sort both strings' tokens alphabetically, then run character-level edit
// distance. Handles typos while remaining order-invariant.

function sortedLevenshteinScore(input: string, candidate: string): number {
  return similarityScore(sortedTokenStr(input), sortedTokenStr(candidate));
}

// ─── Combined score ───────────────────────────────────────────────────────────

function computeScore(
  input: string,
  candidateName: string,
): { score: number; method: FacilityMatch['matchMethod'] } {
  if (norm(input) === norm(candidateName)) return { score: 1.0, method: 'exact' };

  const ts = tokenSetScore(input, candidateName);
  const ac = acronymScore(input, candidateName);
  const lv = sortedLevenshteinScore(input, candidateName);

  const score = Math.max(ts, ac, lv);

  let method: FacilityMatch['matchMethod'];
  if (score === ts && ts >= 0.95) method = 'exact';
  else if (score === ac) method = 'acronym';
  else if (score === ts) method = 'token-set';
  else method = 'fuzzy';

  return { score, method };
}

function toConfidence(score: number): FacilityMatch['confidence'] {
  if (score >= 0.95) return 'exact';
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the top-N matches for `rawName` from `facilities`, sorted by score.
 * Results below `threshold` are excluded.
 */
export function matchFacilities<T extends { id: string; name: string }>(
  rawName: string,
  facilities: T[],
  limit = 5,
  threshold = 0.5,
): Array<FacilityMatch & { facility: T }> {
  const results: Array<FacilityMatch & { facility: T }> = [];

  for (const facility of facilities) {
    const { score, method } = computeScore(rawName, facility.name);
    if (score >= threshold) {
      results.push({
        id: facility.id,
        name: facility.name,
        score,
        confidence: toConfidence(score),
        matchMethod: method,
        facility,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Returns the single best match, or null if nothing clears `threshold`.
 */
export function bestMatch<T extends { id: string; name: string }>(
  rawName: string,
  facilities: T[],
  threshold = 0.5,
): (FacilityMatch & { facility: T }) | null {
  const matches = matchFacilities(rawName, facilities, 1, threshold);
  return matches[0] ?? null;
}
