// Athlete database model. Kept deliberately close to a relational shape so it
// can move to Supabase later: `athletes` and `athlete_images` are separate
// stores, images referenced by athlete_id rather than embedded.

export const IMAGE_CATEGORIES = [
  "portrait",
  "stage",
  "front_pose",
  "side_pose",
  "back_pose",
  "progress",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export const IMAGE_CATEGORY_LABEL: Record<ImageCategory, string> = {
  portrait: "Portrait",
  stage: "Stage Photo",
  front_pose: "Front Pose",
  side_pose: "Side Pose",
  back_pose: "Back Pose",
  progress: "Progress Photo",
};

export type OlympiaStatus = "qualified" | "pending" | "not_qualified" | "unknown";

export const OLYMPIA_STATUS_LABEL: Record<OlympiaStatus, string> = {
  qualified: "Qualified",
  pending: "Pending",
  not_qualified: "Not Qualified",
  unknown: "Unknown",
};

export interface SocialLinks {
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  x?: string;
  website?: string;
}

export interface Athlete {
  id: string;
  full_name: string;
  nickname?: string;
  division?: string;
  country?: string;
  team?: string;
  coach?: string;
  olympia_status: OlympiaStatus;
  height?: string;
  weight?: string;
  socials: SocialLinks;
  notes?: string;
  season?: string;
  sponsors: string[];
  /** Free-form tags — the extension point for future data without migrations. */
  tags: string[];
  /**
   * Open-ended slot for the "future expansion" fields (competition history,
   * placings, scores, rankings…) so they can be captured before each one gets
   * a dedicated typed column.
   */
  extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AthleteImage {
  id: string;
  athlete_id: string;
  category: ImageCategory;
  /** Stored as a Blob in IndexedDB — never base64 in localStorage. */
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  created_at: string;
}

/** An image joined with a live object URL for rendering. */
export interface AthleteImageRef extends Omit<AthleteImage, "blob"> {
  url: string;
}

export function emptyAthlete(fullName: string): Athlete {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    full_name: fullName,
    olympia_status: "unknown",
    socials: {},
    sponsors: [],
    tags: [],
    extra: {},
    created_at: now,
    updated_at: now,
  };
}

/** Fields a caller (UI or Jarvis) may set when creating/updating an athlete. */
export type AthleteInput = Partial<Omit<Athlete, "id" | "created_at" | "updated_at">> & {
  full_name: string;
};
