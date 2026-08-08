// Note builders — one per kind of thing the app records.
//
// Every note carries YAML frontmatter so it stays machine-readable, and links
// to related notes with wikilinks. Those wikilinks are what the Brain graph
// later reads as edges, so the structure written here directly determines how
// good that graph is.

import dayjs from "dayjs";
import { frontmatter, sanitizeFileName, wikilink } from "./vaultClient";

export const VAULT_ROOT = "GRIND EMPIRE";

export const VAULT_PATHS = {
  daily: (date: string) => `${VAULT_ROOT}/Daily/${date}.md`,
  athlete: (name: string) => `${VAULT_ROOT}/Athletes/${sanitizeFileName(name)}.md`,
  show: (name: string) => `${VAULT_ROOT}/Shows/${sanitizeFileName(name)}.md`,
  post: (slug: string) => `${VAULT_ROOT}/Posts/${sanitizeFileName(slug)}.md`,
  clip: (slug: string) => `${VAULT_ROOT}/Clips/${sanitizeFileName(slug)}.md`,
  ledger: `${VAULT_ROOT}/Earnings/ledger.md`,
  roadmap: `${VAULT_ROOT}/Roadmap/milestones.md`,
  achievements: `${VAULT_ROOT}/Meta/achievements.md`,
  bossLog: `${VAULT_ROOT}/Meta/boss-log.md`,
} as const;

export const DAILY_HEADER = (date: string) =>
  `${frontmatter({ type: "daily", date })}\n# ${date}\n`;

export const LEDGER_HEADER = `${frontmatter({ type: "ledger" })}\n# Einnahmen\n`;
export const ROADMAP_HEADER = `${frontmatter({ type: "roadmap" })}\n# Meilensteine\n`;
export const ACHIEVEMENTS_HEADER = `${frontmatter({ type: "achievements" })}\n# Achievements\n`;
export const BOSS_HEADER = `${frontmatter({ type: "boss-log" })}\n# Boss-Log\n`;

export function today(): string {
  return dayjs().format("YYYY-MM-DD");
}

function stamp(): string {
  return dayjs().format("HH:mm");
}

/* ------------------------------------------------------------- entries */

export function contractEntry(text: string, channel: string, xp: number): { block: string; key: string } {
  const key = `ge-contract:${text}:${today()}`;
  return {
    block: `- [x] ${stamp()} — ${text} · ${channel} · +${xp} XP <!-- ${key} -->`,
    key,
  };
}

export function earningEntry(amount: number, source: string, id: string): { block: string; key: string } {
  const key = `ge-earning:${id}`;
  return {
    block: `- ${today()} · **${amount.toFixed(2)} €** · ${source} <!-- ${key} -->`,
    key,
  };
}

export function bossEntry(name: string, defeatedCount: number): { block: string; key: string } {
  const key = `ge-boss:${name}:${defeatedCount}`;
  return {
    block: `- ${today()} — **${name}** besiegt (Nr. ${defeatedCount}) <!-- ${key} -->`,
    key,
  };
}

export function achievementEntry(title: string): { block: string; key: string } {
  const key = `ge-achievement:${title}`;
  return { block: `- ${today()} — 🏆 ${title} <!-- ${key} -->`, key };
}

export function roadmapEntry(title: string, status: string): { block: string; key: string } {
  const key = `ge-roadmap:${title}:${status}`;
  return { block: `- ${today()} — ${title} → **${status}** <!-- ${key} -->`, key };
}

/* --------------------------------------------------------------- notes */

export interface AthleteNoteInput {
  name: string;
  division?: string;
  country?: string;
  coach?: string;
  team?: string;
  olympiaStatus?: string;
  height?: string;
  weight?: string;
  season?: string;
  sponsors?: string[];
  tags?: string[];
  shows?: string[];
}

export function athleteNote(a: AthleteNoteInput): { frontmatter: string; body: string } {
  const fm = frontmatter({
    type: "athlete",
    name: a.name,
    division: a.division,
    country: a.country,
    coach: a.coach,
    team: a.team,
    olympia_status: a.olympiaStatus,
    height: a.height,
    weight: a.weight,
    season: a.season,
    sponsors: a.sponsors,
    tags: a.tags,
    updated: today(),
  });

  const links: string[] = [];
  if (a.coach) links.push(`Coach: ${wikilink(a.coach)}`);
  if (a.shows?.length) links.push(`Shows: ${a.shows.map(wikilink).join(", ")}`);

  return {
    frontmatter: fm,
    body: [`# ${a.name}`, "", ...(links.length ? [links.join(" · "), ""] : []), "## Notizen", ""].join("\n"),
  };
}

export function showNote(name: string, year: string, location: string): { frontmatter: string; body: string } {
  return {
    frontmatter: frontmatter({ type: "show", name, year, location, updated: today() }),
    body: [`# ${name}`, "", [year, location].filter(Boolean).join(" · "), "", "## Lineup", ""].join("\n"),
  };
}

export interface PostNoteInput {
  slug: string;
  headline: string;
  subtitle: string;
  postType: string;
  athletes: string[];
  show?: string | null;
  format: string;
  template: string;
}

export function postNote(p: PostNoteInput): { frontmatter: string; body: string } {
  const fm = frontmatter({
    type: "post",
    post_type: p.postType,
    headline: p.headline,
    subtitle: p.subtitle,
    athletes: p.athletes,
    show: p.show ?? undefined,
    format: p.format,
    template: p.template,
    date: today(),
  });

  const body = [
    `# ${p.headline || p.slug}`,
    "",
    p.subtitle,
    "",
    p.athletes.length ? `Athleten: ${p.athletes.map(wikilink).join(", ")}` : "",
    p.show ? `Show: ${wikilink(p.show)}` : "",
    "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return { frontmatter: fm, body };
}

export interface ClipNoteInput {
  slug: string;
  label: string;
  sourceName: string;
  start: number;
  end: number;
  athlete?: string | null;
  status: string;
  processedUrl?: string | null;
}

export function clipNote(c: ClipNoteInput): { frontmatter: string; body: string } {
  const fm = frontmatter({
    type: "clip",
    label: c.label,
    source: c.sourceName,
    start_time: Number(c.start.toFixed(2)),
    end_time: Number(c.end.toFixed(2)),
    duration: Number((c.end - c.start).toFixed(2)),
    athlete: c.athlete ?? undefined,
    status: c.status,
    date: today(),
  });

  const body = [
    `# ${c.label}`,
    "",
    `Quelle: ${c.sourceName} · ${c.start.toFixed(1)}s–${c.end.toFixed(1)}s`,
    c.athlete ? `Athlet: ${wikilink(c.athlete)}` : "",
    c.processedUrl ? `\n[Generiertes Video](${c.processedUrl})` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return { frontmatter: fm, body };
}
