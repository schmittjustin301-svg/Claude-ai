// Markdown serialisation for the Obsidian memory file.
//
// The file is meant to be read and edited by a human inside Obsidian, so the
// format is a plain bullet list grouped by category heading. Metadata rides in
// an HTML comment, which Obsidian hides in preview and which survives manual
// editing of the sentence in front of it.
//
// Bullets written by hand carry no comment. Those are adopted as new entries on
// the next load rather than discarded — jotting a line in Obsidian is a valid
// way to tell JARVIS something.

import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_LABEL,
  type MemoryCategory,
  type MemoryEntry,
  type MemoryImportance,
} from "./types";

const HEADER = `# JARVIS Gedächtnis

> [!info] Verwaltet von GRIND EMPIRE
> Du kannst hier direkt mitschreiben. Neue Zeilen einfach als \`- Text\` unter die
> passende Überschrift setzen — die App übernimmt sie beim nächsten Laden.
> Der Kommentar am Zeilenende gehört der App; lass ihn stehen, wenn du einen
> Eintrag nur umformulierst.
`;

interface LineMeta {
  id: string;
  imp: number;
  src: string;
  c: string;
  u: string;
}

const LABEL_TO_CATEGORY = new Map<string, MemoryCategory>(
  MEMORY_CATEGORIES.map((c) => [MEMORY_CATEGORY_LABEL[c].toLowerCase(), c])
);

export function serializeMemories(entries: MemoryEntry[]): string {
  const byCategory = new Map<MemoryCategory, MemoryEntry[]>();
  for (const entry of entries) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const sections: string[] = [];
  // Fixed category order keeps the file's diff stable between writes.
  for (const category of MEMORY_CATEGORIES) {
    const list = byCategory.get(category);
    if (!list?.length) continue;
    const lines = list
      .map((e) => {
        const meta: LineMeta = {
          id: e.id,
          imp: e.importance,
          src: e.source,
          c: e.created_at,
          u: e.updated_at,
        };
        return `- ${escapeContent(e.content)} <!-- ge:${JSON.stringify(meta)} -->`;
      })
      .join("\n");
    sections.push(`## ${MEMORY_CATEGORY_LABEL[category]}\n\n${lines}`);
  }

  return `${HEADER}\n${sections.join("\n\n")}\n`;
}

/** Keeps a pasted comment in the text from terminating our metadata comment. */
function escapeContent(content: string): string {
  return content.replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;").replace(/\r?\n/g, " ").trim();
}

function unescapeContent(content: string): string {
  return content.replace(/&lt;!--/g, "<!--").replace(/--&gt;/g, "-->");
}

export function parseMemories(markdown: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  let category: MemoryCategory = "fact";

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      category = LABEL_TO_CATEGORY.get(heading[1].toLowerCase()) ?? "fact";
      continue;
    }

    // Skip callout/quote lines from the header block.
    if (line.startsWith(">")) continue;

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (!bullet) continue;

    const body = bullet[1];
    const metaMatch = /<!--\s*ge:(\{.*?\})\s*-->\s*$/.exec(body);
    const content = unescapeContent(metaMatch ? body.slice(0, metaMatch.index).trim() : body.trim());
    if (!content) continue;

    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]) as Partial<LineMeta>;
        entries.push({
          id: typeof meta.id === "string" && meta.id ? meta.id : crypto.randomUUID(),
          content,
          category,
          importance: clampImportance(meta.imp),
          source: meta.src === "jarvis" ? "jarvis" : "user",
          created_at: typeof meta.c === "string" ? meta.c : new Date().toISOString(),
          updated_at: typeof meta.u === "string" ? meta.u : new Date().toISOString(),
        });
        continue;
      } catch {
        // Corrupted metadata — fall through and treat it as a hand-written line
        // so the sentence itself is never lost.
      }
    }

    const now = new Date().toISOString();
    entries.push({
      id: crypto.randomUUID(),
      content,
      category,
      importance: 2,
      source: "user",
      created_at: now,
      updated_at: now,
    });
  }

  return entries;
}

function clampImportance(value: unknown): MemoryImportance {
  const n = Number(value);
  return (n === 1 || n === 2 || n === 3 ? n : 2) as MemoryImportance;
}
