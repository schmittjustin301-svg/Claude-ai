import type { Platform } from '../data/types'

export const platformMeta: Record<Platform, { label: string; color: string; emoji: string }> = {
  instagram: { label: 'Instagram', color: '#E1306C', emoji: '📸' },
  tiktok: { label: 'TikTok', color: '#25F4EE', emoji: '🎵' },
  youtube: { label: 'YouTube', color: '#FF0000', emoji: '▶️' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', emoji: '💼' },
}
