// Typo-tolerant athlete lookup.
//
// Names in this domain are frequently misspelled (Truscott/Truscot,
// Soltero/Soltera) and often typed from memory, so exact matching is not
// enough. The scoring itself lives in lib/textMatch.ts, shared with memory
// deduplication.

import type { Athlete } from "./types";
import { similarity } from "../textMatch";

export { normalize, levenshtein, similarity } from "../textMatch";

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
