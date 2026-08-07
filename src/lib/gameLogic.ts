import dayjs from "dayjs";
import type { AppState, BossState, DailyEvent, Tier } from "./types";
import { BOSS_NAMES, RANDOM_EVENTS } from "./seed";

const XP_BASE = 100;

/** Total cumulative XP required to *reach* a given level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(XP_BASE * Math.pow(level - 1, 1.4));
}

/** Derive current level + progress-within-level from cumulative XP. */
export function levelFromXp(totalXp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) {
    level += 1;
  }
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, xpIntoLevel: totalXp - floor, xpForNext: ceil - floor };
}

export function tierForLevel(level: number): Tier {
  if (level >= 50) return "EMPIRE";
  if (level >= 25) return "SCALING";
  if (level >= 10) return "GROWING";
  return "STARTUP";
}

export const TIER_ORDER: Tier[] = ["STARTUP", "GROWING", "SCALING", "EMPIRE"];

export function canPrestige(level: number): boolean {
  return level >= 10;
}

/** +10% XP per prestige stage, applied multiplicatively to XP gains. */
export function prestigeMultiplier(prestige: number): number {
  return 1 + prestige * 0.1;
}

export function applyXpGain(baseXp: number, prestige: number, event: DailyEvent | null): number {
  const multiplier = prestigeMultiplier(prestige) * (event?.xpMultiplier ?? 1);
  return Math.round(baseXp * multiplier);
}

export function bossDamage(contractXp: number, event: DailyEvent | null): number {
  return Math.round(contractXp * (event?.bossDamageMultiplier ?? 1));
}

/** Generates the next, stronger boss once the current one is defeated. */
export function nextBoss(current: BossState): BossState {
  const name = BOSS_NAMES[current.defeated_count % BOSS_NAMES.length];
  const maxHp = Math.round(current.max_hp * 1.3 + 50);
  return {
    ...current,
    name,
    hp: maxHp,
    max_hp: maxHp,
    defeated_count: current.defeated_count + 1,
  };
}

const TODAY = () => dayjs().format("YYYY-MM-DD");

export function isNewDay(lastDate: string | null): boolean {
  return lastDate !== TODAY();
}

/** Streak: continues if the last completion was yesterday or today, else resets. */
export function computeStreakOnCompletion(appState: AppState): number {
  const today = TODAY();
  if (appState.last_completion_date === today) return appState.streak;
  const wasYesterday = appState.last_completion_date === dayjs().subtract(1, "day").format("YYYY-MM-DD");
  return wasYesterday ? appState.streak + 1 : 1;
}

/** Empire Health drops once 2+ days pass without any completed activity. */
export function decayEmpireHealth(appState: AppState): number {
  if (!appState.last_completion_date) return appState.empire_health;
  const daysInactive = dayjs().diff(dayjs(appState.last_completion_date), "day");
  if (daysInactive < 2) return appState.empire_health;
  const decay = (daysInactive - 1) * 8;
  return Math.max(0, appState.empire_health - decay);
}

/** Deterministic "random" daily event so it's stable across reloads within the same day. */
export function dailyEventForToday(): DailyEvent {
  const dateSeed = Number(dayjs().format("YYYYMMDD"));
  const index = dateSeed % RANDOM_EVENTS.length;
  const def = RANDOM_EVENTS[index];
  return {
    key: def.key,
    title: def.title,
    description: def.description,
    xpMultiplier: def.xpMultiplier,
    bossDamageMultiplier: def.bossDamageMultiplier,
  };
}

export function today(): string {
  return TODAY();
}
