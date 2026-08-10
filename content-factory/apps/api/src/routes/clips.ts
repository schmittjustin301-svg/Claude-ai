import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { probeDurationSec } from "../lib/ffprobe.js";
import { absolutePathFor, publicUrlFor, storageDirs } from "../lib/storage.js";

export const clipsRouter = Router();
clipsRouter.use(requireAuth);

const upload = multer({
  storage: multer.diskStorage({
    destination: storageDirs.uploads,
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

  const project = await assertProjectOwnership(meta.projectId, req.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const filePath = req.file.filename;
  const absPath = absolutePathFor("uploads", filePath);
  const durationSec = await probeDurationSec(absPath);

  const clip = await prisma.clip.create({
    data: {
      projectId: meta.projectId,
      category: meta.category,
      name: meta.name?.trim() || req.file.originalname,
      filePath,
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
    where: { id: req.params.id, project: { userId: req.userId } },
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
  const updated = await prisma.clip.update({ where: { id: clip.id }, data: parsed.data });
  res.json({ clip: toClipDTO(updated) });
});

clipsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const clip = await prisma.clip.findFirst({
    where: { id: req.params.id, project: { userId: req.userId } },
  });
  if (!clip) {
    res.status(404).json({ error: "Clip not found" });
    return;
  }
  await prisma.clip.delete({ where: { id: clip.id } });
  res.status(204).send();
});

export function toClipDTO(clip: {
  id: string;
  projectId: string;
  category: string;
  name: string;
  filePath: string;
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
    fileUrl: publicUrlFor("uploads", clip.filePath),
    previewUrl: publicUrlFor("uploads", clip.filePath),
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
