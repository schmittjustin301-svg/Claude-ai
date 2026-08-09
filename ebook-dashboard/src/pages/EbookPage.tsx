import { useDashboardStore } from '../store'
import { Badge } from '../components/Badge'
import { ebook } from '../data/mock'

export function EbookPage() {
  const chapters = useDashboardStore((s) => s.chapters)
  const generatingChapterId = useDashboardStore((s) => s.generatingChapterId)
  const generateChapter = useDashboardStore((s) => s.generateChapter)

  const totalWords = chapters.reduce((sum, c) => sum + c.words, 0)
  const targetWords = chapters.reduce((sum, c) => sum + c.targetWords, 0)
  const progress = Math.round((totalWords / targetWords) * 100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">{ebook.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{ebook.subtitle}</p>
        <p className="mt-1 text-xs text-slate-500">Zielgruppe: {ebook.targetAudience}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-200">Gesamtfortschritt</span>
          <span className="font-mono text-slate-400">{totalWords.toLocaleString('de-DE')} / {targetWords.toLocaleString('de-DE')} Wörter ({progress}%)</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter, idx) => {
          const chapterProgress = Math.round((chapter.words / chapter.targetWords) * 100)
          const isGenerating = generatingChapterId === chapter.id
          return (
            <div key={chapter.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Kapitel {idx + 1}</div>
                  <div className="mt-0.5 font-medium text-slate-100">{chapter.title}</div>
                </div>
                <Badge status={chapter.status} />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${chapterProgress}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{chapter.words.toLocaleString('de-DE')} / {chapter.targetWords.toLocaleString('de-DE')} Wörter</span>
                {chapter.status !== 'final' && (
                  <button
                    onClick={() => generateChapter(chapter.id)}
                    disabled={isGenerating}
                    className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    {isGenerating ? 'KI schreibt …' : 'Mit KI weiterschreiben'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
