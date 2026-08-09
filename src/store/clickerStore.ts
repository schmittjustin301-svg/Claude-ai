import { create } from "zustand";
import {
  CLICKER_ACHIEVEMENTS,
  CLICKER_UPGRADES,
  CLOUT_PERKS,
  COIN_SHOP,
  PREWORKOUT_MS,
  PREWORKOUT_MULTIPLIER,
  questCoinBonus,
  questTargetFactor,
  shopCost,
  shopLevel,
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
  makeQuest,
  questProgress,
  QUEST_DEFS,
  type GameState,
  type GoldenBuff,
  type Quest,
  type QuestKind,
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
  /** Levels of the gym equipment bought with Coins. */
  shop: Record<string, number>;
  clout: number;
  /** Clout ever earned, so spending it does not block the Legacy gate. */
  lifetimeClout: number;
  /** Quest currency. Deliberately separate from Clout — see COIN_SHOP. */
  coins: number;
  lifetimeCoins: number;
  legacy: number;
  prestigeCount: number;
  legacyCount: number;
  achievements: string[];
  goldenCollected: number;
  bestCombo: number;
  quests: Quest[];
  questsDone: number;
  /** Pre-Workout: end of the temporary global multiplier, 0 when inactive. */
  boostUntil: number;
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
    shop: {},
    clout: 0,
    lifetimeClout: 0,
    coins: 0,
    lifetimeCoins: 0,
    legacy: 0,
    prestigeCount: 0,
    legacyCount: 0,
    achievements: [],
    goldenCollected: 0,
    bestCombo: 0,
    quests: [],
    questsDone: 0,
    boostUntil: 0,
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
    shop: s.shop,
    clout: s.clout,
    lifetimeClout: s.lifetimeClout,
    coins: s.coins,
    lifetimeCoins: s.lifetimeCoins,
    legacy: s.legacy,
    prestigeCount: s.prestigeCount,
    legacyCount: s.legacyCount,
    achievements: s.achievements,
    goldenCollected: s.goldenCollected,
    bestCombo: s.bestCombo,
    quests: s.quests,
    questsDone: s.questsDone,
    boostUntil: s.boostUntil,
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
  buyShopItem(id: string): void;
  prestige(): void;
  goLegacy(): void;
  tick(): void;
  collectGolden(): void;
  claimQuest(id: string): void;
  questValue(kind: QuestKind): number;
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
      shop: s.shop,
      clout: s.clout,
      legacy: s.legacy,
      totalRepsEarned: s.totalRepsEarned,
      achievements: s.achievements,
      boost: Date.now() < s.boostUntil ? PREWORKOUT_MULTIPLIER : 1,
    };
  }

  /**
   * Capped at three. A Rebrand can unlock a handful of awards at once, and an
   * uncapped stack covered half the screen with notifications.
   */
  function pushToast(text: string, kind: ClickerToast["kind"]) {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-3) }));
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
      questsDone: s.questsDone,
      shopLevels: Object.values(s.shop).reduce((a, b) => a + b, 0),
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

  /** Current value of the counter a quest tracks. */
  function counterFor(kind: QuestKind): number {
    const s = get();
    switch (kind) {
      case "clicks": return s.totalClicks;
      case "reps": return s.lifetimeReps;
      case "upgrades": return Object.values(s.owned).reduce((a, b) => a + b, 0);
      case "golden": return s.goldenCollected;
      case "combo": return s.bestCombo;
    }
  }

  const QUEST_KINDS = Object.keys(QUEST_DEFS) as QuestKind[];

  /** Tops the board back up to three, scaling difficulty with quests completed. */
  function refillQuests() {
    const s = get();
    if (s.quests.length >= 3) return;
    const taken = new Set(s.quests.map((q) => q.kind));
    const tier = Math.floor(s.questsDone / 3);
    const factor = questTargetFactor(s.shop);
    const bonus = questCoinBonus(s.shop);
    const next = [...s.quests];
    for (const kind of QUEST_KINDS) {
      if (next.length >= 3) break;
      if (taken.has(kind)) continue;
      next.push(makeQuest(kind, tier, counterFor(kind), factor, bonus));
    }
    set({ quests: next });
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
      refillQuests();
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

    buyShopItem(id) {
      const s = get();
      const def = COIN_SHOP.find((i) => i.id === id);
      if (!def) return;
      const level = shopLevel(s.shop, id);
      if (def.maxLevel > 0 && level >= def.maxLevel) return;
      const cost = shopCost(def, level);
      if (s.coins < cost) return;
      set({ coins: s.coins - cost });

      if (def.maxLevel === 0) {
        // Consumables do something once instead of levelling up.
        if (id === "preworkout") {
          set({ boostUntil: Date.now() + PREWORKOUT_MS });
          pushToast(`⚡ Pre-Workout: ×${PREWORKOUT_MULTIPLIER} für 10 Minuten`, "golden");
        } else if (id === "reroll") {
          set({ quests: [] });
          refillQuests();
          pushToast("🔄 Neue Aufträge", "rank");
        }
      } else {
        set({ shop: { ...s.shop, [id]: level + 1 } });
        pushToast(`${def.icon} ${def.name} Stufe ${level + 1}`, "rank");
      }
      sound.levelUp();
      checkAchievements();
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
      // Quests keyed to per-run counters would be unreachable after a reset,
      // so rebase them onto the fresh values.
      set((st) => ({
        quests: st.quests.map((q) =>
          q.kind === "upgrades" ? { ...q, startValue: 0 } : q
        ),
      }));
      sound.levelUp();
      pushToast(`Rebrand: +${gain} Clout`, "rank");
      checkAchievements();
      save(get());
    },

    goLegacy() {
      const s = get();
      const gain = legacyForReset(s.lifetimeClout);
      if (gain < 1) return;
      // Coins and gym equipment survive on purpose: they are the quest economy,
      // not the prestige economy, and wiping them would punish quest play for a
      // reset it has nothing to do with.
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
        const amount = windfallReps(repsPerSecond(state()), repsPerClick(state()), s.perks, s.shop);
        grant(amount);
        pushToast(`✨ Windfall! +${Math.round(amount).toLocaleString("de-DE")} Reps`, "golden");
      }
      sound.achievement();
      checkAchievements();
      save(get());
    },

    questValue: counterFor,

    claimQuest(id) {
      const s = get();
      const quest = s.quests.find((q) => q.id === id);
      if (!quest) return;
      if (questProgress(quest, counterFor(quest.kind)) < 1) return;

      set({
        coins: s.coins + quest.reward,
        lifetimeCoins: s.lifetimeCoins + quest.reward,
        questsDone: s.questsDone + 1,
        quests: s.quests.filter((q) => q.id !== id),
      });
      sound.achievement();
      pushToast(`Quest erfüllt: +${quest.reward} Coins`, "rank");
      refillQuests();
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
