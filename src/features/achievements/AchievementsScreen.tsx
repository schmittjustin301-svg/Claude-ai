import clsx from "clsx";
import { useEmpireStore } from "../../store/empireStore";
import { Card, SectionTitle } from "../../components/ui";
import { ACHIEVEMENT_DEFS } from "../../lib/seed";

export function AchievementsScreen() {
  const achievements = useEmpireStore((s) => s.achievements);
  const unlockedCount = achievements.filter((a) => a.unlocked_at).length;

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle right={<span className="font-mono text-xs text-white/50">{unlockedCount} / {achievements.length}</span>}>
        Achievements
      </SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {achievements.map((a) => {
          const def = ACHIEVEMENT_DEFS.find((d) => d.key === a.achievement_key);
          const unlocked = Boolean(a.unlocked_at);
          return (
            <Card key={a.id} className={clsx(!unlocked && "opacity-45")}>
              <div className="flex items-center gap-3">
                <div className={clsx("text-2xl", unlocked ? "" : "grayscale")}>{unlocked ? "🏆" : "🔒"}</div>
                <div>
                  <div className="font-display text-base tracking-wide text-ge-white uppercase">{def?.title ?? a.achievement_key}</div>
                  <div className="text-xs text-white/50">{def?.description}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
