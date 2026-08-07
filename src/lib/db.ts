import { v4 as uuid } from "uuid";
import type {
  AppState,
  Achievement,
  BossState,
  Channel,
  ChatMessage,
  Contract,
  DailyTask,
  Earning,
  RoadmapItem,
  Skill,
  SocialStat,
} from "./types";
import { ACHIEVEMENT_DEFS, BOSS_NAMES, CHANNEL_SEED, ROADMAP_SEED, SKILL_SEED } from "./seed";
import { today } from "./gameLogic";

export interface Database {
  channels: Channel[];
  contracts: Contract[];
  dailyTasks: DailyTask[];
  earnings: Earning[];
  roadmapItems: RoadmapItem[];
  skills: Skill[];
  achievements: Achievement[];
  bossState: BossState;
  appState: AppState;
  chatMessages: ChatMessage[];
  socialStats: SocialStat[];
}

const STORAGE_KEY = "grind-empire-db-v1";

function seedDatabase(): Database {
  const now = new Date().toISOString();
  return {
    channels: CHANNEL_SEED.map((c) => ({ id: c.id, name: c.name, icon: c.icon, xp: 0, created_at: now })),
    contracts: [],
    dailyTasks: [],
    earnings: [],
    roadmapItems: ROADMAP_SEED.map((r) => ({ ...r, id: uuid() })),
    skills: SKILL_SEED.map((s) => ({ ...s, level: 0 })),
    achievements: ACHIEVEMENT_DEFS.map((a) => ({ id: uuid(), achievement_key: a.key, unlocked_at: null })),
    bossState: { id: uuid(), name: BOSS_NAMES[0], hp: 300, max_hp: 300, defeated_count: 0 },
    appState: {
      id: uuid(),
      streak: 0,
      last_completion_date: null,
      prestige: 0,
      daily_event: null,
      empire_health: 100,
      total_level: 1,
      total_xp: 0,
    },
    chatMessages: [],
    socialStats: [],
  };
}

/**
 * Thin persistence layer. Everything above this (store.ts) talks to the
 * Database shape only — swapping localStorage for Supabase later means
 * reimplementing load()/save() (and ideally per-table CRUD) here, nothing
 * else in the app needs to change.
 */
export function loadDatabase(): Database {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedDatabase();
    saveDatabase(seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as Database;
    return migrateIfNeeded(parsed);
  } catch {
    const seeded = seedDatabase();
    saveDatabase(seeded);
    return seeded;
  }
}

export function saveDatabase(db: Database): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/** Fills in any tables/fields missing from an older locally-stored save. */
function migrateIfNeeded(db: Partial<Database>): Database {
  const seeded = seedDatabase();
  return {
    channels: db.channels?.length ? db.channels : seeded.channels,
    contracts: db.contracts ?? [],
    dailyTasks: db.dailyTasks ?? [],
    earnings: db.earnings ?? [],
    roadmapItems: db.roadmapItems?.length ? db.roadmapItems : seeded.roadmapItems,
    skills: db.skills?.length ? db.skills : seeded.skills,
    achievements: db.achievements?.length ? db.achievements : seeded.achievements,
    bossState: db.bossState ?? seeded.bossState,
    appState: db.appState ?? seeded.appState,
    chatMessages: db.chatMessages ?? [],
    socialStats: db.socialStats ?? [],
  };
}

export function resetDatabase(): Database {
  const seeded = seedDatabase();
  saveDatabase(seeded);
  return seeded;
}

export function newId(): string {
  return uuid();
}

export function isoNow(): string {
  return new Date().toISOString();
}

export { today };
