import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { ensureStorageDirs, storageDirs } from "./lib/storage.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { clipsRouter } from "./routes/clips.js";
import { combinationsRouter } from "./routes/combinations.js";
import { videosRouter } from "./routes/videos.js";
import { dashboardRouter } from "./routes/dashboard.js";

ensureStorageDirs();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/files/uploads", express.static(storageDirs.uploads));
app.use("/files/rendered", express.static(storageDirs.rendered));
app.use("/files/thumbnails", express.static(storageDirs.thumbnails));

app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/clips", clipsRouter);
app.use("/combinations", combinationsRouter);
app.use("/videos", videosRouter);
app.use("/dashboard", dashboardRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
