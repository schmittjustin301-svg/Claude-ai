import fs from "node:fs";
import path from "node:path";

/**
 * Turns a clip or project name into a filename-safe slug.
 * "Why your legs won't grow" -> "why-your-legs-wont-grow"
 */
export function slugify(input: string, maxLength = 60): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/['’]/g, "") // won't -> wont, rather than won-t
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

/**
 * Finds a free filename in `dir`, appending -2, -3 … on collision, so two
 * clips named the same never overwrite each other.
 */
export function uniqueFilename(dir: string, baseName: string, ext: string): string {
  let candidate = `${baseName}${ext}`;
  let counter = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${baseName}-${counter}${ext}`;
    counter++;
  }
  return candidate;
}
