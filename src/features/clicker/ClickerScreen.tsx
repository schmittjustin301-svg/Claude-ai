import { useEffect, useState, type ReactNode } from "react";
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
  questLabel,
  questProgress,
  rankFor,
  rankMultiplier,
  RANKS,
  repsPerClick,
  repsPerSecond,
  repsToNextClout,
  upgradeCost,
  type Quest,
} from "../../lib/clicker";
import { GlowButton } from "../../components/ui";

/* ------------------------------------------------------------ primitives */

/** Panel with a heading — the dashboard's building block. */
function Panel({
  title,
  right,
  children,
  className,
  accent,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: "red" | "gold" | "green";
}) {
  const glow =
    accent === "gold"
      ? "border-ge-gold/30"
      : accent === "green"
        ? "border-ge-green/25"
        : accent === "red"
          ? "border-ge-red/30"
          : "border-white/10";
  return (
    <section className={clsx("flex flex-col rounded-2xl border bg-white/[0.03] backdrop-blur-sm", glow, className)}>
      <header className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5">
        <h3 className="font-display text-sm tracking-[0.15em] text-white/70 uppercase">{title}</h3>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}

function Meter({
  value,
  label,
  right,
  color = "red",
}: {
  value: number;
  label?: string;
  right?: string;
  color?: "red" | "gold" | "green";
}) {
  const bar = color === "gold" ? "bg-ge-gold" : color === "green" ? "bg-ge-green" : "bg-ge-red";
  const glow = color === "gold" ? "ge-glow-gold" : color === "green" ? "ge-glow-green" : "ge-glow-red";
  return (
    <div>
      {(label || right) && (
        <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] text-white/45">
          <span>{label}</span>
          <span>{right}</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={clsx("h-full rounded-full transition-all duration-500", bar, glow)}
          style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-2 py-1.5 text-center">
      <div className="font-mono text-[9px] tracking-wider text-white/35 uppercase">{label}</div>
      <div className={clsx("font-display text-base leading-tight", color ?? "text-ge-white")}>{value}</div>
    </div>
  );
}

interface FloatingGain {
  id: number;
  x: number;
  y: number;
  value: number;
  crit: boolean;
}

let floatId = 0;

/* ------------------------------------------------------------- the screen */

export function ClickerScreen() {
  const s = useClickerStore();
  const [floats, setFloats] = useState<FloatingGain[]>([]);
  const [pressed, setPressed] = useState(false);
  const [, repaint] = useState(0);
  // Mobile only — desktop shows every panel at once.
  const [mobilePane, setMobilePane] = useState<"grind" | "upgrades" | "meta">("grind");

  useEffect(() => {
    s.init();
    const interval = setInterval(() => s.tick(), 1000);
    const paint = setInterval(() => repaint((n) => n + 1), 100);
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

  const rankProgress = upcoming
    ? (s.totalRepsEarned - rank.threshold) / (upcoming.threshold - rank.threshold)
    : 1;
  const nextCloutAt = repsToNextClout(s.totalRepsEarned);
  const cloutProgress = potentialClout >= 1 ? 1 : 1 - nextCloutAt / ((potentialClout + 1) ** 2 * 100_000);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const gain = s.click();
    const rect = e.currentTarget.getBoundingClientRect();
    const id = floatId++;
    setFloats((f) => [
      ...f,
      {
        id,
        x: e.clientX - rect.left + (Math.random() * 44 - 22),
        y: e.clientY - rect.top,
        value: gain,
        crit: frenzyActive,
      },
    ]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
    setPressed(true);
    setTimeout(() => setPressed(false), 90);
  }

  /* --------------------------------------------------------------- panels */

  const grindPanel = (
    <Panel
      title="Grind"
      accent={frenzyActive ? "gold" : "red"}
      right={
        <span className="rounded-full border border-ge-gold/40 px-2 py-0.5 font-mono text-[10px] text-ge-gold">
          {rank.name}
        </span>
      }
    >
      <div className="flex flex-col items-center">
        <div className="font-display text-5xl leading-none text-ge-white ge-text-glow-red">{formatReps(s.reps)}</div>
        <div className="mt-1 font-mono text-[11px] text-white/50">
          +{formatReps(perClick)} / Klick · +{formatReps(perSecond)} / Sek
        </div>

        <div className="mt-3 flex h-6 items-center gap-2">
          {comboActive && (
            <span className="rounded-full border border-ge-gold/50 bg-ge-gold/10 px-2 py-0.5 font-mono text-[10px] text-ge-gold">
              🔥 ×{combo.toFixed(2)} · {s.combo}
            </span>
          )}
          {frenzyActive && (
            <span className="ge-glow-gold rounded-full border border-ge-gold/60 bg-ge-gold/15 px-2 py-0.5 font-mono text-[10px] text-ge-gold">
              ✨ Frenzy ×{s.buff?.value} · {Math.ceil(((s.buff?.expiresAt ?? 0) - now) / 1000)}s
            </span>
          )}
        </div>

        <div className="relative mt-2 flex w-full justify-center">
          <button
            onClick={handleClick}
            aria-label="Rep machen"
            className={clsx(
              "relative flex h-44 w-44 items-center justify-center rounded-full text-6xl transition-transform select-none",
              "before:absolute before:inset-[-14px] before:rounded-full before:border before:transition-opacity",
              frenzyActive
                ? "ge-glow-gold bg-gradient-to-b from-ge-gold to-[#c99a12] before:border-ge-gold/40"
                : "ge-glow-red bg-gradient-to-b from-[#ff2a45] to-[#9c0a1e] before:border-ge-red/30",
              pressed ? "scale-95" : "scale-100 hover:scale-[1.03]"
            )}
          >
            <span className="drop-shadow-lg">🏋️</span>
            <AnimatePresence>
              {floats.map((f) => (
                <motion.span
                  key={f.id}
                  initial={{ opacity: 1, y: 0, scale: 0.9 }}
                  animate={{ opacity: 0, y: -80, scale: 1.15 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  style={{ left: f.x, top: f.y }}
                  className={clsx(
                    "pointer-events-none absolute font-display text-lg",
                    f.crit ? "text-ge-gold" : "text-white"
                  )}
                >
                  +{formatReps(f.value)}
                </motion.span>
              ))}
            </AnimatePresence>
          </button>

          <AnimatePresence>
            {s.golden && (
              <motion.button
                key={s.golden.id}
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: [1, 1.12, 1], rotate: 0 }}
                transition={{ scale: { repeat: Infinity, duration: 1.1 } }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={s.collectGolden}
                aria-label="Goldene Rep einsammeln"
                style={{ left: `${s.golden.x}%`, top: `${s.golden.y}%` }}
                className="ge-glow-gold absolute z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ge-gold text-2xl"
              >
                ✨
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 w-full space-y-2">
          <Meter
            value={rankProgress}
            color="gold"
            label={upcoming ? `Nächster Rang: ${upcoming.name}` : "Höchster Rang"}
            right={upcoming ? formatReps(upcoming.threshold) : "MAX"}
          />
          <Meter
            value={cloutProgress}
            color="green"
            label="Bis +1 Clout"
            right={potentialClout >= 1 ? `+${potentialClout} bereit` : formatReps(nextCloutAt)}
          />
        </div>

        <div className="mt-3 grid w-full grid-cols-3 gap-1.5">
          <Stat label="Klicks" value={s.totalClicks.toLocaleString("de-DE")} />
          <Stat label="Gesamt" value={formatReps(s.lifetimeReps)} />
          <Stat label="Beste Combo" value={String(s.bestCombo)} />
        </div>
      </div>
    </Panel>
  );

  const upgradesPanel = (
    <Panel
      title="Upgrades"
      right={<span className="font-mono text-[10px] text-white/35">alle 25 Stufen ×2</span>}
      className="max-h-[540px]"
    >
      <div className="flex flex-col gap-1.5">
        {CLICKER_UPGRADES.map((u) => {
          const owned = s.owned[u.id] ?? 0;
          const cost = Math.ceil(upgradeCost(u.baseCost, owned) * costMultiplier(s.perks));
          const affordable = s.reps >= cost;
          if (!(owned > 0 || s.lifetimeReps >= u.baseCost * 0.4)) return null;
          const mult = milestoneMultiplier(owned);
          const toNext = nextMilestone(owned);
          const milestoneProgress = (owned % 25) / 25;

          return (
            <div
              key={u.id}
              className={clsx(
                "rounded-lg border px-2.5 py-2 transition",
                affordable ? "border-ge-green/30 bg-ge-green/[0.04]" : "border-white/8 bg-white/[0.02] opacity-55"
              )}
            >
              {/* Name gets the full row: sharing it with the price and three
                  buy buttons squeezed it down to one or two letters. */}
              <div className="flex items-baseline gap-2">
                <span className="text-lg leading-none">{u.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{u.name}</span>
                {owned > 0 && <span className="shrink-0 font-mono text-[10px] text-white/40">Lv.{owned}</span>}
                {mult > 1 && (
                  <span className="shrink-0 rounded-full border border-ge-gold/40 px-1 font-mono text-[9px] text-ge-gold">
                    ×{mult}
                  </span>
                )}
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-2 pl-7">
                <span className="truncate font-mono text-[10px] text-white/40">{u.description}</span>
                <span className={clsx("shrink-0 font-mono text-[11px]", affordable ? "text-ge-green" : "text-white/35")}>
                  {formatReps(cost)}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5 pl-7">
                {[1, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => s.buyUpgrade(u.id, n)}
                    disabled={!affordable}
                    className="rounded border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/70 hover:border-white/40 disabled:opacity-25"
                  >
                    ×{n}
                  </button>
                ))}
                <button
                  onClick={() => s.buyMax(u.id)}
                  disabled={!affordable}
                  className="rounded border border-ge-red/40 px-2 py-0.5 font-mono text-[10px] text-ge-red hover:bg-ge-red/10 disabled:opacity-25"
                >
                  MAX
                </button>
                {owned > 0 && (
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-white/30">
                    Lv.{toNext} → ×{mult * 2}
                  </span>
                )}
              </div>

              {owned > 0 && (
                <div className="mt-1.5">
                  <Meter value={milestoneProgress} color="gold" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );

  const questPanel = (
    <Panel title="Quests" accent="green" right={<span className="font-mono text-[10px] text-white/35">{s.questsDone} erfüllt</span>}>
      <div className="flex flex-col gap-2">
        {s.quests.length === 0 && <p className="font-mono text-[11px] text-white/40">Neue Quests kommen gleich…</p>}
        {s.quests.map((q: Quest) => {
          const current = s.questValue(q.kind);
          const p = questProgress(q, current);
          const done = p >= 1;
          return (
            <div
              key={q.id}
              className={clsx(
                "rounded-lg border px-2.5 py-2",
                done ? "border-ge-green/50 bg-ge-green/10" : "border-white/10 bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] text-white/85">{questLabel(q)}</span>
                {done ? (
                  <button
                    onClick={() => s.claimQuest(q.id)}
                    className="ge-glow-green shrink-0 rounded bg-ge-green px-2 py-0.5 font-mono text-[10px] font-bold text-black"
                  >
                    +{q.reward} ✦
                  </button>
                ) : (
                  <span className="shrink-0 font-mono text-[10px] text-ge-gold">+{q.reward} ✦</span>
                )}
              </div>
              <div className="mt-1.5">
                <Meter value={p} color={done ? "green" : "red"} right={`${Math.floor(p * 100)}%`} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );

  const prestigePanel = (
    <Panel title="Prestige" accent="gold">
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-ge-gold/25 bg-ge-gold/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm tracking-wide text-ge-gold uppercase">Rebrand</span>
            <GlowButton variant="gold" onClick={s.prestige} disabled={potentialClout < 1}>
              +{potentialClout} ✦
            </GlowButton>
          </div>
          <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-white/45">
            Reps und Upgrades zurück, dafür Clout — dauerhaft +2% pro Punkt plus alles aus dem Perk-Baum.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Stat label="Clout" value={String(s.clout)} color="text-ge-gold" />
            <Stat label="Rebrands" value={String(s.prestigeCount)} />
            <Stat label="Mult." value={`×${cloutMultiplier(s.clout).toFixed(2)}`} color="text-ge-green" />
          </div>
        </div>

        <div className={clsx("rounded-lg border p-3", legacyUnlocked ? "border-ge-red/30 bg-ge-red/[0.04]" : "border-white/8 opacity-60")}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm tracking-wide text-ge-red uppercase">Legacy</span>
            {legacyUnlocked ? (
              <GlowButton
                onClick={() => {
                  if (confirm(`Legacy durchführen? Clout, Perks und Upgrades werden zurückgesetzt. Du bekommst +${legacyGain} Legacy.`)) {
                    s.goLegacy();
                  }
                }}
                disabled={legacyGain < 1}
              >
                +{legacyGain}
              </GlowButton>
            ) : (
              <span className="font-mono text-[10px] text-white/40">🔒</span>
            )}
          </div>
          {legacyUnlocked ? (
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-white/45">
              Setzt auch Clout und Perks zurück — dafür +50% auf alles, für immer.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              <Meter
                value={s.prestigeCount / LEGACY_UNLOCK_PRESTIGES}
                label="Rebrands"
                right={`${s.prestigeCount}/${LEGACY_UNLOCK_PRESTIGES}`}
              />
              <Meter
                value={s.lifetimeClout / LEGACY_UNLOCK_CLOUT}
                color="gold"
                label="Verdientes Clout"
                right={`${s.lifetimeClout}/${LEGACY_UNLOCK_CLOUT}`}
              />
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Stat label="Legacy" value={String(s.legacy)} color="text-ge-red" />
            <Stat label="Mult." value={`×${legacyMultiplier(s.legacy).toFixed(1)}`} color="text-ge-green" />
          </div>
        </div>
      </div>
    </Panel>
  );

  const perksPanel = (
    <Panel
      title="Perks"
      accent="gold"
      right={<span className="font-mono text-[10px] text-ge-gold">{s.clout} ✦</span>}
      className="max-h-[420px]"
    >
      <div className="flex flex-col gap-1.5">
        {CLOUT_PERKS.map((p) => {
          const level = perkLevel(s.perks, p.id);
          const maxed = level >= p.maxLevel;
          const cost = perkCost(p, level);
          const affordable = !maxed && s.clout >= cost;
          return (
            <button
              key={p.id}
              onClick={() => s.buyPerk(p.id)}
              disabled={!affordable}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition",
                maxed
                  ? "border-ge-gold/40 bg-ge-gold/10"
                  : affordable
                    ? "border-ge-green/30 bg-ge-green/[0.04] hover:border-ge-green/60"
                    : "border-white/8 opacity-50"
              )}
            >
              <span className="text-xl">{p.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12px] font-semibold text-white">{p.name}</span>
                  <span className="font-mono text-[9px] text-white/40">
                    {level}/{p.maxLevel}
                  </span>
                </div>
                <div className="truncate font-mono text-[10px] text-white/40">{p.description}</div>
              </div>
              <span className={clsx("shrink-0 font-mono text-[11px]", maxed ? "text-ge-gold" : affordable ? "text-ge-green" : "text-white/30")}>
                {maxed ? "MAX" : `${cost} ✦`}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );

  const ranksPanel = (
    <Panel
      title="Ränge"
      right={<span className="font-mono text-[10px] text-ge-green">×{rankMultiplier(s.totalRepsEarned).toFixed(2)}</span>}
      className="max-h-[320px]"
    >
      <div className="flex flex-col gap-0.5">
        {RANKS.map((r) => {
          const reached = s.totalRepsEarned >= r.threshold;
          const current = r.index === rank.index;
          return (
            <div
              key={r.index}
              className={clsx(
                "flex items-center gap-2 rounded px-2 py-1",
                current ? "ge-glow-red bg-ge-red/15" : reached ? "bg-white/5" : "opacity-35"
              )}
            >
              <span className="w-5 font-mono text-[9px] text-white/35">{r.index + 1}</span>
              <span className={clsx("flex-1 truncate text-[12px]", current ? "text-ge-red" : reached ? "text-white/85" : "text-white/45")}>
                {r.name}
              </span>
              <span className="font-mono text-[9px] text-white/30">{formatReps(r.threshold)}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );

  const awardsPanel = (
    <Panel
      title="Awards"
      right={
        <span className="font-mono text-[10px] text-ge-gold">
          {s.achievements.length}/{CLICKER_ACHIEVEMENTS.length}
        </span>
      }
      className="max-h-[320px]"
    >
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-1">
        {CLICKER_ACHIEVEMENTS.map((a) => {
          const got = s.achievements.includes(a.id);
          return (
            <div
              key={a.id}
              className={clsx(
                "flex items-center gap-2 rounded border px-2 py-1.5",
                got ? "border-ge-gold/35 bg-ge-gold/[0.06]" : "border-white/8 opacity-40"
              )}
              title={a.description}
            >
              <span className="text-sm">{got ? "🏆" : "🔒"}</span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-white">{a.name}</div>
                <div className="truncate font-mono text-[9px] text-white/40">{a.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );

  /* --------------------------------------------------------------- render */

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Toasts sit above the nav; the header already carries the event banner. */}
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

      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="font-display text-xl tracking-wide text-ge-white uppercase">
          Grind <span className="text-ge-red">Clicker</span>
        </h2>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-ge-gold">{s.clout} ✦</span>
          {s.legacy > 0 && <span className="text-ge-red">{s.legacy} ⬥</span>}
        </div>
      </div>

      {s.offlineGain !== null && (
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-ge-green/40 bg-ge-green/10 px-3 py-2">
          <span className="font-mono text-[11px] text-ge-green">
            Willkommen zurück — während du weg warst: +{formatReps(s.offlineGain)} Reps 💪
          </span>
          <button onClick={s.dismissOfflineGain} className="font-mono text-xs text-white/40">
            ✕
          </button>
        </div>
      )}

      {/* Mobile: three panes. Desktop: everything at once, no switching. */}
      <div className="flex shrink-0 gap-1.5 lg:hidden">
        {(["grind", "upgrades", "meta"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setMobilePane(p)}
            className={clsx(
              "flex-1 rounded-lg px-3 py-1.5 font-display text-sm tracking-wide uppercase transition",
              mobilePane === p ? "ge-glow-red bg-ge-red/15 text-ge-red" : "bg-white/5 text-white/50"
            )}
          >
            {p === "grind" ? "Grind" : p === "upgrades" ? "Upgrades" : "Meta"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {/* Desktop dashboard */}
        <div className="hidden gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex flex-col gap-3 lg:col-span-1">
            {grindPanel}
            {questPanel}
          </div>
          <div className="flex flex-col gap-3 lg:col-span-1">{upgradesPanel}</div>
          <div className="flex flex-col gap-3 lg:col-span-1">
            {prestigePanel}
            {perksPanel}
          </div>
          <div className="hidden flex-col gap-3 xl:flex xl:col-span-1">
            {ranksPanel}
            {awardsPanel}
          </div>
        </div>

        {/* Large tablets get the fourth column's panels underneath */}
        <div className="mt-3 hidden gap-3 lg:grid lg:grid-cols-2 xl:hidden">
          {ranksPanel}
          {awardsPanel}
        </div>

        {/* Mobile */}
        <div className="flex flex-col gap-3 lg:hidden">
          {mobilePane === "grind" && (
            <>
              {grindPanel}
              {questPanel}
            </>
          )}
          {mobilePane === "upgrades" && upgradesPanel}
          {mobilePane === "meta" && (
            <>
              {prestigePanel}
              {perksPanel}
              {ranksPanel}
              {awardsPanel}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
