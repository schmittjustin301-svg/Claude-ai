// Memory backend backed by an Obsidian vault, via the "Local REST API"
// community plugin (coddingtonbear). Memories become a real markdown note you
// can read, edit and link to inside Obsidian.
//
// Reachability is the awkward part and the error messages below are written to
// name the actual cause rather than surface a bare "Failed to fetch":
//   - The plugin serves HTTPS on 27124 with a *self-signed* certificate, so the
//     browser refuses it until that certificate has been accepted once.
//   - Its plain-HTTP port (27123, off by default) cannot be called from an
//     HTTPS-hosted app at all — browsers block mixed content.
//   - Obsidian has to be running; there is no server when the app is closed.
// In practice this backend is for the machine Obsidian runs on.

import type { MemoryBackend, MemoryEntry } from "./types";
import { parseMemories, serializeMemories } from "./obsidianFormat";

export interface ObsidianConfig {
  /** Base URL of the Local REST API, e.g. https://127.0.0.1:27124 */
  baseUrl: string;
  apiKey: string;
  /** Vault-relative path of the memory note. */
  notePath: string;
}

export const DEFAULT_OBSIDIAN_CONFIG: ObsidianConfig = {
  baseUrl: "https://127.0.0.1:27124",
  apiKey: "",
  notePath: "GRIND EMPIRE/JARVIS Gedächtnis.md",
};

const CONFIG_KEY = "grind-empire-obsidian-config";

export function loadObsidianConfig(): ObsidianConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_OBSIDIAN_CONFIG };
    return { ...DEFAULT_OBSIDIAN_CONFIG, ...(JSON.parse(raw) as Partial<ObsidianConfig>) };
  } catch {
    return { ...DEFAULT_OBSIDIAN_CONFIG };
  }
}

export function saveObsidianConfig(config: ObsidianConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export class ObsidianUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObsidianUnreachableError";
  }
}

function describeNetworkFailure(baseUrl: string): string {
  const isHttp = baseUrl.startsWith("http://");
  const pageIsHttps = typeof location !== "undefined" && location.protocol === "https:";

  if (isHttp && pageIsHttps) {
    return (
      "Die Seite läuft über HTTPS und darf deshalb kein http:// aufrufen (Mixed Content). " +
      "Nimm die HTTPS-Adresse des Plugins (Port 27124) — oder öffne die App lokal über http://localhost."
    );
  }
  return (
    "Obsidian ist nicht erreichbar. Prüfe: Läuft Obsidian? Ist das Plugin „Local REST API\" aktiv? " +
    "Und öffne die Adresse einmal direkt im Browser, um das selbstsignierte Zertifikat zu akzeptieren."
  );
}

export class ObsidianMemoryBackend implements MemoryBackend {
  id = "obsidian";
  label = "Obsidian";

  private config: ObsidianConfig;

  constructor(config: ObsidianConfig) {
    this.config = config;
  }

  setConfig(config: ObsidianConfig): void {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  private notePath(): string {
    return this.config.notePath.split("/").map(encodeURIComponent).join("/");
  }

  private url(): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}/vault/${this.notePath()}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/`, { headers: this.headers });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Health check with an explanatory message, used by the settings UI. */
  async check(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.apiKey.trim()) {
      return { ok: false, message: "Kein API-Key eingetragen. Findest du in Obsidian unter Local REST API." };
    }
    try {
      const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/`, { headers: this.headers });
      if (res.status === 401) return { ok: false, message: "API-Key wird abgelehnt. Stimmt er mit dem Plugin überein?" };
      if (!res.ok) return { ok: false, message: `Plugin antwortet mit Status ${res.status}.` };
      return { ok: true, message: "Verbindung steht." };
    } catch {
      return { ok: false, message: describeNetworkFailure(this.config.baseUrl) };
    }
  }

  async loadAll(): Promise<MemoryEntry[]> {
    let res: Response;
    try {
      res = await fetch(this.url(), { headers: { ...this.headers, Accept: "text/markdown" } });
    } catch {
      throw new ObsidianUnreachableError(describeNetworkFailure(this.config.baseUrl));
    }

    // The note simply does not exist yet — that is an empty memory, not an error.
    if (res.status === 404) return [];
    if (res.status === 401) throw new ObsidianUnreachableError("API-Key wird von Obsidian abgelehnt.");
    if (!res.ok) throw new ObsidianUnreachableError(`Obsidian antwortet mit Status ${res.status}.`);

    return parseMemories(await res.text());
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
    let res: Response;
    try {
      res = await fetch(this.url(), {
        method: "PUT",
        headers: { ...this.headers, "Content-Type": "text/markdown" },
        body: serializeMemories(entries),
      });
    } catch {
      throw new ObsidianUnreachableError(describeNetworkFailure(this.config.baseUrl));
    }
    if (!res.ok) {
      throw new ObsidianUnreachableError(`Schreiben fehlgeschlagen (Status ${res.status}).`);
    }
  }
}

export const obsidianBackend = new ObsidianMemoryBackend(loadObsidianConfig());
