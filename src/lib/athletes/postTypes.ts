// Shows and saved posts.
//
// Posts are persisted so they stay editable later — the previous Studio
// generated a graphic and forgot it the moment you navigated away.

export interface Show {
  id: string;
  name: string;
  /** Transparent PNG. Stored as a blob for the same reason athlete photos are. */
  logo: Blob | null;
  /** Optional pre-glowed variant; the renderer never fakes a 3D effect. */
  logo_glow: Blob | null;
  year: string;
  location: string;
  created_at: string;
}

export interface ShowRef extends Omit<Show, "logo" | "logo_glow"> {
  logo_url: string | null;
  logo_glow_url: string | null;
}

export type PostType = "athlete_list" | "show_lineup";

export const POST_TYPE_LABEL: Record<PostType, string> = {
  athlete_list: "Athleten-Post",
  show_lineup: "Show-Lineup",
};

export interface Post {
  id: string;
  type: PostType;
  athlete_ids: string[];
  headline: string;
  subtitle: string;
  show_id: string | null;
  template_id: string;
  format_id: string;
  show_coach: boolean;
  show_status: boolean;
  /** Rendered result, kept so a saved post can be previewed without re-rendering. */
  image: Blob | null;
  created_at: string;
  updated_at: string;
}

export function emptyShow(name: string): Show {
  return {
    id: crypto.randomUUID(),
    name,
    logo: null,
    logo_glow: null,
    year: "",
    location: "",
    created_at: new Date().toISOString(),
  };
}

export function emptyPost(): Post {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type: "athlete_list",
    athlete_ids: [],
    headline: "",
    subtitle: "",
    show_id: null,
    template_id: "full-access-weekly",
    format_id: "instagram-feed",
    show_coach: true,
    show_status: false,
    image: null,
    created_at: now,
    updated_at: now,
  };
}
