import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useProjectStore } from "../store/projectStore";
import { Card, StatCard } from "../components/ui";

interface DashboardStats {
  totalClips: number;
  totalCombinations: number;
  totalVideos: number;
  clipsByCategory: Record<string, number>;
  videosByStatus: Record<string, number>;
}

export function Dashboard() {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api.get<DashboardStats>(`/dashboard?projectId=${projectId}`).then(setStats);
  }, [projectId]);

  if (!stats) return <p className="text-cf-muted">Loading…</p>;

  const readyVideos = stats.videosByStatus.READY ?? 0;
  const renderingVideos = (stats.videosByStatus.QUEUED ?? 0) + (stats.videosByStatus.RENDERING ?? 0);
  const failedVideos = stats.videosByStatus.FAILED ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Clips" value={stats.totalClips} />
        <StatCard label="Combinations Generated" value={stats.totalCombinations} />
        <StatCard label="Videos Ready" value={readyVideos} sub={`${renderingVideos} rendering · ${failedVideos} failed`} />
        <StatCard label="Total Videos" value={stats.totalVideos} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-cf-muted">Clips by category</h2>
          <div className="flex flex-col gap-2">
            {Object.entries(stats.clipsByCategory).map(([category, count]) => (
              <Bar key={category} label={category} value={count} max={stats.totalClips || 1} />
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-cf-muted">Videos by status</h2>
          <div className="flex flex-col gap-2">
            {Object.entries(stats.videosByStatus).map(([status, count]) => (
              <Bar key={status} label={status} value={count} max={stats.totalVideos || 1} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-cf-muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-cf-surface-2">
        <div className="h-full rounded-full bg-cf-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
