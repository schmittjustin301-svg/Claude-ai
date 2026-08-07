// Persistent record of video generations.
//
// A generation outlives the page: it keeps running at Higgsfield whether or not
// the app is open. Storing the status_url means a reload can resume watching a
// job instead of losing a paid generation, which is why these records exist at
// all rather than being component state.
//
// The records are small metadata, so localStorage is the right home — unlike
// athlete images, which needed IndexedDB.

import type { DoPModel, GenerationStatus } from "./higgsfieldClient";

export interface VideoJob {
  id: string;
  athlete_id: string | null;
  athlete_name: string;
  prompt: string;
  model: DoPModel;
  motion_id: string | null;
  status: GenerationStatus;
  status_url: string;
  video_url: string | null;
  error: string | null;
  /** Who started it — lets the UI show what JARVIS kicked off on its own. */
  source: "ui" | "jarvis";
  created_at: string;
  finished_at: string | null;
  /** Set once the user has been told, so a finish is announced only once. */
  notified: boolean;
}

const STORAGE_KEY = "grind-empire-video-jobs-v1";
const MAX_JOBS = 40;

export function loadJobs(): VideoJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VideoJob[]) : [];
  } catch {
    return [];
  }
}

export function saveJobs(jobs: VideoJob[]): void {
  try {
    // Newest first, capped — old finished jobs are history, not state.
    const trimmed = [...jobs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, MAX_JOBS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota or private mode — the jobs simply will not survive a reload.
  }
}

export const PENDING_STATUSES: GenerationStatus[] = ["queued", "in_progress", "unknown"];

export function isPending(job: VideoJob): boolean {
  return PENDING_STATUSES.includes(job.status);
}

/**
 * A job that has been pending far longer than any generation should take is
 * treated as stale, so a lost job cannot poll forever across reloads.
 */
export function isStale(job: VideoJob, maxAgeMs = 30 * 60 * 1000): boolean {
  return isPending(job) && Date.now() - new Date(job.created_at).getTime() > maxAgeMs;
}
