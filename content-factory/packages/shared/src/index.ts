export type ClipCategory = "HOOK" | "MAIN" | "CTA" | "BROLL" | "OUTRO";

export const CLIP_CATEGORIES: ClipCategory[] = ["HOOK", "MAIN", "CTA", "BROLL", "OUTRO"];

export type ClipStatus = "PROCESSING" | "READY" | "FAILED";

export type VideoStatus =
  | "DRAFT"
  | "QUEUED"
  | "RENDERING"
  | "READY"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export interface ClipDTO {
  id: string;
  projectId: string;
  category: ClipCategory;
  name: string;
  fileUrl: string;
  previewUrl: string;
  durationSec: number | null;
  tags: string[];
  description: string | null;
  speaker: string | null;
  topic: string | null;
  priority: number;
  status: ClipStatus;
  createdAt: string;
}

export interface CombinationDTO {
  id: string;
  projectId: string;
  hookClipId: string;
  mainClipId: string;
  ctaClipId: string;
  brollClipId: string | null;
  outroClipId: string | null;
  score: number;
  createdAt: string;
}

export interface GeneratedVideoDTO {
  id: string;
  projectId: string;
  combinationId: string;
  status: VideoStatus;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  errorMessage: string | null;
  createdAt: string;
  combination?: CombinationDTO & {
    hookClip: ClipDTO;
    mainClip: ClipDTO;
    ctaClip: ClipDTO;
    brollClip: ClipDTO | null;
    outroClip: ClipDTO | null;
  };
}

export interface GenerateCombinationsRequest {
  projectId: string;
  targetCount: number;
  hookClipIds?: string[];
  mainClipIds?: string[];
  ctaClipIds?: string[];
  brollClipIds?: string[];
  outroClipIds?: string[];
  allowRepeats: boolean;
  useTagAffinity: boolean;
  usePriorityWeighting: boolean;
}

export interface DashboardStats {
  totalClips: number;
  totalCombinations: number;
  totalVideos: number;
  videosByStatus: Record<VideoStatus, number>;
  clipsByCategory: Record<ClipCategory, number>;
}
