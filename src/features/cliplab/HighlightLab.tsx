import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useClipStore } from "../../store/clipStore";
import { useAthleteStore } from "../../store/athleteStore";
import { Card, EmptyState, GlowButton } from "../../components/ui";
import { CLIP_STATUS_LABEL, clipDuration, formatTime, type ClipStatus } from "../../lib/cliplab/clipTypes";
import { DOP_MODELS, type DoPModel } from "../../lib/higgsfield/higgsfieldClient";

const STATUS_STYLE: Record<ClipStatus, string> = {
  draft: "border-white/20 text-white/50",
  queued: "border-ge-gold/40 text-ge-gold",
  processing: "border-ge-gold/40 text-ge-gold",
  done: "border-ge-green/40 text-ge-green",
  failed: "border-ge-red/40 text-ge-red",
};

export function HighlightLab() {
  const videos = useClipStore((s) => s.videos);
  const clips = useClipStore((s) => s.clips);
  const load = useClipStore((s) => s.load);
  const addVideo = useClipStore((s) => s.addVideo);
  const removeVideo = useClipStore((s) => s.removeVideo);
  const addClip = useClipStore((s) => s.addClip);
  const removeClip = useClipStore((s) => s.removeClip);
  const processClip = useClipStore((s) => s.processClip);

  const athletes = useAthleteStore((s) => s.athletes);

  const [videoId, setVideoId] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(5);
  const [label, setLabel] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("Cinematic slow motion, dramatic lighting, shallow depth of field");
  const [model, setModel] = useState<DoPModel>("dop-turbo");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const video = videos.find((v) => v.id === videoId) ?? null;
  const clipsForVideo = useMemo(
    () => clips.filter((c) => !videoId || c.source_video_id === videoId),
    [clips, videoId]
  );

  useEffect(() => {
    if (!videoId && videos.length > 0) setVideoId(videos[0].id);
  }, [videos, videoId]);

  useEffect(() => {
    if (video) {
      setStart(0);
      setEnd(Math.min(5, video.duration));
    }
  }, [video]);

  function seek(to: number) {
    if (videoRef.current) videoRef.current.currentTime = to;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Video hochladen</div>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              await addVideo(file);
            } finally {
              setBusy(false);
              if (fileRef.current) fileRef.current.value = "";
            }
          }}
          className="block w-full text-xs text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-ge-red file:px-3 file:py-1.5 file:text-xs file:text-white"
        />
        {busy && <p className="mt-2 font-mono text-[11px] text-ge-gold">Wird eingelesen…</p>}

        {videos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => setVideoId(v.id)}
                className={clsx(
                  "rounded-full border px-3 py-1 font-mono text-[11px] transition",
                  videoId === v.id ? "border-ge-red/60 bg-ge-red/15 text-ge-red" : "border-white/15 text-white/60"
                )}
              >
                {v.name.slice(0, 24)} · {formatTime(v.duration)}
              </button>
            ))}
          </div>
        )}
      </Card>

      {!video ? (
        <EmptyState>Lade ein Video hoch, um Highlights zu markieren.</EmptyState>
      ) : (
        <Card>
          <video
            ref={videoRef}
            src={video.url}
            controls
            playsInline
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            className="w-full rounded-lg border border-white/10"
          />

          <div className="mt-3 font-mono text-[11px] text-white/50">
            Position {formatTime(current)} · Segment {formatTime(start)}–{formatTime(end)} ({clipDuration({ start_time: start, end_time: end }).toFixed(1)}s)
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Start</span>
              <input
                type="range"
                min={0}
                max={video.duration}
                step={0.1}
                value={start}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setStart(v);
                  if (v >= end) setEnd(Math.min(video.duration, v + 1));
                  seek(v);
                }}
                className="accent-[#ff1432]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase">Ende</span>
              <input
                type="range"
                min={0}
                max={video.duration}
                step={0.1}
                value={end}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setEnd(v);
                  if (v <= start) setStart(Math.max(0, v - 1));
                  seek(v);
                }}
                className="accent-[#ff1432]"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <GlowButton variant="ghost" onClick={() => setStart(current)}>
              Start = jetzt
            </GlowButton>
            <GlowButton variant="ghost" onClick={() => setEnd(current)}>
              Ende = jetzt
            </GlowButton>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Bezeichnung, z.B. Backstage Posing"
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            />
            <select
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            >
              <option value="">Kein Athlet (optional)</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <GlowButton
              onClick={() => {
                const athlete = athletes.find((a) => a.id === athleteId);
                void addClip({
                  sourceVideoId: video.id,
                  start,
                  end,
                  label: label.trim() || `Clip ${formatTime(start)}`,
                  athleteId: athlete?.id ?? null,
                  athleteName: athlete?.full_name ?? null,
                });
                setLabel("");
              }}
              disabled={end <= start}
            >
              Highlight markieren
            </GlowButton>
            <GlowButton
              variant="ghost"
              className="ml-2"
              onClick={() => {
                if (confirm(`Video "${video.name}" und alle zugehörigen Clips löschen?`)) void removeVideo(video.id);
              }}
            >
              Video löschen
            </GlowButton>
          </div>
        </Card>
      )}

      {clipsForVideo.length > 0 && (
        <Card>
          <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">
            Highlights ({clipsForVideo.length})
          </div>

          <div className="mb-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <p className="font-mono text-[10px] leading-relaxed text-white/40">
              Higgsfield erzeugt Videos <span className="text-white/70">aus einem Bild</span> — eine Video-zu-Video-
              Bearbeitung (Upscaling, Stilisierung des Originalclips) bietet die API nicht an. Weitergegeben wird
              deshalb ein Frame aus der Mitte des Segments, aus dem ein neuer Clip generiert wird. Dein Original bleibt
              unangetastet erhalten.
            </p>
          </div>

          <div className="mb-3 flex flex-col gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Beschreibung für die Generierung"
              className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as DoPModel)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-ge-red"
            >
              {DOP_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.hint}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {clipsForVideo.map((clip) => (
              <div key={clip.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start gap-3">
                  {clip.poster_url ? (
                    <img src={clip.poster_url} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-white/5 text-sm">🎞️</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{clip.label}</div>
                    <div className="font-mono text-[10px] text-white/40">
                      {formatTime(clip.start_time)}–{formatTime(clip.end_time)} ·{" "}
                      {clipDuration(clip).toFixed(1)}s
                      {clip.athlete_name ? ` · ${clip.athlete_name}` : ""}
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px]",
                      STATUS_STYLE[clip.status]
                    )}
                  >
                    {(clip.status === "queued" || clip.status === "processing") && (
                      <span className="mr-1 inline-block animate-pulse">●</span>
                    )}
                    {CLIP_STATUS_LABEL[clip.status]}
                  </span>
                </div>

                {clip.error && <p className="mt-2 font-mono text-[11px] text-ge-red">{clip.error}</p>}

                {clip.processed_url && (
                  <div className="mt-2">
                    <video src={clip.processed_url} controls playsInline className="w-full rounded border border-white/10" />
                    <a href={clip.processed_url} download target="_blank" rel="noreferrer">
                      <GlowButton variant="green" className="mt-2">
                        Herunterladen
                      </GlowButton>
                    </a>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  <GlowButton
                    variant="ghost"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = clip.start_time;
                        void videoRef.current.play();
                      }
                    }}
                  >
                    Abspielen
                  </GlowButton>
                  <GlowButton
                    onClick={() => void processClip(clip.id, prompt, model)}
                    disabled={clip.status === "queued" || clip.status === "processing" || !prompt.trim()}
                  >
                    An Higgsfield
                  </GlowButton>
                  <GlowButton variant="ghost" onClick={() => void removeClip(clip.id)}>
                    ✕
                  </GlowButton>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
