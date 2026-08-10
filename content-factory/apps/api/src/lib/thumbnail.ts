import ffmpeg from "fluent-ffmpeg";
import { storageDirs } from "./storage.js";

/**
 * Extracts a single poster frame so the library can show what a clip is
 * instead of a black <video> box. Resolves to null on failure — a missing
 * thumbnail degrades the UI but must never fail the upload itself.
 */
export function generateClipThumbnail(absVideoPath: string, filenameBase: string): Promise<string | null> {
  const filename = `${filenameBase}.jpg`;
  return new Promise((resolve) => {
    ffmpeg(absVideoPath)
      .on("error", () => resolve(null))
      .on("end", () => resolve(filename))
      .screenshots({
        timestamps: ["25%"],
        filename,
        folder: storageDirs.thumbnails,
        size: "324x576",
      });
  });
}
