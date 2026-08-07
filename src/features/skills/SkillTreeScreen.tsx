import { useEmpireStore } from "../../store/empireStore";
import { Card, GlowButton, ProgressBar, SectionTitle } from "../../components/ui";

export function SkillTreeScreen() {
  const skills = useEmpireStore((s) => s.skills);
  const trainSkill = useEmpireStore((s) => s.trainSkill);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Skill Tree</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {skills.map((skill) => {
          const mastered = skill.level >= 5;
          return (
            <Card key={skill.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg tracking-wide text-ge-white uppercase">{skill.name}</div>
                  <div className="mt-0.5 text-xs text-white/50">{skill.description}</div>
                </div>
                {mastered && (
                  <span className="ge-glow-gold shrink-0 rounded-full border border-ge-gold/50 px-2 py-0.5 font-mono text-[10px] text-ge-gold uppercase">
                    Mastered
                  </span>
                )}
              </div>
              <div className="mt-3">
                <ProgressBar
                  value={skill.level}
                  max={5}
                  colorClass={mastered ? "bg-ge-gold" : "bg-ge-red"}
                  glowClass={mastered ? "ge-glow-gold" : "ge-glow-red"}
                  label={`Stufe ${skill.level} / 5`}
                />
              </div>
              <div className="mt-3">
                <GlowButton variant="ghost" disabled={mastered} onClick={() => trainSkill(skill.id)}>
                  {mastered ? "Max" : "Trainieren"}
                </GlowButton>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
