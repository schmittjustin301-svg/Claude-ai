import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { prisma } from "./db.js";
import { storageDirs } from "./storage.js";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

export interface RenderResult {
  outputFilename: string;
  thumbnailFilename: string;
  durationSec: number;
}

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

/**
 * Renders hook -> main -> [broll] -> cta -> [outro] into one 9:16 1080x1920
 * MP4: each clip is scaled/cropped to fill the frame (cover fit, keeps the
 * center in the safe zone), concatenated in order, and the combined audio
 * track is loudness-normalized. Hard cuts only, no captions/overlays/music
 * yet — that's Phase 2 (see README "Known limitations").
 */
export async function renderCombinationVideo(
  generatedVideoId: string,
  onProgress: (percent: number) => void,
): Promise<RenderResult> {
  const video = await prisma.generatedVideo.findUniqueOrThrow({
    where: { id: generatedVideoId },
    include: {
      combination: {
        include: { hookClip: true, mainClip: true, brollClip: true, ctaClip: true, outroClip: true },
      },
    },
  });

  const combo = video.combination;
  const orderedClips = [combo.hookClip, combo.mainClip, combo.brollClip, combo.ctaClip, combo.outroClip].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );

  const inputPaths = orderedClips.map((c) => path.join(storageDirs.uploads, c.filePath));

  const outputFilename = `${generatedVideoId}.mp4`;
  const outputPath = path.join(storageDirs.rendered, outputFilename);

  const filterParts: string[] = [];
  inputPaths.forEach((_p, i) => {
    filterParts.push(
      `[${i}:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},fps=30,setsar=1[v${i}]`,
    );
    filterParts.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
  });
  const concatInputs = inputPaths.map((_p, i) => `[v${i}][a${i}]`).join("");
  filterParts.push(`${concatInputs}concat=n=${inputPaths.length}:v=1:a=1[vcat][acat]`);
  filterParts.push(`[acat]loudnorm=I=-16:TP=-1.5:LRA=11[aout]`);

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg();
    inputPaths.forEach((p) => command.input(p));
    command
      .complexFilter(filterParts)
      .outputOptions([
        "-map",
        "[vcat]",
        "-map",
        "[aout]",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
      ])
      .on("progress", (p) => onProgress(Math.min(Math.round(p.percent ?? 0), 99)))
      .on("error", (err) => reject(err))
      .on("end", () => resolve())
      .save(outputPath);
  });

  const durationSec = await probeDuration(outputPath);

  const thumbnailFilename = `${generatedVideoId}.jpg`;
  await new Promise<void>((resolve, reject) => {
    ffmpeg(outputPath)
      .on("error", (err) => reject(err))
      .on("end", () => resolve())
      .screenshots({
        timestamps: ["50%"],
        filename: thumbnailFilename,
        folder: storageDirs.thumbnails,
        size: `${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`,
      });
  });

  return { outputFilename, thumbnailFilename, durationSec };
}
