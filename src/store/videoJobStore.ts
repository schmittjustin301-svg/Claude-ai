import { create } from "zustand";
import {
  blobToBase64,
  fetchStatus,
  formatFromMime,
  submitGeneration,
  TERMINAL_STATUSES,
  type DoPModel,
} from "../lib/higgsfield/higgsfieldClient";
import { isPending, isStale, loadJobs, saveJobs, type VideoJob } from "../lib/higgsfield/videoJobs";
import { getImagesForAthlete, pickPrimaryImage, getImageRefs } from "../lib/athletes/athleteDb";

interface VideoJobStore {
  jobs: VideoJob[];
  load(): void;
  /** Starts a generation and returns immediately; polling continues in the background. */
  start(params: {
    athleteId: string;
    athleteName: string;
    imageId?: string;
    prompt: string;
    model: DoPModel;
    motionId?: string | null;
    source: "ui" | "jarvis";
  }): Promise<VideoJob>;
  markNotified(id: string): void;
  remove(id: string): void;
  resumeAll(): void;
}

/** Guards against two pollers watching the same job after a remount. */
const activePolls = new Set<string>();

export const useVideoJobStore = create<VideoJobStore>((set, get) => {
  function persist(jobs: VideoJob[]) {
    saveJobs(jobs);
    set({ jobs });
  }

  function update(id: string, changes: Partial<VideoJob>) {
    const jobs = get().jobs.map((j) => (j.id === id ? { ...j, ...changes } : j));
    persist(jobs);
  }

  /** Polls one job to a terminal state, widening the interval as it goes. */
  async function watch(id: string) {
    if (activePolls.has(id)) return;
    activePolls.add(id);
    let delay = 4000;

    try {
      for (;;) {
        const job = get().jobs.find((j) => j.id === id);
        if (!job || !isPending(job)) return;

        if (isStale(job)) {
          update(id, {
            status: "failed",
            error: "Zeitüberschreitung — bei Higgsfield im Konto nachsehen, ob der Clip doch fertig wurde.",
            finished_at: new Date().toISOString(),
          });
          return;
        }

        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 1.3, 15000);

        try {
          const result = await fetchStatus(job.status_url);
          if (TERMINAL_STATUSES.includes(result.status)) {
            update(id, {
              status: result.status,
              video_url: result.video_url,
              error:
                result.status === "nsfw"
                  ? "Von Higgsfield abgelehnt (NSFW-Filter)."
                  : result.status === "failed"
                    ? "Generierung fehlgeschlagen."
                    : null,
              finished_at: new Date().toISOString(),
            });
            return;
          }
          update(id, { status: result.status });
        } catch (err) {
          // A transient network blip should not kill the watch; only give up
          // once the job goes stale above.
          if (err instanceof Error && /Zugangscode/.test(err.message)) {
            update(id, { status: "failed", error: err.message, finished_at: new Date().toISOString() });
            return;
          }
        }
      }
    } finally {
      activePolls.delete(id);
    }
  }

  return {
    jobs: [],

    load() {
      set({ jobs: loadJobs() });
      get().resumeAll();
    },

    async start({ athleteId, athleteName, imageId, prompt, model, motionId, source }) {
      // Pick the requested image, else the athlete's best available one.
      const stored = await getImagesForAthlete(athleteId);
      if (stored.length === 0) throw new Error(`Für ${athleteName} ist kein Bild gespeichert.`);

      let chosen = imageId ? stored.find((i) => i.id === imageId) : undefined;
      if (!chosen) {
        const refs = await getImageRefs(athleteId);
        const primary = pickPrimaryImage(refs);
        chosen = stored.find((i) => i.id === primary?.id) ?? stored[0];
        refs.forEach((r) => URL.revokeObjectURL(r.url));
      }

      const submitted = await submitGeneration({
        imageBase64: await blobToBase64(chosen.blob),
        format: formatFromMime(chosen.blob.type),
        prompt,
        model,
        motions: motionId ? [{ id: motionId, strength: 0.8 }] : undefined,
      });

      const job: VideoJob = {
        id: submitted.request_id || crypto.randomUUID(),
        athlete_id: athleteId,
        athlete_name: athleteName,
        prompt,
        model,
        motion_id: motionId ?? null,
        status: submitted.status,
        status_url: submitted.status_url,
        video_url: null,
        error: null,
        source,
        created_at: new Date().toISOString(),
        finished_at: null,
        notified: false,
      };

      persist([job, ...get().jobs]);
      void watch(job.id);
      return job;
    },

    markNotified(id) {
      update(id, { notified: true });
    },

    remove(id) {
      persist(get().jobs.filter((j) => j.id !== id));
    },

    resumeAll() {
      // Anything still pending after a reload keeps being watched — the
      // generation ran on regardless of the page being open.
      for (const job of get().jobs) {
        if (isPending(job)) void watch(job.id);
      }
    },
  };
});
