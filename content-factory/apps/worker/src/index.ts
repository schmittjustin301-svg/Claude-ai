import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { renderCombinationVideo } from "./ffmpegPipeline.js";
import { ensureStorageDirs } from "./storage.js";

ensureStorageDirs();

const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

interface RenderJobPayload {
  generatedVideoId: string;
}

async function processJob(job: Job<RenderJobPayload>) {
  const { generatedVideoId } = job.data;

  await prisma.generatedVideo.update({ where: { id: generatedVideoId }, data: { status: "RENDERING" } });
  await prisma.renderJob.update({
    where: { generatedVideoId },
    data: { status: "RUNNING", startedAt: new Date(), progress: 0 },
  });

  try {
    const result = await renderCombinationVideo(generatedVideoId, (percent) => {
      job.updateProgress(percent).catch(() => {});
      prisma.renderJob
        .update({ where: { generatedVideoId }, data: { progress: percent } })
        .catch(() => {});
    });

    await prisma.generatedVideo.update({
      where: { id: generatedVideoId },
      data: {
        status: "READY",
        outputPath: result.outputPath,
        thumbnailPath: result.thumbnailPath,
        durationSec: result.durationSec,
        errorMessage: null,
      },
    });
    await prisma.renderJob.update({
      where: { generatedVideoId },
      data: { status: "DONE", progress: 100, completedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Render failed for ${generatedVideoId}:`, message);
    await prisma.generatedVideo.update({
      where: { id: generatedVideoId },
      data: { status: "FAILED", errorMessage: message },
    });
    await prisma.renderJob.update({
      where: { generatedVideoId },
      data: { status: "FAILED", error: message, completedAt: new Date() },
    });
    throw err;
  }
}

const worker = new Worker<RenderJobPayload>("video-render", processJob, {
  connection,
  concurrency: Number(process.env.RENDER_CONCURRENCY ?? 2),
});

worker.on("completed", (job) => console.log(`Rendered ${job.data.generatedVideoId}`));
worker.on("failed", (job, err) => console.error(`Render job ${job?.id} failed:`, err.message));

console.log("Render worker started, waiting for jobs...");
