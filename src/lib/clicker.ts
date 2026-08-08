export interface ClickerUpgrade {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  kind: "click" | "auto";
  power: number;
}

/** Fitness-empire themed upgrade ladder — cheap gym gear up to a full AI content team. */
export const CLICKER_UPGRADES: ClickerUpgrade[] = [
  { id: "shake", name: "Protein Shake", icon: "🥤", description: "+1 Rep pro Klick", baseCost: 15, kind: "click", power: 1 },
  { id: "bands", name: "Resistance Bands", icon: "🎗️", description: "+1 Rep/Sek", baseCost: 25, kind: "auto", power: 1 },
  { id: "trainer", name: "Personal Trainer", icon: "🏋️", description: "+5 Reps pro Klick", baseCost: 150, kind: "click", power: 5 },
  { id: "ringlight", name: "Ring Light Setup", icon: "💡", description: "+5 Reps/Sek", baseCost: 300, kind: "auto", power: 5 },
  { id: "editor", name: "Viral Hook Editor", icon: "🎬", description: "+25 Reps/Sek", baseCost: 1500, kind: "auto", power: 25 },
  { id: "sponsor", name: "Sponsorship Deal", icon: "🤝", description: "+50 Reps pro Klick", baseCost: 5000, kind: "click", power: 50 },
  { id: "studio", name: "Eigenes Studio", icon: "🏟️", description: "+200 Reps/Sek", baseCost: 20000, kind: "auto", power: 200 },
  { id: "aiteam", name: "AI Content Team", icon: "🤖", description: "+1000 Reps/Sek", baseCost: 100000, kind: "auto", power: 1000 },
];

/** Classic clicker cost curve: +15% per level already owned. */
export function upgradeCost(baseCost: number, owned: number): number {
  return Math.ceil(baseCost * Math.pow(1.15, owned));
}

export function repsPerClick(owned: Record<string, number>, clout: number): number {
  const base = 1 + CLICKER_UPGRADES.filter((u) => u.kind === "click").reduce((sum, u) => sum + u.power * (owned[u.id] ?? 0), 0);
  return base * cloutMultiplier(clout);
}

export function repsPerSecond(owned: Record<string, number>, clout: number): number {
  const base = CLICKER_UPGRADES.filter((u) => u.kind === "auto").reduce((sum, u) => sum + u.power * (owned[u.id] ?? 0), 0);
  return base * cloutMultiplier(clout);
}

/** Prestige currency ("Clout"): +2% permanent multiplier per point. */
export function cloutMultiplier(clout: number): number {
  return 1 + clout * 0.02;
}

const PRESTIGE_THRESHOLD = 100_000;

export function cloutForPrestige(totalRepsEarned: number): number {
  return Math.floor(Math.sqrt(totalRepsEarned / PRESTIGE_THRESHOLD));
}

export function canPrestige(totalRepsEarned: number): boolean {
  return cloutForPrestige(totalRepsEarned) >= 1;
}

export function formatReps(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return sign + Math.floor(abs).toString();
  const units = ["K", "M", "B", "T", "Qa", "Qi"];
  let value = abs;
  let unitIndex = -1;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${sign}${value.toFixed(decimals)}${units[unitIndex]}`;
}
