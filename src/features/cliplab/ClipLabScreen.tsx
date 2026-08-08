import { useEffect, useState } from "react";
import clsx from "clsx";
import { SectionTitle } from "../../components/ui";
import { useAthleteStore } from "../../store/athleteStore";
import { useVideoJobStore } from "../../store/videoJobStore";
import { useClipStore } from "../../store/clipStore";
import { VideoStudio } from "./VideoStudio";
import { VideoJobList } from "./VideoJobList";
import { HighlightLab } from "./HighlightLab";
import { UsagePanel } from "./UsagePanel";

type SubTab = "generate" | "highlights";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "generate", label: "Aus Foto" },
  { key: "highlights", label: "Highlights" },
];

/**
 * Clip Lab is its own module: video work no longer lives inside the athlete
 * library. The two stay connected by reference only — a clip may point at an
 * athlete, but does not have to.
 */
export function ClipLabScreen() {
  const [tab, setTab] = useState<SubTab>("generate");
  const loadAthletes = useAthleteStore((s) => s.load);
  const jobs = useVideoJobStore((s) => s.jobs);
  const clips = useClipStore((s) => s.clips);
  const loadClips = useClipStore((s) => s.load);

  // Athletes are a reference source here, not this module's own data.
  useEffect(() => {
    void loadAthletes();
    void loadClips();
  }, [loadAthletes, loadClips]);

  const running =
    jobs.filter((j) => j.status === "queued" || j.status === "in_progress").length +
    clips.filter((c) => c.status === "queued" || c.status === "processing").length;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle
        right={
          <span className="font-mono text-xs text-white/50">
            {running > 0 ? `${running} laufend` : `${jobs.length} Clips`}
          </span>
        }
      >
        Clip Lab
      </SectionTitle>

      <div className="flex gap-1.5">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "rounded-lg px-3 py-1.5 font-display text-sm tracking-wide uppercase transition",
              tab === t.key ? "ge-glow-red bg-ge-red/15 text-ge-red" : "bg-white/5 text-white/50 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "generate" && (
        <>
          <VideoStudio />
          {/* Owned by the module, not by the generate form: existing clips must
              stay visible even when the athlete library is empty. */}
          <VideoJobList />
        </>
      )}
      {tab === "highlights" && <HighlightLab />}

      <UsagePanel />
    </div>
  );
}
