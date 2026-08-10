import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useProjectStore } from "../store/projectStore";
import { Badge, Button, Card, Input, Modal, Select } from "../components/ui";

type Category = "HOOK" | "MAIN" | "CTA" | "BROLL" | "OUTRO";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "HOOK", label: "Hook" },
  { key: "MAIN", label: "Main Content" },
  { key: "CTA", label: "CTA" },
  { key: "BROLL", label: "B-Roll" },
  { key: "OUTRO", label: "Outro" },
];

interface Clip {
  id: string;
  category: Category;
  name: string;
  fileUrl: string;
  previewUrl: string;
  durationSec: number | null;
  tags: string[];
  description: string | null;
  speaker: string | null;
  topic: string | null;
  priority: number;
  status: string;
}

export function Library() {
  const projectId = useProjectStore((s) => s.selectedProjectId)!;
  const [clips, setClips] = useState<Clip[]>([]);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  async function load() {
    const params = new URLSearchParams({ projectId });
    if (search) params.set("search", search);
    const { clips } = await api.get<{ clips: Clip[] }>(`/clips?${params}`);
    setClips(clips);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, search]);

  async function moveClip(clipId: string, category: Category) {
    setClips((cs) => cs.map((c) => (c.id === clipId ? { ...c, category } : c)));
    await api.patch(`/clips/${clipId}`, { category });
  }

  async function deleteClip(clipId: string) {
    await api.delete(`/clips/${clipId}`);
    setClips((cs) => cs.filter((c) => c.id !== clipId));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Content Library</h1>
        <div className="flex gap-2">
          <Input placeholder="Search name, topic, speaker…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button onClick={() => setUploadOpen(true)}>+ Upload clips</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {CATEGORIES.map((cat) => (
          <CategoryColumn
            key={cat.key}
            category={cat.key}
            label={cat.label}
            clips={clips.filter((c) => c.category === cat.key)}
            onDropClip={(clipId) => moveClip(clipId, cat.key)}
            onDelete={deleteClip}
          />
        ))}
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} projectId={projectId} onUploaded={load} />
    </div>
  );
}

function CategoryColumn({
  category,
  label,
  clips,
  onDropClip,
  onDelete,
}: {
  category: Category;
  label: string;
  clips: Clip[];
  onDropClip: (clipId: string) => void;
  onDelete: (clipId: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const clipId = e.dataTransfer.getData("text/clip-id");
        if (clipId) onDropClip(clipId);
      }}
      className={`flex min-h-[240px] flex-col gap-2 rounded-2xl border p-3 transition-colors ${
        over ? "border-cf-accent bg-cf-accent/5" : "border-cf-border bg-cf-surface"
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{label}</span>
        <Badge>{clips.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} onDelete={() => onDelete(clip.id)} />
        ))}
        {clips.length === 0 && <p className="px-1 text-xs text-cf-muted">Drag clips here</p>}
      </div>
    </div>
  );
}

function ClipCard({ clip, onDelete }: { clip: Clip; onDelete: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/clip-id", clip.id)}
      className="cursor-grab rounded-xl border border-cf-border bg-cf-surface-2 p-2 active:cursor-grabbing"
    >
      <video src={clip.previewUrl} className="mb-2 aspect-[9/16] w-full rounded-lg bg-black object-cover" muted preload="metadata" />
      <p className="truncate text-xs font-medium">{clip.name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-cf-muted">
        {clip.durationSec != null && <span>{clip.durationSec.toFixed(1)}s</span>}
        {clip.topic && <Badge tone="accent">{clip.topic}</Badge>}
      </div>
      <button onClick={onDelete} className="mt-2 text-[10px] text-cf-danger hover:underline">
        Delete
      </button>
    </div>
  );
}

function UploadModal({
  open,
  onClose,
  projectId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>("HOOK");
  const [tags, setTags] = useState("");
  const [topic, setTopic] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleUpload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("category", category);
      if (tags) form.append("tags", tags);
      if (topic) form.append("topic", topic);
      if (speaker) form.append("speaker", speaker);
      try {
        await api.post("/clips/upload", form);
      } catch (err) {
        console.error("Upload failed for", file.name, err);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    onUploaded();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload clips">
      <div className="flex flex-col gap-3">
        <input ref={fileRef} type="file" accept="video/*" multiple className="text-sm" />
        <div>
          <label className="mb-1 block text-xs text-cf-muted">Category</label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <Input placeholder="Tags, comma separated" value={tags} onChange={(e) => setTags(e.target.value)} />
        <Input placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <Input placeholder="Speaker / person (optional)" value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
        <Button onClick={handleUpload} disabled={uploading}>
          {uploading ? `Uploading ${progress.done}/${progress.total}…` : "Upload"}
        </Button>
      </div>
    </Modal>
  );
}
