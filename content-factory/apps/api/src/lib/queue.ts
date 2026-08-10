import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";

export const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

export const RENDER_QUEUE_NAME = "video-render";

export interface RenderJobPayload {
  generatedVideoId: string;
}

export const renderQueue = new Queue<RenderJobPayload>(RENDER_QUEUE_NAME, { connection });
