// Generic Obsidian vault access, on top of the Local REST API plugin.
//
// The memory backend (lib/memory/obsidianBackend.ts) owns exactly one note.
// This is the broader writer: it creates and grows notes across the whole
// vault structure. Writing goes through the plugin rather than the filesystem
// so Obsidian keeps its index intact and wikilinks survive renames.

import { loadObsidianConfig, type ObsidianConfig } from "../memory/obsidianBackend";

export class VaultUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultUnreachableError";
  }
}

function baseUrl(config: ObsidianConfig): string {
  return config.baseUrl.replace(/\/$/, "");
}

function headers(config: ObsidianConfig, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${config.apiKey}`, ...extra };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function unreachable(): VaultUnreachableError {
  return new VaultUnreachableError(
    "Obsidian nicht erreichbar. Läuft es? Ist das Plugin „Local REST API“ aktiv und das Zertifikat akzeptiert?"
  );
}

export async function vaultAvailable(config = loadObsidianConfig()): Promise<boolean> {
  if (!config.apiKey.trim()) return false;
  try {
    const res = await fetch(`${baseUrl(config)}/`, { headers: headers(config) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns null when the note does not exist yet. */
export async function readNote(path: string, config = loadObsidianConfig()): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl(config)}/vault/${encodePath(path)}`, {
      headers: headers(config, { Accept: "text/markdown" }),
    });
  } catch {
    throw unreachable();
  }
  if (res.status === 404) return null;
  if (res.status === 401) throw new VaultUnreachableError("API-Key wird von Obsidian abgelehnt.");
  if (!res.ok) throw new VaultUnreachableError(`Obsidian antwortet mit Status ${res.status}.`);
  return res.text();
}

export async function writeNote(path: string, content: string, config = loadObsidianConfig()): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl(config)}/vault/${encodePath(path)}`, {
      method: "PUT",
      headers: headers(config, { "Content-Type": "text/markdown" }),
      body: content,
    });
  } catch {
    throw unreachable();
  }
  if (!res.ok) throw new VaultUnreachableError(`Schreiben fehlgeschlagen (Status ${res.status}).`);
}

/**
 * Appends a block to a note, creating it from `header` when missing.
 *
 * Writes are additive by design — notes grow, they are never replaced, so
 * anything the user added by hand survives. `dedupeKey` makes a repeated write
 * a no-op, which matters because the sync queue may retry.
 */
export async function appendToNote(
  path: string,
  block: string,
  header: string,
  dedupeKey?: string,
  config = loadObsidianConfig()
): Promise<{ written: boolean }> {
  const existing = await readNote(path, config);

  if (existing && dedupeKey && existing.includes(dedupeKey)) {
    return { written: false };
  }

  const base = existing ?? header;
  const separator = base.endsWith("\n") ? "" : "\n";
  await writeNote(path, `${base}${separator}${block}\n`, config);
  return { written: true };
}

/**
 * Creates or updates a note whose frontmatter is owned by the app while the
 * body below stays untouched, so notes edited in Obsidian keep those edits.
 */
export async function upsertNoteWithFrontmatter(
  path: string,
  frontmatter: string,
  initialBody: string,
  config = loadObsidianConfig()
): Promise<void> {
  const existing = await readNote(path, config);
  if (existing === null) {
    await writeNote(path, `${frontmatter}\n${initialBody}\n`, config);
    return;
  }
  // Replace only the leading frontmatter block; keep everything the user wrote.
  const body = existing.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  await writeNote(path, `${frontmatter}\n${body.startsWith("\n") ? body.slice(1) : body}`, config);
}

/** Obsidian treats these as path separators or link syntax. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|[\]#^]/g, "-").replace(/\s+/g, " ").trim() || "Unbenannt";
}

export function wikilink(name: string): string {
  return `[[${sanitizeFileName(name)}]]`;
}

/** Serialises a YAML frontmatter block; arrays become YAML lists. */
export function frontmatter(fields: Record<string, string | number | boolean | string[] | null | undefined>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - "${String(item).replace(/"/g, '\\"')}"`);
    } else if (typeof value === "string") {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
