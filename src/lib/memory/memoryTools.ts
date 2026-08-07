import { forget, loadMemories, remember, searchMemories } from "./memory";
import { MEMORY_CATEGORIES, type MemoryCategory, type MemoryImportance } from "./types";

export const MEMORY_TOOL_DEFINITIONS = [
  {
    name: "rememberFact",
    description:
      "Speichert dauerhaft eine Information über den Nutzer oder sein Business. Nutze das für Dinge, die auch in Wochen noch gelten — Vorlieben, Arbeitsweisen, wichtige Personen, Ziele, laufende Projekte. Nicht für Tagesaufgaben (dafür gibt es Contracts) und nicht für Belangloses. Wiederholte Fakten werden automatisch aktualisiert statt doppelt gespeichert.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Der Fakt als vollständiger, für sich verständlicher Satz — ohne Bezug auf den aktuellen Chat.",
        },
        category: { type: "string", enum: [...MEMORY_CATEGORIES] },
        importance: {
          type: "number",
          enum: [1, 2, 3],
          description: "3 = zentral und immer relevant, 2 = wichtig, 1 = Detail.",
        },
      },
      required: ["content", "category", "importance"],
    },
  },
  {
    name: "searchMemory",
    description:
      "Durchsucht das Langzeitgedächtnis. Nur nötig, wenn im Kontext ein Hinweis auf weitere gespeicherte Einträge steht oder du gezielt etwas Älteres suchst — die wichtigsten Einträge stehen ohnehin schon im Systemkontext.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "forgetMemory",
    description:
      "Löscht einen Gedächtnis-Eintrag dauerhaft. Vorher die genaue ID mit searchMemory holen und beim Nutzer kurz rückfragen, bevor du löschst.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "ID des Eintrags aus searchMemory" } },
      required: ["id"],
    },
  },
] as const;

export const MEMORY_TOOL_NAMES = new Set(MEMORY_TOOL_DEFINITIONS.map((t) => t.name as string));

export async function executeMemoryTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "rememberFact": {
      const content = String(input.content ?? "").trim();
      if (!content) return { ok: false, error: "content fehlt." };

      const category = (String(input.category ?? "fact") as MemoryCategory);
      const safeCategory = MEMORY_CATEGORIES.includes(category) ? category : "fact";
      const rawImportance = Number(input.importance ?? 2);
      const importance = ([1, 2, 3].includes(rawImportance) ? rawImportance : 2) as MemoryImportance;

      const result = await remember(content, safeCategory, importance, "jarvis");
      return {
        ok: true,
        created: result.created,
        message: result.created
          ? "Gespeichert."
          : `Bestehenden Eintrag aktualisiert (vorher: "${result.replaced}").`,
      };
    }

    case "searchMemory": {
      const query = String(input.query ?? "");
      const hits = searchMemories(query, await loadMemories());
      return {
        found: hits.length > 0,
        results: hits.map((h) => ({
          id: h.entry.id,
          content: h.entry.content,
          category: h.entry.category,
          importance: h.entry.importance,
          updated_at: h.entry.updated_at,
        })),
      };
    }

    case "forgetMemory": {
      const id = String(input.id ?? "");
      const all = await loadMemories();
      const target = all.find((e) => e.id === id);
      if (!target) return { ok: false, error: "Kein Eintrag mit dieser ID." };
      await forget(id);
      return { ok: true, message: `Vergessen: "${target.content}"` };
    }

    default:
      return { ok: false, error: `Unbekanntes Gedächtnis-Tool: ${name}` };
  }
}
