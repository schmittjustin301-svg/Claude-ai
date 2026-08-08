// Builds the knowledge graph.
//
// Primary source is the Obsidian vault: the wikilinks between notes *are* the
// edges, exactly as the plan intends. When the vault is unreachable the graph
// falls back to the app's own stores, so the Brain still shows something
// instead of an empty canvas — with the UI saying which source it used.

import { readNote, vaultAvailable } from "../vault/vaultClient";
import { VAULT_ROOT } from "../vault/vaultNotes";
import { loadObsidianConfig } from "../memory/obsidianBackend";

export type NodeKind = "athlete" | "show" | "content" | "business" | "goal";

/** Colours are fixed by the design spec, not chosen per render. */
export const NODE_COLOR: Record<NodeKind, string> = {
  athlete: "#FF1432",
  show: "#F5F5F5",
  content: "#9AA0A6",
  business: "#39FF88",
  goal: "#FFD24A",
};

export const NODE_LABEL: Record<NodeKind, string> = {
  athlete: "Athleten",
  show: "Shows",
  content: "Posts & Clips",
  business: "Business",
  goal: "Ziele",
};

export interface BrainNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** Vault path, when the node came from a note. */
  path?: string;
  detail?: string;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BrainEdge {
  source: string;
  target: string;
}

export interface BrainGraph {
  nodes: BrainNode[];
  edges: BrainEdge[];
  source: "vault" | "local";
}

function makeNode(label: string, kind: NodeKind, path?: string, detail?: string): BrainNode {
  return {
    id: label,
    label,
    kind,
    path,
    detail,
    degree: 0,
    // Seeded from the label so a rebuild does not reshuffle the whole layout.
    x: hashTo(label, 0) * 600,
    y: hashTo(label, 1) * 600,
    vx: 0,
    vy: 0,
  };
}

function hashTo(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const WIKILINK = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;

function extractLinks(markdown: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = WIKILINK.exec(markdown)) !== null) {
    out.push(match[1].trim());
  }
  return out;
}

function frontmatterValue(markdown: string, key: string): string | null {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!block) return null;
  const line = new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, "m").exec(block[1]);
  return line ? line[1].trim() : null;
}

/** Folder → node kind, matching the vault layout written in Etappe 4. */
const FOLDER_KIND: { folder: string; kind: NodeKind }[] = [
  { folder: "Athletes", kind: "athlete" },
  { folder: "Shows", kind: "show" },
  { folder: "Posts", kind: "content" },
  { folder: "Clips", kind: "content" },
  { folder: "Earnings", kind: "business" },
  { folder: "Daily", kind: "business" },
  { folder: "Roadmap", kind: "goal" },
  { folder: "Meta", kind: "goal" },
];

async function listFolder(folder: string): Promise<string[]> {
  const config = loadObsidianConfig();
  const url = `${config.baseUrl.replace(/\/$/, "")}/vault/${encodeURIComponent(VAULT_ROOT)}/${encodeURIComponent(folder)}/`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { files?: string[] };
    return (data.files ?? []).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

export async function buildGraphFromVault(): Promise<BrainGraph | null> {
  if (!(await vaultAvailable())) return null;

  const nodes = new Map<string, BrainNode>();
  const edges: BrainEdge[] = [];

  for (const { folder, kind } of FOLDER_KIND) {
    for (const file of await listFolder(folder)) {
      const name = file.replace(/\.md$/, "");
      const path = `${VAULT_ROOT}/${folder}/${file}`;
      let markdown = "";
      try {
        markdown = (await readNote(path)) ?? "";
      } catch {
        continue;
      }

      const detail =
        [frontmatterValue(markdown, "division"), frontmatterValue(markdown, "country")].filter(Boolean).join(" · ") ||
        frontmatterValue(markdown, "type") ||
        undefined;

      if (!nodes.has(name)) nodes.set(name, makeNode(name, kind, path, detail));

      for (const target of extractLinks(markdown)) {
        if (!nodes.has(target)) nodes.set(target, makeNode(target, "athlete"));
        edges.push({ source: name, target });
      }
    }
  }

  if (nodes.size === 0) return null;
  return finalise([...nodes.values()], edges, "vault");
}

export interface LocalGraphInput {
  athletes: { name: string; division?: string; country?: string; coach?: string }[];
  shows: { name: string }[];
  posts: { headline: string; athleteNames: string[]; showName?: string | null }[];
  clips: { label: string; athleteName?: string | null }[];
  goals: string[];
  business: { label: string; detail?: string }[];
}

/** Fallback graph from in-app data when the vault is not reachable. */
export function buildGraphFromLocal(input: LocalGraphInput): BrainGraph {
  const nodes = new Map<string, BrainNode>();
  const edges: BrainEdge[] = [];

  const ensure = (label: string, kind: NodeKind, detail?: string) => {
    if (!label.trim()) return null;
    if (!nodes.has(label)) nodes.set(label, makeNode(label, kind, undefined, detail));
    return label;
  };

  for (const a of input.athletes) {
    ensure(a.name, "athlete", [a.division, a.country].filter(Boolean).join(" · "));
    if (a.coach) {
      ensure(a.coach, "business", "Coach");
      edges.push({ source: a.name, target: a.coach });
    }
  }
  for (const s of input.shows) ensure(s.name, "show");
  for (const g of input.goals) ensure(g, "goal");
  for (const b of input.business) ensure(b.label, "business", b.detail);

  for (const p of input.posts) {
    const label = p.headline || "Post";
    ensure(label, "content");
    for (const name of p.athleteNames) {
      ensure(name, "athlete");
      edges.push({ source: label, target: name });
    }
    if (p.showName) {
      ensure(p.showName, "show");
      edges.push({ source: label, target: p.showName });
    }
  }

  for (const c of input.clips) {
    ensure(c.label, "content");
    if (c.athleteName) {
      ensure(c.athleteName, "athlete");
      edges.push({ source: c.label, target: c.athleteName });
    }
  }

  return finalise([...nodes.values()], edges, "local");
}

/** Drops dangling edges and computes degree, which drives node size. */
function finalise(nodes: BrainNode[], edges: BrainEdge[], source: "vault" | "local"): BrainGraph {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const clean: BrainEdge[] = [];

  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const key = [edge.source, edge.target].sort().join("→");
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(edge);
    byId.get(edge.source)!.degree++;
    byId.get(edge.target)!.degree++;
  }

  return { nodes, edges: clean, source };
}

/** Node radius grows with connectedness, damped so hubs stay on screen. */
export function nodeRadius(node: BrainNode): number {
  return 6 + Math.sqrt(node.degree) * 4;
}
