import { create } from 'zustand'
import { chapters as initialChapters, contentPosts as initialPosts, platformConnections as initialConnections } from './data/mock'
import type { Chapter, ContentPost, PlatformConnection } from './data/types'

export type Page = 'overview' | 'ebook' | 'content' | 'platforms'

interface DashboardState {
  page: Page
  setPage: (page: Page) => void

  chapters: Chapter[]
  generatingChapterId: string | null
  generateChapter: (id: string) => void

  posts: ContentPost[]

  connections: PlatformConnection[]
  toggleConnection: (platform: PlatformConnection['platform']) => void
  toggleAutoPost: (platform: PlatformConnection['platform']) => void
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  page: 'overview',
  setPage: (page) => set({ page }),

  chapters: initialChapters,
  generatingChapterId: null,
  generateChapter: (id) => {
    if (get().generatingChapterId) return
    set({ generatingChapterId: id })
    const chapter = get().chapters.find((c) => c.id === id)
    if (!chapter) {
      set({ generatingChapterId: null })
      return
    }
    const startWords = chapter.words
    const target = chapter.targetWords
    const steps = 12
    let step = 0
    const interval = setInterval(() => {
      step += 1
      const progressWords = Math.min(target, Math.round(startWords + ((target - startWords) * step) / steps))
      set((state) => ({
        chapters: state.chapters.map((c) =>
          c.id === id
            ? { ...c, words: progressWords, status: step >= steps ? 'final' : c.status === 'idea' ? 'outline' : 'draft' }
            : c,
        ),
      }))
      if (step >= steps) {
        clearInterval(interval)
        set({ generatingChapterId: null })
      }
    }, 220)
  },

  posts: initialPosts,

  connections: initialConnections,
  toggleConnection: (platform) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.platform === platform ? { ...c, connected: !c.connected, autoPostEnabled: c.connected ? false : c.autoPostEnabled } : c,
      ),
    })),
  toggleAutoPost: (platform) =>
    set((state) => ({
      connections: state.connections.map((c) => (c.platform === platform ? { ...c, autoPostEnabled: !c.autoPostEnabled } : c)),
    })),
}))
