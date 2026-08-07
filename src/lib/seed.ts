import type { RoadmapItem, Skill } from "./types";

// Static reference data — ids are stable strings (not uuids) so the
// AI tool-use layer and UI can address them predictably.

export const CHANNEL_SEED = [
  { id: "justingymlife", name: "Justingymlife", icon: "💪" },
  { id: "rafael", name: "Rafael Zimmermann", icon: "🎬" },
  { id: "fullaccess", name: "Full Access", icon: "🔓" },
  { id: "skool", name: "Skool", icon: "🎓" },
] as const;

export const SKILL_SEED: Omit<Skill, "level">[] = [
  { id: "editing-speed", name: "Editing Speed", description: "Wie schnell du sauberen Schnitt lieferst." },
  { id: "hook-writing", name: "Hook Writing", description: "Die ersten 3 Sekunden, die scrollen stoppen." },
  { id: "storytelling", name: "Storytelling", description: "Content, der hängen bleibt." },
  { id: "sponsor-outreach", name: "Sponsor Outreach", description: "Deals an Land ziehen." },
  { id: "community-building", name: "Community Building", description: "Eine Audience, die bleibt." },
  { id: "trend-research", name: "Trend Research", description: "Wissen, was als nächstes läuft." },
];

export const ACHIEVEMENT_DEFS: { key: string; title: string; description: string }[] = [
  { key: "first_contract", title: "Erster Auftrag", description: "Schließe deinen ersten Contract ab." },
  { key: "ten_contracts", title: "Grinder", description: "Schließe 10 Contracts ab." },
  { key: "fifty_contracts", title: "Workhorse", description: "Schließe 50 Contracts ab." },
  { key: "first_boss", title: "Boss Slayer", description: "Besiege deinen ersten wöchentlichen Boss." },
  { key: "five_bosses", title: "Boss Hunter", description: "Besiege 5 Bosse." },
  { key: "streak_7", title: "Eine Woche am Stück", description: "Erreiche eine 7-Tage-Streak." },
  { key: "streak_30", title: "Unaufhaltbar", description: "Erreiche eine 30-Tage-Streak." },
  { key: "first_earning", title: "Erstes Geld", description: "Logge deine erste Einnahme." },
  { key: "earnings_1000", title: "Vierstellig", description: "Erreiche 1.000€ Gesamteinnahmen." },
  { key: "first_prestige", title: "Neuanfang", description: "Führe dein erstes Prestige durch." },
  { key: "skill_mastered", title: "Meister", description: "Bringe einen Skill auf Stufe 5." },
  { key: "empire_tier", title: "Empire Status", description: "Erreiche den EMPIRE-Tier." },
];

export const ROADMAP_SEED: Omit<RoadmapItem, "id">[] = [
  { title: "Foundation: App + DB live", status: "ACTIVE", position: 0 },
  { title: "JARVIS-Modus: KI-Assistent", status: "LOCKED", position: 1 },
  { title: "YouTube-Anbindung", status: "LOCKED", position: 2 },
  { title: "Instagram-Anbindung", status: "LOCKED", position: 3 },
  { title: "10.000€ Gesamteinnahmen", status: "LOCKED", position: 4 },
  { title: "TikTok-Anbindung", status: "LOCKED", position: 5 },
];

export const BOSS_NAMES = [
  "Content Void",
  "Der Algorithmus",
  "Deadline Dämon",
  "Burnout Beast",
  "Sponsor Ghosting",
  "Shadowban",
  "Zero Engagement",
  "Analysis Paralysis",
];

export const RANDOM_EVENTS: { key: string; title: string; description: string; xpMultiplier: number; bossDamageMultiplier: number }[] = [
  { key: "double_xp", title: "Double XP Day", description: "Heute gibt's das Doppelte an XP für jeden Contract.", xpMultiplier: 2, bossDamageMultiplier: 1 },
  { key: "boss_weakness", title: "Boss-Schwäche entdeckt", description: "Boss-Schaden ist heute um 50% erhöht.", xpMultiplier: 1, bossDamageMultiplier: 1.5 },
  { key: "focus_day", title: "Focus Day", description: "Ein ruhiger Tag ohne besondere Effekte — nutze ihn gut.", xpMultiplier: 1, bossDamageMultiplier: 1 },
  { key: "grind_surge", title: "Grind Surge", description: "XP und Boss-Schaden beide um 25% erhöht.", xpMultiplier: 1.25, bossDamageMultiplier: 1.25 },
  { key: "slow_start", title: "Slow Start", description: "Der Tag beginnt zäh — XP ist um 10% reduziert. Zieh trotzdem durch.", xpMultiplier: 0.9, bossDamageMultiplier: 1 },
];
