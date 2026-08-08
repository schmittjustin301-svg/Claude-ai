import { useEffect } from "react";
import { useVideoJobStore } from "../../store/videoJobStore";
import { useEmpireStore } from "../../store/empireStore";
import { sound } from "../../lib/sound";
import { isPending } from "../../lib/higgsfield/videoJobs";

/**
 * Announces finished generations wherever the user happens to be.
 *
 * Mounted at the app root rather than in the video tab: a generation runs for
 * minutes, so the tab that started it is usually long gone by the time it
 * lands. Each job is announced once, tracked on the job itself so a reload
 * cannot repeat an old announcement.
 */
export function useVideoJobNotifier(): void {
  const jobs = useVideoJobStore((s) => s.jobs);
  const markNotified = useVideoJobStore((s) => s.markNotified);

  useEffect(() => {
    for (const job of jobs) {
      if (job.notified || isPending(job)) continue;

      markNotified(job.id);

      const notify = useEmpireStore.getState().notify;
      if (job.status === "completed") {
        sound.achievement();
        notify(`Video fertig: ${job.athlete_name}`, "achievement");
      } else {
        notify(`Video fehlgeschlagen: ${job.athlete_name}`, "boss");
      }
    }
  }, [jobs, markNotified]);
}
