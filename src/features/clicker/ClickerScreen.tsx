import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useClickerStore } from "../../store/clickerStore";
import {
  CLICKER_ACHIEVEMENTS,
  CLICKER_UPGRADES,
  CLOUT_PERKS,
  canGoLegacy,
  cloutForPrestige,
  cloutMultiplier,
  comboMultiplier,
  costMultiplier,
  formatReps,
  LEGACY_UNLOCK_CLOUT,
  LEGACY_UNLOCK_PRESTIGES,
  legacyForReset,
  legacyMultiplier,
  milestoneMultiplier,
  nextMilestone,
  nextRank,
  perkCost,
  perkLevel,
  rankFor,
  rankMultiplier,
  RANKS,
  repsPerClick,
  repsPerSecond,
  repsToNextClout,
  upgradeCost,
} from "../../lib/clicker";
import { Card, GlowButton, SectionTitle } from "../../components/ui";

type SubTab = "grind" | "upgrades" | "perks" | "ranks" | "awards";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "grind", label: "Grind" },
  { key: "upgrades", label: "Upgrades" },
  { key: "perks", label: "Perks" },
  { key: "ranks", label: "Ränge" },
  { key: "awards", label: "Awards" },
];

interface FloatingGain {
  id: number;
  x: number;
  y: number;
  value: number;
  crit: boolean;
}

let floatId = 0;

