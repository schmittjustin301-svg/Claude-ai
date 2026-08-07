import { create } from "zustand";
import {
  deleteTemplate as dbDeleteTemplate,
  getAllAthletes,
  getAllTemplates,
  getImageRefs,
  deleteImage,
  putTemplate,
} from "../lib/athletes/athleteDb";
import {
  attachImage,
  findDuplicate,
  removeAthlete,
  updateAthleteById,
  upsertAthlete,
  type UpsertResult,
} from "../lib/athletes/repository";
import { DEFAULT_TEMPLATES, type CardTemplate } from "../lib/athletes/templates";
import type { Athlete, AthleteImageRef, AthleteInput, ImageCategory } from "../lib/athletes/types";

interface AthleteStore {
  athletes: Athlete[];
  templates: CardTemplate[];
  imagesByAthlete: Record<string, AthleteImageRef[]>;
  loading: boolean;
  loaded: boolean;

  load(): Promise<void>;
  refreshAthletes(): Promise<void>;
  loadImages(athleteId: string): Promise<AthleteImageRef[]>;

  saveAthlete(input: AthleteInput): Promise<UpsertResult>;
  editAthlete(id: string, input: AthleteInput): Promise<void>;
  deleteAthlete(id: string): Promise<void>;
  checkDuplicate(name: string): Promise<Athlete | null>;

  addImage(athleteId: string, file: File, category: ImageCategory): Promise<void>;
  removeImage(athleteId: string, imageId: string): Promise<void>;

  saveTemplate(template: CardTemplate): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
}

export const useAthleteStore = create<AthleteStore>((set, get) => ({
  athletes: [],
  templates: DEFAULT_TEMPLATES,
  imagesByAthlete: {},
  loading: false,
  loaded: false,

  async load() {
    if (get().loading || get().loaded) return;
    set({ loading: true });
    try {
      const [athletes, stored] = await Promise.all([getAllAthletes(), getAllTemplates()]);
      // Built-in templates are always available; stored ones override by id.
      const merged = [...DEFAULT_TEMPLATES];
      for (const t of stored) {
        const i = merged.findIndex((m) => m.id === t.id);
        if (i >= 0) merged[i] = t;
        else merged.push(t);
      }
      set({ athletes, templates: merged, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  async refreshAthletes() {
    set({ athletes: await getAllAthletes() });
  },

  async loadImages(athleteId) {
    const refs = await getImageRefs(athleteId);
    set((s) => ({ imagesByAthlete: { ...s.imagesByAthlete, [athleteId]: refs } }));
    return refs;
  },

  async saveAthlete(input) {
    const result = await upsertAthlete(input);
    await get().refreshAthletes();
    return result;
  },

  async editAthlete(id, input) {
    await updateAthleteById(id, input);
    await get().refreshAthletes();
  },

  async deleteAthlete(id) {
    await removeAthlete(id);
    set((s) => {
      const next = { ...s.imagesByAthlete };
      delete next[id];
      return { imagesByAthlete: next };
    });
    await get().refreshAthletes();
  },

  async checkDuplicate(name) {
    const { existing } = await findDuplicate(name, get().athletes);
    return existing;
  },

  async addImage(athleteId, file, category) {
    await attachImage(athleteId, file, category, file.name);
    await get().loadImages(athleteId);
  },

  async removeImage(athleteId, imageId) {
    await deleteImage(imageId);
    await get().loadImages(athleteId);
  },

  async saveTemplate(template) {
    await putTemplate(template);
    set((s) => {
      const i = s.templates.findIndex((t) => t.id === template.id);
      const next = [...s.templates];
      if (i >= 0) next[i] = template;
      else next.push(template);
      return { templates: next };
    });
  },

  async deleteTemplate(id) {
    await dbDeleteTemplate(id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },
}));
