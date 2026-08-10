import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../api/client";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count?: { clips: number; combinations: number; generatedVideos: number };
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  loading: boolean;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  selectProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,
      loading: false,
      fetchProjects: async () => {
        set({ loading: true });
        try {
          const { projects } = await api.get<{ projects: Project[] }>("/projects");
          set({ projects, loading: false });
          const current = get().selectedProjectId;
          if (!current && projects.length > 0) {
            set({ selectedProjectId: projects[0].id });
          }
        } catch {
          set({ loading: false });
        }
      },
      createProject: async (name, description) => {
        const { project } = await api.post<{ project: Project }>("/projects", { name, description });
        set((s) => ({ projects: [project, ...s.projects], selectedProjectId: project.id }));
        return project;
      },
      selectProject: (id) => set({ selectedProjectId: id }),
    }),
    { name: "cf-project", partialize: (s) => ({ selectedProjectId: s.selectedProjectId }) },
  ),
);
