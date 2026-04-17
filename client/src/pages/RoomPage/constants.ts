import { MINIGAME_CATEGORIES, type MinigameCategory } from '@shared/types'

export const CATEGORY_COLORS: Record<MinigameCategory, string> = {
  reflex: 'var(--blue)',
  math: 'var(--orange)',
  luck: 'var(--yellow)',
  strategy: 'var(--green)',
  skill: 'var(--red)',
  memory: 'var(--purple)',
}

// Dark-tinted backgrounds for the round transition overlay — dark enough to read white text
export const CATEGORY_OVERLAY_BG: Record<MinigameCategory, string> = {
  reflex: 'rgba(20,  60, 160, 0.92)',
  math: 'rgba(160, 70,  10, 0.92)',
  luck: 'rgba(130, 110,  0, 0.92)',
  strategy: 'rgba(10,  100, 45, 0.92)',
  skill: 'rgba(180,  20,  40, 0.92)',
  memory: 'rgba(100,  20, 160, 0.92)',
}

export const ALL_CATEGORIES: readonly MinigameCategory[] = MINIGAME_CATEGORIES
export const BEST_OF_OPTIONS = [3, 5, 7, 9] as const
export const DRAFT_COUNT_OPTIONS = [0, 1, 2, 3] as const

export const CATEGORY_LABEL: Record<MinigameCategory, string> = {
  reflex: '⚡ Reflex',
  math: '🔢 Math',
  luck: '🎲 Luck',
  strategy: '🧠 Strategy',
  skill: '🎯 Skill',
  memory: '🧩 Memory',
}

export const EMOTES = ['😂', '🔥', '💀', '👏']
