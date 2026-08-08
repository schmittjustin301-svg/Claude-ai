// IndexedDB for the Clip Lab. Separate database from the athlete library —
// the two modules are decoupled, and a source video is far larger than
// anything the athlete store holds.

import type { Clip, ClipRef, SourceVideo, SourceVideoRef } from "./clipTypes";

const DB_NAME = "grind-empire-cliplab";
const DB_VERSION = 1;
const STORE_VIDEOS = "videos";
const STORE_CLIPS = "clips";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CLIPS)) {
        const clips = db.createObjectStore(STORE_CLIPS, { keyPath: "id" });
        clips.createIndex("source_video_id", "source_video_id", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Clip-Datenbank nicht verfügbar."));
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB-Fehler"));
      })
  );
}

export function getAllVideos(): Promise<SourceVideo[]> {
  return tx<SourceVideo[]>(STORE_VIDEOS, "readonly", (s) => s.getAll());
}

export function putVideo(video: SourceVideo): Promise<unknown> {
  return tx(STORE_VIDEOS, "readwrite", (s) => s.put(video));
}

export async function deleteVideo(id: string): Promise<void> {
  const clips = (await getAllClips()).filter((c) => c.source_video_id === id);
  await Promise.all(clips.map((c) => deleteClip(c.id)));
  await tx(STORE_VIDEOS, "readwrite", (s) => s.delete(id));
}

export function getAllClips(): Promise<Clip[]> {
  return tx<Clip[]>(STORE_CLIPS, "readonly", (s) => s.getAll());
}

export function putClip(clip: Clip): Promise<unknown> {
  return tx(STORE_CLIPS, "readwrite", (s) => s.put(clip));
}

export function deleteClip(id: string): Promise<unknown> {
  return tx(STORE_CLIPS, "readwrite", (s) => s.delete(id));
}

export function toVideoRefs(videos: SourceVideo[], previous: SourceVideoRef[]): SourceVideoRef[] {
  previous.forEach((v) => URL.revokeObjectURL(v.url));
  return videos.map(({ blob, ...rest }) => ({ ...rest, url: URL.createObjectURL(blob) }));
}

export function toClipRefs(clips: Clip[], previous: ClipRef[]): ClipRef[] {
  previous.forEach((c) => {
    if (c.poster_url) URL.revokeObjectURL(c.poster_url);
  });
  return clips.map(({ poster, ...rest }) => ({
    ...rest,
    poster_url: poster ? URL.createObjectURL(poster) : null,
  }));
}

/** Reads duration and dimensions without decoding the whole file. */
export function readVideoMeta(blob: Blob): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const meta = { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video konnte nicht gelesen werden."));
    };
    video.src = url;
  });
}

/**
 * Grabs a single frame at the given time. This is what gets sent to Higgsfield,
 * whose API takes an image rather than a video.
 */
export function captureFrame(videoUrl: string, time: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.crossOrigin = "anonymous";

    const fail = (msg: string) => () => reject(new Error(msg));
    video.onerror = fail("Video konnte nicht geladen werden.");

    video.onloadeddata = () => {
      video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas nicht verfügbar."));
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Frame konnte nicht exportiert werden."));
      }, "image/jpeg", 0.92);
    };

    video.src = videoUrl;
  });
}
