import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import ffmpeg from "fluent-ffmpeg";
import { prisma } from "./db.js";
import {
  absolutePathFor,
  finishedDirFor,
  finishedRelativePath,
  slugify,
  thumbnailRelativePath,
  thumbnailsDir,
} from "./storage.js";
import { escapeFilterPath, layoutPosterText } from "./posterText.js";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

// src/ and dist/ sit at the same depth under apps/worker, so this resolves
// correctly whether running via tsx or from a build.
const ANTON_FONT_PATH =
  process.env.POSTER_FONT_PATH ??
  fileURLToPath(new URL("../../../assets/fonts/Anton-Regular.ttf", import.meta.url));

export interface RenderResult {
  /** Paths relative to STORAGE_ROOT, as stored in the database. */
  outputPath: string;
  thumbnailPath: string;
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
      project: { select: { slug: true } },
      combination: {
        include: { hookClip: true, mainClip: true, brollClip: true, ctaClip: true, outroClip: true },
      },
    },
  });

  const combo = video.combination;
  const orderedClips = [combo.hookClip, combo.mainClip, combo.brollClip, combo.ctaClip, combo.outroClip].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );

  const inputPaths = orderedClips.map((c) => absolutePathFor(c.filePath));

  // Name the file after the combination it came from, so the finished folder
  // is readable without opening the app: which hook, which main, which CTA.
  // The id suffix keeps it unique when the same names recur.
  const outputFilename =
    [
      slugify(combo.hookClip.name, 28),
      slugify(combo.mainClip.name, 28),
      slugify(combo.ctaClip.name, 28),
      generatedVideoId.slice(0, 8),
    ].join("__") + ".mp4";
  const outputPath = path.join(finishedDirFor(video.project.slug), outputFilename);

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
  const thumbnailPath = await renderPoster(outputPath, generatedVideoId, combo.hookClip.name);

  return {
    outputPath: finishedRelativePath(video.project.slug, outputFilename),
    thumbnailPath,
    durationSec,
  };
}

/**
 * Builds the poster: the video's first frame with the hook's name set in
 * Anton across the lower third. The hook is what the video is *about*, so it
 * makes the better headline — and the first frame is what a viewer sees when
 * the post loads, so the poster matches the opening of the video.
 *
 * The headline sits low on purpose: in a 9:16 reel the subject's face is in
 * the upper-middle, so centred type lands straight on it. Instead of dimming
 * the whole frame, a gradient scrim darkens only the bottom — the face stays
 * bright, the type stays readable.
 *
 * Note: if a source clip fades in from black, so does this poster. Shift
 * FIRST_FRAME_AT below to grab slightly later if that becomes a problem.
 */
const FIRST_FRAME_AT = 0;

/**
 * Space kept clear below the headline, in pixels of a 1920-tall frame.
 * Instagram and TikTok both lay their own UI (caption, handle, buttons) over
 * roughly the bottom fifth, so text placed lower than this gets covered.
 */
const BOTTOM_SAFE_MARGIN = 400;

/** Where the scrim starts, as a fraction of frame height, and how dark it gets. */
const SCRIM_START = 0.4;
const SCRIM_STRENGTH = 0.82;
const SCRIM_DESATURATION = 0.45;

/**
 * A gradient scrim across the bottom of the frame.
 *
 * Commas inside the expressions are escaped because fluent-ffmpeg joins the
 * filter array with commas — an unescaped one silently ends the filter and
 * the scrim disappears without any error.
 *
 * The ramp is normalised by plane height (Y/H) rather than absolute pixels so
 * it lines up on the subsampled chroma planes as well as on luma.
 */
function scrimFilter(): string {
  const ramp = `max(0\\,min(1\\,(Y-${SCRIM_START}*H)/(${1 - SCRIM_START}*H)))`;
  return [
    `geq=lum='lum(X\\,Y)*(1-${SCRIM_STRENGTH}*${ramp})'`,
    `cb='128+(cb(X\\,Y)-128)*(1-${SCRIM_DESATURATION}*${ramp})'`,
    `cr='128+(cr(X\\,Y)-128)*(1-${SCRIM_DESATURATION}*${ramp})'`,
  ].join(":");
}

async function renderPoster(videoPath: string, generatedVideoId: string, headline: string): Promise<string> {
  const thumbnailFilename = `${generatedVideoId}.jpg`;
  const outPath = path.join(thumbnailsDir(), thumbnailFilename);
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
          // geq addresses lum/cb/cr, so the frame has to be in a planar YUV
          // format first — on an RGB input the scrim silently does nothing.
          "format=yuv420p",
          scrimFilter(),
          [
            `drawtext=fontfile='${escapeFilterPath(ANTON_FONT_PATH)}'`,
            `textfile='${escapeFilterPath(textFilePath)}'`,
            `fontcolor=white`,
            `fontsize=${fontSize}`,
            `line_spacing=${lineSpacing}`,
            // Horizontally centred; anchored to the bottom so extra lines
            // grow upward instead of creeping into the platform UI.
            `x=(w-text_w)/2`,
            `y=h-${BOTTOM_SAFE_MARGIN}-text_h`,
            `shadowcolor=black@0.5`,
            `shadowx=4`,
            `shadowy=4`,
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

  return thumbnailRelativePath(thumbnailFilename);
}
