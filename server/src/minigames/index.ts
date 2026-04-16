import {
  MINIGAME_CONFIGS,
  type MinigameId,
  type MinigameCategory,
  type MinigamePlatform,
} from '@shared/types'
import type { MinigameModule } from '../types'

import clickspeed from './clickspeed'
import coinflip from './coinflip'
import reactiontest from './reactiontest'
import quickmaths from './quickmaths'
import memorymatch from './memorymatch'
import fastesttyper from './fastesttyper'
import rockpaperscissors from './rockpaperscissors'
import colorword from './colorword'
import kaboom from './kaboom'
import tapsequence from './tapsequence'

const registry: Record<string, MinigameModule> = {
  clickspeed,
  coinflip,
  reactiontest,
  quickmaths,
  memorymatch,
  fastesttyper,
  rockpaperscissors,
  colorword,
  kaboom,
  tapsequence,
}

// Fail fast at startup if any game in MINIGAME_CONFIGS is missing a server module.
const missing = (Object.keys(MINIGAME_CONFIGS) as MinigameId[]).filter((id) => !registry[id])
if (missing.length > 0) {
  throw new Error(
    `[minigames] Missing server modules for: ${missing.join(', ')}.\n` +
      `Create server/src/minigames/<id>.ts with a default export that has id: '${missing[0]}'.`
  )
}

export function getMinigame(id: MinigameId): MinigameModule {
  return registry[id]!
}

// ── Queue builder ──────────────────────────────────────────────────────────────

function fisherYates<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

// Build a queue of `size` games that avoids consecutive same-category games.
// Filters to `categories` when provided (falls back to all if filter yields nothing).
// Excludes games whose platform tag is in `excludePlatforms` (e.g. 'desktop-only' for mobile players).
// Works at any pool size: with many games it naturally varies well;
// with few games it does the best it can before falling back to repeats.
export function shuffleQueue(
  size = 5,
  categories?: MinigameCategory[],
  excludePlatforms?: MinigamePlatform[],
  excludeIds?: MinigameId[]
): MinigameId[] {
  let allIds = Object.keys(MINIGAME_CONFIGS) as MinigameId[]
  if (categories && categories.length > 0) {
    const filtered = allIds.filter((id) => categories.includes(MINIGAME_CONFIGS[id].category))
    if (filtered.length > 0) allIds = filtered
  }
  if (excludePlatforms && excludePlatforms.length > 0) {
    const filtered = allIds.filter(
      (id) => !excludePlatforms.includes(MINIGAME_CONFIGS[id].platforms)
    )
    if (filtered.length > 0) allIds = filtered
  }
  if (excludeIds && excludeIds.length > 0) {
    const filtered = allIds.filter((id) => !excludeIds.includes(id))
    // Only apply ban filter if it leaves at least 1 game
    if (filtered.length > 0) allIds = filtered
  }

  // Working pool — shuffled fresh
  const pool = [...allIds]
  fisherYates(pool)

  const queue: MinigameId[] = []

  while (queue.length < size) {
    const lastCat = queue.length > 0 ? MINIGAME_CONFIGS[queue[queue.length - 1]!].category : null

    // Prefer a game with a different category than the previous one
    const idx = pool.findIndex((id) => MINIGAME_CONFIGS[id].category !== lastCat)

    if (idx !== -1) {
      queue.push(pool.splice(idx, 1)[0]!)
    } else {
      // All remaining games share the same category — just pick the first
      queue.push(pool.splice(0, 1)[0]!)
    }

    // Refill pool when exhausted (best-of-N can exceed unique game count)
    if (pool.length === 0 && queue.length < size) {
      const refill = [...allIds]
      fisherYates(refill)
      pool.push(...refill)
    }
  }

  return queue
}
