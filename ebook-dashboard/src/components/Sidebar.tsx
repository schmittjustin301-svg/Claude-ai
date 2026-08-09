import clsx from 'clsx'
import { useDashboardStore, type Page } from '../store'

const items: { id: Page; label: string; icon: string }[] = [
  { id: 'overview', label: 'Übersicht', icon: '◧' },
  { id: 'ebook', label: 'Ebook', icon: '📘' },
  { id: 'content', label: 'Content-Kalender', icon: '🗓️' },
  { id: 'platforms', label: 'Plattformen', icon: '🔗' },
]

export function Sidebar() {
  const page = useDashboardStore((s) => s.page)
  const setPage = useDashboardStore((s) => s.setPage)

  return (
    <aside className="flex w-full shrink-0 flex-col border-white/10 bg-white/[0.02] md:h-screen md:w-64 md:border-r">
      <div className="px-5 py-6">
        <div className="text-lg font-extrabold tracking-tight text-slate-50">LeanLead</div>
        <div className="text-xs text-slate-500">Ebook & Marketing Autopilot</div>
      </div>
      <nav className="flex flex-1 gap-1 overflow-x-auto px-3 pb-4 md:flex-col md:overflow-visible">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={clsx(
              'flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
              page === item.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="hidden border-t border-white/10 px-5 py-4 text-xs text-slate-500 md:block">
        Demo-Modus · Mock-Daten
      </div>
    </aside>
  )
}
