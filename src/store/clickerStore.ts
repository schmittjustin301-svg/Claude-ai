import { create } from "zustand";
import { CLICKER_UPGRADES, cloutForPrestige, repsPerClick, repsPerSecond, upgradeCost } from "../lib/clicker";
import { sound } from "../lib/sound";

const STORAGE_KEY = "grind-clicker-v1";
/** Cap idle/offline catch-up so leaving the tab open for days doesn't blow up the numbers. */
const MAX_OFFLINE_SECONDS = 4 * 60 * 60;

interface Persisted {
  reps: number;
  totalRepsEarned: number;
  totalClicks: number;
  owned: Record<string, number>;
  clout: number;
  prestigeCount: number;
  lastTick: number;
}

function seed(): Persisted {
  return { reps: 0, totalRepsEarned: 0, totalClicks: 0, owned: {}, clout: 0, prestigeCount: 0, lastTick: Date.now() };
}

function load(): Persisted {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seed();
  try {
    return { ...seed(), ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return seed();
  }
}

function save(s: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

interface ClickerStore extends Persisted {
  offlineGain: number | null;

  init(): void;
  click(): void;
  buyUpgrade(id: string): void;
  prestige(): void;
  tick(): void;
  dismissOfflineGain(): void;
}

export const useClickerStore = create<ClickerStore>((set, get) => ({
  ...load(),
  offlineGain: null,

  init() {
    const s = get();
    const elapsed = Math.min(MAX_OFFLINE_SECONDS, Math.max(0, (Date.now() - s.lastTick) / 1000));
    const rate = repsPerSecond(s.owned, s.clout);
    const gain = rate * elapsed;
    if (gain >= 1) {
      set({
        reps: s.reps + gain,
        totalRepsEarned: s.totalRepsEarned + gain,
        lastTick: Date.now(),
        offlineGain: gain,
      });
      save(get());
    } else {
      set({ lastTick: Date.now() });
    }
  },

  click() {
    const s = get();
    const gain = repsPerClick(s.owned, s.clout);
    set({ reps: s.reps + gain, totalRepsEarned: s.totalRepsEarned + gain, totalClicks: s.totalClicks + 1 });
    sound.click();
    save(get());
  },

  buyUpgrade(id) {
    const s = get();
    const def = CLICKER_UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const owned = s.owned[id] ?? 0;
    const cost = upgradeCost(def.baseCost, owned);
    if (s.reps < cost) return;
    set({ reps: s.reps - cost, owned: { ...s.owned, [id]: owned + 1 } });
    sound.taskDone();
    save(get());
  },

  prestige() {
    const s = get();
    const gain = cloutForPrestige(s.totalRepsEarned);
    if (gain < 1) return;
    set({
      reps: 0,
      totalRepsEarned: 0,
      owned: {},
      clout: s.clout + gain,
      prestigeCount: s.prestigeCount + 1,
    });
    sound.levelUp();
    save(get());
  },

  tick() {
    const s = get();
    const now = Date.now();
    const deltaSec = Math.min(5, (now - s.lastTick) / 1000);
    const gain = repsPerSecond(s.owned, s.clout) * deltaSec;
    set({ reps: s.reps + gain, totalRepsEarned: s.totalRepsEarned + gain, lastTick: now });
    if (gain > 0) save(get());
  },

  dismissOfflineGain() {
    set({ offlineGain: null });
  },
}));
