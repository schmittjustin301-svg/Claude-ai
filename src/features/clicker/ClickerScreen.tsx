import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useClickerStore } from "../../store/clickerStore";
import {
  CLICKER_ACHIEVEMENTS,
  CLICKER_UPGRADES,
  CLOUT_PERKS,
  COIN_SHOP,
  canGoLegacy,
  cloutForPrestige,
  cloutMultiplier,
  comboMultiplier,
  costMultiplier,
  formatReps,
  gymTierFor,
  LEGACY_UNLOCK_CLOUT,
  LEGACY_UNLOCK_PRESTIGES,
  legacyForReset,
  legacyMultiplier,
  milestoneMultiplier,
  nextMilestone,
  nextRank,
  perkCost,
  perkLevel,
  PREWORKOUT_MULTIPLIER,
  questLabel,
  questProgress,
  rankFor,
  rankMultiplier,
  RANKS,
  repsPerClick,
  repsPerSecond,
  repsToNextClout,
  shopCost,
  shopLevel,
  upgradeCost,
  type Quest,
} from "../../lib/clicker";
import { GymView } from "./GymView";

/* ------------------------------------------------------------ primitives */

/**
 * Flat, near-black card. No neon outline and no glow: the earlier version read
 * as a terminal HUD, which is not what a game should feel like.
 */
