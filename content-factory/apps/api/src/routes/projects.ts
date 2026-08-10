import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { param } from "../lib/params.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req: AuthedRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { clips: true, combinations: true, generatedVideos: true } },
    },
  });
  res.json({ projects });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

projectsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const project = await prisma.project.create({
    data: { ...parsed.data, userId: req.userId! },
  });
  res.status(201).json({ project });
});

projectsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: param(req, "id"), userId: req.userId },
    include: {
      _count: { select: { clips: true, combinations: true, generatedVideos: true } },
    },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ project });
});

projectsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const project = await prisma.project.findFirst({ where: { id: param(req, "id"), userId: req.userId } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await prisma.project.delete({ where: { id: project.id } });
  res.status(204).send();
});
