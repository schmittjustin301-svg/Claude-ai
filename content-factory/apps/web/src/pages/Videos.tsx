import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useProjectStore } from "../store/projectStore";
import { Badge, Button, Card, Select } from "../components/ui";

interface VideoItem {
  id: string;
  status: string;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  caption: string | null;
  hashtags: string[];
  errorMessage: string | null;
  combination: {
    hookClip: { name: string };
    mainClip: { name: string };
    ctaClip: { name: string };
  };
}

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger" | "accent"> = {
  DRAFT: "default",
  QUEUED: "accent",
  RENDERING: "warning",
  READY: "success",
  SCHEDULED: "accent",
  PUBLISHED: "success",
  FAILED: "danger",
};

export function Videos() {
  const projectId = useProjectStore((s) => s.selectedProjectId)!;
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  async function load() {
    const params = new URLSearchParams({ projectId });
    if (statusFilter) params.set("status", statusFilter);
    const { videos } = await api.get<{ videos: VideoItem[] }>(`/videos?${params}`);
    setVideos(videos);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, statusFilter]);

  useEffect(() => {
    timer.current = setInterval(() => {
      if (videos.some((v) => v.status === "QUEUED" || v.status === "RENDERING")) load();
    }, 4000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, projectId, statusFilter]);

  async function regenerate(id: string) {
    await api.post(`/videos/${id}/regenerate`);
    load();
  }

  async function remove(id: string) {
    await api.delete(`/videos/${id}`);
    setVideos((vs) => vs.filter((v) => v.id !== id));
  }

  async function saveCaption(id: string, caption: string, hashtags: string[]) {
    await api.patch(`/videos/${id}`, { caption, hashtags });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Videos ({videos.length})</h1>
        <Select className="w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_TONE).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} onRegenerate={() => regenerate(v.id)} onDelete={() => remove(v.id)} onSaveCaption={saveCaption} />
        ))}
      </div>
      {videos.length === 0 && (
        <Card className="py-16 text-center text-sm text-cf-muted">No videos yet — generate combinations and render them.</Card>
      )}
    </div>
  );
}

function VideoCard({
  video,
  onRegenerate,
  onDelete,
  onSaveCaption,
}: {
  video: VideoItem;
  onRegenerate: () => void;
  onDelete: () => void;
  onSaveCaption: (id: string, caption: string, hashtags: string[]) => void;
}) {
  const [caption, setCaption] = useState(video.caption ?? "");
  const [hashtags, setHashtags] = useState(video.hashtags.join(" "));
  const [saving, setSaving] = useState(false);
  const dirty = caption !== (video.caption ?? "") || hashtags !== video.hashtags.join(" ");

  async function save() {
    setSaving(true);
    try {
      await onSaveCaption(
        video.id,
        caption,
        hashtags.split(/\s+/).filter(Boolean),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
        {video.outputUrl ? (
          <video src={video.outputUrl} poster={video.thumbnailUrl ?? undefined} controls className="h-full w-full object-cover" />
        ) : video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-cf-muted">
            {video.status === "FAILED" ? "Render failed" : "Rendering…"}
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Badge tone={STATUS_TONE[video.status]}>{video.status}</Badge>
        </div>
      </div>

      <p className="truncate text-xs text-cf-muted">
        {video.combination.hookClip.name} → {video.combination.mainClip.name} → {video.combination.ctaClip.name}
      </p>
      {video.errorMessage && <p className="text-xs text-cf-danger">{video.errorMessage}</p>}

      <textarea
        className="min-h-[50px] w-full resize-none rounded-lg border border-cf-border bg-cf-surface-2 px-2 py-1 text-xs"
        placeholder="Caption…"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <input
        className="w-full rounded-lg border border-cf-border bg-cf-surface-2 px-2 py-1 text-xs"
        placeholder="#hashtags #space #separated"
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            Save
          </Button>
        )}
        {video.outputUrl && (
          <Button size="sm" variant="secondary" onClick={() => window.open(`/api/videos/${video.id}/download`, "_blank")}>
            Download
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onRegenerate}>
          Regenerate
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}