export function ClickerScreen() {
  const s = useClickerStore();
  const [tab, setTab] = useState<SubTab>("grind");
  const [floats, setFloats] = useState<FloatingGain[]>([]);
  const [pressed, setPressed] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    s.init();
    const interval = setInterval(() => s.tick(), 1000);
    // The combo bar and buff timer need to move between ticks.
    const paint = setInterval(() => forceRender((n) => n + 1), 100);
    return () => {
      clearInterval(interval);
      clearInterval(paint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const game = s.gameState();
  const perClick = repsPerClick(game);
  const perSecond = repsPerSecond(game);
  const rank = rankFor(s.totalRepsEarned);
  const upcoming = nextRank(s.totalRepsEarned);
  const potentialClout = cloutForPrestige(s.totalRepsEarned);
  const legacyGain = legacyForReset(s.lifetimeClout);
  const legacyUnlocked = canGoLegacy(s.prestigeCount, s.lifetimeClout);

  const now = Date.now();
  const frenzyActive = s.buff?.kind === "frenzy" && now < s.buff.expiresAt;
  const comboActive = s.combo > 0 && now < s.comboUntil;
  const combo = comboMultiplier(s.combo, s.perks);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const gain = s.click();
    const rect = e.currentTarget.getBoundingClientRect();
    const id = floatId++;
    setFloats((f) => [
      ...f,
      {
        id,
        x: e.clientX - rect.left + (Math.random() * 40 - 20),
        y: e.clientY - rect.top,
        value: gain,
        crit: frenzyActive,
      },
    ]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
    setPressed(true);
    setTimeout(() => setPressed(false), 90);
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle right={<span className="font-mono text-xs text-ge-gold">{rank.name}</span>}>
        Grind Clicker
      </SectionTitle>

      {/* Anchored above the nav rather than at the top: the header already
          carries the event banner and the app's own toasts, and stacking there
          buried both. */}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-1.5 px-3 md:bottom-6">
        <AnimatePresence>
          {s.toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={clsx(
                "rounded-xl border bg-black/90 px-3 py-2 font-mono text-xs backdrop-blur",
                t.kind === "golden" ? "border-ge-gold/60 text-ge-gold" : "border-ge-green/50 text-ge-green"
              )}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {s.offlineGain !== null && (
        <Card className="border-ge-green/40">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-xs text-ge-green">
              Willkommen zurück! Während du weg warst: +{formatReps(s.offlineGain)} Reps 💪
            </p>
            <button onClick={s.dismissOfflineGain} className="font-mono text-xs text-white/40">
              ✕
            </button>
          </div>
        </Card>
      )}

      <div className="flex gap-1.5 overflow-x-auto">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "shrink-0 rounded-lg px-3 py-1.5 font-display text-sm tracking-wide uppercase transition",
              tab === t.key ? "ge-glow-red bg-ge-red/15 text-ge-red" : "bg-white/5 text-white/50 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------ grind */}
      {tab === "grind" && (
        <>
          <Card className="relative overflow-hidden text-center">
            <div className="font-mono text-xs tracking-widest text-white/50 uppercase">Reps</div>
            <div className="ge-text-glow-red font-display text-5xl text-ge-white">{formatReps(s.reps)}</div>
            <div className="mt-1 font-mono text-xs text-white/50">
              +{formatReps(perClick)} / Klick · +{formatReps(perSecond)} / Sek
            </div>

            {(comboActive || frenzyActive) && (
              <div className="mt-2 flex items-center justify-center gap-2">
                {comboActive && (
                  <span className="rounded-full border border-ge-gold/50 px-2 py-0.5 font-mono text-[10px] text-ge-gold">
                    🔥 Combo ×{combo.toFixed(2)} ({s.combo})
                  </span>
                )}
                {frenzyActive && (
                  <span className="ge-glow-gold rounded-full border border-ge-gold/60 px-2 py-0.5 font-mono text-[10px] text-ge-gold">
                    ✨ Frenzy ×{s.buff?.value} · {Math.ceil(((s.buff?.expiresAt ?? 0) - now) / 1000)}s
                  </span>
                )}
              </div>
            )}

            <div className="relative mt-4 flex justify-center">
              <button
                onClick={handleClick}
                className={clsx(
                  "ge-glow-red flex h-40 w-40 items-center justify-center rounded-full text-6xl transition-transform select-none",
                  frenzyActive ? "bg-ge-gold" : "bg-ge-red",
                  pressed ? "scale-95" : "scale-100"
                )}
              >
                🏋️
                <AnimatePresence>
                  {floats.map((f) => (
                    <motion.span
                      key={f.id}
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -70 }}
                      transition={{ duration: 0.9 }}
                      style={{ left: f.x, top: f.y }}
                      className={clsx(
                        "pointer-events-none absolute font-mono text-sm font-bold",
                        f.crit ? "text-ge-gold" : "text-white"
                      )}
                    >
                      +{formatReps(f.value)}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </button>

              {/* Golden rep — a short window that rewards actually watching */}
              <AnimatePresence>
                {s.golden && (
                  <motion.button
                    key={s.golden.id}
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={s.collectGolden}
                    style={{ left: `${s.golden.x}%`, top: `${s.golden.y}%` }}
                    className="ge-glow-gold absolute z-10 h-12 w-12 rounded-full bg-ge-gold text-2xl"
                  >
                    ✨
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 font-mono text-[10px] text-white/35">
              {s.totalClicks.toLocaleString("de-DE")} Klicks · {formatReps(s.lifetimeReps)} Reps insgesamt
            </div>
          </Card>

          <Card>
            <div className="mb-1 font-mono text-xs tracking-widest text-white/50 uppercase">Rebrand (Prestige)</div>
            <p className="text-sm text-white/70">
              Setzt Reps und Upgrades zurück und tauscht sie in <span className="text-ge-gold">Clout</span> — dauerhaft
              +2% pro Punkt, plus alles, was du dir davon im Perks-Tab kaufst.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-ge-gold">
                {potentialClout >= 1 ? `+${potentialClout} Clout verfügbar` : `Noch ${formatReps(repsToNextClout(s.totalRepsEarned))} Reps bis +1 Clout`}
              </span>
              <GlowButton variant="gold" onClick={s.prestige} disabled={potentialClout < 1} className="ml-auto">
                Rebrand
              </GlowButton>
            </div>
            <div className="mt-2 font-mono text-[10px] text-white/35">
              {s.clout} Clout · {s.prestigeCount} Rebrands · Multiplikator ×{cloutMultiplier(s.clout).toFixed(2)}
            </div>
          </Card>

          <Card className={clsx(!legacyUnlocked && "opacity-60")}>
            <div className="mb-1 font-mono text-xs tracking-widest text-white/50 uppercase">Legacy</div>
            {legacyUnlocked ? (
              <>
                <p className="text-sm text-white/70">
                  Die zweite Ebene: setzt <span className="text-ge-red">auch Clout und Perks</span> zurück und gibt dafür
                  Legacy — <span className="text-ge-gold">+50% auf alles</span> pro Punkt, für immer.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ge-gold">+{legacyGain} Legacy verfügbar</span>
                  <GlowButton
                    variant="gold"
                    className="ml-auto"
                    onClick={() => {
                      if (confirm(`Legacy durchführen? Clout, Perks und Upgrades werden zurückgesetzt. Du bekommst +${legacyGain} Legacy.`)) {
                        s.goLegacy();
                      }
                    }}
                    disabled={legacyGain < 1}
                  >
                    Legacy
                  </GlowButton>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/50">
                Freigeschaltet ab {LEGACY_UNLOCK_PRESTIGES} Rebrands und {LEGACY_UNLOCK_CLOUT} verdientem Clout.
                <br />
                <span className="font-mono text-[11px] text-white/40">
                  Aktuell: {s.prestigeCount}/{LEGACY_UNLOCK_PRESTIGES} Rebrands · {s.lifetimeClout}/{LEGACY_UNLOCK_CLOUT} Clout
                </span>
              </p>
            )}
            <div className="mt-2 font-mono text-[10px] text-white/35">
              {s.legacy} Legacy · {s.legacyCount}× zurückgesetzt · Multiplikator ×{legacyMultiplier(s.legacy).toFixed(1)}
            </div>
          </Card>
        </>
      )}

      {/* --------------------------------------------------------- upgrades */}
      {tab === "upgrades" && (
        <Card>
          <div className="mb-3 font-mono text-xs tracking-widest text-white/50 uppercase">
            Upgrades · alle {25} Stufen verdoppelt sich die Wirkung
          </div>
          <div className="flex flex-col gap-2">
            {CLICKER_UPGRADES.map((u) => {
              const owned = s.owned[u.id] ?? 0;
              const cost = Math.ceil(upgradeCost(u.baseCost, owned) * costMultiplier(s.perks));
              const affordable = s.reps >= cost;
              // Hide upgrades far out of reach so the list stays readable early on.
              const visible = owned > 0 || s.lifetimeReps >= u.baseCost * 0.4;
              if (!visible) return null;
              const mult = milestoneMultiplier(owned);

              return (
                <div
                  key={u.id}
                  className={clsx(
                    "rounded-lg border p-3 transition",
                    affordable ? "border-ge-green/30 bg-white/5" : "border-white/10 bg-white/[0.02] opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{u.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-white">{u.name}</span>
                        {owned > 0 && <span className="font-mono text-[10px] text-white/40">Lv.{owned}</span>}
                        {mult > 1 && (
                          <span className="rounded-full border border-ge-gold/40 px-1.5 font-mono text-[9px] text-ge-gold">
                            ×{mult}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-white/45">{u.description}</div>
                      {owned > 0 && (
                        <div className="font-mono text-[9px] text-white/30">
                          Nächster Meilenstein bei Lv.{nextMilestone(owned)}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={clsx("font-mono text-xs", affordable ? "text-ge-green" : "text-white/40")}>
                        {formatReps(cost)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => s.buyUpgrade(u.id, 1)}
                          disabled={!affordable}
                          className="rounded border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/70 disabled:opacity-30"
                        >
                          ×1
                        </button>
                        <button
                          onClick={() => s.buyUpgrade(u.id, 10)}
                          disabled={!affordable}
                          className="rounded border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/70 disabled:opacity-30"
                        >
                          ×10
                        </button>
                        <button
                          onClick={() => s.buyMax(u.id)}
                          disabled={!affordable}
                          className="rounded border border-ge-red/40 px-2 py-0.5 font-mono text-[10px] text-ge-red disabled:opacity-30"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------ perks */}
      {tab === "perks" && (
        <Card>
          <div className="mb-1 font-mono text-xs tracking-widest text-white/50 uppercase">Clout-Perks</div>
          <p className="mb-3 font-mono text-[11px] text-white/40">
            Dauerhaft — überleben jeden Rebrand. Verfügbar: <span className="text-ge-gold">{s.clout} Clout</span>
          </p>
          <div className="flex flex-col gap-2">
            {CLOUT_PERKS.map((p) => {
              const level = perkLevel(s.perks, p.id);
              const maxed = level >= p.maxLevel;
              const cost = perkCost(p, level);
              const affordable = !maxed && s.clout >= cost;
              return (
                <div
                  key={p.id}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg border p-3",
                    maxed
                      ? "border-ge-gold/40 bg-ge-gold/5"
                      : affordable
                        ? "border-ge-green/30 bg-white/5"
                        : "border-white/10 bg-white/[0.02] opacity-60"
                  )}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{p.name}</span>
                      <span className="font-mono text-[10px] text-white/40">
                        {level}/{p.maxLevel}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-white/45">{p.description}</div>
                  </div>
                  {maxed ? (
                    <span className="shrink-0 font-mono text-[10px] text-ge-gold uppercase">Max</span>
                  ) : (
                    <button
                      onClick={() => s.buyPerk(p.id)}
                      disabled={!affordable}
                      className="shrink-0 rounded border border-ge-gold/40 px-2.5 py-1 font-mono text-[11px] text-ge-gold disabled:opacity-30"
                    >
                      {cost} ✦
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------ ranks */}
      {tab === "ranks" && (
        <Card>
          <div className="mb-1 font-mono text-xs tracking-widest text-white/50 uppercase">Ränge</div>
          <p className="mb-3 font-mono text-[11px] text-white/40">
            Jeder Rang gibt dauerhaft +8% auf alles. Aktuell ×{rankMultiplier(s.totalRepsEarned).toFixed(2)}.
            {upcoming && ` Nächster: ${upcoming.name} bei ${formatReps(upcoming.threshold)} Reps.`}
          </p>
          <div className="flex flex-col gap-1">
            {RANKS.map((r) => {
              const reached = s.totalRepsEarned >= r.threshold;
              const current = r.index === rank.index;
              return (
                <div
                  key={r.index}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5",
                    current ? "ge-glow-red bg-ge-red/15" : reached ? "bg-white/5" : "opacity-40"
                  )}
                >
                  <span className="w-6 font-mono text-[10px] text-white/40">{r.index + 1}</span>
                  <span className={clsx("flex-1 text-sm", current ? "text-ge-red" : reached ? "text-white" : "text-white/50")}>
                    {r.name}
                  </span>
                  <span className="font-mono text-[10px] text-white/35">{formatReps(r.threshold)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ----------------------------------------------------------- awards */}
      {tab === "awards" && (
        <Card>
          <div className="mb-1 font-mono text-xs tracking-widest text-white/50 uppercase">
            Awards {s.achievements.length}/{CLICKER_ACHIEVEMENTS.length}
          </div>
          <p className="mb-3 font-mono text-[11px] text-white/40">Jedes Award gibt dauerhaft +2% auf alles.</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {CLICKER_ACHIEVEMENTS.map((a) => {
              const got = s.achievements.includes(a.id);
              return (
                <div
                  key={a.id}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2",
                    got ? "border-ge-gold/40 bg-ge-gold/5" : "border-white/10 opacity-45"
                  )}
                >
                  <span className="text-lg">{got ? "🏆" : "🔒"}</span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">{a.name}</div>
                    <div className="truncate font-mono text-[10px] text-white/45">{a.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
