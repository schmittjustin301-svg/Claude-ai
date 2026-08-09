// Grind Clicker — game rules.
//
// Progression is layered so there is always a next goal at a different time
// scale: upgrades (minutes), milestones (tens of minutes), ranks (a session),
// Clout perks (across prestiges), Legacy (across many prestiges).

export interface ClickerUpgrade {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  kind: "click" | "auto";
  power: number;
  /** Where this shows up in the gym view: standing on the floor or hung on the wall. */
  place: "floor" | "wall";
}

/** Fitness-empire ladder, from a protein shake to owning the whole sport. */
export const CLICKER_UPGRADES: ClickerUpgrade[] = [
  { id: "shake", name: "Protein Shake", icon: "🥤", description: "+1 Rep pro Klick", baseCost: 15, kind: "click", power: 1, place: "wall" },
  { id: "bands", name: "Resistance Bands", icon: "🎗️", description: "+1 Rep/Sek", baseCost: 25, kind: "auto", power: 1, place: "wall" },
  { id: "trainer", name: "Personal Trainer", icon: "🏋️", description: "+5 Reps pro Klick", baseCost: 150, kind: "click", power: 5, place: "floor" },
  { id: "ringlight", name: "Ring Light Setup", icon: "💡", description: "+5 Reps/Sek", baseCost: 300, kind: "auto", power: 5, place: "floor" },
  { id: "editor", name: "Viral Hook Editor", icon: "🎬", description: "+25 Reps/Sek", baseCost: 1_500, kind: "auto", power: 25, place: "wall" },
  { id: "sponsor", name: "Sponsorship Deal", icon: "🤝", description: "+50 Reps pro Klick", baseCost: 5_000, kind: "click", power: 50, place: "wall" },
  { id: "studio", name: "Eigenes Studio", icon: "🏟️", description: "+200 Reps/Sek", baseCost: 20_000, kind: "auto", power: 200, place: "floor" },
  { id: "aiteam", name: "AI Content Team", icon: "🤖", description: "+1.000 Reps/Sek", baseCost: 100_000, kind: "auto", power: 1_000, place: "floor" },

  // Late game — each tier is roughly an order of magnitude past the last.
  { id: "camera", name: "Kamera-Crew", icon: "📹", description: "+500 Reps pro Klick", baseCost: 400_000, kind: "click", power: 500, place: "floor" },
  { id: "gymchain", name: "Gym-Kette", icon: "🏢", description: "+6.000 Reps/Sek", baseCost: 1_200_000, kind: "auto", power: 6_000, place: "wall" },
  { id: "supplement", name: "Supplement-Linie", icon: "💊", description: "+35.000 Reps/Sek", baseCost: 8_000_000, kind: "auto", power: 35_000, place: "floor" },
  { id: "agency", name: "Athleten-Agentur", icon: "📇", description: "+8.000 Reps pro Klick", baseCost: 40_000_000, kind: "click", power: 8_000, place: "floor" },
  { id: "network", name: "Streaming-Netzwerk", icon: "📡", description: "+250.000 Reps/Sek", baseCost: 200_000_000, kind: "auto", power: 250_000, place: "wall" },
  { id: "federation", name: "Eigene Föderation", icon: "🏅", description: "+2 Mio Reps/Sek", baseCost: 1_500_000_000, kind: "auto", power: 2_000_000, place: "floor" },
  { id: "empire", name: "Medien-Imperium", icon: "👑", description: "+400.000 Reps pro Klick", baseCost: 10_000_000_000, kind: "click", power: 400_000, place: "wall" },
  { id: "olympia", name: "Olympia-Rechte", icon: "🏛️", description: "+25 Mio Reps/Sek", baseCost: 80_000_000_000, kind: "auto", power: 25_000_000, place: "floor" },
];

/** Classic cost curve: +15% per level already owned. */
export function upgradeCost(baseCost: number, owned: number): number {
  return Math.ceil(baseCost * Math.pow(1.15, owned));
}

/** Total cost of buying `count` more levels, for the ×10 / max buttons. */
export function bulkCost(baseCost: number, owned: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += upgradeCost(baseCost, owned + i);
  return total;
}

export function maxAffordable(baseCost: number, owned: number, reps: number, cap = 1000): number {
  let count = 0;
  let spent = 0;
  while (count < cap) {
    const next = upgradeCost(baseCost, owned + count);
    if (spent + next > reps) break;
    spent += next;
    count++;
  }
  return count;
}

