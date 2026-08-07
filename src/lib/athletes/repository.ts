// Duplicate-safe write paths. Everything that creates or changes an athlete
// goes through here — the UI and the Jarvis tools share it, which is what
// keeps the database clean without manual editing.

import {
  deleteAthlete as dbDeleteAthlete,
  getAllAthletes,
  getAthlete,
  putAthlete,
  putImage,
  readImageDimensions,
} from "./athleteDb";
import { searchAthletes, similarity } from "./search";
import { emptyAthlete, type Athlete, type AthleteInput, type ImageCategory } from "./types";

/** Above this similarity two names are treated as the same person. */
const DUPLICATE_THRESHOLD = 0.86;

export interface DuplicateCheck {
  existing: Athlete | null;
  score: number;
  /** Close-but-not-certain matches worth confirming before creating a new profile. */
  nearMatches: Athlete[];
}

export async function findDuplicate(fullName: string, athletes?: Athlete[]): Promise<DuplicateCheck> {
  const all = athletes ?? (await getAllAthletes());
  const matches = searchAthletes(fullName, all, 5, 0.6);
  const best = matches[0];
  if (best && best.score >= DUPLICATE_THRESHOLD) {
    return { existing: best.athlete, score: best.score, nearMatches: matches.slice(1).map((m) => m.athlete) };
  }
  return { existing: null, score: best?.score ?? 0, nearMatches: matches.map((m) => m.athlete) };
}

/** Merge rule: incoming values fill gaps, they never blank out existing data. */
function mergeAthlete(existing: Athlete, input: AthleteInput): Athlete {
  const filled = <T>(next: T | undefined, prev: T | undefined): T | undefined => {
    if (next === undefined || next === null) return prev;
    if (typeof next === "string" && next.trim() === "") return prev;
    return next;
  };

  return {
    ...existing,
    // The stored name stays authoritative. A merge means the incoming name only
    // fuzzy-matched this profile, so trusting it would let a typo ("missy
    // truscot") silently rename an established athlete. Renaming is possible
    // through updateAthleteById, which is an explicit edit rather than a match.
    full_name: existing.full_name,
    nickname: filled(input.nickname, existing.nickname),
    division: filled(input.division, existing.division),
    country: filled(input.country, existing.country),
    team: filled(input.team, existing.team),
    coach: filled(input.coach, existing.coach),
    olympia_status:
      input.olympia_status && input.olympia_status !== "unknown" ? input.olympia_status : existing.olympia_status,
    height: filled(input.height, existing.height),
    weight: filled(input.weight, existing.weight),
    season: filled(input.season, existing.season),
    notes: input.notes?.trim()
      ? existing.notes
        ? `${existing.notes}\n${input.notes}`
        : input.notes
      : existing.notes,
    socials: { ...existing.socials, ...stripEmpty(input.socials ?? {}) },
    sponsors: unique([...existing.sponsors, ...(input.sponsors ?? [])]),
    tags: unique([...existing.tags, ...(input.tags ?? [])]),
    extra: { ...existing.extra, ...(input.extra ?? {}) },
    updated_at: new Date().toISOString(),
  };
}

function stripEmpty(obj: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

export interface UpsertResult {
  athlete: Athlete;
  created: boolean;
  mergedInto?: string;
}

/**
 * Creates the athlete, or merges into an existing profile when the name
 * matches closely enough. Never produces a duplicate for a known name.
 */
export async function upsertAthlete(input: AthleteInput): Promise<UpsertResult> {
  const name = input.full_name.trim();
  if (!name) throw new Error("full_name darf nicht leer sein.");

  const { existing } = await findDuplicate(name);
  if (existing) {
    const merged = mergeAthlete(existing, input);
    await putAthlete(merged);
    return { athlete: merged, created: false, mergedInto: existing.full_name };
  }

  const created = mergeAthlete({ ...emptyAthlete(name) }, input);
  await putAthlete(created);
  return { athlete: created, created: true };
}

export async function updateAthleteById(id: string, input: AthleteInput): Promise<Athlete> {
  const existing = await getAthlete(id);
  if (!existing) throw new Error("Athlet nicht gefunden.");
  // Direct edits are authoritative: unlike merges, they may clear fields.
  const updated: Athlete = { ...existing, ...input, id: existing.id, updated_at: new Date().toISOString() };
  await putAthlete(updated);
  return updated;
}

export async function removeAthlete(id: string): Promise<void> {
  await dbDeleteAthlete(id);
}

export async function attachImage(
  athleteId: string,
  blob: Blob,
  category: ImageCategory,
  filename: string
): Promise<void> {
  const { width, height } = await readImageDimensions(blob);
  await putImage({
    id: crypto.randomUUID(),
    athlete_id: athleteId,
    category,
    blob,
    filename,
    width,
    height,
    created_at: new Date().toISOString(),
  });
}

/** Resolves a name to an existing athlete without creating anything. */
export async function findAthleteByName(name: string): Promise<Athlete | null> {
  const all = await getAllAthletes();
  const matches = searchAthletes(name, all, 1, 0.6);
  const best = matches[0];
  if (!best) return null;
  return similarity(name, best.athlete.full_name) >= 0.6 ? best.athlete : null;
}
