import { useVideoJobStore } from "../../store/videoJobStore";
import { useClipStore } from "../../store/clipStore";
import { Card } from "../../components/ui";

/**
 * Higgsfield's API exposes no balance endpoint — only a CreditsError once the
 * account runs dry. So this counts what this app actually started rather than
 * pretending to read a balance, and says so.
 */
export function UsagePanel() {
  const jobs = useVideoJobStore((s) => s.jobs);
  const clips = useClipStore((s) => s.clips);

  const fromPhotos = jobs.length;
  const fromClips = clips.filter((c) => c.higgsfield_job_id).length;
  const total = fromPhotos + fromClips;
  if (total === 0) return null;

  const failed =
    jobs.filter((j) => j.status === "failed" || j.status === "nsfw").length +
    clips.filter((c) => c.status === "failed").length;

  const byModel = new Map<string, number>();
  for (const job of jobs) byModel.set(job.model, (byModel.get(job.model) ?? 0) + 1);

  return (
    <Card>
      <div className="mb-2 font-mono text-xs tracking-widest text-white/50 uppercase">Verbrauch</div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Gesamt" value={total} />
        <Stat label="Aus Fotos" value={fromPhotos} />
        <Stat label="Aus Clips" value={fromClips} />
      </div>
      {byModel.size > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...byModel.entries()].map(([model, count]) => (
            <span key={model} className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/50">
              {model}: {count}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/35">
        Gezählt werden Generierungen, die diese App gestartet hat{failed > 0 ? ` (davon ${failed} fehlgeschlagen)` : ""}.
        Higgsfield bietet keine Abfrage des Kontostands an — den echten Stand siehst du unter cloud.higgsfield.ai.
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 p-2.5 text-center">
      <div className="font-mono text-[10px] text-white/40 uppercase">{label}</div>
      <div className="font-display text-xl text-ge-white">{value}</div>
    </div>
  );
}