/* ------------------------------------------------------------ milestones */

export const MILESTONE_STEP = 25;

/**
 * Every 25 levels doubles that upgrade's output. Gives each upgrade its own
 * long-term goal instead of it going flat once you can afford many.
 */
export function milestoneMultiplier(owned: number): number {
  return Math.pow(2, Math.floor(owned / MILESTONE_STEP));
}

export function nextMilestone(owned: number): number {
  return (Math.floor(owned / MILESTONE_STEP) + 1) * MILESTONE_STEP;
}

/** Levels still missing before the next doubling. */
export function levelsToMilestone(owned: number): number {
  return nextMilestone(owned) - owned;
}

/**
 * Price of `count` further levels at the current discount. Rounds per level the
 * same way the purchase does, so the price on the button is the price charged.
 */
export function bulkCostWithDiscount(
  baseCost: number,
  owned: number,
  count: number,
  discount: number
): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.ceil(upgradeCost(baseCost, owned + i) * discount);
  return total;
}

/* ----------------------------------------------------------------- ranks */

export interface Rank {
  index: number;
  name: string;
  threshold: number;
}

const RANK_NAMES = [
  "Rookie", "Gym Rat", "Beginner Gains", "Consistent", "Shredded",
  "Local Legend", "Regional Star", "Nationalkader", "Pro Card", "Sponsored",
  "Headliner", "Champion", "Titelverteidiger", "Hall of Famer", "Ikone",
  "Mr. Olympia", "Legende", "Unsterblich", "Mythos", "Über-Mensch",
  "Grind Gott", "Singularität", "Omniversal", "Endgegner",
];

/** Thresholds grow ~×4.2 per rank, so the ladder spans a whole run. */
export const RANKS: Rank[] = RANK_NAMES.map((name, index) => ({
  index,
  name,
  threshold: index === 0 ? 0 : Math.round(100 * Math.pow(4.2, index - 1)),
}));

export function rankFor(totalRepsEarned: number): Rank {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (totalRepsEarned >= rank.threshold) current = rank;
    else break;
  }
  return current;
}

export function nextRank(totalRepsEarned: number): Rank | null {
  return RANKS.find((r) => r.threshold > totalRepsEarned) ?? null;
}

/** Each rank adds +8% to everything — a steady background reward for playing on. */
export function rankMultiplier(totalRepsEarned: number): number {
  return 1 + rankFor(totalRepsEarned).index * 0.08;
}

/* ----------------------------------------------------------- clout perks */

export interface CloutPerk {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  maxLevel: number;
}

/**
 * Clout is spent here rather than only being a flat multiplier, so each
 * prestige is a decision instead of just a bigger number.
 */
export const CLOUT_PERKS: CloutPerk[] = [
  { id: "fists", name: "Eiserne Fäuste", icon: "👊", description: "+30% Reps pro Klick je Stufe", baseCost: 1, maxLevel: 20 },
  { id: "engine", name: "Dauerläufer", icon: "⚙️", description: "+30% Reps/Sek je Stufe", baseCost: 1, maxLevel: 20 },
  { id: "headstart", name: "Startkapital", icon: "🎒", description: "Nach jedem Rebrand mit Reps starten", baseCost: 2, maxLevel: 15 },
  { id: "offline", name: "Offline-Meister", icon: "🌙", description: "+2 Std Offline-Ertrag je Stufe", baseCost: 3, maxLevel: 10 },
  { id: "golden", name: "Goldene Reps", icon: "✨", description: "Goldene Reps kommen häufiger und geben mehr", baseCost: 4, maxLevel: 10 },
  { id: "combo", name: "Combo-Meister", icon: "🔥", description: "Combo hält länger und steigt höher", baseCost: 4, maxLevel: 10 },
  { id: "discount", name: "Großeinkauf", icon: "🏷️", description: "-3% Upgrade-Kosten je Stufe", baseCost: 5, maxLevel: 12 },
];

/** Perk prices climb so late levels stay meaningful purchases. */
export function perkCost(perk: CloutPerk, level: number): number {
  return Math.ceil(perk.baseCost * Math.pow(1.6, level));
}

export function perkLevel(perks: Record<string, number>, id: string): number {
  return perks[id] ?? 0;
}

/* --------------------------------------------------------------- legacy */

/** Second prestige layer, unlocked once Clout stops being the bottleneck. */
export const LEGACY_UNLOCK_PRESTIGES = 5;
export const LEGACY_UNLOCK_CLOUT = 50;

