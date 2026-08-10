import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";

// Mirrors apps/api/src/lib/storage.ts. The API and worker share the same
// disk (or, in production, the same bucket) via STORAGE_ROOT — this is the
// worker's read/write side of that shared storage.
export const storageDirs = {
  uploads: path.resolve(env.storageRoot, "uploads"),
  rendered: path.resolve(env.storageRoot, "rendered"),
  thumbnails: path.resolve(env.storageRoot, "thumbnails"),
};

export function ensureStorageDirs() {
  for (const dir of Object.values(storageDirs)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
