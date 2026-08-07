import { create } from "zustand";
import type { Database } from "../lib/db";
import { isoNow, loadDatabase, newId, saveDatabase, today } from "../lib/db";
import {
  applyXpGain,
  bossDamage,
  canPrestige,
  computeStreakOnCompletion,
  dailyEventForToday,
  decayEmpireHealth,
  levelFromXp,
  nextBoss,
  prestigeMultiplier,
  tierForLevel,
} from "../lib/gameLogic";
import { sound } from "../lib/sound";
import type {
  Achievement,
  Channel,
  ChatRole,
  Earning,
  EmpireStatus,
  RoadmapStatus,
} from "../lib/types";

export interface Toast {
  id: string;
  message: string;
  kind: "xp" | "achievement" | "boss" | "info";
}

interface UiState {
  toasts: Toast[];
  levelUpOverlay: { visible: boolean; level: number } | null;
  bossShake: number; // increment to trigger a fresh shake animation
}

interface EmpireStore extends Database, UiState {
  init(): void;
  tick(): void;

  addContract(text: string, channelId: string, xp: number): void;
  completeContract(contractId: string): void;
  deleteContract(contractId: string): void;

  addDailyTask(text: string): void;
  completeDailyTask(taskId: string): void;
  deleteDailyTask(taskId: string): void;

  logEarning(amount: number, source: string): void;

  addRoadmapItem(title: string): void;
  updateRoadmapStatus(itemId: string, status: RoadmapStatus): void;

  setSkillLevel(skillId: string, level: number): void;
  trainSkill(skillId: string): void;

  prestige(): void;

  addChatMessage(role: ChatRole, content: string): void;
  clearChat(): void;

  getEmpireStatus(): EmpireStatus;
  getEarningsSummary(period: "week" | "month" | "all"): { total: number; count: number; byMonth: Record<string, number> };

  dismissToast(id: string): void;
  dismissLevelUpOverlay(): void;
}

function persist(get: () => EmpireStore) {
  const s = get();
  const db: Database = {
    channels: s.channels,
    contracts: s.contracts,
    dailyTasks: s.dailyTasks,
    earnings: s.earnings,
    roadmapItems: s.roadmapItems,
    skills: s.skills,
    achievements: s.achievements,
    bossState: s.bossState,
    appState: s.appState,
    chatMessages: s.chatMessages,
    socialStats: s.socialStats,
  };
  saveDatabase(db);
}

function pushToast(set: (fn: (s: EmpireStore) => Partial<EmpireStore>) => void, message: string, kind: Toast["kind"]) {
  const id = newId();
  set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  setTimeout(() => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, 4200);
}

function registerActivity(s: EmpireStore): { streak: number; last_completion_date: string; empire_health: number } {
  const streak = computeStreakOnCompletion(s.appState);
  return {
    streak,
    last_completion_date: today(),
    empire_health: Math.min(100, s.appState.empire_health + 4),
  };
}

