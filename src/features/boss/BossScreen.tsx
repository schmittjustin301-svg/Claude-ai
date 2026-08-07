import { useEffect, useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { useEmpireStore } from "../../store/empireStore";
import { Card, ProgressBar, SectionTitle } from "../../components/ui";

export function BossScreen() {
  const boss = useEmpireStore((s) => s.bossState);
  const bossShake = useEmpireStore((s) => s.bossShake);
  const contracts = useEmpireStore((s) => s.contracts);
  const controls = useAnimationControls();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void controls.start({
      x: [0, -10, 10, -8, 8, -4, 4, 0],
      transition: { duration: 0.45 },
    });
  }, [bossShake, controls]);

  const doneToday = contracts.filter((c) => c.done).length;
  const hpPct = Math.round((boss.hp / boss.max_hp) * 100);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        right={<span className="font-mono text-xs text-white/50">{boss.defeated_count} besiegt</span>}
      >
        Boss Fight
      </SectionTitle>

      <motion.div animate={controls}>
        <Card className="ge-grid-bg text-center">
          <div className="font-mono text-xs tracking-widest text-white/50 uppercase">Wöchentlicher Boss</div>
          <div className="ge-text-glow-red font-display text-4xl text-ge-white">{boss.name}</div>
          <div className="my-6 text-7xl">{hpPct <= 0 ? "💀" : "👹"}</div>
          <ProgressBar value={boss.hp} max={boss.max_hp} colorClass="bg-ge-red" glowClass="ge-glow-red" />
          <div className="mt-2 font-mono text-sm text-white/70">
            {boss.hp} / {boss.max_hp} HP ({hpPct}%)
          </div>
        </Card>
      </motion.div>

      <Card>
        <div className="font-mono text-xs tracking-widest text-white/50 uppercase">So funktioniert's</div>
        <p className="mt-2 text-sm text-white/60">
          Jeder abgeschlossene Contract im Today-Tab fügt dem Boss Schaden zu. Ist die HP auf 0, erscheint ein neuer,
          stärkerer Boss.
        </p>
        <div className="mt-3 font-mono text-xs text-white/40">Heute erledigt: {doneToday} Contracts</div>
      </Card>
    </div>
  );
}
