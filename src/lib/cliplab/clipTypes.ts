// Source videos and the highlight clips cut out of them.
//
// A clip is a *reference* into its source (start/end seconds), not a re-encoded
// copy. Cutting real video in the browser needs either ffmpeg.wasm (a ~30MB
// download) or realtime MediaRecorder capture that re-encodes and loses
// quality. Storing in/out points keeps the original pristine — which the brief
// requires anyway — and makes marking instant.

export type ClipStatus = "draft" | "queued" | "processing" | "done" | "failed";

export const CLIP_STATUS_LABEL: Record<ClipStatus, string> = {
  draft: "ENTWURF",
  queued: "QUEUED",
  processing: "PROCESSING",
  done: "DONE",
  failed: "FAILED",
};

export interface SourceVideo {
  id: string;
  name: string;
  blob: Blob;
  duration: number;
  width: number;
  height: number;
  created_at: string;
}

export interface SourceVideoRef extends Omit<SourceVideo, "blob"> {
  url: string;
}

export interface Clip {
  id: string;
  source_video_id: string;
  /** Optional — a clip may belong to an athlete, but does not have to. */
  athlete_id: string | null;
  athlete_name: string | null;
  label: string;
  start_time: number;
  end_time: number;
  status: ClipStatus;
  /** Higgsfield request id, once the clip has been sent for generation. */
  higgsfield_job_id: string | null;
  higgsfield_status_url: string | null;
  /** Frame exported from the segment and used as the generation input. */
  poster: Blob | null;
  processed_url: string | null;
  error: string | null;
  created_at: string;
}

export interface ClipRef extends Omit<Clip, "poster"> {
  poster_url: string | null;
}

export function clipDuration(clip: Pick<Clip, "start_time" | "end_time">): number {
  return Math.max(0, clip.end_time - clip.start_time);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
