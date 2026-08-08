import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useClickerStore } from "../../store/clickerStore";
import {
  CLICKER_UPGRADES,
  cloutForPrestige,
  cloutMultiplier,
  formatReps,
  repsPerClick,
  repsPerSecond,
  upgradeCost,
} from "../../lib/clicker";
import { Card, GlowButton, SectionTitle } from "../../components/ui";

interface FloatingGain {
  id: number;
  x: number;
  y: number;
  value: number;
}

let floatId = 0;

export function ClickerScreen() {
  const reps = useClickerStore((s) => s.reps);
  const totalRepsEarned = useClickerStore((s) => s.totalRepsEarned);
  const totalClicks = useClickerStore((s) => s.totalClicks);
  const owned = useClickerStore((s) => s.owned);
  const clout = useClickerStore((s) => s.clout);
  const prestigeCount = useClickerStore((s) => s.prestigeCount);
  const offlineGain = useClickerStore((s) => s.offlineGain);
  const init = useClickerStore((s) => s.init);
  const click = useClickerStore((s) => s.click);
  const buyUpgrade = useClickerStore((s) => s.buyUpgrade);
  const prestige = useClickerStore((s) => s.prestige);
  const tick = useClickerStore((s) => s.tick);
  const dismissOfflineGain = useClickerStore((s) => s.dismissOfflineGain);

  const [floats, setFloats] = useState<FloatingGain[]>([]);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    init();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const perClick = repsPerClick(owned, clout);
  const perSecond = repsPerSecond(owned, clout);
  const potentialClout = cloutForPrestige(totalRepsEarned);
  const canPrestigeNow = potentialClout >= 1;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    click();
    const rect = e.currentTarget.getBoundingClientRect();
    const id = floatId++;
    setFloats((f) => [
      ...f,
      { id, x: e.clientX - rect.left + (Math.random() * 40 - 20), y: e.clientY - rect.top, value: perClick },
    ]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 800);
    setPressed(true);
    setTimeout(() => setPressed(false), 90);
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        right={
          clout > 0 && (
            <span className="rounded-full border border-ge-gold/40 px-2.5 py-0.5 font-mono text-[11px] text-ge-gold">
              x{cloutMultiplier(clout).toFixed(2)} Clout
            </span>
          )
        }
      >
        Grind Clicker
      </SectionTitle>

      <AnimatePresence>
        {offlineGain != null && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-ge-green/40 bg-ge-green/5" onClick={dismissOfflineGain}>
              <div className="cursor-pointer text-sm text-ge-green">
                Willkommen zurück! Während du weg warst: +{formatReps(offlineGain)} Reps 💪
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="ge-grid-bg text-center">
        <div className="font-mono text-xs tracking-widest text-white/50 uppercase">Reps</div>
        <div className="ge-text-glow-red font-display text-5xl text-ge-white tabular-nums">{formatReps(reps)}</div>
        <div className="mt-1 font-mono text-xs text-white/40">
          +{formatReps(perClick)} / Klick · +{formatReps(perSecond)} / Sek
        </div>

        <div className="relative mx-auto mt-6 mb-2 h-40 w-40">
          <AnimatePresence>
            {floats.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, y: 0, x: f.x, scale: 0.9 }}
                animate={{ opacity: 0, y: -50 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="pointer-events-none absolute font-display text-lg text-ge-green"
                style={{ left: 0, top: f.y }}
              >
                +{formatReps(f.value)}
              </motion.div>
            ))}
          </AnimatePresence>
          <motion.button
            animate={{ scale: pressed ? 0.92 : 1 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 400, damping: 12 }}
            onClick={handleClick}
            className="ge-glow-red flex h-40 w-40 items-center justify-center rounded-full bg-ge-red text-6xl select-none"
          >
            🏋️
          </motion.button>
        </div>
        <div className="font-mono text-[11px] text-white/40">{totalClicks} Klicks · {formatReps(totalRepsEarned)} Reps insgesamt</div>
      </Card>

      <Card className="border-ge-gold/30">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-xs tracking-widest text-white/50 uppercase">Rebrand (Prestige)</div>
          {prestigeCount > 0 && <span className="font-mono text-[11px] text-white/40">{prestigeCount}x rebranded</span>}
        </div>
        <p className="text-sm text-white/60">
          Setz deinen Fortschritt zurück und tausch ihn in <span className="text-ge-gold">Clout</span> — dauerhaft +2% Reps
          pro Punkt, für immer.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="font-mono text-sm text-ge-gold">
            {canPrestigeNow ? `+${potentialClout} Clout verfügbar` : `Noch ${formatReps(100000 - totalRepsEarned)} Reps bis zum ersten Rebrand`}
          </div>
          <GlowButton variant="gold" disabled={!canPrestigeNow} onClick={prestige}>
            Rebrand
          </GlowButton>
        </div>
      </Card>

      <Card>
        <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">Upgrades</div>
        <div className="flex flex-col gap-2">
          {CLICKER_UPGRADES.map((u) => {
            const level = owned[u.id] ?? 0;
            const cost = upgradeCost(u.baseCost, level);
            const affordable = reps >= cost;
            return (
              <button
                key={u.id}
                onClick={() => buyUpgrade(u.id)}
                disabled={!affordable}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2.5 text-left transition disabled:opacity-40 enabled:hover:bg-white/10"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl">{u.icon}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">
                      {u.name} {level > 0 && <span className="font-mono text-[11px] text-white/40">Lv.{level}</span>}
                    </div>
                    <div className="font-mono text-[11px] text-white/40">{u.description}</div>
                  </div>
                </div>
                <div className={"shrink-0 font-mono text-sm " + (affordable ? "text-ge-green" : "text-white/40")}>
                  {formatReps(cost)}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
