import { create } from "zustand";
import {
  appendToNote,
  upsertNoteWithFrontmatter,
  vaultAvailable,
  VaultUnreachableError,
} from "../lib/vault/vaultClient";
import {
  ACHIEVEMENTS_HEADER,
  BOSS_HEADER,
  DAILY_HEADER,
  LEDGER_HEADER,
  ROADMAP_HEADER,
  VAULT_PATHS,
  today,
} from "../lib/vault/vaultNotes";

/**
 * A queued vault write.
 *
 * Everything is queued rather than written inline because Obsidian may simply
 * be closed — the app must never block or lose an event over that. Entries stay
 * pending and drain on the next successful connection.
 */
export interface VaultTask {
  id: string;
  kind: "append" | "note";
  path: string;
  /** append */
  block?: string;
  header?: string;
  dedupeKey?: string;
  /** note */
  frontmatter?: string;
  body?: string;
  label: string;
  created_at: string;
  attempts: number;
  error: string | null;
}

interface VaultStore {
  queue: VaultTask[];
  enabled: boolean;
  available: boolean | null;
  syncing: boolean;
  lastSync: string | null;

  init(): void;
  setEnabled(enabled: boolean): void;
  checkAvailability(): Promise<boolean>;
  flush(): Promise<void>;
  clearQueue(): void;

  /* Recording helpers used by the rest of the app */
  recordAppend(path: string, header: string, block: string, dedupeKey: string, label: string): void;
  recordNote(path: string, frontmatter: string, body: string, label: string): void;
}

const QUEUE_KEY = "grind-empire-vault-queue";
const ENABLED_KEY = "grind-empire-vault-enabled";
const MAX_ATTEMPTS = 5;

function loadQueue(): VaultTask[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: VaultTask[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200)));
  } catch {
    // Queue simply will not survive a reload if storage is unavailable.
  }
}

export const useVaultStore = create<VaultStore>((set, get) => {
  function setQueue(queue: VaultTask[]) {
    persistQueue(queue);
    set({ queue });
  }

  function enqueue(task: Omit<VaultTask, "id" | "created_at" | "attempts" | "error">) {
    if (!get().enabled) return;
    setQueue([
      ...get().queue,
      { ...task, id: crypto.randomUUID(), created_at: new Date().toISOString(), attempts: 0, error: null },
    ]);
    void get().flush();
  }

  return {
    queue: [],
    enabled: false,
    available: null,
    syncing: false,
    lastSync: null,

    init() {
      let enabled = false;
      try {
        enabled = localStorage.getItem(ENABLED_KEY) === "1";
      } catch {
        enabled = false;
      }
      set({ queue: loadQueue(), enabled });
      if (enabled) void get().flush();
    },

    setEnabled(enabled) {
      try {
        localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
      } catch {
        // Preference will not persist; the session still honours it.
      }
      set({ enabled });
      if (enabled) void get().flush();
    },

    async checkAvailability() {
      const ok = await vaultAvailable();
      set({ available: ok });
      return ok;
    },

    async flush() {
      if (get().syncing || !get().enabled || get().queue.length === 0) return;
      set({ syncing: true });

      try {
        if (!(await get().checkAvailability())) return;

        // Sequential on purpose: several tasks may target the same note, and
        // parallel read-modify-write would drop entries.
        for (const task of [...get().queue]) {
          try {
            if (task.kind === "append") {
              await appendToNote(task.path, task.block ?? "", task.header ?? "", task.dedupeKey);
            } else {
              await upsertNoteWithFrontmatter(task.path, task.frontmatter ?? "", task.body ?? "");
            }
            setQueue(get().queue.filter((t) => t.id !== task.id));
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unbekannter Fehler";
            const attempts = task.attempts + 1;
            setQueue(
              get().queue.map((t) => (t.id === task.id ? { ...t, attempts, error: message } : t))
            );
            // Connection problems affect every remaining task, so stop early
            // and retry the whole batch later rather than hammering.
            if (err instanceof VaultUnreachableError) break;
            if (attempts >= MAX_ATTEMPTS) {
              setQueue(get().queue.filter((t) => t.id !== task.id));
            }
          }
        }
        set({ lastSync: new Date().toISOString() });
      } finally {
        set({ syncing: false });
      }
    },

    clearQueue() {
      setQueue([]);
    },

    recordAppend(path, header, block, dedupeKey, label) {
      enqueue({ kind: "append", path, header, block, dedupeKey, label });
    },

    recordNote(path, frontmatterText, body, label) {
      enqueue({ kind: "note", path, frontmatter: frontmatterText, body, label });
    },
  };
});

/* ------------------------------------------------------ event recorders */

export const vault = {
  contract(text: string, channel: string, xp: number, entry: { block: string; key: string }) {
    const date = today();
    useVaultStore
      .getState()
      .recordAppend(VAULT_PATHS.daily(date), DAILY_HEADER(date), entry.block, entry.key, `Contract: ${text}`);
    void channel;
    void xp;
  },

  earning(entry: { block: string; key: string }, source: string) {
    useVaultStore
      .getState()
      .recordAppend(VAULT_PATHS.ledger, LEDGER_HEADER, entry.block, entry.key, `Einnahme: ${source}`);
  },

  boss(entry: { block: string; key: string }, name: string) {
    useVaultStore.getState().recordAppend(VAULT_PATHS.bossLog, BOSS_HEADER, entry.block, entry.key, `Boss: ${name}`);
  },

  achievement(entry: { block: string; key: string }, title: string) {
    useVaultStore
      .getState()
      .recordAppend(VAULT_PATHS.achievements, ACHIEVEMENTS_HEADER, entry.block, entry.key, `Achievement: ${title}`);
  },

  roadmap(entry: { block: string; key: string }, title: string) {
    useVaultStore
      .getState()
      .recordAppend(VAULT_PATHS.roadmap, ROADMAP_HEADER, entry.block, entry.key, `Roadmap: ${title}`);
  },

  note(path: string, note: { frontmatter: string; body: string }, label: string) {
    useVaultStore.getState().recordNote(path, note.frontmatter, note.body, label);
  },
};
