import { create } from "zustand";
import {
  CLICKER_ACHIEVEMENTS,
  CLICKER_UPGRADES,
  CLOUT_PERKS,
  cloutForPrestige,
  comboMultiplier,
  comboWindowMs,
  costMultiplier,
  frenzyMultiplier,
  goldenChancePerTick,
  headstartReps,
  legacyForReset,
  maxAffordable,
  offlineCapSeconds,
  perkCost,
  perkLevel,
  repsPerClick,
  repsPerSecond,
  upgradeCost,
  windfallReps,
  type GameState,
  type GoldenBuff,
} from "../lib/clicker";
import { sound } from "../lib/sound";

const STORAGE_KEY = "grind-clicker-v1";

interface Persisted {
  reps: number;
  /** Resets on prestige — drives Clout gain and rank. */
  totalRepsEarned: number;
  /** Never resets — the number achievements and bragging rights use. */
  lifetimeReps: number;
  totalClicks: number;
  owned: Record<string, number>;
  perks: Record<string, number>;
  clout: number;
  /** Clout ever earned, so spending it does not block the Legacy gate. */
  lifetimeClout: number;
  legacy: number;
  prestigeCount: number;
  legacyCount: number;
  achievements: string[];
  goldenCollected: number;
  bestCombo: number;
  lastTick: number;
}

function seed(): Persisted {
  return {
    reps: 0,
    totalRepsEarned: 0,
    lifetimeReps: 0,
    totalClicks: 0,
    owned: {},
    perks: {},
    clout: 0,
    lifetimeClout: 0,
    legacy: 0,
    prestigeCount: 0,
    legacyCount: 0,
    achievements: [],
    goldenCollected: 0,
    bestCombo: 0,
    lastTick: Date.now(),
  };
}

/**
 * Spreading over the seed migrates older saves for free: fields added later
 * (perks, legacy, lifetime counters) simply take their defaults, so an existing
 * run keeps its reps, upgrades and Clout.
 */
function load(): Persisted {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seed();
  try {
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const merged = { ...seed(), ...parsed };
    // Pre-Legacy saves have no lifetime counters; seed them from what exists so
    // the Legacy gate and achievements are not silently reset to zero.
    if (merged.lifetimeReps < merged.totalRepsEarned) merged.lifetimeReps = merged.totalRepsEarned;
    if (merged.lifetimeClout < merged.clout) merged.lifetimeClout = merged.clout;
    return merged;
  } catch {
    return seed();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Persisted | null = null;

/**
 * Throttled persistence.
 *
 * Fast clicking fires many times a second, and serialising the whole save on
 * each one is enough JSON work to make the button feel laggy on a phone. State
 * still updates instantly; only the write is coalesced, so the worst case is
 * losing under a second of progress on a hard crash.
 */
function save(s: Persisted) {
  pending = s;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!pending) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripTransient(pending)));
    } catch {
      // Full storage should not break the game loop.
    }
    pending = null;
  }, 800);
}

/** Writes immediately — used before the page goes away. */
function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!pending) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripTransient(pending)));
  } catch {
    // Nothing useful to do here.
  }
  pending = null;
}

if (typeof window !== "undefined") {
  // pagehide covers the iOS case, where unload often never fires.
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
}

function stripTransient(s: Persisted): Persisted {
  return {
    reps: s.reps,
    totalRepsEarned: s.totalRepsEarned,
    lifetimeReps: s.lifetimeReps,
    totalClicks: s.totalClicks,
    owned: s.owned,
    perks: s.perks,
    clout: s.clout,
    lifetimeClout: s.lifetimeClout,
    legacy: s.legacy,
    prestigeCount: s.prestigeCount,
    legacyCount: s.legacyCount,
    achievements: s.achievements,
    goldenCollected: s.goldenCollected,
    bestCombo: s.bestCombo,
    lastTick: s.lastTick,
  };
}

export interface ClickerToast {
  id: number;
  text: string;
  kind: "achievement" | "golden" | "rank";
}

interface ClickerStore extends Persisted {
  offlineGain: number | null;
  combo: number;
  comboUntil: number;
  golden: { id: number; x: number; y: number; expiresAt: number } | null;
  buff: GoldenBuff | null;
  toasts: ClickerToast[];

