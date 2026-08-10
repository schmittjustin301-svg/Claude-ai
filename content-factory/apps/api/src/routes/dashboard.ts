import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

const querySchema = z.object({ projectId: z.string().uuid() });

const CLIP_CATEGORIES = ["HOOK", "MAIN", "CTA", "BROLL", "OUTRO"] as const;
const VIDEO_STATUSES = ["DRAFT", "QUEUED", "RENDERING", "READY", "SCHEDULED", "PUBLISHED", "FAILED"] as const;

dashboardRouter.get("/", async (req: AuthedRequest, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const project = await prisma.project.findFirst({ where: { id: parsed.data.projectId, userId: req.userId } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [totalClips, totalCombinations, totalVideos, clipGroups, videoGroups] = await Promise.all([
    prisma.clip.count({ where: { projectId: project.id } }),
    prisma.combination.count({ where: { projectId: project.id } }),
    prisma.generatedVideo.count({ where: { projectId: project.id } }),
    prisma.clip.groupBy({ by: ["category"], where: { projectId: project.id }, _count: true }),
    prisma.generatedVideo.groupBy({ by: ["status"], where: { projectId: project.id }, _count: true }),
  ]);

  const clipsByCategory = Object.fromEntries(CLIP_CATEGORIES.map((c) => [c, 0])) as Record<string, number>;
  for (const g of clipGroups) clipsByCategory[g.category] = g._count;

  const videosByStatus = Object.fromEntries(VIDEO_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const g of videoGroups) videosByStatus[g.status] = g._count;

  res.json({
    totalClips,
    totalCombinations,
    totalVideos,
    clipsByCategory,
    videosByStatus,
  });
});
