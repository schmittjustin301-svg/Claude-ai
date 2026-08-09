import { useState } from 'react'
import clsx from 'clsx'
import { useDashboardStore } from '../store'
import { Badge } from '../components/Badge'
import { platformMeta } from '../components/platformMeta'
import type { Platform } from '../data/types'

const filters: { id: Platform | 'all'; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
]

export function ContentPage() {
  const posts = useDashboardStore((s) => s.posts)
  const [filter, setFilter] = useState<Platform | 'all'>('all')

  const visible = [...posts]
    .filter((p) => filter === 'all' || p.platform === filter)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Content-Kalender</h1>
        <p className="mt-1 text-sm text-slate-400">Automatisch aus den Ebook-Kapiteln abgeleitete Posts für alle Kanäle.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === f.id
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 text-slate-400 hover:text-slate-200',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((post) => (
          <div key={post.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="text-xl">{platformMeta[post.platform].emoji}</span>
                <div className="min-w-0">
                  <div className="font-medium text-slate-100">{post.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {platformMeta[post.platform].label} · {post.format} · {post.date}
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{post.caption}</p>
                </div>
              </div>
              <Badge status={post.status} />
            </div>
            {post.metrics && (
              <div className="mt-3 flex gap-4 border-t border-white/5 pt-3 text-xs text-slate-500">
                <span>{post.metrics.views.toLocaleString('de-DE')} Views</span>
                <span>{post.metrics.likes.toLocaleString('de-DE')} Likes</span>
                <span>{post.metrics.comments.toLocaleString('de-DE')} Kommentare</span>
                <span>{post.metrics.shares.toLocaleString('de-DE')} Shares</span>
              </div>
            )}
          </div>
        ))}
        {visible.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">Keine Posts für diesen Filter.</div>}
      </div>
    </div>
  )
}
