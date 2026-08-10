import fs from "node:fs";
import path from "node:path";
import { env } from "../env.js";

// Local-disk storage adapter. Swap this module for an S3/GCS-backed one
// later without touching callers — every caller only uses these exports.
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

export type StorageKind = keyof typeof storageDirs;

export function publicUrlFor(kind: StorageKind, filename: string): string {
  return `${env.publicBaseUrl}/files/${kind}/${filename}`;
}

export function absolutePathFor(kind: StorageKind, filename: string): string {
  return path.join(storageDirs[kind], filename);
}
