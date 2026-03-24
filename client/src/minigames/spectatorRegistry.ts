// Auto-discover all *.spectator.tsx files — no manual imports needed.
// Naming rule: GameName.spectator.tsx → registered under 'gamename' (lowercased stem).
// Eagerly loaded (small components, always needed when spectating).

import type { ComponentType } from 'react'
import type { MinigameId } from '@shared/types'
import type { SpectatorProps } from './spectatorHelpers'

const modules = import.meta.glob<{ default: ComponentType<SpectatorProps> }>('./*.spectator.tsx', {
  eager: true,
})

export const SPECTATOR_COMPONENTS: Partial<Record<MinigameId, ComponentType<SpectatorProps>>> = {}

for (const [path, mod] of Object.entries(modules)) {
  // './ClickSpeed.spectator.tsx' → 'clickspeed'
  const stem = path.slice(2, -'.spectator.tsx'.length).toLowerCase()
  SPECTATOR_COMPONENTS[stem as MinigameId] = mod.default
}
