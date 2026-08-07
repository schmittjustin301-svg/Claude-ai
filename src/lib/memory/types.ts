// Long-term memory for JARVIS.
//
// Deliberately separate from the chat transcript: the transcript is a rolling
// log that gets trimmed and can be cleared, while these are durable facts that
// survive both. Only this store is guaranteed to reach the model on every turn.

export const MEMORY_CATEGORIES = ["business", "preference", "person", "goal", "project", "fact"] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_LABEL: Record<MemoryCategory, string> = {
  business: "Business",
  preference: "Vorliebe",
  person: "Person",
  goal: "Ziel",
  project: "Projekt",
  fact: "Fakt",
};

/** 3 = always keep in context, 1 = nice to have. Drives ordering when the budget is tight. */
export type MemoryImportance = 1 | 2 | 3;

export interface MemoryEntry {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: MemoryImportance;
  /** Who created it — lets the UI show what JARVIS decided to keep on its own. */
  source: "jarvis" | "user";
  created_at: string;
  updated_at: string;
}

/**
 * Storage seam. Everything above this talks to MemoryBackend only, so adding
 * Obsidian (markdown files via the Local REST API) or Supabase later means
 * writing one more implementation — no changes to the store, tools or UI.
 */
export interface MemoryBackend {
  id: string;
  label: string;
  /** False when the backend is configured but unreachable (e.g. Obsidian closed). */
  isAvailable(): Promise<boolean>;
  loadAll(): Promise<MemoryEntry[]>;
  put(entry: MemoryEntry): Promise<void>;
  remove(id: string): Promise<void>;
  replaceAll(entries: MemoryEntry[]): Promise<void>;
}

export function newMemory(
  content: string,
  category: MemoryCategory,
  importance: MemoryImportance,
  source: "jarvis" | "user"
): MemoryEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    content: content.trim(),
    category,
    importance,
    source,
    created_at: now,
    updated_at: now,
  };
}
