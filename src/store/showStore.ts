import { create } from "zustand";
import {
  deletePost as dbDeletePost,
  deleteShow as dbDeleteShow,
  getAllPosts,
  getAllShows,
  putPost,
  putShow,
} from "../lib/athletes/athleteDb";
import { emptyShow, POST_TYPE_LABEL, type Post, type Show, type ShowRef } from "../lib/athletes/postTypes";
import { vault } from "./vaultStore";
import { postNote, showNote, VAULT_PATHS } from "../lib/vault/vaultNotes";
import { getAllAthletes } from "../lib/athletes/athleteDb";

interface ShowStore {
  shows: ShowRef[];
  posts: Post[];
  loaded: boolean;

  load(): Promise<void>;
  saveShow(show: Show): Promise<void>;
  createShow(name: string): Promise<Show>;
  deleteShow(id: string): Promise<void>;
  setShowLogo(id: string, file: File, glow: boolean): Promise<void>;

  savePost(post: Post): Promise<void>;
  deletePost(id: string): Promise<void>;
}

/** Object URLs are minted per load and revoked when the set is replaced. */
function toRefs(shows: Show[], previous: ShowRef[]): ShowRef[] {
  previous.forEach((r) => {
    if (r.logo_url) URL.revokeObjectURL(r.logo_url);
    if (r.logo_glow_url) URL.revokeObjectURL(r.logo_glow_url);
  });
  return shows.map(({ logo, logo_glow, ...rest }) => ({
    ...rest,
    logo_url: logo ? URL.createObjectURL(logo) : null,
    logo_glow_url: logo_glow ? URL.createObjectURL(logo_glow) : null,
  }));
}

export const useShowStore = create<ShowStore>((set, get) => ({
  shows: [],
  posts: [],
  loaded: false,

  async load() {
    const [shows, posts] = await Promise.all([getAllShows(), getAllPosts()]);
    set({ shows: toRefs(shows, get().shows), posts, loaded: true });
  },

  async saveShow(show) {
    await putShow(show);
    set({ shows: toRefs(await getAllShows(), get().shows) });
    vault.note(VAULT_PATHS.show(show.name), showNote(show.name, show.year, show.location), `Show: ${show.name}`);
  },

  async createShow(name) {
    const show = emptyShow(name);
    await putShow(show);
    set({ shows: toRefs(await getAllShows(), get().shows) });
    vault.note(VAULT_PATHS.show(name), showNote(name, show.year, show.location), `Show: ${name}`);
    return show;
  },

  async deleteShow(id) {
    await dbDeleteShow(id);
    set({ shows: toRefs(await getAllShows(), get().shows) });
  },

  async setShowLogo(id, file, glow) {
    const all = await getAllShows();
    const show = all.find((s) => s.id === id);
    if (!show) return;
    await putShow({ ...show, [glow ? "logo_glow" : "logo"]: file });
    set({ shows: toRefs(await getAllShows(), get().shows) });
  },

  async savePost(post) {
    await putPost({ ...post, updated_at: new Date().toISOString() });
    set({ posts: await getAllPosts() });

    // The wikilinks written here become edges in the Brain graph, so names are
    // resolved to real athletes rather than stored as bare ids.
    const athletes = await getAllAthletes();
    const names = post.athlete_ids
      .map((id) => athletes.find((a) => a.id === id)?.full_name)
      .filter((n): n is string => Boolean(n));
    const showName = post.show_id ? get().shows.find((s) => s.id === post.show_id)?.name ?? null : null;
    const slug = `${new Date().toISOString().slice(0, 10)}-${(post.headline || "post").toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;

    vault.note(
      VAULT_PATHS.post(slug),
      postNote({
        slug,
        headline: post.headline,
        subtitle: post.subtitle,
        postType: POST_TYPE_LABEL[post.type],
        athletes: names,
        show: showName,
        format: post.format_id,
        template: post.template_id,
      }),
      `Post: ${post.headline || slug}`
    );
  },

  async deletePost(id) {
    await dbDeletePost(id);
    set({ posts: await getAllPosts() });
  },
}));