export const useEmpireStore = create<EmpireStore>((set, get) => ({
  ...loadDatabase(),
  toasts: [],
  levelUpOverlay: null,
  bossShake: 0,

  init() {
    get().tick();
  },

  tick() {
    set((s) => {
      const resetTasks = s.dailyTasks.map((t) => (t.last_reset !== today() ? { ...t, done: false, last_reset: today() } : t));
      const decayedHealth = decayEmpireHealth(s.appState);
      const event = s.appState.daily_event?.key === dailyEventForToday().key ? s.appState.daily_event : dailyEventForToday();
      return {
        dailyTasks: resetTasks,
        appState: { ...s.appState, empire_health: decayedHealth, daily_event: event },
      };
    });
    persist(get);
  },

  addContract(text, channelId, xp) {
    const contract = {
      id: newId(),
      text,
      channel_id: channelId,
      xp,
      done: false,
      created_at: isoNow(),
      completed_at: null,
    };
    set((s) => ({ contracts: [contract, ...s.contracts] }));
    persist(get);
  },

  completeContract(contractId) {
    const s = get();
    const contract = s.contracts.find((c) => c.id === contractId);
    if (!contract || contract.done) return;

    const event = s.appState.daily_event;
    const gainedXp = applyXpGain(contract.xp, s.appState.prestige, event);
    const damage = bossDamage(contract.xp, event);

    const channels: Channel[] = s.channels.map((c) => (c.id === contract.channel_id ? { ...c, xp: c.xp + gainedXp } : c));

    const totalXp = s.appState.total_xp + gainedXp;
    const { level: prevLevel } = levelFromXp(s.appState.total_xp);
    const { level: newLevel } = levelFromXp(totalXp);

    let boss = { ...s.bossState, hp: Math.max(0, s.bossState.hp - damage) };
    let bossDefeated = false;
    if (boss.hp <= 0) {
      boss = nextBoss(boss);
      bossDefeated = true;
    }

    const activity = registerActivity(s);

    set({
      contracts: s.contracts.map((c) => (c.id === contractId ? { ...c, done: true, completed_at: isoNow() } : c)),
      channels,
      bossState: boss,
      appState: {
        ...s.appState,
        total_xp: totalXp,
        total_level: newLevel,
        ...activity,
      },
      bossShake: get().bossShake + 1,
    });

    sound.xpGain();
    pushToast(set, `+${gainedXp} XP — ${contract.text}`, "xp");

    if (newLevel > prevLevel) {
      sound.levelUp();
      set({ levelUpOverlay: { visible: true, level: newLevel } });
    }

    if (bossDefeated) {
      sound.bossVictory();
      pushToast(set, `Boss besiegt! Nächster Gegner: ${boss.name}`, "boss");
    } else {
      sound.bossHit();
    }

    checkAchievements(set, get);
    persist(get);
  },

  deleteContract(contractId) {
    set((s) => ({ contracts: s.contracts.filter((c) => c.id !== contractId) }));
    persist(get);
  },

  addDailyTask(text) {
    set((s) => ({
      dailyTasks: [{ id: newId(), text, done: false, last_reset: today() }, ...s.dailyTasks],
    }));
    persist(get);
  },

  completeDailyTask(taskId) {
    const s = get();
    const task = s.dailyTasks.find((t) => t.id === taskId);
    if (!task || task.done) return;
    const activity = registerActivity(s);
    set({
      dailyTasks: s.dailyTasks.map((t) => (t.id === taskId ? { ...t, done: true } : t)),
      appState: { ...s.appState, ...activity },
    });
    sound.taskDone();
    persist(get);
  },

  deleteDailyTask(taskId) {
    set((s) => ({ dailyTasks: s.dailyTasks.filter((t) => t.id !== taskId) }));
    persist(get);
  },

  logEarning(amount, source) {
    const earning: Earning = { id: newId(), amount, source, date: today() };
    set((s) => ({ earnings: [earning, ...s.earnings] }));
    pushToast(set, `Einnahme geloggt: +${amount}€ (${source})`, "info");
    checkAchievements(set, get);
    persist(get);
  },

  addRoadmapItem(title) {
    set((s) => ({
      roadmapItems: [...s.roadmapItems, { id: newId(), title, status: "LOCKED", position: s.roadmapItems.length }],
    }));
    persist(get);
  },

  updateRoadmapStatus(itemId, status) {
    set((s) => ({
      roadmapItems: s.roadmapItems.map((r) => (r.id === itemId ? { ...r, status } : r)),
    }));
    persist(get);
  },

  setSkillLevel(skillId, level) {
    const clamped = Math.max(0, Math.min(5, level));
    set((s) => ({ skills: s.skills.map((sk) => (sk.id === skillId ? { ...sk, level: clamped } : sk)) }));
    checkAchievements(set, get);
    persist(get);
  },

  trainSkill(skillId) {
    const s = get();
    const skill = s.skills.find((sk) => sk.id === skillId);
    if (!skill || skill.level >= 5) return;
    get().setSkillLevel(skillId, skill.level + 1);
  },

  prestige() {
    const s = get();
    const { level } = levelFromXp(s.appState.total_xp);
    if (!canPrestige(level)) return;
    set({
      appState: {
        ...s.appState,
        prestige: s.appState.prestige + 1,
        total_xp: 0,
        total_level: 1,
      },
    });
    pushToast(set, `Prestige! Dauerhaft +10% XP (jetzt x${prestigeMultiplier(get().appState.prestige).toFixed(1)})`, "achievement");
    checkAchievements(set, get);
    persist(get);
  },

  addChatMessage(role, content) {
    set((s) => ({ chatMessages: [...s.chatMessages, { id: newId(), role, content, created_at: isoNow() }] }));
    persist(get);
  },

  clearChat() {
    set({ chatMessages: [] });
    persist(get);
  },

  getEmpireStatus() {
    const s = get();
    return {
      channels: s.channels,
      contracts: s.contracts,
      dailyTasks: s.dailyTasks,
      boss: s.bossState,
      roadmap: s.roadmapItems,
      skills: s.skills,
      achievements: s.achievements,
      appState: s.appState,
    };
  },

  getEarningsSummary(period) {
    const s = get();
    const now = new Date();
    const filtered = s.earnings.filter((e) => {
      if (period === "all") return true;
      const d = new Date(e.date);
      if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    });
    const byMonth: Record<string, number> = {};
    for (const e of s.earnings) {
      const key = e.date.slice(0, 7);
      byMonth[key] = (byMonth[key] ?? 0) + e.amount;
    }
    return {
      total: filtered.reduce((sum, e) => sum + e.amount, 0),
      count: filtered.length,
      byMonth,
    };
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  dismissLevelUpOverlay() {
    set({ levelUpOverlay: null });
  },
}));

function checkAchievements(set: (fn: (s: EmpireStore) => Partial<EmpireStore>) => void, get: () => EmpireStore) {
  const s = get();
  const doneContracts = s.contracts.filter((c) => c.done).length;
  const totalEarnings = s.earnings.reduce((sum, e) => sum + e.amount, 0);
  const { level } = levelFromXp(s.appState.total_xp);
  const tier = tierForLevel(level);

  const conditions: Record<string, boolean> = {
    first_contract: doneContracts >= 1,
    ten_contracts: doneContracts >= 10,
    fifty_contracts: doneContracts >= 50,
    first_boss: s.bossState.defeated_count >= 1,
    five_bosses: s.bossState.defeated_count >= 5,
    streak_7: s.appState.streak >= 7,
    streak_30: s.appState.streak >= 30,
    first_earning: s.earnings.length >= 1,
    earnings_1000: totalEarnings >= 1000,
    first_prestige: s.appState.prestige >= 1,
    skill_mastered: s.skills.some((sk) => sk.level >= 5),
    empire_tier: tier === "EMPIRE",
  };

  const toUnlock: Achievement[] = [];
  const updated = s.achievements.map((a) => {
    if (a.unlocked_at) return a;
    if (conditions[a.achievement_key]) {
      const unlocked = { ...a, unlocked_at: isoNow() };
      toUnlock.push(unlocked);
      return unlocked;
    }
    return a;
  });

  if (toUnlock.length > 0) {
    set(() => ({ achievements: updated }));
    for (const a of toUnlock) {
      sound.achievement();
      pushToast(set, `Achievement freigeschaltet: ${a.achievement_key}`, "achievement");
    }
  }
}
