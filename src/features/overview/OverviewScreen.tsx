import { useEmpireStore } from "../../store/empireStore";
import { canPrestige, levelFromXp, prestigeMultiplier, tierForLevel } from "../../lib/gameLogic";
import { Card, GlowButton, ProgressBar, SectionTitle, TierBadge } from "../../components/ui";
import { SkylineBuilding } from "./SkylineBuilding";

export function OverviewScreen() {
  const appState = useEmpireStore((s) => s.appState);
  const channels = useEmpireStore((s) => s.channels);
  const prestige = useEmpireStore((s) => s.prestige);

  const { level, xpIntoLevel, xpForNext } = levelFromXp(appState.total_xp);
  const tier = tierForLevel(level);
  const eligible = canPrestige(level);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle right={<TierBadge tier={tier} />}>Empire Overview</SectionTitle>

      <Card>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-mono text-xs tracking-widest text-white/50 uppercase">Empire Valuation</div>
            <div className="ge-text-glow-red font-display text-4xl text-ge-white">Level {level}</div>
          </div>
          <div className="text-right font-mono text-xs text-white/50">
            Prestige x{appState.prestige}
            <br />
            Multiplier ×{prestigeMultiplier(appState.prestige).toFixed(1)}
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={xpIntoLevel} max={xpForNext} colorClass="bg-ge-red" glowClass="ge-glow-red" />
          <div className="mt-1 font-mono text-[11px] text-white/50">
            {xpIntoLevel} / {xpForNext} XP zum nächsten Level
          </div>
        </div>
        {eligible && (
          <div className="mt-4">
            <GlowButton
              variant="gold"
              onClick={() => {
                if (confirm("Prestige jetzt durchführen? Dein Level wird zurückgesetzt, du behältst dauerhaft +10% XP.")) {
                  prestige();
                }
              }}
            >
              Prestige durchführen
            </GlowButton>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-xs tracking-widest text-white/50 uppercase">Empire Health</div>
          <div className="font-mono text-xs text-white/70">{appState.empire_health}%</div>
        </div>
        <ProgressBar
          value={appState.empire_health}
          max={100}
          colorClass={appState.empire_health < 40 ? "bg-ge-red" : "bg-ge-green"}
          glowClass={appState.empire_health < 40 ? "ge-glow-red" : "ge-glow-green"}
        />
        {appState.empire_health < 60 && (
          <div className="mt-2 font-mono text-[11px] text-ge-red">Inaktivität schadet deinem Empire. Zeit für einen Contract.</div>
        )}
      </Card>

      <Card>
        <div className="mb-4 font-mono text-xs tracking-widest text-white/50 uppercase">Business Units</div>
        <div className="flex h-52 items-end gap-3">
          {channels.map((c) => {
            const cl = levelFromXp(c.xp);
            return <SkylineBuilding key={c.id} name={c.name} icon={c.icon} level={cl.level} tier={tierForLevel(cl.level)} />;
          })}
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-3 font-mono text-xs text-white/70">
          <Stat label="Streak" value={`${appState.streak} 🔥`} />
          <Stat label="Total XP" value={appState.total_xp.toString()} />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <div className="text-white/40 uppercase">{label}</div>
      <div className="mt-1 text-base text-ge-white">{value}</div>
    </div>
  );
}
