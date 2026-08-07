import type { useEmpireStore } from "../store/empireStore";
import {
  ATHLETE_TOOL_DEFINITIONS,
  ATHLETE_TOOL_NAMES,
  executeAthleteTool,
} from "./athletes/athleteTools";
import {
  MEMORY_TOOL_DEFINITIONS,
  MEMORY_TOOL_NAMES,
  executeMemoryTool,
} from "./memory/memoryTools";

type Store = ReturnType<typeof useEmpireStore.getState>;

// Tool definitions exactly as specified in the project brief, in Anthropic
// Messages API "tools" format. The persisted app state (localStorage today,
// Supabase later) lives in the browser, so tool *execution* happens on the
// client — the proxy only brokers the Anthropic API call itself, see
// aiClient.ts and supabase/functions/chat for the server-side half.
export const TOOL_DEFINITIONS = [
  {
    name: "createContract",
    description: "Legt einen neuen Contract (Aufgabe) für einen Kanal an, mit einem XP-Wert.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Beschreibung des Contracts" },
        channelId: {
          type: "string",
          description: "Kanal-ID: justingymlife, rafael, fullaccess oder skool",
        },
        xp: { type: "number", description: "XP-Wert des Contracts, typisch 10-50" },
      },
      required: ["text", "channelId", "xp"],
    },
  },
  {
    name: "completeContract",
    description: "Markiert einen bestehenden Contract als erledigt, vergibt XP und fügt dem Boss Schaden zu.",
    input_schema: {
      type: "object",
      properties: { contractId: { type: "string" } },
      required: ["contractId"],
    },
  },
  {
    name: "addDailyTask",
    description: "Fügt der Tagesliste ein einfaches To-do hinzu.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "logEarning",
    description: "Trägt eine Einnahme ein (Betrag in Euro + Quelle).",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        source: { type: "string" },
      },
      required: ["amount", "source"],
    },
  },
  {
    name: "addRoadmapItem",
    description: "Fügt einen neuen Meilenstein zur Roadmap hinzu (Status LOCKED).",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "updateRoadmapStatus",
    description: "Ändert den Status eines Roadmap-Meilensteins.",
    input_schema: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        status: { type: "string", enum: ["LOCKED", "ACTIVE", "DONE"] },
      },
      required: ["itemId", "status"],
    },
  },
  {
    name: "updateSkill",
    description: "Setzt das Level eines Skills (0-5).",
    input_schema: {
      type: "object",
      properties: {
        skillId: { type: "string" },
        level: { type: "number" },
      },
      required: ["skillId", "level"],
    },
  },
  {
    name: "getEmpireStatus",
    description: "Liest den kompletten aktuellen Stand: Kanäle, Contracts, Tagesliste, Boss, Roadmap, Skills, Achievements, Streak.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getEarningsSummary",
    description: "Liest eine Zusammenfassung der Einnahmen für einen Zeitraum.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["week", "month", "all"] },
      },
      required: ["period"],
    },
  },
] as const;

export type ToolName = (typeof TOOL_DEFINITIONS)[number]["name"];

export function executeEmpireTool(name: string, input: Record<string, unknown>, store: Store): unknown {
  switch (name as ToolName) {
    case "createContract": {
      const text = String(input.text ?? "");
      const channelId = String(input.channelId ?? "");
      const xp = Number(input.xp ?? 20);
      store.addContract(text, channelId, xp);
      return { ok: true, message: `Contract "${text}" angelegt (${xp} XP).` };
    }
    case "completeContract": {
      const contractId = String(input.contractId ?? "");
      store.completeContract(contractId);
      return { ok: true };
    }
    case "addDailyTask": {
      const text = String(input.text ?? "");
      store.addDailyTask(text);
      return { ok: true, message: `To-do "${text}" hinzugefügt.` };
    }
    case "logEarning": {
      const amount = Number(input.amount ?? 0);
      const source = String(input.source ?? "");
      store.logEarning(amount, source);
      return { ok: true, message: `${amount}€ von "${source}" geloggt.` };
    }
    case "addRoadmapItem": {
      const title = String(input.title ?? "");
      store.addRoadmapItem(title);
      return { ok: true };
    }
    case "updateRoadmapStatus": {
      const itemId = String(input.itemId ?? "");
      const status = String(input.status ?? "ACTIVE") as "LOCKED" | "ACTIVE" | "DONE";
      store.updateRoadmapStatus(itemId, status);
      return { ok: true };
    }
    case "updateSkill": {
      const skillId = String(input.skillId ?? "");
      const level = Number(input.level ?? 0);
      store.setSkillLevel(skillId, level);
      return { ok: true };
    }
    case "getEmpireStatus": {
      return store.getEmpireStatus();
    }
    case "getEarningsSummary": {
      const period = String(input.period ?? "month") as "week" | "month" | "all";
      return store.getEarningsSummary(period);
    }
    default:
      return { ok: false, error: `Unbekanntes Tool: ${name}` };
  }
}

/** Every tool JARVIS can call: empire mechanics, athlete database, memory. */
export const ALL_TOOL_DEFINITIONS = [
  ...TOOL_DEFINITIONS,
  ...ATHLETE_TOOL_DEFINITIONS,
  ...MEMORY_TOOL_DEFINITIONS,
];

/**
 * Single dispatch point. Athlete and memory tools hit persistent storage and
 * are therefore async, so the whole surface is async even though the empire
 * tools resolve immediately.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  store: Store
): Promise<unknown> {
  if (ATHLETE_TOOL_NAMES.has(name)) {
    return executeAthleteTool(name, input);
  }
  if (MEMORY_TOOL_NAMES.has(name)) {
    return executeMemoryTool(name, input);
  }
  return executeEmpireTool(name, input, store);
}
