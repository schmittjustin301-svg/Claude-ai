import path from "node:path";
import fsp from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { param } from "../lib/params.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { probeDurationSec } from "../lib/ffprobe.js";
import { generateClipThumbnail } from "../lib/thumbnail.js";
import { slugify, uniqueFilename } from "../lib/slug.js";
import {
  INCOMING_DIR,
  STORAGE_ROOT,
  absolutePathFor,
  clipDirFor,
  clipRelativePath,
  ensureProjectDirs,
  publicUrlFor,
  removeFileQuietly,
  type ClipCategoryKey,
} from "../lib/storage.js";

export const clipsRouter = Router();
clipsRouter.use(requireAuth);

// Uploads land in a staging folder first: the destination depends on the
// project and category in the request body, and multer cannot rely on those
// having been parsed before the file part arrives.
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(STORAGE_ROOT, INCOMING_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".mp4";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      cb(new Error("Only video files are accepted"));
      return;
    }
    cb(null, true);
  },
});

async function assertProjectOwnership(projectId: string, userId: string | undefined) {
  return prisma.project.findFirst({ where: { id: projectId, userId } });
}

const categoryEnum = z.enum(["HOOK", "MAIN", "CTA", "BROLL", "OUTRO"]);

const uploadMetaSchema = z.object({
  projectId: z.string().uuid(),
  category: categoryEnum,
  name: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  description: z.string().optional(),
  speaker: z.string().optional(),
  topic: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
});

clipsRouter.post("/upload", upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const parsed = uploadMetaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const meta = parsed.data;

  const stagedPath = req.file.path;

  const project = await assertProjectOwnership(meta.projectId, req.userId);
  if (!project) {
    fsp.rm(stagedPath, { force: true }).catch(() => {});
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const clipName = meta.name?.trim() || path.parse(req.file.originalname).name;

  // Move out of staging into <project>/<category>/<clip-name>.mp4
  ensureProjectDirs(project.slug);
  const targetDir = clipDirFor(project.slug, meta.category);
  const ext = path.extname(req.file.originalname) || ".mp4";
  const filename = uniqueFilename(targetDir, slugify(clipName), ext);
  const absPath = path.join(targetDir, filename);
  await fsp.rename(stagedPath, absPath);

  const filePath = clipRelativePath(project.slug, meta.category, filename);
  const [durationSec, thumbnailPath] = await Promise.all([
    probeDurationSec(absPath),
    generateClipThumbnail(absPath, randomUUID()),
  ]);

  const clip = await prisma.clip.create({
    data: {
      projectId: meta.projectId,
      category: meta.category,
      name: clipName,
      filePath,
      thumbnailPath,
      durationSec: durationSec ?? undefined,
      tags: meta.tags ? meta.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      description: meta.description,
      speaker: meta.speaker,
      topic: meta.topic,
      priority: meta.priority ?? 1,
      status: "READY",
    },
  });

  res.status(201).json({ clip: toClipDTO(clip) });
});

const listQuerySchema = z.object({
  projectId: z.string().uuid(),
  category: categoryEnum.optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
});

clipsRouter.get("/", async (req: AuthedRequest, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { projectId, category, search, tag } = parsed.data;

  const project = await assertProjectOwnership(projectId, req.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const clips = await prisma.clip.findMany({
    where: {
      projectId,
      category,
      tags: tag ? { has: tag } : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: "insensitive" } },
            { topic: { contains: search, mode: "insensitive" } },
            { speaker: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ clips: clips.map(toClipDTO) });
});

const updateSchema = z.object({
  name: z.string().optional(),
  category: categoryEnum.optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
  speaker: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

clipsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const clip = await prisma.clip.findFirst({
    where: { id: param(req, "id"), project: { userId: req.userId } },
    include: { project: { select: { slug: true } } },
  });
  if (!clip) {
    res.status(404).json({ error: "Clip not found" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  // Dragging a clip to another category, or renaming it, has to move the file
  // too — otherwise the folders on disk drift out of sync with the library.
  const nextCategory = (parsed.data.category ?? clip.category) as ClipCategoryKey;
  const nextName = parsed.data.name?.trim() || clip.name;
  const categoryChanged = nextCategory !== clip.category;
  const nameChanged = nextName !== clip.name;

  let filePath = clip.filePath;
  if (categoryChanged || nameChanged) {
    const targetDir = clipDirFor(clip.project.slug, nextCategory);
    ensureProjectDirs(clip.project.slug);
    const ext = path.extname(clip.filePath) || ".mp4";
    const filename = uniqueFilename(targetDir, slugify(nextName), ext);
    await fsp.rename(absolutePathFor(clip.filePath), path.join(targetDir, filename));
    filePath = clipRelativePath(clip.project.slug, nextCategory, filename);
  }

  const updated = await prisma.clip.update({
    where: { id: clip.id },
    data: { ...parsed.data, filePath },
  });
  res.json({ clip: toClipDTO(updated) });
});

clipsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const clip = await prisma.clip.findFirst({
    where: { id: param(req, "id"), project: { userId: req.userId } },
  });
  if (!clip) {
    res.status(404).json({ error: "Clip not found" });
    return;
  }
  await prisma.clip.delete({ where: { id: clip.id } });
  removeFileQuietly(clip.filePath);
  removeFileQuietly(clip.thumbnailPath);
  res.status(204).send();
});

export function toClipDTO(clip: {
  id: string;
  projectId: string;
  category: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  durationSec: number | null;
  tags: string[];
  description: string | null;
  speaker: string | null;
  topic: string | null;
  priority: number;
  status: string;
  createdAt: Date;
}) {
  return {
    id: clip.id,
    projectId: clip.projectId,
    category: clip.category,
    name: clip.name,
    fileUrl: publicUrlFor(clip.filePath),
    previewUrl: publicUrlFor(clip.filePath),
    thumbnailUrl: clip.thumbnailPath ? publicUrlFor(clip.thumbnailPath) : null,
    durationSec: clip.durationSec,
    tags: clip.tags,
    description: clip.description,
    speaker: clip.speaker,
    topic: clip.topic,
    priority: clip.priority,
    status: clip.status,
    createdAt: clip.createdAt.toISOString(),
  };
}
