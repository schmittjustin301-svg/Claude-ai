import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useBrainStore } from "../../store/brainStore";
import { Card, EmptyState, GlowButton, SectionTitle } from "../../components/ui";
import { NODE_COLOR, NODE_LABEL, nodeRadius, type BrainNode, type NodeKind } from "../../lib/brain/graph";
import { findNodeAt, stepLayout } from "../../lib/brain/forceLayout";

export function BrainScreen() {
  const graph = useBrainStore((s) => s.graph);
  const loading = useBrainStore((s) => s.loading);
  const error = useBrainStore((s) => s.error);
  const highlighted = useBrainStore((s) => s.highlighted);
  const selected = useBrainStore((s) => s.selected);
  const rebuild = useBrainStore((s) => s.rebuild);
  const select = useBrainStore((s) => s.select);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [size, setSize] = useState({ width: 360, height: 420 });

  useEffect(() => {
    if (!graph && !loading) void rebuild();
  }, [graph, loading, rebuild]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setSize({ width, height: Math.max(360, Math.min(560, width * 1.1)) });
    });
    observer.observe(canvas.parentElement ?? canvas);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size.width * dpr) {
      canvas.width = size.width * dpr;
      canvas.height = size.height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stepLayout(graph.nodes, graph.edges, { width: size.width, height: size.height });

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, size.width, size.height);

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const isHot = (id: string) => highlighted.includes(id);

    for (const edge of graph.edges) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      const hot = isHot(a.id) || isHot(b.id);
      ctx.strokeStyle = hot ? "rgba(255,20,50,0.55)" : "rgba(245,245,245,0.12)";
      ctx.lineWidth = hot ? 1.6 : 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const node of graph.nodes) {
      const r = nodeRadius(node);
      const color = NODE_COLOR[node.kind];
      const hot = isHot(node.id) || selected?.id === node.id;

      if (hot) {
        ctx.shadowBlur = 22;
        ctx.shadowColor = color;
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = hot ? 1 : 0.85;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // Only label the nodes worth labelling, or the graph turns to mush.
      if (r > 9 || hot) {
        ctx.fillStyle = hot ? "#F5F5F5" : "rgba(245,245,245,0.6)";
        ctx.font = `${hot ? 12 : 10}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.label.slice(0, 22), node.x, node.y + r + 3);
      }
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [graph, size, highlighted, selected]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  const counts = graph
    ? (Object.keys(NODE_LABEL) as NodeKind[]).map((kind) => ({
        kind,
        count: graph.nodes.filter((n) => n.kind === kind).length,
      }))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle
        right={
          graph && (
            <span className="font-mono text-xs text-white/50">
              {graph.nodes.length} Knoten · {graph.edges.length} Kanten
            </span>
          )
        }
      >
        Brain
      </SectionTitle>

      {error && (
        <Card className="border-ge-red/40">
          <p className="font-mono text-xs text-ge-red">{error}</p>
        </Card>
      )}

      {!graph && loading && <EmptyState>Graph wird gebaut…</EmptyState>}

      {graph && graph.nodes.length === 0 && (
        <EmptyState>Noch keine Daten. Lege Athleten an oder aktiviere den Vault-Sync.</EmptyState>
      )}

      {graph && graph.nodes.length > 0 && (
        <>
          <Card className="p-2">
            <canvas
              ref={canvasRef}
              style={{ width: size.width, height: size.height }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                select(findNodeAt(graph.nodes, e.clientX - rect.left, e.clientY - rect.top));
              }}
              className="block w-full cursor-pointer rounded-lg"
            />
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            {counts
              .filter((c) => c.count > 0)
              .map(({ kind, count }) => (
                <span
                  key={kind}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 font-mono text-[10px] text-white/60"
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: NODE_COLOR[kind] }} />
                  {NODE_LABEL[kind]} {count}
                </span>
              ))}
            <span className="ml-auto font-mono text-[10px] text-white/30">
              Quelle: {graph.source === "vault" ? "Obsidian-Vault" : "App-Daten"}
            </span>
          </div>

          {graph.source === "local" && (
            <p className="px-1 font-mono text-[10px] leading-relaxed text-white/35">
              Der Vault war nicht erreichbar — der Graph kommt aus den App-Daten. Mit aktivem Vault-Sync werden die
              Wikilinks deiner Notizen zu den Kanten, und der Graph wird deutlich reicher.
            </p>
          )}

          <NodeDetail node={selected} onClose={() => select(null)} />

          <GlowButton variant="ghost" onClick={() => void rebuild()} disabled={loading}>
            {loading ? "Baut…" : "Graph neu aufbauen"}
          </GlowButton>
        </>
      )}
    </div>
  );
}

function NodeDetail({ node, onClose }: { node: BrainNode | null; onClose: () => void }) {
  if (!node) return null;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLOR[node.kind] }} />
            <span className="font-display text-lg tracking-wide text-ge-white uppercase">{node.label}</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-white/45">
            {NODE_LABEL[node.kind]} · {node.degree} Verbindungen
            {node.detail ? ` · ${node.detail}` : ""}
          </div>
        </div>
        <button onClick={onClose} className="font-mono text-xs text-white/40 hover:text-white">
          ✕
        </button>
      </div>

      {node.path && (
        <a
          href={`obsidian://open?path=${encodeURIComponent(node.path)}`}
          className={clsx(
            "mt-3 inline-block rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[11px] text-white/70",
            "hover:border-ge-red/50 hover:text-ge-red"
          )}
        >
          In Obsidian öffnen
        </a>
      )}
    </Card>
  );
}