export function canGoLegacy(prestigeCount: number, lifetimeClout: number): boolean {
  return prestigeCount >= LEGACY_UNLOCK_PRESTIGES && lifetimeClout >= LEGACY_UNLOCK_CLOUT;
}

export function legacyForReset(lifetimeClout: number): number {
  if (lifetimeClout < LEGACY_UNLOCK_CLOUT) return 0;
  return Math.floor(Math.pow(lifetimeClout / LEGACY_UNLOCK_CLOUT, 0.7));
}

/** Legacy is deliberately strong — it is meant to reshape a whole run. */
export function legacyMultiplier(legacy: number): number {
  return 1 + legacy * 0.5;
}

/* ------------------------------------------------------------- the gym */

/**
 * The gym you train in. One step up per Rebrand — the visible reward for
 * prestiging, so a reset reads as moving into a bigger place rather than
 * losing everything.
 */
export interface GymTier {
  index: number;
  name: string;
  tagline: string;
  /** Back wall, floor and trim colours. Kept near-black so the room stays calm. */
  wall: string;
  floor: string;
  trim: string;
  accent: string;
  windows: number;
}

export const GYM_TIERS: GymTier[] = [
  { index: 0, name: "Garage", tagline: "Wo alles anfängt", wall: "#111113", floor: "#181818", trim: "#26262a", accent: "#8a8f98", windows: 1 },
  { index: 1, name: "Kellerstudio", tagline: "Kein Fenster, kein Problem", wall: "#111216", floor: "#1a1b1f", trim: "#2a2c32", accent: "#a3a9b4", windows: 0 },
  { index: 2, name: "Hinterhof-Gym", tagline: "Die ersten Stammgäste", wall: "#121317", floor: "#1c1e22", trim: "#2d3038", accent: "#ff1432", windows: 2 },
  { index: 3, name: "Stadtteil-Studio", tagline: "Eigenes Schild an der Tür", wall: "#131519", floor: "#1e2126", trim: "#31353e", accent: "#ff1432", windows: 3 },
  { index: 4, name: "Premium-Club", tagline: "Handtuchservice inklusive", wall: "#14161b", floor: "#20242a", trim: "#363b45", accent: "#ffd24a", windows: 3 },
  { index: 5, name: "Sportzentrum", tagline: "Drei Etagen, ein Ziel", wall: "#15181d", floor: "#222730", trim: "#3a404b", accent: "#ffd24a", windows: 4 },
  { index: 6, name: "Mega-Gym", tagline: "Rund um die Uhr voll", wall: "#161a20", floor: "#242a34", trim: "#3e4552", accent: "#39ff88", windows: 4 },
  { index: 7, name: "Arena-Komplex", tagline: "Mit eigener Tribüne", wall: "#171c24", floor: "#262d39", trim: "#424a59", accent: "#39ff88", windows: 5 },
  { index: 8, name: "Olympia-Campus", tagline: "Ein ganzes Gelände", wall: "#181e28", floor: "#28303e", trim: "#46505f", accent: "#ffd24a", windows: 6 },
];

export function gymTierFor(prestigeCount: number): GymTier {
  return GYM_TIERS[Math.min(prestigeCount, GYM_TIERS.length - 1)];
}

/* ------------------------------------------------------------ coin shop */

/**
 * Quests pay Coins, not Clout. Deliberately a separate currency: Clout is the
 * prestige reward and buying perks with quest income would let quests
 * short-circuit the whole prestige loop. Coins buy gym equipment instead —
 * smaller bonuses, plus the pieces that show up in the gym view.
 */
export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  /** 0 marks a consumable: bought again and again, never levelled. */
  maxLevel: number;
}

export const COIN_SHOP: ShopItem[] = [
  { id: "bench", name: "Extra Hantelbank", icon: "🪑", description: "+5% Reps pro Klick je Stufe", baseCost: 3, maxLevel: 10 },
  { id: "music", name: "Sound-Anlage", icon: "🔊", description: "+5% Reps/Sek je Stufe", baseCost: 3, maxLevel: 10 },
  { id: "mirror", name: "Spiegelwand", icon: "🪞", description: "+20% Wert goldener Reps je Stufe", baseCost: 5, maxLevel: 5 },
  { id: "bar", name: "Saftbar", icon: "🧃", description: "+1 Coin pro erfüllter Quest je Stufe", baseCost: 8, maxLevel: 5 },
  { id: "clock", name: "Stoppuhr", icon: "⏱️", description: "-10% Quest-Ziele je Stufe", baseCost: 6, maxLevel: 5 },
  { id: "preworkout", name: "Pre-Workout", icon: "⚡", description: "10 Minuten lang alles ×3", baseCost: 6, maxLevel: 0 },
  { id: "reroll", name: "Neue Aufträge", icon: "🔄", description: "Tauscht alle offenen Quests aus", baseCost: 2, maxLevel: 0 },
];

