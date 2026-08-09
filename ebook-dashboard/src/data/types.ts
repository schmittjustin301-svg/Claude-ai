export type ChapterStatus = 'idea' | 'outline' | 'draft' | 'final'

export interface Chapter {
  id: string
  title: string
  status: ChapterStatus
  words: number
  targetWords: number
}

export interface Ebook {
  title: string
  subtitle: string
  targetAudience: string
  chapters: Chapter[]
}

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin'

export type PostStatus = 'idea' | 'draft' | 'scheduled' | 'published'

export interface PostMetrics {
  views: number
  likes: number
  comments: number
  shares: number
}

export interface ContentPost {
  id: string
  platform: Platform
  format: string
  title: string
  caption: string
  status: PostStatus
  date: string
  metrics?: PostMetrics
}

export interface PlatformConnection {
  platform: Platform
  connected: boolean
  handle: string
  followers: number
  autoPostEnabled: boolean
}
