import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import ffmpeg from "fluent-ffmpeg";
import { prisma } from "./db.js";
import { storageDirs } from "./storage.js";
import { escapeFilterPath, layoutPosterText } from "./posterText.js";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

// src/ and dist/ sit at the same depth under apps/worker, so this resolves
// correctly whether running via tsx or from a build.
const ANTON_FONT_PATH =
  process.env.POSTER_FONT_PATH ??
  fileURLToPath(new URL("../../../assets/fonts/Anton-Regular.ttf", import.meta.url));

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

  const thumbnailFilename = await renderPoster(outputPath, generatedVideoId, combo.hookClip.name);

  return { outputFilename, thumbnailFilename, durationSec };
}

/**
 * Builds the poster: the video's first frame, dimmed, with the hook's name
 * set in Anton across the middle. The hook is what the video is *about*, so
 * it makes the better headline — and the first frame is what a viewer sees
 * when the post loads, so the poster matches the opening of the video.
 *
 * Note: if a source clip fades in from black, so does this poster. Shift
 * FIRST_FRAME_AT below to grab slightly later if that becomes a problem.
 */
const FIRST_FRAME_AT = 0;

async function renderPoster(videoPath: string, generatedVideoId: string, headline: string): Promise<string> {
  const thumbnailFilename = `${generatedVideoId}.jpg`;
  const outPath = path.join(storageDirs.thumbnails, thumbnailFilename);
  const { text, fontSize, lineSpacing } = layoutPosterText(headline);

  // drawtext reads the headline from a file so that apostrophes, colons and
  // other filtergraph metacharacters in a clip name can never break the graph.
  const textFilePath = path.join(os.tmpdir(), `poster-${randomUUID()}.txt`);
  await fs.writeFile(textFilePath, text, "utf8");

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(FIRST_FRAME_AT)
        .frames(1)
        .videoFilters([
          // Dim the frame so white type stays legible over any footage. Kept
          // light — a heavier scrim turns already-dark footage into a black
          // rectangle; the drop shadow below carries legibility over bright
          // frames.
          `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.3:t=fill`,
          [
            `drawtext=fontfile='${escapeFilterPath(ANTON_FONT_PATH)}'`,
            `textfile='${escapeFilterPath(textFilePath)}'`,
            `fontcolor=white`,
            `fontsize=${fontSize}`,
            `line_spacing=${lineSpacing}`,
            `x=(w-text_w)/2`,
            `y=(h-text_h)/2`,
            `shadowcolor=black@0.55`,
            `shadowx=5`,
            `shadowy=5`,
          ].join(":"),
        ])
        .outputOptions(["-q:v", "3"])
        .on("error", (err) => reject(err))
        .on("end", () => resolve())
        .save(outPath);
    });
  } finally {
    await fs.rm(textFilePath, { force: true });
  }

  return thumbnailFilename;
}
