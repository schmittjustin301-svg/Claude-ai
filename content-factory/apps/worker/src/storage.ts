import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";

/**
 * Mirrors apps/api/src/lib/storage.ts — the API and worker share one storage
 * tree via STORAGE_ROOT. See that file for the layout:
 *
 *   storage/<project-slug>/{hooks,main,cta,broll,outro,finished}/
 *   storage/_thumbnails/
 */

export const STORAGE_ROOT = path.resolve(env.storageRoot);

export const FINISHED_DIR = "finished";
export const THUMBNAILS_DIR = "_thumbnails";

export function ensureStorageDirs() {
  fs.mkdirSync(path.join(STORAGE_ROOT, THUMBNAILS_DIR), { recursive: true });
}

export function absolutePathFor(relativePath: string): string {
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error(`Refusing path outside storage root: ${relativePath}`);
  }
  return resolved;
}

export function finishedDirFor(projectSlug: string): string {
  const dir = path.join(STORAGE_ROOT, projectSlug, FINISHED_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function finishedRelativePath(projectSlug: string, filename: string): string {
  return `${projectSlug}/${FINISHED_DIR}/${filename}`;
}

export function thumbnailsDir(): string {
  const dir = path.join(STORAGE_ROOT, THUMBNAILS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function thumbnailRelativePath(filename: string): string {
  return `${THUMBNAILS_DIR}/${filename}`;
}

/** Mirrors apps/api/src/lib/slug.ts. */
export function slugify(input: string, maxLength = 60): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "untitled";
}
