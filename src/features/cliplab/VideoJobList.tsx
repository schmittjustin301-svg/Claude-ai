import clsx from "clsx";
import { useVideoJobStore } from "../../store/videoJobStore";
import { Card, GlowButton } from "../../components/ui";
import { isPending } from "../../lib/higgsfield/videoJobs";
import type { GenerationStatus } from "../../lib/higgsfield/higgsfieldClient";

const STATUS_LABEL: Record<GenerationStatus, string> = {
  queued: "In der Warteschlange",
  in_progress: "Wird generiert",
  completed: "Fertig",
  failed: "Fehlgeschlagen",
  nsfw: "Abgelehnt (NSFW)",
  unknown: "Unbekannt",
};

const STATUS_STYLE: Record<GenerationStatus, string> = {
  queued: "border-ge-gold/40 text-ge-gold",
  in_progress: "border-ge-gold/40 text-ge-gold",
  completed: "border-ge-green/40 text-ge-green",
  failed: "border-ge-red/40 text-ge-red",
  nsfw: "border-ge-red/40 text-ge-red",
  unknown: "border-white/20 text-white/50",
};

export function VideoJobList() {
  const jobs = useVideoJobStore((s) => s.jobs);
  const remove = useVideoJobStore((s) => s.remove);

  if (jobs.length === 0) return null;

  return (
    <Card>
      <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Generierungen</div>
      <div className="flex flex-col gap-2">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-display text-sm tracking-wide text-ge-white uppercase">
                  {job.athlete_name}
                </div>
                <div className="truncate font-mono text-[10px] text-white/40">{job.prompt}</div>
              </div>
              <span
                className={clsx(
                  "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px]",
                  STATUS_STYLE[job.status]
                )}
              >
                {isPending(job) && <span className="mr-1 inline-block animate-pulse">●</span>}
                {STATUS_LABEL[job.status]}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-white/30">
              <span>{job.model}</span>
              {job.source === "jarvis" && <span className="text-ge-green/60">von JARVIS gestartet</span>}
            </div>

            {job.error && <p className="mt-2 font-mono text-[11px] text-ge-red">{job.error}</p>}

            {job.video_url && (
              <div className="mt-2">
                <video src={job.video_url} controls playsInline className="w-full rounded-lg border border-white/10" />
                <div className="mt-2 flex gap-2">
                  <a href={job.video_url} download target="_blank" rel="noreferrer">
                    <GlowButton variant="green">Herunterladen</GlowButton>
                  </a>
                  <GlowButton variant="ghost" onClick={() => remove(job.id)}>
                    Aus Liste entfernen
                  </GlowButton>
                </div>
              </div>
            )}

            {!job.video_url && !isPending(job) && (
              <div className="mt-2">
                <GlowButton variant="ghost" onClick={() => remove(job.id)}>
                  Entfernen
                </GlowButton>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
