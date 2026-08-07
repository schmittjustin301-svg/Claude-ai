// Video-generation tools for JARVIS.
//
// Submitting is deliberately non-blocking: a DoP generation takes minutes,
// far longer than a chat turn should wait. The tool starts the job and returns,
// the app keeps polling in the background, and the user is told when it lands.

import { useVideoJobStore } from "../../store/videoJobStore";
import { findAthleteByName } from "../athletes/repository";
import { fetchMotions, type DoPModel } from "./higgsfieldClient";
import { isPending } from "./videoJobs";

export const VIDEO_TOOL_DEFINITIONS = [
  {
    name: "generateAthleteVideo",
    description:
      "Startet eine Videogenerierung aus einem gespeicherten Athletenfoto (Higgsfield DoP). Läuft im Hintergrund und dauert einige Minuten — der Aufruf kommt sofort zurück, das fertige Video erscheint danach im Video-Tab. Jede Generierung kostet Guthaben, also nur auf ausdrücklichen Wunsch aufrufen und bei Unklarheit vorher nachfragen.",
    input_schema: {
      type: "object",
      properties: {
        athleteName: { type: "string", description: "Name des Athleten aus der Datenbank" },
        prompt: {
          type: "string",
          description:
            "Beschreibung der Kamerabewegung und Stimmung auf Englisch, z.B. 'Cinematic slow push-in, dramatic stage lighting'",
        },
        model: {
          type: "string",
          enum: ["dop-lite", "dop-turbo", "dop-standard"],
          description: "dop-lite = schnell/günstig, dop-turbo = Standard, dop-standard = beste Qualität",
        },
        motionName: {
          type: "string",
          description: "Optionaler Name einer Kamerafahrt, z.B. 'Zoom In'. Wird gegen die verfügbaren Presets gematcht.",
        },
      },
      required: ["athleteName", "prompt"],
    },
  },
  {
    name: "listVideoJobs",
    description:
      "Zeigt laufende und kürzlich fertiggestellte Videogenerierungen mit Status. Nutze das, wenn der Nutzer fragt, ob sein Video fertig ist.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

export const VIDEO_TOOL_NAMES = new Set(VIDEO_TOOL_DEFINITIONS.map((t) => t.name as string));

export async function executeVideoTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "generateAthleteVideo": {
      const athleteName = String(input.athleteName ?? "").trim();
      const prompt = String(input.prompt ?? "").trim();
      if (!athleteName) return { ok: false, error: "athleteName fehlt." };
      if (!prompt) return { ok: false, error: "prompt fehlt." };

      const athlete = await findAthleteByName(athleteName);
      if (!athlete) {
        return { ok: false, error: `Kein Athlet namens "${athleteName}" in der Datenbank.` };
      }

      const rawModel = String(input.model ?? "dop-turbo");
      const model = (["dop-lite", "dop-turbo", "dop-standard"].includes(rawModel) ? rawModel : "dop-turbo") as DoPModel;

      // Motion presets are account-specific; resolve the spoken name to an id.
      let motionId: string | null = null;
      const motionName = String(input.motionName ?? "").trim();
      if (motionName) {
        try {
          const motions = await fetchMotions();
          const match =
            motions.find((m) => m.name.toLowerCase() === motionName.toLowerCase()) ??
            motions.find((m) => m.name.toLowerCase().includes(motionName.toLowerCase()));
          motionId = match?.id ?? null;
        } catch {
          // Presets unavailable — the prompt alone still produces a clip.
        }
      }

      try {
        const job = await useVideoJobStore.getState().start({
          athleteId: athlete.id,
          athleteName: athlete.full_name,
          prompt,
          model,
          motionId,
          source: "jarvis",
        });
        return {
          ok: true,
          job_id: job.id,
          status: job.status,
          message: `Generierung für ${athlete.full_name} gestartet (${model}). Dauert ein paar Minuten und läuft im Hintergrund weiter.`,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Start fehlgeschlagen." };
      }
    }

    case "listVideoJobs": {
      const jobs = useVideoJobStore.getState().jobs.slice(0, 10);
      return {
        count: jobs.length,
        jobs: jobs.map((j) => ({
          athlete: j.athlete_name,
          status: j.status,
          running: isPending(j),
          prompt: j.prompt,
          has_video: Boolean(j.video_url),
          error: j.error,
          started_at: j.created_at,
        })),
      };
    }

    default:
      return { ok: false, error: `Unbekanntes Video-Tool: ${name}` };
  }
}