  init(): void;
  click(): number;
  buyUpgrade(id: string, count?: number): void;
  buyMax(id: string): void;
  buyPerk(id: string): void;
  prestige(): void;
  goLegacy(): void;
  tick(): void;
  collectGolden(): void;
  dismissOfflineGain(): void;
  dismissToast(id: number): void;
  gameState(): GameState;
}

let toastId = 0;
let goldenId = 0;

export const useClickerStore = create<ClickerStore>((set, get) => {
  function state(): GameState {
    const s = get();
    return {
      owned: s.owned,
      perks: s.perks,
      clout: s.clout,
      legacy: s.legacy,
      totalRepsEarned: s.totalRepsEarned,
      achievements: s.achievements,
    };
  }

  function pushToast(text: string, kind: ClickerToast["kind"]) {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  }

  /** Awards any achievement whose condition is newly met. */
  function checkAchievements() {
    const s = get();
    const ctx = {
      totalClicks: s.totalClicks,
      totalRepsEarned: s.totalRepsEarned,
      lifetimeReps: s.lifetimeReps,
      owned: s.owned,
      clout: s.lifetimeClout,
      legacy: s.legacy,
      prestigeCount: s.prestigeCount,
      goldenCollected: s.goldenCollected,
      bestCombo: s.bestCombo,
    };
    const unlocked: string[] = [];
    for (const a of CLICKER_ACHIEVEMENTS) {
      if (s.achievements.includes(a.id)) continue;
      if (a.test(ctx)) unlocked.push(a.id);
    }
    if (unlocked.length === 0) return;
    set({ achievements: [...s.achievements, ...unlocked] });
    for (const id of unlocked) {
      const def = CLICKER_ACHIEVEMENTS.find((a) => a.id === id);
      if (def) pushToast(`🏆 ${def.name}`, "achievement");
    }
    sound.achievement();
  }

  function grant(amount: number) {
    set((s) => ({
      reps: s.reps + amount,
      totalRepsEarned: s.totalRepsEarned + amount,
      lifetimeReps: s.lifetimeReps + amount,
    }));
  }

  return {
    ...load(),
    offlineGain: null,
    combo: 0,
    comboUntil: 0,
    golden: null,
    buff: null,
    toasts: [],

    gameState: state,

    init() {
      const s = get();
      const cap = offlineCapSeconds(s.perks);
      const elapsed = Math.min(cap, Math.max(0, (Date.now() - s.lastTick) / 1000));
      const gain = repsPerSecond(state()) * elapsed;
      if (gain >= 1) {
        grant(gain);
        set({ lastTick: Date.now(), offlineGain: gain });
      } else {
        set({ lastTick: Date.now() });
      }
      save(get());
    },

    click() {
      const s = get();
      const now = Date.now();
      const streak = now < s.comboUntil ? s.combo + 1 : 1;
      const combo = comboMultiplier(streak, s.perks);
      const frenzy = s.buff?.kind === "frenzy" && now < s.buff.expiresAt ? s.buff.value : 1;

      const gain = repsPerClick(state()) * combo * frenzy;
      grant(gain);
      set({
        totalClicks: s.totalClicks + 1,
        combo: streak,
        comboUntil: now + comboWindowMs(s.perks),
        bestCombo: Math.max(s.bestCombo, streak),
      });
      sound.click();
      checkAchievements();
      save(get());
      return gain;
    },

    buyUpgrade(id, count = 1) {
      const s = get();
      const def = CLICKER_UPGRADES.find((u) => u.id === id);
      if (!def) return;

      const discount = costMultiplier(s.perks);
      let owned = s.owned[id] ?? 0;
      let total = 0;
      let bought = 0;
      for (let i = 0; i < count; i++) {
        const price = Math.ceil(upgradeCost(def.baseCost, owned + i) * discount);
        if (s.reps < total + price) break;
        total += price;
        bought++;
      }
      if (bought === 0) return;
      owned = owned + bought;

      set({ reps: s.reps - total, owned: { ...s.owned, [id]: owned } });
      sound.taskDone();
      checkAchievements();
      save(get());
    },

    buyMax(id) {
      const s = get();
      const def = CLICKER_UPGRADES.find((u) => u.id === id);
      if (!def) return;
      const discount = costMultiplier(s.perks);
      // maxAffordable works on undiscounted prices, so scale the budget instead.
      const count = maxAffordable(def.baseCost, s.owned[id] ?? 0, s.reps / discount);
      if (count > 0) get().buyUpgrade(id, count);
    },

    buyPerk(id) {
      const s = get();
      const def = CLOUT_PERKS.find((p) => p.id === id);
      if (!def) return;
      const level = perkLevel(s.perks, id);
      if (level >= def.maxLevel) return;
      const cost = perkCost(def, level);
      if (s.clout < cost) return;
      set({ clout: s.clout - cost, perks: { ...s.perks, [id]: level + 1 } });
      sound.levelUp();
      save(get());
    },

    prestige() {
      const s = get();
      const gain = cloutForPrestige(s.totalRepsEarned);
      if (gain < 1) return;
      // Perks, Legacy and lifetime counters deliberately survive — that is what
      // makes each run start stronger than the last.
      set({
        reps: headstartReps(s.perks),
        totalRepsEarned: 0,
        owned: {},
        clout: s.clout + gain,
        lifetimeClout: s.lifetimeClout + gain,
        prestigeCount: s.prestigeCount + 1,
        combo: 0,
        comboUntil: 0,
        buff: null,
        golden: null,
      });
      sound.levelUp();
      pushToast(`Rebrand: +${gain} Clout`, "rank");
      checkAchievements();
      save(get());
    },

    goLegacy() {
      const s = get();
      const gain = legacyForReset(s.lifetimeClout);
      if (gain < 1) return;
      set({
        reps: 0,
        totalRepsEarned: 0,
        owned: {},
        perks: {},
        clout: 0,
        lifetimeClout: 0,
        legacy: s.legacy + gain,
        legacyCount: s.legacyCount + 1,
        prestigeCount: 0,
        combo: 0,
        comboUntil: 0,
        buff: null,
        golden: null,
      });
      sound.bossVictory();
      pushToast(`Legacy: +${gain} — alles ×${(1 + (s.legacy + gain) * 0.5).toFixed(1)}`, "rank");
      checkAchievements();
      save(get());
    },

    tick() {
      const s = get();
      const now = Date.now();
      const deltaSec = Math.min(5, (now - s.lastTick) / 1000);
      const gain = repsPerSecond(state()) * deltaSec;
      if (gain > 0) grant(gain);
      set({ lastTick: now });

      // Expire the combo and any finished buff.
      if (s.combo > 0 && now >= s.comboUntil) set({ combo: 0 });
      if (s.buff && now >= s.buff.expiresAt) set({ buff: null });
      if (s.golden && now >= s.golden.expiresAt) set({ golden: null });

      // Spawn a golden rep. Only one at a time, and never while one is waiting.
      if (!get().golden && Math.random() < goldenChancePerTick(s.perks)) {
        set({
          golden: {
            id: goldenId++,
            x: 10 + Math.random() * 70,
            y: 10 + Math.random() * 60,
            expiresAt: now + 9000,
          },
        });
      }

      checkAchievements();
      if (gain > 0) save(get());
    },

    collectGolden() {
      const s = get();
      if (!s.golden) return;
      set({ golden: null, goldenCollected: s.goldenCollected + 1 });

      // Half the time a burst of clicking power, half an instant payout.
      if (Math.random() < 0.5) {
        set({
          buff: {
            kind: "frenzy",
            value: frenzyMultiplier(s.perks),
            expiresAt: Date.now() + 15_000,
          },
        });
        pushToast(`✨ Frenzy! ×${frenzyMultiplier(s.perks)} pro Klick`, "golden");
      } else {
        const amount = windfallReps(repsPerSecond(state()), repsPerClick(state()), s.perks);
        grant(amount);
        pushToast(`✨ Windfall! +${Math.round(amount).toLocaleString("de-DE")} Reps`, "golden");
      }
      sound.achievement();
      checkAchievements();
      save(get());
    },

    dismissOfflineGain() {
      set({ offlineGain: null });
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  };
});
