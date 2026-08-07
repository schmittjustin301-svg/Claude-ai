// Data model mirrors the planned Supabase schema 1:1 so the localStorage
// repository (db.ts) can be swapped for a Supabase-backed one later
// without touching the store or UI layer.

export type Tier = "STARTUP" | "GROWING" | "SCALING" | "EMPIRE";

export type ChannelKey = "justingymlife" | "rafael" | "fullaccess" | "skool";

export interface Channel {
  id: string;
  name: string;
  icon: string;
  xp: number;
  created_at: string;
}

export interface Contract {
  id: string;
  text: string;
  channel_id: string;
  xp: number;
  done: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface DailyTask {
  id: string;
  text: string;
  done: boolean;
  last_reset: string; // ISO date (yyyy-mm-dd) this task was last active for
}

export interface Earning {
  id: string;
  amount: number;
  source: string;
  date: string; // ISO date
}

export type RoadmapStatus = "LOCKED" | "ACTIVE" | "DONE";

export interface RoadmapItem {
  id: string;
  title: string;
  status: RoadmapStatus;
  position: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  level: number; // 0-5
}

export interface Achievement {
  id: string;
  achievement_key: string;
  unlocked_at: string | null;
}

export interface BossState {
  id: string;
  name: string;
  hp: number;
  max_hp: number;
  defeated_count: number;
}

export interface AppState {
  id: string;
  streak: number;
  last_completion_date: string | null;
  prestige: number;
  daily_event: DailyEvent | null;
  empire_health: number; // 0-100
  total_level: number;
  total_xp: number;
}

export type ChatRole = "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export type SocialPlatform = "youtube" | "instagram" | "tiktok";

export interface SocialStat {
  id: string;
  platform: SocialPlatform;
  metric: string;
  value: number;
  fetched_at: string;
}

export interface DailyEvent {
  key: string;
  title: string;
  description: string;
  xpMultiplier: number;
  bossDamageMultiplier: number;
}

// Aggregate snapshot returned to the AI assistant / used by the overview UI
export interface EmpireStatus {
  channels: Channel[];
  contracts: Contract[];
  dailyTasks: DailyTask[];
  boss: BossState;
  roadmap: RoadmapItem[];
  skills: Skill[];
  achievements: Achievement[];
  appState: AppState;
}
