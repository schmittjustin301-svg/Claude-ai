import fs from "node:fs";
import path from "node:path";
import { env } from "../env.js";

/**
 * On-disk layout, designed to be browsable by hand in Explorer/Finder:
 *
 *   storage/
 *     road-to-olympia/          one folder per project
 *       hooks/
 *       main/
 *       cta/
 *       broll/
 *       outro/
 *       finished/               ready-to-post videos
 *     _thumbnails/              app-internal preview images
 *
 * Files are named after the clip ("why-your-legs-wont-grow.mp4"), not by id.
 * The database stores paths relative to the storage root, so moving the whole
 * storage folder to another disk only means changing STORAGE_ROOT.
 *
 * Swap this module for an S3/GCS-backed one later without touching callers.
 */

export const STORAGE_ROOT = path.resolve(env.storageRoot);

/** Category folder names, mirroring the categories in the UI. */
export const CATEGORY_DIRS = {
  HOOK: "hooks",
  MAIN: "main",
  CTA: "cta",
  BROLL: "broll",
  OUTRO: "outro",
} as const;

export type ClipCategoryKey = keyof typeof CATEGORY_DIRS;

export const FINISHED_DIR = "finished";
export const THUMBNAILS_DIR = "_thumbnails";
/** Uploads land here first, then move to their category folder once validated. */
export const INCOMING_DIR = "_incoming";

export function ensureStorageDirs() {
  for (const dir of [THUMBNAILS_DIR, INCOMING_DIR]) {
    fs.mkdirSync(path.join(STORAGE_ROOT, dir), { recursive: true });
  }
}

/** Creates (if needed) and returns the absolute path of a project's folders. */
export function ensureProjectDirs(projectSlug: string): void {
  for (const dir of [...Object.values(CATEGORY_DIRS), FINISHED_DIR]) {
    fs.mkdirSync(path.join(STORAGE_ROOT, projectSlug, dir), { recursive: true });
  }
}

export function clipDirFor(projectSlug: string, category: ClipCategoryKey): string {
  return path.join(STORAGE_ROOT, projectSlug, CATEGORY_DIRS[category]);
}

/** Relative path (as stored in the database) for a clip file. */
export function clipRelativePath(projectSlug: string, category: ClipCategoryKey, filename: string): string {
  return `${projectSlug}/${CATEGORY_DIRS[category]}/${filename}`;
}

export function finishedRelativePath(projectSlug: string, filename: string): string {
  return `${projectSlug}/${FINISHED_DIR}/${filename}`;
}

export function thumbnailRelativePath(filename: string): string {
  return `${THUMBNAILS_DIR}/${filename}`;
}

/** Resolves a stored relative path to an absolute one, refusing escapes. */
export function absolutePathFor(relativePath: string): string {
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error(`Refusing path outside storage root: ${relativePath}`);
  }
  return resolved;
}

export function publicUrlFor(relativePath: string): string {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `${env.publicBaseUrl}/files/${encoded}`;
}

export function removeFileQuietly(relativePath: string | null | undefined): void {
  if (!relativePath) return;
  try {
    fs.rmSync(absolutePathFor(relativePath), { force: true });
  } catch {
    // A missing or already-removed file must not fail the request.
  }
}
