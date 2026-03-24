import { readdirSync } from 'fs'
import {
  MINIGAME_CONFIGS,
  type MinigameId,
  type MinigameCategory,
  type MinigamePlatform,
} from '@shared/types'
import type { MinigameModule } from '../types'

// ── Dynamic module discovery ───────────────────────────────────────────────────
// Scans this directory for game files on first use — no manual imports needed.
// Lazy so the require() calls run at call-time rather than import-time,
// which keeps the module safe to import in test environments (Vitest) without
// triggering side effects before the module system is fully set up.
//
// Rules for a file to be auto-loaded:
//   • Must end in .ts or .js
//   • Must NOT start with _ (templates are excluded)
//   • Must NOT be index.ts / index.js
//   • The default export must have an `id` property matching a MinigameId

let _modules: Record<string, MinigameModule> | null = null

function loadModules(): Record<string, MinigameModule> {
  if (_modules) return _modules

  const mods: Record<string, MinigameModule> = {}

  const files = readdirSync(__dirname).filter((f) => {
    if (f.startsWith('_')) return false
    if (f === 'index.ts' || f === 'index.js') return false
    return f.endsWith('.ts') || f.endsWith('.js')
  })

  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('./' + file)
    const mod: MinigameModule = raw.default ?? raw
    if (mod && typeof mod.id === 'string') {
      mods[mod.id] = mod
    }
  }

  // Fail fast if any game in MINIGAME_CONFIGS is missing a server module.
  const missing = (Object.keys(MINIGAME_CONFIGS) as MinigameId[]).filter((id) => !mods[id])
  if (missing.length > 0) {
    throw new Error(
      `[minigames] Missing server modules for: ${missing.join(', ')}.\n` +
        `Create server/src/minigames/<id>.ts with a default export that has id: '${missing[0]}'.`
    )
  }

  _modules = mods
  return _modules
}

export function getMinigame(id: MinigameId): MinigameModule {
  return loadModules()[id]
}

// ── Queue builder ──────────────────────────────────────────────────────────────

function fisherYates<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
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
  excludePlatforms?: MinigamePlatform[]
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

  // Working pool — shuffled fresh
  const pool = [...allIds]
  fisherYates(pool)

  const queue: MinigameId[] = []

  while (queue.length < size) {
    const lastCat = queue.length > 0 ? MINIGAME_CONFIGS[queue[queue.length - 1]].category : null

    // Prefer a game with a different category than the previous one
    const idx = pool.findIndex((id) => MINIGAME_CONFIGS[id].category !== lastCat)

    if (idx !== -1) {
      queue.push(pool.splice(idx, 1)[0])
    } else {
      // All remaining games share the same category — just pick the first
      queue.push(pool.splice(0, 1)[0])
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