export const PREWORKOUT_MS = 10 * 60 * 1000;
export const PREWORKOUT_MULTIPLIER = 3;

export function shopLevel(shop: Record<string, number>, id: string): number {
  return shop[id] ?? 0;
}

export function shopCost(item: ShopItem, level: number): number {
  if (item.maxLevel === 0) return item.baseCost;
  return Math.ceil(item.baseCost * Math.pow(1.7, level));
}

/** Only the levelled items decorate the gym; consumables have nothing to show. */
export function shopClickBonus(shop: Record<string, number>): number {
  return 1 + shopLevel(shop, "bench") * 0.05;
}

export function shopAutoBonus(shop: Record<string, number>): number {
  return 1 + shopLevel(shop, "music") * 0.05;
}

export function goldenValueBonus(shop: Record<string, number>): number {
  return 1 + shopLevel(shop, "mirror") * 0.2;
}

export function questCoinBonus(shop: Record<string, number>): number {
  return shopLevel(shop, "bar");
}

export function questTargetFactor(shop: Record<string, number>): number {
  return Math.max(0.5, 1 - shopLevel(shop, "clock") * 0.1);
}

/* -------------------------------------------------------- multipliers */

export function cloutMultiplier(clout: number): number {
  return 1 + clout * 0.02;
}

export interface GameState {
  owned: Record<string, number>;
  perks: Record<string, number>;
  shop: Record<string, number>;
  clout: number;
  legacy: number;
  totalRepsEarned: number;
  achievements: string[];
  /** Active temporary multiplier (Pre-Workout), 1 when nothing is running. */
  boost: number;
}

/** Small permanent boost per unlocked achievement, so they are worth chasing. */
export function achievementMultiplier(achievements: string[]): number {
  return 1 + achievements.length * 0.02;
}

function globalMultiplier(s: GameState): number {
  return (
    cloutMultiplier(s.clout) *
    legacyMultiplier(s.legacy) *
    rankMultiplier(s.totalRepsEarned) *
    achievementMultiplier(s.achievements) *
    (s.boost || 1)
  );
}

export function repsPerClick(s: GameState): number {
  const base =
    1 +
    CLICKER_UPGRADES.filter((u) => u.kind === "click").reduce((sum, u) => {
      const owned = s.owned[u.id] ?? 0;
      return sum + u.power * owned * milestoneMultiplier(owned);
    }, 0);
  const perk = 1 + perkLevel(s.perks, "fists") * 0.3;
  return base * perk * shopClickBonus(s.shop) * globalMultiplier(s);
}

export function repsPerSecond(s: GameState): number {
  const base = CLICKER_UPGRADES.filter((u) => u.kind === "auto").reduce((sum, u) => {
    const owned = s.owned[u.id] ?? 0;
    return sum + u.power * owned * milestoneMultiplier(owned);
  }, 0);
  const perk = 1 + perkLevel(s.perks, "engine") * 0.3;
  return base * perk * shopAutoBonus(s.shop) * globalMultiplier(s);
}

export function costMultiplier(perks: Record<string, number>): number {
  return Math.max(0.4, 1 - perkLevel(perks, "discount") * 0.03);
}

export function offlineCapSeconds(perks: Record<string, number>): number {
  return (4 + perkLevel(perks, "offline") * 2) * 60 * 60;
}

export function headstartReps(perks: Record<string, number>): number {
  const level = perkLevel(perks, "headstart");
  return level === 0 ? 0 : Math.round(50 * Math.pow(4, level));
}

/* ---------------------------------------------------------- prestige */

const PRESTIGE_THRESHOLD = 100_000;

export function cloutForPrestige(totalRepsEarned: number): number {
  return Math.floor(Math.sqrt(totalRepsEarned / PRESTIGE_THRESHOLD));
}

export function canPrestige(totalRepsEarned: number): boolean {
  return cloutForPrestige(totalRepsEarned) >= 1;
}

