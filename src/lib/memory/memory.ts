// Memory operations: dedup-aware writes, recall, and the context block that
// gets injected into every system prompt.

import { similarity, tokenOverlap } from "../textMatch";
import { getMemoryBackend } from "./backends";
import {
  MEMORY_CATEGORY_LABEL,
  newMemory,
  type MemoryCategory,
  type MemoryEntry,
  type MemoryImportance,
} from "./types";

/** Above this, a new fact is treated as a restatement of an existing one. */
const DUPLICATE_THRESHOLD = 0.82;

/**
 * Character budget for the memory block in the system prompt. Keeps token cost
 * bounded as the store grows; anything that does not fit stays reachable
 * through the searchMemory tool.
 */
const CONTEXT_BUDGET = 3500;

/**
 * Shared words are the meaningful signal between sentences. Character-level
 * edit distance across whole sentences mostly tracks their length — two
 * unrelated facts of similar length score ~0.3 — so it only nudges the result
 * rather than driving it, otherwise searches return everything.
 */
function contentSimilarity(a: string, b: string): number {
  return Math.max(tokenOverlap(a, b), similarity(a, b) * 0.55);
}

export function findSimilarMemory(content: string, entries: MemoryEntry[]): MemoryEntry | null {
  let best: MemoryEntry | null = null;
  let bestScore = 0;
  for (const entry of entries) {
    const score = contentSimilarity(content, entry.content);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= DUPLICATE_THRESHOLD ? best : null;
}

export interface RememberResult {
  entry: MemoryEntry;
  created: boolean;
  replaced?: string;
}

/**
 * Stores a fact, updating an existing entry when it restates one. Without this
 * the store fills with near-identical lines every time a topic comes up again.
 */
export async function remember(
  content: string,
  category: MemoryCategory,
  importance: MemoryImportance,
  source: "jarvis" | "user"
): Promise<RememberResult> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Leerer Gedächtnis-Eintrag.");

  const backend = getMemoryBackend();
  const all = await backend.loadAll();
  const existing = findSimilarMemory(trimmed, all);

  if (existing) {
    const updated: MemoryEntry = {
      ...existing,
      // Newer phrasing wins — it usually reflects the more current situation.
      content: trimmed,
      category,
      importance: Math.max(existing.importance, importance) as MemoryImportance,
      updated_at: new Date().toISOString(),
    };
    await backend.put(updated);
    return { entry: updated, created: false, replaced: existing.content };
  }

  const entry = newMemory(trimmed, category, importance, source);
  await backend.put(entry);
  return { entry, created: true };
}

export async function forget(id: string): Promise<void> {
  await getMemoryBackend().remove(id);
}

export async function updateMemory(id: string, changes: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
  const backend = getMemoryBackend();
  const all = await backend.loadAll();
  const existing = all.find((e) => e.id === id);
  if (!existing) return null;
  const updated = { ...existing, ...changes, id: existing.id, updated_at: new Date().toISOString() };
  await backend.put(updated);
  return updated;
}

export async function loadMemories(): Promise<MemoryEntry[]> {
  return getMemoryBackend().loadAll();
}

export interface MemoryHit {
  entry: MemoryEntry;
  score: number;
}

export function searchMemories(query: string, entries: MemoryEntry[], limit = 8): MemoryHit[] {
  const q = query.trim();
  if (!q) return [];
  return entries
    .map((entry) => ({ entry, score: contentSimilarity(q, entry.content) }))
    .filter((h) => h.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Most important first, then most recently touched. */
export function rankForContext(entries: MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

/**
 * Renders the memory block for the system prompt, grouped by category and
 * capped at CONTEXT_BUDGET characters.
 */
export function buildMemoryBlock(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";

  const ranked = rankForContext(entries);
  const included: MemoryEntry[] = [];
  let used = 0;
  for (const entry of ranked) {
    const cost = entry.content.length + 4;
    if (used + cost > CONTEXT_BUDGET) break;
    included.push(entry);
    used += cost;
  }

  const byCategory = new Map<MemoryCategory, MemoryEntry[]>();
  for (const entry of included) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const sections = [...byCategory.entries()].map(([category, list]) => {
    const lines = list.map((e) => `- ${e.content}`).join("\n");
    return `${MEMORY_CATEGORY_LABEL[category]}:\n${lines}`;
  });

  const omitted = ranked.length - included.length;
  const footer =
    omitted > 0
      ? `\n\n(${omitted} weitere Einträge gespeichert — mit searchMemory abrufbar, wenn sie relevant werden.)`
      : "";

  return `\n\nGEDÄCHTNIS — was du über den Nutzer gespeichert hast:\n${sections.join("\n\n")}${footer}`;
}

export function exportMemories(entries: MemoryEntry[]): string {
  return JSON.stringify({ version: 1, exported_at: new Date().toISOString(), entries }, null, 2);
}

/** Merges an exported file into this device's store, skipping restatements. */
export async function importMemories(json: string): Promise<{ added: number; skipped: number }> {
  const parsed = JSON.parse(json) as { entries?: MemoryEntry[] };
  const incoming = parsed.entries;
  if (!Array.isArray(incoming)) throw new Error("Datei enthält keine Gedächtnis-Einträge.");

  const backend = getMemoryBackend();
  const existing = await backend.loadAll();
  let added = 0;
  let skipped = 0;

  for (const entry of incoming) {
    if (typeof entry?.content !== "string" || !entry.content.trim()) {
      skipped++;
      continue;
    }
    if (existing.some((e) => e.id === entry.id) || findSimilarMemory(entry.content, existing)) {
      skipped++;
      continue;
    }
    existing.push(entry);
    added++;
  }

  await backend.replaceAll(existing);
  return { added, skipped };
}
