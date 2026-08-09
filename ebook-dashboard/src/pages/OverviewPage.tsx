import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useDashboardStore } from '../store'
import { StatCard } from '../components/StatCard'
import { Badge } from '../components/Badge'
import { platformMeta } from '../components/platformMeta'
import { ebook } from '../data/mock'

export function OverviewPage() {
  const chapters = useDashboardStore((s) => s.chapters)
  const posts = useDashboardStore((s) => s.posts)
  const connections = useDashboardStore((s) => s.connections)

  const totalWords = chapters.reduce((sum, c) => sum + c.words, 0)
  const targetWords = chapters.reduce((sum, c) => sum + c.targetWords, 0)
  const ebookProgress = Math.round((totalWords / targetWords) * 100)

  const scheduledCount = posts.filter((p) => p.status === 'scheduled' || p.status === 'draft' || p.status === 'idea').length
  const totalReach = posts.reduce((sum, p) => sum + (p.metrics?.views ?? 0), 0)
  const connectedCount = connections.filter((c) => c.connected).length

  const chartData = (Object.keys(platformMeta) as (keyof typeof platformMeta)[]).map((platform) => ({
    platform: platformMeta[platform].label,
    Posts: posts.filter((p) => p.platform === platform).length,
  }))

  const recent = [...posts]
    .filter((p) => p.status === 'published')
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Übersicht</h1>
        <p className="mt-1 text-sm text-slate-400">{ebook.title} — {ebook.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ebook-Fortschritt" value={`${ebookProgress}%`} hint={`${totalWords.toLocaleString('de-DE')} / ${targetWords.toLocaleString('de-DE')} Wörter`} />
        <StatCard label="Posts in Pipeline" value={String(scheduledCount)} hint="Idee, Entwurf & geplant" />
        <StatCard label="Reichweite gesamt" value={totalReach.toLocaleString('de-DE')} hint="Views über alle veröffentlichten Posts" />
        <StatCard label="Verbundene Plattformen" value={`${connectedCount} / 4`} hint="Instagram, TikTok, YouTube, LinkedIn" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 text-sm font-semibold text-slate-200">Content-Pipeline pro Plattform</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232a34" vertical={false} />
              <XAxis dataKey="platform" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f151c', border: '1px solid #232a34', borderRadius: 12, color: '#e7ecf2' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="Posts" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 text-sm font-semibold text-slate-200">Zuletzt veröffentlicht</div>
        <div className="space-y-2">
          {recent.map((post) => (
            <div key={post.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-lg">{platformMeta[post.platform].emoji}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">{post.title}</div>
                  <div className="text-xs text-slate-500">{platformMeta[post.platform].label} · {post.format} · {post.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-slate-400 sm:block">{post.metrics?.views.toLocaleString('de-DE')} Views</span>
                <Badge status={post.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
