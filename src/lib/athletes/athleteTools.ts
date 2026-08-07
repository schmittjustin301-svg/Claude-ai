// Athlete-database tools exposed to JARVIS.
//
// The uploaded image never round-trips through the model's tool results (far
// too large). Instead the app holds attachments in a pending buffer; the model
// decides *which* athlete and *which* category, and saveUploadedImage moves
// the bytes from that buffer into IndexedDB client-side.

import { getAllAthletes } from "./athleteDb";
import { attachImage, findDuplicate, upsertAthlete } from "./repository";
import { searchAthletes } from "./search";
import { IMAGE_CATEGORIES, type AthleteInput, type ImageCategory, type OlympiaStatus } from "./types";

/** Images attached to the current chat message, awaiting a tool call. */
export interface PendingUpload {
  id: string;
  file: File;
  previewUrl: string;
}

let pendingUploads: PendingUpload[] = [];

export function setPendingUploads(uploads: PendingUpload[]): void {
  pendingUploads = uploads;
}

export function getPendingUploads(): PendingUpload[] {
  return pendingUploads;
}

export function clearPendingUploads(): void {
  pendingUploads = [];
}

export const ATHLETE_TOOL_DEFINITIONS = [
  {
    name: "searchAthleteDatabase",
    description:
      "Sucht Athleten in der Datenbank (tippfehlertolerant). Immer zuerst aufrufen, bevor ein neues Profil angelegt wird, um Duplikate zu vermeiden.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Gesuchter Athletenname" } },
      required: ["name"],
    },
  },
  {
    name: "listAthletes",
    description: "Listet alle gespeicherten Athleten mit ihren Kerndaten auf.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "upsertAthlete",
    description:
      "Legt ein Athletenprofil an oder ergänzt ein bestehendes. Bestehende Werte werden nie überschrieben, nur fehlende ergänzt. Erkennt Duplikate automatisch anhand des Namens.",
    input_schema: {
      type: "object",
      properties: {
        full_name: { type: "string" },
        nickname: { type: "string" },
        division: { type: "string", description: "z.B. Fitness, Bikini, Wellness, Figure, Womens Physique" },
        country: { type: "string", description: "Land im Klartext, z.B. USA, Germany" },
        team: { type: "string" },
        coach: { type: "string" },
        olympia_status: { type: "string", enum: ["qualified", "pending", "not_qualified", "unknown"] },
        height: { type: "string" },
        weight: { type: "string" },
        season: { type: "string" },
        notes: { type: "string" },
        sponsors: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        instagram: { type: "string" },
        youtube: { type: "string" },
      },
      required: ["full_name"],
    },
  },
  {
    name: "saveUploadedImage",
    description:
      "Speichert ein vom Nutzer in diesem Chat hochgeladenes Bild beim angegebenen Athleten. uploadIndex ist die Position des Bildes in der Nachricht (0 = erstes Bild). Die Kategorie anhand des Bildinhalts wählen.",
    input_schema: {
      type: "object",
      properties: {
        athleteName: { type: "string", description: "Name des Athleten, zu dem das Bild gehört" },
        uploadIndex: { type: "number", description: "Index des hochgeladenen Bildes, beginnend bei 0" },
        category: {
          type: "string",
          enum: [...IMAGE_CATEGORIES],
          description:
            "portrait = Kopf/Oberkörper, stage = Bühnenfoto, front_pose/side_pose/back_pose = Posing-Richtung, progress = Vergleichsfoto",
        },
      },
      required: ["athleteName", "uploadIndex", "category"],
    },
  },
] as const;

export async function executeAthleteTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "searchAthleteDatabase": {
      const query = String(input.name ?? "");
      const all = await getAllAthletes();
      const matches = searchAthletes(query, all, 5, 0.4);
      return {
        found: matches.length > 0,
        matches: matches.map((m) => ({
          id: m.athlete.id,
          full_name: m.athlete.full_name,
          division: m.athlete.division,
          country: m.athlete.country,
          coach: m.athlete.coach,
          confidence: Math.round(m.score * 100),
        })),
      };
    }

    case "listAthletes": {
      const all = await getAllAthletes();
      return {
        count: all.length,
        athletes: all.map((a) => ({
          full_name: a.full_name,
          division: a.division,
          country: a.country,
          coach: a.coach,
          olympia_status: a.olympia_status,
        })),
      };
    }

    case "upsertAthlete": {
      const payload: AthleteInput = {
        full_name: String(input.full_name ?? "").trim(),
        nickname: str(input.nickname),
        division: str(input.division),
        country: str(input.country),
        team: str(input.team),
        coach: str(input.coach),
        olympia_status: (str(input.olympia_status) as OlympiaStatus) || undefined,
        height: str(input.height),
        weight: str(input.weight),
        season: str(input.season),
        notes: str(input.notes),
        sponsors: Array.isArray(input.sponsors) ? input.sponsors.map(String) : undefined,
        tags: Array.isArray(input.tags) ? input.tags.map(String) : undefined,
        socials: {
          instagram: str(input.instagram),
          youtube: str(input.youtube),
        },
      };
      if (!payload.full_name) return { ok: false, error: "full_name fehlt." };

      const result = await upsertAthlete(payload);
      return {
        ok: true,
        created: result.created,
        athlete_id: result.athlete.id,
        message: result.created
          ? `Profil für ${result.athlete.full_name} angelegt.`
          : `Bestehendes Profil ${result.mergedInto} ergänzt (kein Duplikat angelegt).`,
      };
    }

    case "saveUploadedImage": {
      const athleteName = String(input.athleteName ?? "").trim();
      const index = Number(input.uploadIndex ?? 0);
      const category = String(input.category ?? "portrait") as ImageCategory;

      const upload = pendingUploads[index];
      if (!upload) {
        return { ok: false, error: `Kein hochgeladenes Bild an Position ${index}. Verfügbar: ${pendingUploads.length}.` };
      }
      if (!IMAGE_CATEGORIES.includes(category)) {
        return { ok: false, error: `Unbekannte Kategorie "${category}".` };
      }

      // Guarantee a profile exists, reusing one when the name already matches.
      const { existing } = await findDuplicate(athleteName);
      const athlete = existing ?? (await upsertAthlete({ full_name: athleteName })).athlete;

      await attachImage(athlete.id, upload.file, category, upload.file.name);
      return {
        ok: true,
        message: `Bild als "${category}" bei ${athlete.full_name} gespeichert.`,
        athlete_id: athlete.id,
      };
    }

    default:
      return { ok: false, error: `Unbekanntes Athleten-Tool: ${name}` };
  }
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export const ATHLETE_TOOL_NAMES = new Set(ATHLETE_TOOL_DEFINITIONS.map((t) => t.name as string));
