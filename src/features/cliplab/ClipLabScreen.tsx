import { useEffect } from "react";
import { SectionTitle } from "../../components/ui";
import { useAthleteStore } from "../../store/athleteStore";
import { useVideoJobStore } from "../../store/videoJobStore";
import { VideoStudio } from "./VideoStudio";
import { VideoJobList } from "./VideoJobList";

/**
 * Clip Lab is its own module: video work no longer lives inside the athlete
 * library. The two stay connected by reference only — a clip may point at an
 * athlete, but does not have to.
 */
export function ClipLabScreen() {
  const loadAthletes = useAthleteStore((s) => s.load);
  const jobs = useVideoJobStore((s) => s.jobs);

  // Athletes are a reference source here, not this module's own data.
  useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  const running = jobs.filter((j) => j.status === "queued" || j.status === "in_progress").length;

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

      <VideoStudio />

      {/* Owned by the module, not by the generate form: existing clips must stay
          visible even when the athlete library is empty. */}
      <VideoJobList />
    </div>
  );
}
