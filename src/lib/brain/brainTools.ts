// queryBrain — lets the assistant read the knowledge graph.
//
// Answering also highlights the nodes it drew on, so the visualisation shows
// what the assistant was actually looking at rather than just asserting it.

import { useBrainStore } from "../../store/brainStore";
import { similarity, tokenOverlap } from "../textMatch";
import { NODE_LABEL, type BrainNode } from "./graph";

export const BRAIN_TOOL_DEFINITIONS = [
  {
    name: "queryBrain",
    description:
      "Durchsucht den Wissensgraph über das Business (Athleten, Shows, Posts, Clips, Kanäle, Ziele) und liefert die Treffer samt ihrer Verbindungen. Nutze das, wenn du Zusammenhänge brauchst — wer zu welcher Show gehört, in welchen Posts jemand vorkommt, was mit einem Thema verknüpft ist.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Thema, Name oder Stichwort" },
      },
      required: ["topic"],
    },
  },
] as const;

export const BRAIN_TOOL_NAMES = new Set(BRAIN_TOOL_DEFINITIONS.map((t) => t.name as string));

function score(query: string, node: BrainNode): number {
  return Math.max(tokenOverlap(query, node.label), similarity(query, node.label) * 0.9);
}

export async function executeBrainTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  if (name !== "queryBrain") return { ok: false, error: `Unbekanntes Brain-Tool: ${name}` };

  const topic = String(input.topic ?? "").trim();
  if (!topic) return { ok: false, error: "topic fehlt." };

  const store = useBrainStore.getState();
  if (!store.graph) await store.rebuild();
  const graph = useBrainStore.getState().graph;
  if (!graph || graph.nodes.length === 0) {
    return { found: false, message: "Der Wissensgraph ist noch leer." };
  }

  const matches = graph.nodes
    .map((node) => ({ node, score: score(topic, node) }))
    .filter((m) => m.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (matches.length === 0) {
    return { found: false, message: `Nichts zu "${topic}" im Graph gefunden.` };
  }

  const results = matches.map(({ node }) => {
    const connections = graph.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source));
    return {
      name: node.label,
      kind: NODE_LABEL[node.kind],
      detail: node.detail ?? null,
      connections: [...new Set(connections)].slice(0, 12),
      connection_count: node.degree,
    };
  });

  // Light up what informed the answer, plus one hop out.
  const ids = new Set(matches.map((m) => m.node.id));
  for (const result of results) for (const c of result.connections) ids.add(c);
  useBrainStore.getState().setHighlighted([...ids]);

  return { found: true, source: graph.source, results };
}
