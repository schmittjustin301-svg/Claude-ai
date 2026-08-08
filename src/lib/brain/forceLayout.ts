// Minimal force-directed layout.
//
// Written by hand rather than pulling in d3-force or react-force-graph: the
// simulation is ~40 lines, and those libraries would add far more to the bundle
// than this problem warrants.

import { nodeRadius, type BrainEdge, type BrainNode } from "./graph";

export interface LayoutOptions {
  width: number;
  height: number;
  /** Above this many nodes, repulsion is sampled instead of exhaustive. */
  sampleThreshold?: number;
}

/**
 * Advances the simulation one step, mutating node positions.
 *
 * Repulsion is O(n²), which is fine for the low hundreds. Past the threshold
 * each node is pushed by a random sample of others instead — the layout stays
 * usable and the frame budget holds.
 */
export function stepLayout(
  nodes: BrainNode[],
  edges: BrainEdge[],
  { width, height, sampleThreshold = 120 }: LayoutOptions
): void {
  const cx = width / 2;
  const cy = height / 2;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const repulsion = 2400;
  const springLength = 90;
  const springStrength = 0.02;
  const centering = 0.006;
  const damping = 0.86;

  const sampled = nodes.length > sampleThreshold;

  for (const node of nodes) {
    let fx = 0;
    let fy = 0;

    const others = sampled ? sampleOthers(nodes, node, 40) : nodes;
    for (const other of others) {
      if (other === node) continue;
      let dx = node.x - other.x;
      let dy = node.y - other.y;
      let distSq = dx * dx + dy * dy;
      if (distSq < 0.01) {
        // Perfectly overlapping nodes would produce NaN; nudge them apart.
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
        distSq = 0.01;
      }
      const force = repulsion / distSq;
      const dist = Math.sqrt(distSq);
      fx += (dx / dist) * force;
      fy += (dy / dist) * force;
    }

    fx += (cx - node.x) * centering;
    fy += (cy - node.y) * centering;

    node.vx = (node.vx + fx) * damping;
    node.vy = (node.vy + fy) * damping;
  }

  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const force = (dist - springLength) * springStrength;
    const ux = (dx / dist) * force;
    const uy = (dy / dist) * force;
    a.vx += ux;
    a.vy += uy;
    b.vx -= ux;
    b.vy -= uy;
  }

  for (const node of nodes) {
    node.x += Math.max(-12, Math.min(12, node.vx));
    node.y += Math.max(-12, Math.min(12, node.vy));
    const r = nodeRadius(node);
    node.x = Math.max(r, Math.min(width - r, node.x));
    node.y = Math.max(r, Math.min(height - r, node.y));
  }
}

function sampleOthers(nodes: BrainNode[], exclude: BrainNode, count: number): BrainNode[] {
  const out: BrainNode[] = [];
  for (let i = 0; i < count; i++) {
    const candidate = nodes[Math.floor(Math.random() * nodes.length)];
    if (candidate !== exclude) out.push(candidate);
  }
  return out;
}

/**
 * Picks the nearest node within a generous radius rather than requiring a
 * direct hit. Nodes are 6–14px across, which is far below a comfortable touch
 * target, so an exact-hit test makes the graph nearly unusable on a phone.
 */
export function findNodeAt(nodes: BrainNode[], x: number, y: number, tolerance = 22): BrainNode | null {
  let best: BrainNode | null = null;
  let bestDist = Infinity;

  for (const node of nodes) {
    const reach = nodeRadius(node) + tolerance;
    const dist = Math.hypot(node.x - x, node.y - y);
    if (dist <= reach && dist < bestDist) {
      bestDist = dist;
      best = node;
    }
  }
  return best;
}
