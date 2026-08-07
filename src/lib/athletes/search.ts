// Typo-tolerant athlete lookup.
//
// Names in this domain are frequently misspelled (Truscott/Truscot,
// Soltero/Soltera) and often typed from memory, so exact matching is not
// enough. Scoring combines whole-string similarity with per-token similarity
// so that a correct surname still matches when the first name is off.

import type { Athlete } from "./types";

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
function ratio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/**
 * Similarity of a query against one candidate name.
 * Returns 0..1; ~0.7+ is a confident match in practice.
 */
export function similarity(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.92;

  const whole = ratio(q, c);

  // Token-level: every query token takes its best match among candidate tokens.
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

export interface AthleteMatch {
  athlete: Athlete;
  score: number;
}

/** Best matches for a single name, strongest first. */
export function searchAthletes(query: string, athletes: Athlete[], limit = 8, threshold = 0.45): AthleteMatch[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return athletes
    .map((athlete) => {
      // A nickname is an equally valid way to refer to someone.
      const score = Math.max(
        similarity(trimmed, athlete.full_name),
        athlete.nickname ? similarity(trimmed, athlete.nickname) * 0.98 : 0
      );
      return { athlete, score };
    })
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Splits pasted input into individual names. Accepts newline-, comma- and
 * semicolon-separated lists so a block pasted from anywhere just works.
 */
export function parseNameList(input: string): string[] {
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface ResolvedName {
  query: string;
  match: Athlete | null;
  score: number;
  alternatives: Athlete[];
}

/** Resolves a list of typed names to athlete records, keeping misses visible. */
export function resolveNames(input: string, athletes: Athlete[]): ResolvedName[] {
  return parseNameList(input).map((query) => {
    const matches = searchAthletes(query, athletes);
    return {
      query,
      match: matches[0]?.athlete ?? null,
      score: matches[0]?.score ?? 0,
      alternatives: matches.slice(1).map((m) => m.athlete),
    };
  });
}
