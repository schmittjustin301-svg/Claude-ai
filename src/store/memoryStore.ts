import { create } from "zustand";
import {
  exportMemories,
  forget,
  importMemories,
  loadMemories,
  remember,
  updateMemory,
} from "../lib/memory/memory";
import type { MemoryCategory, MemoryEntry, MemoryImportance } from "../lib/memory/types";

interface MemoryStore {
  entries: MemoryEntry[];
  loaded: boolean;

  load(): Promise<void>;
  add(content: string, category: MemoryCategory, importance: MemoryImportance, source?: "jarvis" | "user"): Promise<void>;
  edit(id: string, changes: Partial<MemoryEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  exportJson(): string;
  importJson(json: string): Promise<{ added: number; skipped: number }>;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  entries: [],
  loaded: false,

  async load() {
    set({ entries: await loadMemories(), loaded: true });
  },

  async add(content, category, importance, source = "user") {
    await remember(content, category, importance, source);
    set({ entries: await loadMemories() });
  },

  async edit(id, changes) {
    await updateMemory(id, changes);
    set({ entries: await loadMemories() });
  },

  async remove(id) {
    await forget(id);
    set({ entries: await loadMemories() });
  },

  exportJson() {
    return exportMemories(get().entries);
  },

  async importJson(json) {
    const result = await importMemories(json);
    set({ entries: await loadMemories() });
    return result;
  },
}));
