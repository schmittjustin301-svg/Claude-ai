import { create } from "zustand";
import {
  buildGraphFromLocal,
  buildGraphFromVault,
  type BrainGraph,
  type BrainNode,
} from "../lib/brain/graph";
import { useAthleteStore } from "./athleteStore";
import { useShowStore } from "./showStore";
import { useClipStore } from "./clipStore";
import { useEmpireStore } from "./empireStore";

interface BrainStore {
  graph: BrainGraph | null;
  loading: boolean;
  error: string | null;
  /** Nodes the assistant referenced in its last answer, highlighted in the graph. */
  highlighted: string[];
  selected: BrainNode | null;

  rebuild(): Promise<void>;
  setHighlighted(ids: string[]): void;
  select(node: BrainNode | null): void;
}

export const useBrainStore = create<BrainStore>((set) => ({
  graph: null,
  loading: false,
  error: null,
  highlighted: [],
  selected: null,

  async rebuild() {
    set({ loading: true, error: null });
    try {
      // The vault is the real source — its wikilinks are the edges.
      const fromVault = await buildGraphFromVault();
      if (fromVault) {
        set({ graph: fromVault, loading: false });
        return;
      }

      // Vault closed or empty: fall back to what the app itself knows, so the
      // Brain is never a blank screen.
      //
      // These stores are lazily filled by their own screens, so opening Brain
      // first would otherwise read empty ones and render a graph with no
      // athletes and no edges. Load them here rather than depending on
      // navigation order.
      await Promise.all([
        useAthleteStore.getState().load(),
        useShowStore.getState().load(),
        useClipStore.getState().load(),
      ]);

      const athletes = useAthleteStore.getState().athletes;
      const { shows, posts } = useShowStore.getState();
      const clips = useClipStore.getState().clips;
      const empire = useEmpireStore.getState();

      const nameById = new Map(athletes.map((a) => [a.id, a.full_name]));

      set({
        graph: buildGraphFromLocal({
          athletes: athletes.map((a) => ({
            name: a.full_name,
            division: a.division,
            country: a.country,
            coach: a.coach,
          })),
          shows: shows.map((s) => ({ name: s.name })),
          posts: posts.map((p) => ({
            headline: p.headline || "Post",
            athleteNames: p.athlete_ids.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n)),
            showName: p.show_id ? (shows.find((s) => s.id === p.show_id)?.name ?? null) : null,
          })),
          clips: clips.map((c) => ({ label: c.label, athleteName: c.athlete_name })),
          goals: empire.roadmapItems.map((r) => r.title),
          business: [
            ...empire.channels.map((c) => ({ label: c.name, detail: "Kanal" })),
            ...(empire.earnings.length
              ? [
                  {
                    label: "Einnahmen",
                    detail: `${empire.earnings.reduce((s, e) => s + e.amount, 0).toFixed(0)} €`,
                  },
                ]
              : []),
          ],
        }),
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Graph konnte nicht gebaut werden." });
    }
  },

  setHighlighted(ids) {
    set({ highlighted: ids });
  },

  select(node) {
    set({ selected: node });
  },
}));
