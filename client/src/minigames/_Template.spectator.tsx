/**
 * MINIGAME SPECTATOR VIEW TEMPLATE
 * ──────────────────────────────────
 * Copy this file to a new name matching your MinigameId (e.g. `WordRace.spectator.tsx`).
 * Fill in the TODOs — no manual registration needed.
 * The spectator registry auto-discovers *.spectator.tsx files via glob.
 * Rule: filename must match the MinigameId (case-insensitive).
 *   WordRace.spectator.tsx → 'wordrace'
 *
 * See ADDING_A_GAME.md step 4 for rules and examples.
 *
 * RULES
 * - `state` is the client-visible GAME_UPDATE projection — never the full server state.
 *   It may be `null` before the first update; always guard with `?? fallback`.
 * - Never show information private to one player (e.g. hidden picks before reveal).
 * - Keep it read-only — no sendInput, no buttons.
 * - Reuse helpers from spectatorHelpers.tsx when they fit:
 *     TwoColState  — two stat pills side by side (good for symmetric stat games)
 *     StatPill     — a single labelled number with a unit
 *     MathsPanel   — equation + correct-count panel (specific to quickmaths-style games)
 */

import type { SpectatorProps, SpectatorPlayer } from './spectatorHelpers'
import { TwoColState } from './spectatorHelpers'

// TODO: define the shape of the client-visible state your server broadcasts.
// Mirror only the fields your spectator view actually uses.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface State {
  // example: score: Record<string, number>
}

export default function TemplateSpectator({ state, players }: SpectatorProps) {
  const s = state as State | null
  const [p1, p2] = players as [SpectatorPlayer | undefined, SpectatorPlayer | undefined]

  // TODO: replace with your game's actual state fields.
  // This default wires up a simple two-column view. For more complex layouts,
  // replace TwoColState with your own JSX (see RockPaperScissors.spectator.tsx).
  void s // remove once you use `s`

  return (
    <TwoColState
      p1={{
        label: p1?.nickname ?? '…',
        value: 0 /* TODO: e.g. s?.score[p1?.id ?? ''] ?? 0 */,
        unit: 'pts',
      }}
      p2={{ label: p2?.nickname ?? '…', value: 0 /* TODO: */, unit: 'pts' }}
      color1="var(--blue)"
      color2="var(--orange)"
    />
  )
}
