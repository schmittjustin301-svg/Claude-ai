import { create } from "zustand";
import {
  deletePost as dbDeletePost,
  deleteShow as dbDeleteShow,
  getAllPosts,
  getAllShows,
  putPost,
  putShow,
} from "../lib/athletes/athleteDb";
import { emptyShow, type Post, type Show, type ShowRef } from "../lib/athletes/postTypes";

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
  },

  async createShow(name) {
    const show = emptyShow(name);
    await putShow(show);
    set({ shows: toRefs(await getAllShows(), get().shows) });
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
  },

  async deletePost(id) {
    await dbDeletePost(id);
    set({ posts: await getAllPosts() });
  },
}));
