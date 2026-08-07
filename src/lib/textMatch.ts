// Shared fuzzy text matching. Used by the athlete search and by memory
// deduplication — neither should depend on the other, so it lives here.

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Standard Levenshtein distance, two-row rolling buffer. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** 0..1 similarity derived from edit distance. */
export function ratio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Similarity of a query against one candidate, 0..1.
 * Combines whole-string distance with per-token best matches, so a correct
 * surname still scores well when the first name is misspelled.
 */
export function similarity(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.92;

  const whole = ratio(q, c);

  const qTokens = q.split(" ");
  const cTokens = c.split(" ");
  const tokenScores = qTokens.map((qt) => {
    let best = 0;
    for (const ct of cTokens) {
      const score = ct.startsWith(qt) || qt.startsWith(ct) ? Math.max(0.9, ratio(qt, ct)) : ratio(qt, ct);
      if (score > best) best = score;
    }
    return best;
  });
  const tokenAvg = tokenScores.reduce((sum, s) => sum + s, 0) / (tokenScores.length || 1);

  return Math.max(whole, tokenAvg * 0.97);
}

/**
 * Overlap of shared words, 0..1. Better than edit distance for comparing
 * sentences, where word order varies but the wording largely repeats.
 */
export function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(normalize(a).split(" ").filter((t) => t.length > 2));
  const bTokens = new Set(normalize(b).split(" ").filter((t) => t.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const t of aTokens) if (bTokens.has(t)) shared++;
  return shared / Math.min(aTokens.size, bTokens.size);
}
