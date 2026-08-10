import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { generateCombinations, type EngineClip } from "../lib/combinationEngine.js";

export const combinationsRouter = Router();
combinationsRouter.use(requireAuth);

const generateSchema = z.object({
  projectId: z.string().uuid(),
  targetCount: z.number().int().min(1).max(2000),
  hookClipIds: z.array(z.string().uuid()).optional(),
  mainClipIds: z.array(z.string().uuid()).optional(),
  ctaClipIds: z.array(z.string().uuid()).optional(),
  brollClipIds: z.array(z.string().uuid()).optional(),
  outroClipIds: z.array(z.string().uuid()).optional(),
  allowRepeats: z.boolean().default(false),
  useTagAffinity: z.boolean().default(true),
  usePriorityWeighting: z.boolean().default(true),
});

function toEngineClip(clip: { id: string; tags: string[]; priority: number }): EngineClip {
  return { id: clip.id, tags: clip.tags, priority: clip.priority };
}

combinationsRouter.post("/generate", async (req: AuthedRequest, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const input = parsed.data;

  const project = await prisma.project.findFirst({ where: { id: input.projectId, userId: req.userId } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const clipWhere = (category: "HOOK" | "MAIN" | "CTA" | "BROLL" | "OUTRO", ids?: string[]) => ({
    projectId: input.projectId,
    category,
    status: "READY" as const,
    ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
  });

  const [hooks, mains, ctas, brolls, outros] = await Promise.all([
    prisma.clip.findMany({ where: clipWhere("HOOK", input.hookClipIds) }),
    prisma.clip.findMany({ where: clipWhere("MAIN", input.mainClipIds) }),
    prisma.clip.findMany({ where: clipWhere("CTA", input.ctaClipIds) }),
    prisma.clip.findMany({ where: clipWhere("BROLL", input.brollClipIds) }),
    prisma.clip.findMany({ where: clipWhere("OUTRO", input.outroClipIds) }),
  ]);

  if (hooks.length === 0 || mains.length === 0 || ctas.length === 0) {
    res.status(400).json({ error: "Need at least one ready clip each in Hook, Main and CTA categories" });
    return;
  }

  const existing = input.allowRepeats
    ? []
    : await prisma.combination.findMany({
        where: { projectId: input.projectId },
        select: { hookClipId: true, mainClipId: true, ctaClipId: true },
      });
  const existingKeys = new Set(existing.map((c) => `${c.hookClipId}|${c.mainClipId}|${c.ctaClipId}`));

  const result = generateCombinations(
    hooks.map(toEngineClip),
    mains.map(toEngineClip),
    ctas.map(toEngineClip),
    brolls.map(toEngineClip),
    outros.map(toEngineClip),
    {
      targetCount: input.targetCount,
      allowRepeats: input.allowRepeats,
      useTagAffinity: input.useTagAffinity,
      usePriorityWeighting: input.usePriorityWeighting,
      existingKeys,
    },
  );

  const created = await prisma.$transaction(
    result.candidates.map((c) =>
      prisma.combination.create({
        data: {
          projectId: input.projectId,
          hookClipId: c.hookClipId,
          mainClipId: c.mainClipId,
          ctaClipId: c.ctaClipId,
          brollClipId: c.brollClipId,
          outroClipId: c.outroClipId,
          score: c.score,
        },
      }),
    ),
  );

  res.status(201).json({
    combinations: created,
    requestedCount: result.requestedCount,
    generatedCount: created.length,
    possibleCount: result.possibleCount,
    capped: result.capped,
  });
});

const listQuerySchema = z.object({ projectId: z.string().uuid() });

combinationsRouter.get("/", async (req: AuthedRequest, res) => {
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
  const combinations = await prisma.combination.findMany({
    where: { projectId: parsed.data.projectId },
    include: { hookClip: true, mainClip: true, ctaClip: true, brollClip: true, outroClip: true, generatedVideo: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ combinations });
});