/** Reps still needed before the next Clout point is earned. */
export function repsToNextClout(totalRepsEarned: number): number {
  const next = cloutForPrestige(totalRepsEarned) + 1;
  return Math.max(0, next * next * PRESTIGE_THRESHOLD - totalRepsEarned);
}

/* ------------------------------------------------------- golden reps */

export interface GoldenBuff {
  kind: "frenzy" | "windfall";
  /** Frenzy: click multiplier. Windfall: instant reps already granted. */
  value: number;
  expiresAt: number;
}

export const FRENZY_SECONDS = 15;

export function goldenChancePerTick(perks: Record<string, number>): number {
  // ~1 per 90s at level 0, down to ~1 per 30s fully upgraded.
  return 0.011 + perkLevel(perks, "golden") * 0.002;
}

export function frenzyMultiplier(perks: Record<string, number>): number {
  return 7 + perkLevel(perks, "golden");
}

/** Windfall pays out a slice of current production, so it scales with the run. */
export function windfallReps(
  perSecond: number,
  perClick: number,
  perks: Record<string, number>,
  shop: Record<string, number> = {}
): number {
  const base = perSecond * 60 + perClick * 20;
  return Math.max(50, base * (1 + perkLevel(perks, "golden") * 0.15) * goldenValueBonus(shop));
}

/* --------------------------------------------------------------- combo */

export const COMBO_MAX_BASE = 3;

export function comboWindowMs(perks: Record<string, number>): number {
  return 1200 + perkLevel(perks, "combo") * 250;
}

export function comboCap(perks: Record<string, number>): number {
  return COMBO_MAX_BASE + perkLevel(perks, "combo") * 0.5;
}

/** Ramps toward the cap the longer a click streak is kept alive. */
export function comboMultiplier(streak: number, perks: Record<string, number>): number {
  const cap = comboCap(perks);
  return Math.min(cap, 1 + streak * 0.02);
}

/* -------------------------------------------------------- achievements */

export interface ClickerAchievement {
  id: string;
  name: string;
  description: string;
  test: (s: AchievementContext) => boolean;
}

export interface AchievementContext {
  totalClicks: number;
  totalRepsEarned: number;
  lifetimeReps: number;
  owned: Record<string, number>;
  clout: number;
  legacy: number;
  prestigeCount: number;
  goldenCollected: number;
  bestCombo: number;
  questsDone: number;
  shopLevels: number;
}

function totalUpgrades(owned: Record<string, number>): number {
  return Object.values(owned).reduce((a, b) => a + b, 0);
}

export const CLICKER_ACHIEVEMENTS: ClickerAchievement[] = [
  { id: "click100", name: "Aufgewärmt", description: "100 Klicks", test: (s) => s.totalClicks >= 100 },
  { id: "click1k", name: "Trainingsplan", description: "1.000 Klicks", test: (s) => s.totalClicks >= 1_000 },
  { id: "click10k", name: "Sehnenscheide", description: "10.000 Klicks", test: (s) => s.totalClicks >= 10_000 },
  { id: "reps1k", name: "Erste Sätze", description: "1.000 Reps insgesamt", test: (s) => s.lifetimeReps >= 1_000 },
  { id: "reps1m", name: "Millionär", description: "1 Mio Reps insgesamt", test: (s) => s.lifetimeReps >= 1_000_000 },
  { id: "reps1b", name: "Milliardenschwer", description: "1 Mrd Reps insgesamt", test: (s) => s.lifetimeReps >= 1_000_000_000 },
  { id: "reps1t", name: "Astronomisch", description: "1 Bio Reps insgesamt", test: (s) => s.lifetimeReps >= 1e12 },
  { id: "up10", name: "Ausgerüstet", description: "10 Upgrade-Stufen", test: (s) => totalUpgrades(s.owned) >= 10 },
  { id: "up100", name: "Vollausstattung", description: "100 Upgrade-Stufen", test: (s) => totalUpgrades(s.owned) >= 100 },
  { id: "up500", name: "Ausrüstungs-Fetisch", description: "500 Upgrade-Stufen", test: (s) => totalUpgrades(s.owned) >= 500 },
  { id: "milestone", name: "Meilenstein", description: "Ein Upgrade auf Stufe 25", test: (s) => Object.values(s.owned).some((n) => n >= 25) },
  { id: "milestone2", name: "Doppelt gemoppelt", description: "Ein Upgrade auf Stufe 50", test: (s) => Object.values(s.owned).some((n) => n >= 50) },
  { id: "allup", name: "Sammler", description: "Jedes Upgrade mindestens einmal", test: (s) => CLICKER_UPGRADES.every((u) => (s.owned[u.id] ?? 0) > 0) },
  { id: "prestige1", name: "Rebranded", description: "Einmal prestigen", test: (s) => s.prestigeCount >= 1 },
  { id: "prestige10", name: "Serien-Rebrand", description: "10 Rebrands", test: (s) => s.prestigeCount >= 10 },
  { id: "clout50", name: "Bekannt", description: "50 Clout besessen", test: (s) => s.clout >= 50 },
  { id: "legacy1", name: "Vermächtnis", description: "Erstes Legacy", test: (s) => s.legacy >= 1 },
  { id: "legacy10", name: "Dynastie", description: "10 Legacy", test: (s) => s.legacy >= 10 },
  { id: "golden1", name: "Glückstreffer", description: "Eine goldene Rep gefangen", test: (s) => s.goldenCollected >= 1 },
  { id: "golden25", name: "Goldgräber", description: "25 goldene Reps gefangen", test: (s) => s.goldenCollected >= 25 },
  { id: "combo100", name: "Im Flow", description: "Combo von 100 Klicks", test: (s) => s.bestCombo >= 100 },
  { id: "rank10", name: "Aufgestiegen", description: "Rang 10 erreicht", test: (s) => rankFor(s.totalRepsEarned).index >= 9 },
  { id: "quest10", name: "Auftragslage", description: "10 Quests erfüllt", test: (s) => s.questsDone >= 10 },
  { id: "quest50", name: "Immer geliefert", description: "50 Quests erfüllt", test: (s) => s.questsDone >= 50 },
  { id: "shop5", name: "Eingerichtet", description: "5 Ausstattungs-Stufen gekauft", test: (s) => s.shopLevels >= 5 },
  { id: "gym4", name: "Umgezogen", description: "Ins vierte Gym einziehen", test: (s) => s.prestigeCount >= 3 },
];

