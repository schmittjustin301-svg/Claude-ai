import { create } from "zustand";
import {
  exportMemories,
  forget,
  importMemories,
  loadMemories,
  remember,
  updateMemory,
} from "../lib/memory/memory";
import {
  localMemoryBackend,
  registerMemoryBackend,
  restoreMemoryBackend,
  setMemoryBackend,
} from "../lib/memory/backends";
import { obsidianBackend } from "../lib/memory/obsidianBackend";
import type { MemoryCategory, MemoryEntry, MemoryImportance } from "../lib/memory/types";

registerMemoryBackend(obsidianBackend);

interface MemoryStore {
  entries: MemoryEntry[];
  loaded: boolean;
  backendId: string;
  backendError: string | null;

  load(): Promise<void>;
  switchBackend(id: string): Promise<void>;
  add(content: string, category: MemoryCategory, importance: MemoryImportance, source?: "jarvis" | "user"): Promise<void>;
  edit(id: string, changes: Partial<MemoryEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  exportJson(): string;
  importJson(json: string): Promise<{ added: number; skipped: number }>;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  entries: [],
  loaded: false,
  backendId: localMemoryBackend.id,
  backendError: null,

  async load() {
    const { backend, fellBack } = await restoreMemoryBackend();
    try {
      set({
        entries: await loadMemories(),
        loaded: true,
        backendId: backend.id,
        backendError: fellBack
          ? "Der zuletzt gewählte Speicher war nicht erreichbar — es wird wieder dieses Gerät genutzt."
          : null,
      });
    } catch (err) {
      // Never leave the app without a memory: fall back rather than throw.
      setMemoryBackend(localMemoryBackend);
      set({
        entries: await loadMemories(),
        loaded: true,
        backendId: localMemoryBackend.id,
        backendError: err instanceof Error ? err.message : "Speicher nicht erreichbar.",
      });
    }
  },

  async switchBackend(id) {
    const target = id === obsidianBackend.id ? obsidianBackend : localMemoryBackend;
    if (target.id !== localMemoryBackend.id) {
      const available = await target.isAvailable();
      if (!available) {
        set({ backendError: "Nicht erreichbar — Verbindung erst testen." });
        return;
      }
    }
    setMemoryBackend(target);
    try {
      set({ entries: await loadMemories(), backendId: target.id, backendError: null });
    } catch (err) {
      setMemoryBackend(localMemoryBackend);
      set({
        entries: await loadMemories(),
        backendId: localMemoryBackend.id,
        backendError: err instanceof Error ? err.message : "Wechsel fehlgeschlagen.",
      });
    }
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
