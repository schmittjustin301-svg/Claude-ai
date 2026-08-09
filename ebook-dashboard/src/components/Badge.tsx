import clsx from 'clsx'

const styles: Record<string, string> = {
  idea: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
  outline: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  draft: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  final: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  scheduled: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  published: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
}

const labels: Record<string, string> = {
  idea: 'Idee',
  outline: 'Gliederung',
  draft: 'Entwurf',
  final: 'Fertig',
  scheduled: 'Geplant',
  published: 'Veröffentlicht',
}

export function Badge({ status }: { status: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', styles[status])}>
      {labels[status] ?? status}
    </span>
  )
}
