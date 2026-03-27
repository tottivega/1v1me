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
 *   Live mode   (isMockMatch === false)
 *     — read game state from `minigameState` (set by GAME_UPDATE messages)
 *     — use `state.kind === 'yourgameid'` to narrow MinigameState safely
 *     — send player actions via `sendInput({ type: 'YOUR_TYPE', ...data })`
 *     — never run local timers; trust the server
 *
 *   Mock mode   (isMockMatch === true, used by DevPanel)
 *     — simulate the game locally so it can be tested without a server
 *     — calls to sendInput() are no-ops in this mode; that's fine
 *     — simulate a real opponent response (setTimeout/interval + cleanup)
 */

import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { randomDelay } from './mockUtils'
// import { playCorrect, playWrong, playClick } from '../utils/sounds'

// ── Server state shape ────────────────────────────────────────────────────────
// Mirror the State interface from the server module.
// Import the shared type instead of duplicating if it exists in shared/types.ts.
// import { type YourGameState } from '@shared/types'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ServerState {
  // TODO: match the server module's State fields
  // example: score: Record<string, number>
}

export default function Template() {
  const { myPlayerId, players, minigameState, isMockMatch, sendInput } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Live mode ─────────────────────────────────────────────────────────────
  // Narrow via the `kind` discriminant — replace 'quickmaths' with your id.
  // TODO: replace 'yourgameid' with your MinigameId key (must match MINIGAME_CONFIGS)
  const server =
    isLive && (minigameState as { kind: string } | null)?.kind === 'yourgameid'
      ? (minigameState as ServerState)
      : null

  // TODO: derive display values from live state
  // const myScore = server?.score[myPlayerId] ?? 0

  // ── Mock mode ─────────────────────────────────────────────────────────────
  // Initialise local state that mirrors what the server would provide.
  const [mockResolved, setMockResolved] = useState(false)
  const [mockWinnerId, setMockWinnerId] = useState<string | null>(null)

  // Reset mock state when a new round starts (minigameState goes null on ROUND_START).
  useEffect(() => {
    if (isLive) return
    setMockResolved(false)
    setMockWinnerId(null)
    // TODO: reset any other local mock state here
  }, [isLive, minigameState])

  // Simulate opponent action after a realistic delay, then resolve the round.
  useEffect(() => {
    if (isLive || mockResolved) return
    return randomDelay(1500, 4500, () => {
      const winner = Math.random() < 0.5 ? myPlayerId : (opponent?.id ?? myPlayerId)
      setMockWinnerId(winner)
      setMockResolved(true)
    })
  }, [isLive, mockResolved, myPlayerId, opponent?.id])

  // ── Shared derived values ─────────────────────────────────────────────────
  // Pick live or mock values for the render below.
  const resolved = isLive
    ? false // TODO: replace with live resolved condition e.g. server?.winnerId != null
    : mockResolved
  const winnerId = isLive
    ? null // TODO: replace with e.g. server?.winnerId ?? null
    : mockWinnerId
  const iWon = winnerId === myPlayerId

  // Play sounds when the round resolves.
  useEffect(() => {
    if (!resolved) return
    // if (iWon) playCorrect()
    // else playWrong()
  }, [resolved, iWon])

  function handleAction() {
    if (resolved) return
    // TODO: local optimistic state update if needed
    sendInput({ type: 'YOUR_INPUT_TYPE' /* ...extra fields */ })
    // In mock mode sendInput() is a no-op; handle mock feedback here instead.
    if (!isLive) {
      // TODO: apply local mock feedback (e.g. setMockScore(s => s + 1))
    }
  }

  // Show a loading indicator until state arrives.
  if (isLive && !server) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p className="subtitle anim-pulse">Loading…</p>
      </div>
    )
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
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>
          {/* render game content here */}
        </div>
      </div>

      {/* Primary action — hidden once resolved */}
      {!resolved && (
        <button className="btn btn-orange btn-lg" onClick={handleAction}>
          Do thing {/* TODO: replace */}
        </button>
      )}

      <div className="label" style={{ opacity: 0.45 }}>
        Instruction text here {/* TODO: replace */}
      </div>

      {/* Result overlay */}
      {resolved && (
        <div className="anim-bounce" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: iWon ? 'var(--green)' : 'var(--red)',
              WebkitTextStroke: '2px var(--black)',
              textShadow: '3px 3px 0 var(--black)',
            }}
          >
            {iWon ? 'YOU WIN! 🎉' : 'YOU LOSE 😤'}
          </div>
          <div className="subtitle" style={{ opacity: 0.6, marginTop: 8 }}>
            {iWon ? 'Well played!' : `${opponent?.nickname ?? 'Opponent'} beat you.`}
          </div>
        </div>
      )}
    </div>
  )
}
