import { create } from "zustand";
import {
  captureFrame,
  deleteClip as dbDeleteClip,
  deleteVideo as dbDeleteVideo,
  getAllClips,
  getAllVideos,
  putClip,
  putVideo,
  readVideoMeta,
  toClipRefs,
  toVideoRefs,
} from "../lib/cliplab/clipDb";
import type { Clip, ClipRef, SourceVideoRef } from "../lib/cliplab/clipTypes";
import {
  blobToBase64,
  fetchStatus,
  formatFromMime,
  submitGeneration,
  TERMINAL_STATUSES,
  type DoPModel,
} from "../lib/higgsfield/higgsfieldClient";

interface ClipStore {
  videos: SourceVideoRef[];
  clips: ClipRef[];
  loaded: boolean;

  load(): Promise<void>;
  addVideo(file: File): Promise<void>;
  removeVideo(id: string): Promise<void>;

  addClip(params: {
    sourceVideoId: string;
    start: number;
    end: number;
    label: string;
    athleteId?: string | null;
    athleteName?: string | null;
  }): Promise<void>;
  removeClip(id: string): Promise<void>;

  /** Sends a clip's representative frame to Higgsfield and tracks the job. */
  processClip(id: string, prompt: string, model: DoPModel): Promise<void>;
  resumeProcessing(): void;
}

const activePolls = new Set<string>();

export const useClipStore = create<ClipStore>((set, get) => {
  async function refresh() {
    const [videos, clips] = await Promise.all([getAllVideos(), getAllClips()]);
    set({ videos: toVideoRefs(videos, get().videos), clips: toClipRefs(clips, get().clips), loaded: true });
  }

  async function patch(id: string, changes: Partial<Clip>) {
    const stored = (await getAllClips()).find((c) => c.id === id);
    if (!stored) return;
    await putClip({ ...stored, ...changes });
    await refresh();
  }

  /** Polls one Higgsfield job to a terminal state. */
  async function watch(id: string) {
    if (activePolls.has(id)) return;
    activePolls.add(id);
    let delay = 4000;
    const started = Date.now();

    try {
      for (;;) {
        const clip = get().clips.find((c) => c.id === id);
        if (!clip?.higgsfield_status_url || clip.status === "done" || clip.status === "failed") return;

        if (Date.now() - started > 20 * 60 * 1000) {
          await patch(id, { status: "failed", error: "Zeitüberschreitung bei Higgsfield." });
          return;
        }

        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 1.3, 15000);

        try {
          const result = await fetchStatus(clip.higgsfield_status_url);
          if (TERMINAL_STATUSES.includes(result.status)) {
            await patch(id, {
              status: result.status === "completed" ? "done" : "failed",
              processed_url: result.video_url,
              error:
                result.status === "nsfw"
                  ? "Von Higgsfield abgelehnt (NSFW-Filter)."
                  : result.status === "failed"
                    ? "Generierung fehlgeschlagen."
                    : null,
            });
            return;
          }
          if (clip.status !== "processing" && result.status === "in_progress") {
            await patch(id, { status: "processing" });
          }
        } catch (err) {
          // Transient failures are tolerated; the timeout above is the backstop.
          if (err instanceof Error && /Zugangscode/.test(err.message)) {
            await patch(id, { status: "failed", error: err.message });
            return;
          }
        }
      }
    } finally {
      activePolls.delete(id);
    }
  }

  return {
    videos: [],
    clips: [],
    loaded: false,

    async load() {
      await refresh();
      get().resumeProcessing();
    },

    async addVideo(file) {
      const meta = await readVideoMeta(file);
      await putVideo({
        id: crypto.randomUUID(),
        name: file.name,
        blob: file,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        created_at: new Date().toISOString(),
      });
      await refresh();
    },

    async removeVideo(id) {
      await dbDeleteVideo(id);
      await refresh();
    },

    async addClip({ sourceVideoId, start, end, label, athleteId, athleteName }) {
      const video = get().videos.find((v) => v.id === sourceVideoId);
      // A poster frame from the middle of the segment represents it best.
      let poster: Blob | null = null;
      if (video) {
        try {
          poster = await captureFrame(video.url, (start + end) / 2);
        } catch {
          // A missing thumbnail is cosmetic; the clip is still valid.
        }
      }

      await putClip({
        id: crypto.randomUUID(),
        source_video_id: sourceVideoId,
        athlete_id: athleteId ?? null,
        athlete_name: athleteName ?? null,
        label,
        start_time: start,
        end_time: end,
        status: "draft",
        higgsfield_job_id: null,
        higgsfield_status_url: null,
        poster,
        processed_url: null,
        error: null,
        created_at: new Date().toISOString(),
      });
      await refresh();
    },

    async removeClip(id) {
      await dbDeleteClip(id);
      await refresh();
    },

    async processClip(id, prompt, model) {
      const stored = (await getAllClips()).find((c) => c.id === id);
      if (!stored) return;
      if (!stored.poster) {
        await patch(id, { status: "failed", error: "Kein Frame für diesen Clip vorhanden." });
        return;
      }

      await patch(id, { status: "queued", error: null, processed_url: null });

      try {
        const submitted = await submitGeneration({
          imageBase64: await blobToBase64(stored.poster),
          format: formatFromMime(stored.poster.type),
          prompt,
          model,
        });
        await patch(id, {
          higgsfield_job_id: submitted.request_id,
          higgsfield_status_url: submitted.status_url,
          status: "processing",
        });
        void watch(id);
      } catch (err) {
        await patch(id, { status: "failed", error: err instanceof Error ? err.message : "Start fehlgeschlagen." });
      }
    },

    resumeProcessing() {
      for (const clip of get().clips) {
        if ((clip.status === "queued" || clip.status === "processing") && clip.higgsfield_status_url) {
          void watch(clip.id);
        }
      }
    },
  };
});
