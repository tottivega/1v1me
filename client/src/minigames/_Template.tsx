/**
 * MINIGAME CLIENT COMPONENT TEMPLATE
 * ────────────────────────────────────
 * Copy this file to a new name matching your MinigameId (e.g. `WordRace.tsx`).
 * Fill in the TODOs — no manual registration needed.
 * The registry auto-discovers component files via glob.
 * Rule: filename must match the MinigameId (case-insensitive).
 *   WordRace.tsx → 'wordrace'
 *
 * See ADDING_A_GAME.md at the repo root for the full walkthrough.
 *
 * DUAL MODE
 * Every component must work in two modes:
 *
 *   Live mode   (wsStatus === 'connected')
 *     — read game state from `minigameState` (set by GAME_UPDATE messages)
 *     — send player actions via `sendInput({ type: 'YOUR_TYPE', ...data })`
 *     — never run local timers; trust the server
 *
 *   Mock mode   (wsStatus !== 'connected', used by DevPanel)
 *     — simulate the game locally so it can be tested without a server
 *     — calls to sendInput() are no-ops in this mode; that's fine
 */

import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
// import { playCorrect, playWrong } from '../utils/sounds'  // uncomment when wiring sounds

// ── Server state shape ────────────────────────────────────────────────────────
// Mirror the `State` interface from the server module.

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ServerState {
  // TODO: match the server module's State fields
}

export default function Template() {
  const { myPlayerId, players, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected'
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Live mode ─────────────────────────────────────────────────────────────
  const serverState = isLive ? (minigameState as ServerState | null) : null
  void serverState // TODO: read fields from serverState

  // Reset local state on new round (minigameState is null on ROUND_START)
  useEffect(() => {
    if (minigameState === null) {
      // TODO: reset any local state here
    }
  }, [minigameState])

  // ── Mock mode ─────────────────────────────────────────────────────────────
  // TODO: local state for dev/mock simulation
  const [mockValue, setMockValue] = useState(0)
  void setMockValue // remove when used

  // ── Shared render values ──────────────────────────────────────────────────
  // Derive display values from either server or mock state
  void opponent // may be undefined in solo dev mode

  function handleAction() {
    // TODO: implement player action — no changes to shared/types.ts needed
    // sendInput({ type: 'YOUR_INPUT_TYPE', ...extraFields })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        flex: 1,
        padding: 32,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 32,
          color: 'var(--orange)',
          textAlign: 'center',
        }}
      >
        GAME NAME 🎮 {/* TODO: replace */}
      </div>

      {/* TODO: main game UI */}
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>{mockValue}</div>
      </div>

      {/* Action button */}
      <button className="btn btn-orange btn-lg" onClick={handleAction}>
        Do thing {/* TODO: replace */}
      </button>

      <div className="label" style={{ opacity: 0.45 }}>
        Instruction text here
      </div>
    </div>
  )
}
