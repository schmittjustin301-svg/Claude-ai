import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useProjectStore } from "../store/projectStore";
import { Badge, Button, Card } from "../components/ui";

interface Clip {
  id: string;
  name: string;
  category: string;
}

interface Combination {
  id: string;
  score: number;
  hookClip: Clip;
  mainClip: Clip;
  ctaClip: Clip;
  brollClip: Clip | null;
  outroClip: Clip | null;
  generatedVideo: { id: string; status: string } | null;
}

export function Generator() {
  const projectId = useProjectStore((s) => s.selectedProjectId)!;
  const [counts, setCounts] = useState<{ hook: number; main: number; cta: number }>({ hook: 0, main: 0, cta: 0 });
  const [targetCount, setTargetCount] = useState(50);
  const [allowRepeats, setAllowRepeats] = useState(false);
  const [useTagAffinity, setUseTagAffinity] = useState(true);
  const [usePriorityWeighting, setUsePriorityWeighting] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renderingBulk, setRenderingBulk] = useState(false);

  async function loadCounts() {
    const { clips } = await api.get<{ clips: { category: string }[] }>(`/clips?projectId=${projectId}`);
    setCounts({
      hook: clips.filter((c) => c.category === "HOOK").length,
      main: clips.filter((c) => c.category === "MAIN").length,
      cta: clips.filter((c) => c.category === "CTA").length,
    });
  }

  async function loadCombinations() {
    const { combinations } = await api.get<{ combinations: Combination[] }>(`/combinations?projectId=${projectId}`);
    setCombinations(combinations);
  }

  useEffect(() => {
    loadCounts();
    loadCombinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const possible = counts.hook * counts.main * counts.cta;

  async function handleGenerate() {
    setGenerating(true);
    setResultMsg(null);
    try {
      const res = await api.post<{ generatedCount: number; requestedCount: number; possibleCount: number; capped: boolean }>(
        "/combinations/generate",
        { projectId, targetCount, allowRepeats, useTagAffinity, usePriorityWeighting },
      );
      setResultMsg(
        res.capped
          ? `Generated ${res.generatedCount} unique combinations (capped — only ${res.possibleCount} possible without repeats).`
          : `Generated ${res.generatedCount} combinations.`,
      );
      await loadCombinations();
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function renderSelected() {
    setRenderingBulk(true);
    try {
      await api.post("/videos/render", { projectId, combinationIds: Array.from(selected) });
      setSelected(new Set());
      await loadCombinations();
    } finally {
      setRenderingBulk(false);
    }
  }

  async function renderAllPending() {
    setRenderingBulk(true);
    try {
      await api.post("/videos/render", { projectId });
      await loadCombinations();
    } finally {
      setRenderingBulk(false);
    }
  }

  const pendingCount = combinations.filter((c) => !c.generatedVideo).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Video Generator</h1>

      <Card>
        <div className="mb-4 flex flex-wrap gap-6 text-sm text-cf-muted">
          <span>
            {counts.hook} Hooks × {counts.main} Main × {counts.cta} CTAs ={" "}
            <span className="text-cf-text">{possible.toLocaleString()} possible combinations</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-cf-muted">Videos to generate</label>
            <input
              type="number"
              min={1}
              max={2000}
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              className="w-full rounded-lg border border-cf-border bg-cf-surface-2 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={allowRepeats} onChange={(e) => setAllowRepeats(e.target.checked)} />
            Allow repeated combinations
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={useTagAffinity} onChange={(e) => setUseTagAffinity(e.target.checked)} />
            Smart tag matching
          </label>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={usePriorityWeighting}
              onChange={(e) => setUsePriorityWeighting(e.target.checked)}
            />
            Priority weighting
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleGenerate} disabled={generating || possible === 0}>
            {generating ? "Generating…" : `Generate ${targetCount} videos`}
          </Button>
          {resultMsg && <span className="text-sm text-cf-muted">{resultMsg}</span>}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Combinations ({combinations.length})</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={renderSelected} disabled={selected.size === 0 || renderingBulk}>
              Render selected ({selected.size})
            </Button>
            <Button size="sm" onClick={renderAllPending} disabled={pendingCount === 0 || renderingBulk}>
              Render all pending ({pendingCount})
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-cf-muted">
              <tr>
                <th className="w-8"></th>
                <th className="py-2">Hook</th>
                <th>Main</th>
                <th>CTA</th>
                <th>Score</th>
                <th>Video</th>
              </tr>
            </thead>
            <tbody>
              {combinations.map((c) => (
                <tr key={c.id} className="border-t border-cf-border">
                  <td className="py-2">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                  </td>
                  <td className="py-2">{c.hookClip.name}</td>
                  <td>{c.mainClip.name}</td>
                  <td>{c.ctaClip.name}</td>
                  <td>{c.score.toFixed(1)}</td>
                  <td>
                    {c.generatedVideo ? (
                      <Badge tone={c.generatedVideo.status === "READY" ? "success" : c.generatedVideo.status === "FAILED" ? "danger" : "accent"}>
                        {c.generatedVideo.status}
                      </Badge>
                    ) : (
                      <Badge>not queued</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {combinations.length === 0 && <p className="py-6 text-center text-sm text-cf-muted">No combinations yet.</p>}
        </div>
      </Card>
    </div>
  );
}
