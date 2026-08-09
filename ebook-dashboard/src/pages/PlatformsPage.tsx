import { useDashboardStore } from '../store'
import { platformMeta } from '../components/platformMeta'

export function PlatformsPage() {
  const connections = useDashboardStore((s) => s.connections)
  const toggleConnection = useDashboardStore((s) => s.toggleConnection)
  const toggleAutoPost = useDashboardStore((s) => s.toggleAutoPost)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Plattformen</h1>
        <p className="mt-1 text-sm text-slate-400">
          Verbindungen &amp; Auto-Posting-Status. Für echtes automatisches Posten braucht jede Plattform einen eigenen
          Business/Developer-Zugang (API-Keys), der hier noch nicht hinterlegt ist — diese Ansicht ist aktuell ein Mockup.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {connections.map((conn) => {
          const meta = platformMeta[conn.platform]
          return (
            <div key={conn.platform} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta.emoji}</span>
                  <div>
                    <div className="font-semibold text-slate-100">{meta.label}</div>
                    <div className="text-xs text-slate-500">{conn.connected ? conn.handle : 'Nicht verbunden'}</div>
                  </div>
                </div>
                <span
                  className={
                    conn.connected
                      ? 'rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300'
                      : 'rounded-full bg-slate-700/40 px-2.5 py-0.5 text-xs font-medium text-slate-400'
                  }
                >
                  {conn.connected ? 'Verbunden' : 'Getrennt'}
                </span>
              </div>

              {conn.connected && (
                <div className="mt-4 text-sm text-slate-400">{conn.followers.toLocaleString('de-DE')} Follower</div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={conn.autoPostEnabled}
                    disabled={!conn.connected}
                    onChange={() => toggleAutoPost(conn.platform)}
                    className="h-4 w-4 rounded border-white/20 accent-emerald-400 disabled:opacity-40"
                  />
                  Auto-Posting
                </label>
                <button
                  onClick={() => toggleConnection(conn.platform)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5"
                >
                  {conn.connected ? 'Trennen' : 'Verbinden'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