export function formatReps(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return sign + Math.floor(abs).toString();
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc"];
  let value = abs;
  let unitIndex = -1;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${sign}${value.toFixed(decimals)}${units[unitIndex]}`;
}

/* --------------------------------------------------------------- quests */

export type QuestKind = "clicks" | "reps" | "upgrades" | "golden" | "combo";

export interface QuestDef {
  kind: QuestKind;
  label: (target: number) => string;
  /** Scales with how far the player already is, so quests stay meaningful. */
  target: (tier: number) => number;
  reward: (tier: number) => number;
}

export const QUEST_DEFS: Record<QuestKind, QuestDef> = {
  clicks: {
    kind: "clicks",
    label: (t) => `${t.toLocaleString("de-DE")} Klicks`,
    target: (tier) => 50 * Math.pow(2, tier),
    reward: (tier) => 1 + tier,
  },
  reps: {
    kind: "reps",
    label: (t) => `${formatReps(t)} Reps verdienen`,
    target: (tier) => 2_000 * Math.pow(3.5, tier),
    reward: (tier) => 1 + tier,
  },
  upgrades: {
    kind: "upgrades",
    label: (t) => `${t} Upgrade-Stufen kaufen`,
    target: (tier) => 5 + tier * 5,
    reward: (tier) => 1 + tier,
  },
  golden: {
    kind: "golden",
    label: (t) => `${t} goldene Reps fangen`,
    target: (tier) => 1 + tier,
    reward: (tier) => 2 + tier,
  },
  combo: {
    kind: "combo",
    label: (t) => `Combo von ${t} halten`,
    target: (tier) => 25 * (tier + 1),
    reward: (tier) => 2 + tier,
  },
};

export interface Quest {
  id: string;
  kind: QuestKind;
  tier: number;
  target: number;
  /** Snapshot of the counter when the quest was issued. */
  startValue: number;
  reward: number;
}

export function makeQuest(
  kind: QuestKind,
  tier: number,
  startValue: number,
  targetFactor = 1,
  rewardBonus = 0
): Quest {
  const def = QUEST_DEFS[kind];
  return {
    id: `${kind}-${tier}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    tier,
    target: Math.max(1, Math.round(def.target(tier) * targetFactor)),
    startValue,
    reward: def.reward(tier) + rewardBonus,
  };
}

export function questLabel(quest: Quest): string {
  return QUEST_DEFS[quest.kind].label(quest.target);
}

export function questProgress(quest: Quest, current: number): number {
  return Math.max(0, Math.min(1, (current - quest.startValue) / quest.target));
}