function Panel({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0a0b] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)]",
        className
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <h3 className="font-display text-[15px] tracking-wide text-white/85">{title}</h3>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
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
  color?: "red" | "gold" | "green" | "neutral";
}) {
  const bar =
    color === "gold" ? "bg-ge-gold" : color === "green" ? "bg-ge-green" : color === "neutral" ? "bg-white/45" : "bg-ge-red";
  return (
    <div>
      {(label || right) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="truncate text-white/50">{label}</span>
          <span className="shrink-0 font-mono text-white/40">{right}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={clsx("h-full rounded-full transition-[width] duration-500", bar)}
          style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2 py-2 text-center">
      <div className="text-[10px] text-white/40">{label}</div>
      <div className={clsx("font-display text-[17px] leading-tight", color ?? "text-ge-white")}>{value}</div>
    </div>
  );
}

/** Currency chip in the header — one look for Coins, Clout and Legacy. */
function Purse({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pr-3 pl-2.5" title={label}>
      <span className="text-[13px]">{icon}</span>
      <span className={clsx("font-display text-[15px] leading-none", color)}>{value}</span>
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
  const tier = gymTierFor(s.prestigeCount);

  const now = Date.now();
  const frenzyActive = s.buff?.kind === "frenzy" && now < s.buff.expiresAt;
  const boostActive = now < s.boostUntil;
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

  const gymPanel = (
    <Panel
      title="Dein Gym"
      right={
        <span className="text-[11px] text-white/40">
          {Object.values(s.owned).filter((n) => n > 0).length} Geräte · {s.prestigeCount} Umzüge
        </span>
      }
    >
      <GymView owned={s.owned} shop={s.shop} prestigeCount={s.prestigeCount} />
    </Panel>
  );

  const grindPanel = (
    <Panel
      title="Training"
      right={
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/60">{rank.name}</span>
      }
    >
      <div className="flex flex-col items-center">
        <div className="font-display text-[44px] leading-none text-ge-white">{formatReps(s.reps)}</div>
        <div className="mt-1.5 font-mono text-[11px] text-white/40">
          +{formatReps(perClick)} / Klick · +{formatReps(perSecond)} / Sek
        </div>

        <div className="mt-3 flex h-7 flex-wrap items-center justify-center gap-1.5">
          {comboActive && (
            <span className="rounded-full bg-ge-gold/12 px-2.5 py-1 text-[11px] text-ge-gold">
              Combo ×{combo.toFixed(2)}
            </span>
          )}
          {frenzyActive && (
            <span className="rounded-full bg-ge-gold/15 px-2.5 py-1 text-[11px] text-ge-gold">
              ✨ Frenzy ×{s.buff?.value} · {Math.ceil(((s.buff?.expiresAt ?? 0) - now) / 1000)}s
            </span>
          )}
          {boostActive && (
            <span className="rounded-full bg-ge-green/12 px-2.5 py-1 text-[11px] text-ge-green">
              ⚡ ×{PREWORKOUT_MULTIPLIER} · {Math.ceil((s.boostUntil - now) / 60000)} Min
            </span>
          )}
        </div>

        <div className="relative mt-2 flex w-full justify-center">
          <button
            onClick={handleClick}
            aria-label="Rep machen"
            className={clsx(
              "relative flex h-40 w-40 items-center justify-center rounded-full text-[56px] transition-transform select-none",
              frenzyActive
                ? "bg-gradient-to-b from-[#ffe07a] to-[#d19a12] shadow-[0_0_40px_-6px_rgba(255,210,74,0.5)]"
                : "bg-gradient-to-b from-[#ff3a55] to-[#a30f22] shadow-[0_0_40px_-6px_rgba(255,20,50,0.45)]",
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
                className="absolute z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ge-gold text-2xl shadow-[0_0_28px_-2px_rgba(255,210,74,0.7)]"
              >
                ✨
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-5 w-full space-y-2.5">
          <Meter
            value={rankProgress}
            color="neutral"
            label={upcoming ? `Nächster Rang: ${upcoming.name}` : "Höchster Rang"}
            right={upcoming ? formatReps(upcoming.threshold) : "MAX"}
          />
          <Meter
            value={cloutProgress}
            color="gold"
            label="Bis +1 Clout"
            right={potentialClout >= 1 ? `+${potentialClout} bereit` : formatReps(nextCloutAt)}
          />
        </div>

        <div className="mt-3 grid w-full grid-cols-3 gap-2">
          <Stat label="Klicks" value={s.totalClicks.toLocaleString("de-DE")} />
          <Stat label="Gesamt" value={formatReps(s.lifetimeReps)} />
          <Stat label="Beste Combo" value={String(s.bestCombo)} />
        </div>
      </div>
    </Panel>
  );

  const upgradesPanel = (
    <Panel
      title="Ausrüstung kaufen"
      right={<span className="text-[11px] text-white/35">alle 25 Stufen ×2</span>}
      className="max-h-[560px]"
    >
      <div className="flex flex-col gap-2">
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
                "rounded-xl border px-3 py-2.5 transition",
                affordable ? "border-white/12 bg-white/[0.045]" : "border-white/[0.05] bg-white/[0.015] opacity-60"
              )}
            >
              {/* Name gets the full row: sharing it with the price and three
                  buy buttons squeezed it down to one or two letters. */}
              <div className="flex items-baseline gap-2">
                <span className="text-lg leading-none">{u.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{u.name}</span>
                {owned > 0 && <span className="shrink-0 text-[11px] text-white/40">Stufe {owned}</span>}
                {mult > 1 && (
                  <span className="shrink-0 rounded-full bg-ge-gold/15 px-1.5 py-0.5 text-[10px] text-ge-gold">×{mult}</span>
                )}
              </div>

              <div className="mt-1 flex items-center justify-between gap-2 pl-7">
                <span className="truncate text-[11px] text-white/45">{u.description}</span>
                <span className={clsx("shrink-0 font-mono text-[12px]", affordable ? "text-ge-green" : "text-white/35")}>
                  {formatReps(cost)}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1.5 pl-7">
                {[1, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => s.buyUpgrade(u.id, n)}
                    disabled={!affordable}
                    className="rounded-lg bg-white/[0.07] px-2.5 py-1 text-[11px] text-white/75 transition hover:bg-white/[0.13] disabled:opacity-25"
                  >
                    ×{n}
                  </button>
                ))}
                <button
                  onClick={() => s.buyMax(u.id)}
                  disabled={!affordable}
                  className="rounded-lg bg-ge-red/15 px-2.5 py-1 text-[11px] font-semibold text-ge-red transition hover:bg-ge-red/25 disabled:opacity-25"
                >
                  MAX
                </button>
                {owned > 0 && (
                  <span className="ml-auto shrink-0 text-[10px] text-white/30">
                    Stufe {toNext} → ×{mult * 2}
                  </span>
                )}
              </div>

              {owned > 0 && (
                <div className="mt-2 pl-7">
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
    <Panel
      title="Aufträge"
      right={<span className="text-[11px] text-white/40">{s.questsDone} erfüllt</span>}
    >
      <div className="flex flex-col gap-2">
        {s.quests.length === 0 && <p className="text-[12px] text-white/40">Neue Aufträge kommen gleich…</p>}
        {s.quests.map((q: Quest) => {
          const current = s.questValue(q.kind);
          const p = questProgress(q, current);
          const done = p >= 1;
          return (
            <div
              key={q.id}
              className={clsx(
                "rounded-xl border px-3 py-2.5",
                done ? "border-ge-green/40 bg-ge-green/[0.07]" : "border-white/[0.07] bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] text-white/85">{questLabel(q)}</span>
                {done ? (
                  <button
                    onClick={() => s.claimQuest(q.id)}
                    className="shrink-0 rounded-lg bg-ge-green px-2.5 py-1 text-[11px] font-bold text-black"
                  >
                    +{q.reward} 🪙
                  </button>
                ) : (
                  <span className="shrink-0 text-[11px] text-white/45">+{q.reward} 🪙</span>
                )}
              </div>
              <div className="mt-2">
                <Meter value={p} color={done ? "green" : "neutral"} right={`${Math.floor(p * 100)}%`} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );

  const shopPanel = (
    <Panel
      title="Gym-Ausstattung"
      right={<span className="text-[11px] text-white/50">{s.coins} 🪙</span>}
      className="max-h-[440px]"
    >
      <p className="mb-2.5 text-[11px] leading-relaxed text-white/40">
        Coins kommen aus Aufträgen — nicht aus Rebrands. Was du hier kaufst, bleibt für immer und steht oben im Gym.
      </p>
      <div className="flex flex-col gap-2">
        {COIN_SHOP.map((item) => {
          const level = shopLevel(s.shop, item.id);
          const consumable = item.maxLevel === 0;
          const maxed = !consumable && level >= item.maxLevel;
          const cost = shopCost(item, level);
          const affordable = !maxed && s.coins >= cost;
          return (
            <button
              key={item.id}
              onClick={() => s.buyShopItem(item.id)}
              disabled={!affordable}
              className={clsx(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                maxed
                  ? "border-ge-gold/30 bg-ge-gold/[0.07]"
                  : affordable
                    ? "border-white/12 bg-white/[0.045] hover:bg-white/[0.08]"
                    : "border-white/[0.05] opacity-50"
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-white">{item.name}</span>
                  {!consumable && (
                    <span className="shrink-0 text-[10px] text-white/35">
                      {level}/{item.maxLevel}
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-white/45">{item.description}</div>
              </div>
              <span
                className={clsx(
                  "shrink-0 font-mono text-[12px]",
                  maxed ? "text-ge-gold" : affordable ? "text-ge-green" : "text-white/30"
                )}
              >
                {maxed ? "MAX" : `${cost} 🪙`}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );

  const prestigePanel = (
    <Panel title="Umziehen" right={<span className="text-[11px] text-white/40">Gym {tier.index + 1}</span>}>
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-ge-gold/20 bg-ge-gold/[0.05] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[15px] tracking-wide text-ge-gold">Rebrand</span>
            <button
              onClick={s.prestige}
              disabled={potentialClout < 1}
              className="rounded-lg bg-ge-gold px-3 py-1.5 font-display text-[14px] text-black transition hover:brightness-110 disabled:opacity-30"
            >
              +{potentialClout} ✦
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">
            Reps und Geräte zurück, dafür Clout — und du ziehst in ein größeres Gym um.
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <Stat label="Clout" value={String(s.clout)} color="text-ge-gold" />
            <Stat label="Umzüge" value={String(s.prestigeCount)} />
            <Stat label="Bonus" value={`×${cloutMultiplier(s.clout).toFixed(2)}`} color="text-ge-green" />
          </div>
        </div>

        <div
          className={clsx(
            "rounded-xl border p-3",
            legacyUnlocked ? "border-ge-red/25 bg-ge-red/[0.05]" : "border-white/[0.06] opacity-70"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[15px] tracking-wide text-ge-red">Legacy</span>
            {legacyUnlocked ? (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Legacy durchführen? Clout, Perks und Geräte werden zurückgesetzt. Du bekommst +${legacyGain} Legacy.`
                    )
                  ) {
                    s.goLegacy();
                  }
                }}
                disabled={legacyGain < 1}
                className="rounded-lg bg-ge-red px-3 py-1.5 font-display text-[14px] text-white transition hover:brightness-110 disabled:opacity-30"
              >
                +{legacyGain} ⬥
              </button>
            ) : (
              <span className="text-[11px] text-white/35">gesperrt</span>
            )}
          </div>
          {legacyUnlocked ? (
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">
              Setzt auch Clout und Perks zurück — dafür +50% auf alles, für immer. Coins und Ausstattung bleiben.
            </p>
          ) : (
            <div className="mt-2.5 space-y-2">
              <Meter
                value={s.prestigeCount / LEGACY_UNLOCK_PRESTIGES}
                color="neutral"
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
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Stat label="Legacy" value={String(s.legacy)} color="text-ge-red" />
            <Stat label="Bonus" value={`×${legacyMultiplier(s.legacy).toFixed(1)}`} color="text-ge-green" />
          </div>
        </div>
      </div>
    </Panel>
  );

  const perksPanel = (
    <Panel title="Perks" right={<span className="text-[11px] text-ge-gold">{s.clout} ✦</span>} className="max-h-[420px]">
      <div className="flex flex-col gap-2">
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
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                maxed
                  ? "border-ge-gold/30 bg-ge-gold/[0.07]"
                  : affordable
                    ? "border-white/12 bg-white/[0.045] hover:bg-white/[0.08]"
                    : "border-white/[0.05] opacity-50"
              )}
            >
              <span className="text-xl">{p.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-white">{p.name}</span>
                  <span className="shrink-0 text-[10px] text-white/35">
                    {level}/{p.maxLevel}
                  </span>
                </div>
                <div className="truncate text-[11px] text-white/45">{p.description}</div>
              </div>
              <span
                className={clsx(
                  "shrink-0 font-mono text-[12px]",
                  maxed ? "text-ge-gold" : affordable ? "text-ge-green" : "text-white/30"
                )}
              >
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
      right={<span className="text-[11px] text-ge-green">×{rankMultiplier(s.totalRepsEarned).toFixed(2)}</span>}
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
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5",
                current ? "bg-ge-red/15" : reached ? "bg-white/[0.035]" : "opacity-35"
              )}
            >
              <span className="w-5 font-mono text-[10px] text-white/30">{r.index + 1}</span>
              <span
                className={clsx(
                  "flex-1 truncate text-[12.5px]",
                  current ? "font-semibold text-ge-red" : reached ? "text-white/85" : "text-white/45"
                )}
              >
                {r.name}
              </span>
              <span className="font-mono text-[10px] text-white/30">{formatReps(r.threshold)}</span>
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
        <span className="text-[11px] text-white/45">
          {s.achievements.length}/{CLICKER_ACHIEVEMENTS.length}
        </span>
      }
      className="max-h-[320px]"
    >
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
        {CLICKER_ACHIEVEMENTS.map((a) => {
          const got = s.achievements.includes(a.id);
          return (
            <div
              key={a.id}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2",
                got ? "bg-ge-gold/[0.08]" : "bg-white/[0.02] opacity-45"
              )}
              title={a.description}
            >
              <span className="text-sm">{got ? "🏆" : "🔒"}</span>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-white">{a.name}</div>
                <div className="truncate text-[10.5px] text-white/40">{a.description}</div>
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
                "rounded-xl border border-white/10 bg-[#0b0b0c]/95 px-3.5 py-2.5 text-[12px] shadow-lg backdrop-blur",
                t.kind === "golden" ? "text-ge-gold" : "text-ge-green"
              )}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl tracking-wide text-ge-white">
          Grind <span className="text-ge-red">Clicker</span>
        </h2>
        <div className="flex items-center gap-2">
          <Purse icon="🪙" value={String(s.coins)} label="Coins aus Aufträgen" color="text-white" />
          <Purse icon="✦" value={String(s.clout)} label="Clout aus Rebrands" color="text-ge-gold" />
          {s.legacy > 0 && <Purse icon="⬥" value={String(s.legacy)} label="Legacy" color="text-ge-red" />}
        </div>
      </div>

      {s.offlineGain !== null && (
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-ge-green/25 bg-ge-green/[0.08] px-3.5 py-2.5">
          <span className="text-[12px] text-ge-green">
            Willkommen zurück — während du weg warst: +{formatReps(s.offlineGain)} Reps 💪
          </span>
          <button onClick={s.dismissOfflineGain} className="text-[13px] text-white/40 hover:text-white/70">
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
              "flex-1 rounded-xl py-2 font-display text-[14px] tracking-wide transition",
              mobilePane === p ? "bg-ge-red text-white" : "bg-white/[0.05] text-white/50"
            )}
          >
            {p === "grind" ? "Training" : p === "upgrades" ? "Kaufen" : "Meta"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {gymPanel}

        {/* Desktop dashboard */}
        <div className="mt-3 hidden gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex flex-col gap-3">
            {grindPanel}
            {questPanel}
          </div>
          <div className="flex flex-col gap-3">{upgradesPanel}</div>
          <div className="flex flex-col gap-3">
            {shopPanel}
            {prestigePanel}
          </div>
          <div className="hidden flex-col gap-3 xl:flex">
            {perksPanel}
            {ranksPanel}
            {awardsPanel}
          </div>
        </div>

        {/* Large tablets get the fourth column's panels underneath */}
        <div className="mt-3 hidden gap-3 lg:grid lg:grid-cols-3 xl:hidden">
          {perksPanel}
          {ranksPanel}
          {awardsPanel}
        </div>

        {/* Mobile */}
        <div className="mt-3 flex flex-col gap-3 lg:hidden">
          {mobilePane === "grind" && (
            <>
              {grindPanel}
              {questPanel}
            </>
          )}
          {mobilePane === "upgrades" && (
            <>
              {upgradesPanel}
              {shopPanel}
            </>
          )}
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
