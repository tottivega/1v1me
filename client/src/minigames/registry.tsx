import { lazy, type ComponentType } from 'react'
import { MINIGAME_CONFIGS, type MinigameId } from '@shared/types'

// Auto-discover all game components via Vite glob — no manual imports needed.
// Naming rule: component filename must match MinigameId exactly (case-insensitive).
//   e.g. ClickSpeed.tsx → 'clickspeed', RockPaperScissors.tsx → 'rockpaperscissors'
// Files starting with _ are excluded (templates).
// Each component is lazy-loaded: only the active game's bundle is fetched.

const modules = import.meta.glob<{ default: ComponentType }>('./*.tsx', { eager: false })

export const MINIGAME_COMPONENTS = {} as Record<MinigameId, ComponentType>

for (const [path, load] of Object.entries(modules)) {
  const filename = path.slice(2, -4) // strip './' prefix and '.tsx' suffix
  if (filename.startsWith('_') || filename === 'registry') continue
  const id = filename.toLowerCase() as MinigameId
  MINIGAME_COMPONENTS[id] = lazy(load as () => Promise<{ default: ComponentType }>)
}

// Startup assertion: every MinigameId must have a component.
// This throws at module-load time (before the app renders) — fail fast, never silently.
const missing = (Object.keys(MINIGAME_CONFIGS) as MinigameId[]).filter(
  (id) => !MINIGAME_COMPONENTS[id]
)
if (missing.length > 0) {
  throw new Error(
    `[registry] Missing client components for: ${missing.join(', ')}.\n` +
      `Create client/src/minigames/<PascalCaseId>.tsx with a default export.`
  )
}
