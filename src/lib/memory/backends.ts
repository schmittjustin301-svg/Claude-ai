import type { MemoryBackend, MemoryEntry } from "./types";

const STORAGE_KEY = "grind-empire-memory-v1";

/**
 * Default backend: localStorage. Works identically in desktop and mobile
 * browsers and survives reloads and PWA restarts.
 *
 * Scope caveat: localStorage is per-device and per-origin, so PC and phone
 * each keep their own copy until a networked backend is wired up. The export
 * and import in the memory panel exist to bridge that gap in the meantime.
 *
 * Memories are small text records, so the ~5MB string quota is not a concern
 * here the way it was for athlete images.
 */
export class LocalMemoryBackend implements MemoryBackend {
  id = "local";
  label = "Dieses Gerät";

  async isAvailable(): Promise<boolean> {
    try {
      const probe = "__ge_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return true;
    } catch {
      // Private-mode Safari and disabled storage both land here.
      return false;
    }
  }

  async loadAll(): Promise<MemoryEntry[]> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as MemoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  async put(entry: MemoryEntry): Promise<void> {
    const all = await this.loadAll();
    const index = all.findIndex((e) => e.id === entry.id);
    if (index >= 0) all[index] = entry;
    else all.push(entry);
    await this.replaceAll(all);
  }

  async remove(id: string): Promise<void> {
    await this.replaceAll((await this.loadAll()).filter((e) => e.id !== id));
  }

  async replaceAll(entries: MemoryEntry[]): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

export const localMemoryBackend = new LocalMemoryBackend();

/** Active backend. Swapped wholesale once Obsidian or Supabase is wired in. */
let activeBackend: MemoryBackend = localMemoryBackend;

export function getMemoryBackend(): MemoryBackend {
  return activeBackend;
}

export function setMemoryBackend(backend: MemoryBackend): void {
  activeBackend = backend;
}
