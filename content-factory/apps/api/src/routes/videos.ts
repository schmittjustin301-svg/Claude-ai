import fs from "node:fs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { param } from "../lib/params.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { renderQueue } from "../lib/queue.js";
import { absolutePathFor, publicUrlFor } from "../lib/storage.js";

export const videosRouter = Router();
videosRouter.use(requireAuth);

const includeGraph = {
  combination: {
    include: { hookClip: true, mainClip: true, ctaClip: true, brollClip: true, outroClip: true },
  },
} as const;

async function enqueueRender(generatedVideoId: string) {
  await prisma.renderJob.upsert({
    where: { generatedVideoId },
    create: { generatedVideoId, status: "PENDING", progress: 0 },
    update: { status: "PENDING", progress: 0, error: null, startedAt: null, completedAt: null },
  });
  await renderQueue.add("render", { generatedVideoId }, { removeOnComplete: true, removeOnFail: 50 });
}

const renderSchema = z.object({
  projectId: z.string().uuid(),
  combinationIds: z.array(z.string().uuid()).optional(),
});

videosRouter.post("/render", async (req: AuthedRequest, res) => {
  const parsed = renderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { projectId, combinationIds } = parsed.data;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: req.userId } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const combinations = await prisma.combination.findMany({
    where: {
      projectId,
      id: combinationIds && combinationIds.length > 0 ? { in: combinationIds } : undefined,
      generatedVideo: null,
    },
  });

  const created = await prisma.$transaction(
    combinations.map((c) =>
      prisma.generatedVideo.create({ data: { projectId, combinationId: c.id, status: "QUEUED" } }),
    ),
  );

  for (const video of created) {
    await enqueueRender(video.id);
  }

  res.status(201).json({ queued: created.length, videoIds: created.map((v) => v.id) });
});

const listQuerySchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(["DRAFT", "QUEUED", "RENDERING", "READY", "SCHEDULED", "PUBLISHED", "FAILED"]).optional(),
});

videosRouter.get("/", async (req: AuthedRequest, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const project = await prisma.project.findFirst({ where: { id: parsed.data.projectId, userId: req.userId } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const videos = await prisma.generatedVideo.findMany({
    where: { projectId: parsed.data.projectId, status: parsed.data.status },
    include: includeGraph,
    orderBy: { createdAt: "desc" },
  });
  res.json({ videos: videos.map(toVideoDTO) });
});

videosRouter.get("/:id", async (req: AuthedRequest, res) => {
  const video = await prisma.generatedVideo.findFirst({
    where: { id: param(req, "id"), project: { userId: req.userId } },
    include: includeGraph,
  });
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json({ video: toVideoDTO(video) });
});

const updateSchema = z.object({
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "READY", "SCHEDULED"]).optional(),
});

videosRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const video = await prisma.generatedVideo.findFirst({ where: { id: param(req, "id"), project: { userId: req.userId } } });
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const updated = await prisma.generatedVideo.update({
    where: { id: video.id },
    data: parsed.data,
    include: includeGraph,
  });
  res.json({ video: toVideoDTO(updated) });
});

videosRouter.post("/:id/regenerate", async (req: AuthedRequest, res) => {
  const video = await prisma.generatedVideo.findFirst({ where: { id: param(req, "id"), project: { userId: req.userId } } });
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  await prisma.generatedVideo.update({
    where: { id: video.id },
    data: { status: "QUEUED", errorMessage: null },
  });
  await enqueueRender(video.id);
  res.json({ ok: true });
});

videosRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const video = await prisma.generatedVideo.findFirst({ where: { id: param(req, "id"), project: { userId: req.userId } } });
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  if (video.outputPath) {
    fs.rm(absolutePathFor("rendered", video.outputPath), { force: true }, () => {});
  }
  if (video.thumbnailPath) {
    fs.rm(absolutePathFor("thumbnails", video.thumbnailPath), { force: true }, () => {});
  }
  await prisma.generatedVideo.delete({ where: { id: video.id } });
  res.status(204).send();
});

videosRouter.get("/:id/download", async (req: AuthedRequest, res) => {
  const video = await prisma.generatedVideo.findFirst({ where: { id: param(req, "id"), project: { userId: req.userId } } });
  if (!video?.outputPath) {
    res.status(404).json({ error: "Video not rendered yet" });
    return;
  }
  res.download(absolutePathFor("rendered", video.outputPath));
});

function toVideoDTO(video: any) {
  return {
    id: video.id,
    projectId: video.projectId,
    combinationId: video.combinationId,
    status: video.status,
    outputUrl: video.outputPath ? publicUrlFor("rendered", video.outputPath) : null,
    thumbnailUrl: video.thumbnailPath ? publicUrlFor("thumbnails", video.thumbnailPath) : null,
    durationSec: video.durationSec,
    caption: video.caption,
    hashtags: video.hashtags,
    errorMessage: video.errorMessage,
    createdAt: video.createdAt,
    combination: video.combination,
  };
}
