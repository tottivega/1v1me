import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong, playClick } from '../utils/sounds'
import { type KaboomState, type KaboomLastPick } from '@shared/types'
import { randomDelay } from './mockUtils'

const TOTAL_WIRES = 8
const REVEAL_DELAY_MS = 1500

// Wire colors — one per index 0-7
const WIRE_COLORS = [
  '#e53935', // 0 red
  '#fb8c00', // 1 orange
  '#fdd835', // 2 yellow
  '#43a047', // 3 green
  '#1e88e5', // 4 blue
  '#8e24aa', // 5 purple
  '#f06292', // 6 pink
  '#00897b', // 7 teal
]

// ── Mock state ────────────────────────────────────────────────────────────────
interface MockState {
  bombWire: number
  wires: number[]
  eliminated: number[]
  phase: 'picking' | 'reveal'
  currentPlayerId: string
  lastPick: KaboomLastPick | null
  roundNum: number
  winnerId: string | null
}

function initMockState(myPlayerId: string): MockState {
  return {
    bombWire: Math.floor(Math.random() * TOTAL_WIRES),
    wires: Array.from({ length: TOTAL_WIRES }, (_, i) => i),
    eliminated: [],
    phase: 'picking',
    currentPlayerId: myPlayerId, // player always goes first in mock
    lastPick: null,
    roundNum: 1,
    winnerId: null,
  }
}

export default function Kaboom() {
  const { myPlayerId, players, minigameState, isMockMatch, sendInput } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)
  const oppId = opponent?.id ?? 'opp'
  const oppName = opponent?.nickname ?? '???'

  // ── Live mode ─────────────────────────────────────────────────────────────
  const server = isLive ? (minigameState as KaboomState | null) : null

  // ── Mock mode ─────────────────────────────────────────────────────────────
  const [mock, setMock] = useState<MockState>(() => initMockState(myPlayerId))
  const mockRef = useRef(mock)
  mockRef.current = mock

  // Reset mock when re-entering game
  useEffect(() => {
    if (isLive) return
    setMock(initMockState(myPlayerId))
  }, [isLive, myPlayerId])

  // Mock opponent picks after a delay when it's their turn
  useEffect(() => {
    if (isLive) return
    const m = mockRef.current
    if (m.phase !== 'picking' || m.currentPlayerId !== oppId || m.winnerId !== null) return

    return randomDelay(900, 2400, () => {
      const current = mockRef.current
      if (current.phase !== 'picking' || current.currentPlayerId !== oppId) return
      const wire = current.wires[Math.floor(Math.random() * current.wires.length)]!
      applyMockPick(wire)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, mock.phase, mock.currentPlayerId, mock.roundNum])

  const applyMockPick = useCallback(
    (wire: number) => {
      setMock((prev) => {
        const isBomb = wire === prev.bombWire
        const lastPick: KaboomLastPick = { playerId: prev.currentPlayerId, wire, isBomb }
        const newRoundNum = prev.roundNum + 1

        if (isBomb) {
          // Picker loses
          const winnerId = prev.currentPlayerId === myPlayerId ? oppId : myPlayerId
          return { ...prev, phase: 'reveal', lastPick, roundNum: newRoundNum, winnerId }
        }

        // Safe — show reveal then advance
        const newEliminated = [...prev.eliminated, wire]
        const newWires = prev.wires.filter((w) => w !== wire)
        const nextPlayer = prev.currentPlayerId === myPlayerId ? oppId : myPlayerId

        // Schedule transition back to picking
        setTimeout(() => {
          setMock((m) => ({
            ...m,
            wires: newWires,
            eliminated: newEliminated,
            phase: 'picking',
            currentPlayerId: nextPlayer,
          }))
        }, REVEAL_DELAY_MS)

        return { ...prev, phase: 'reveal', lastPick, roundNum: newRoundNum }
      })
    },
    [myPlayerId, oppId]
  )

  // ── Interaction ───────────────────────────────────────────────────────────
  function handlePick(wire: number) {
    if (isLive) {
      playClick()
      sendInput({ type: 'PICK_WIRE', wire })
    } else {
      const m = mockRef.current
      if (m.phase !== 'picking' || m.currentPlayerId !== myPlayerId || m.winnerId !== null) return
      playClick()
      applyMockPick(wire)
    }
  }

  // ── Sound on result ───────────────────────────────────────────────────────
  const prevWinnerId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const winnerId = isLive ? server?.winnerId : mock.winnerId
    if (winnerId !== undefined && winnerId !== prevWinnerId.current) {
      prevWinnerId.current = winnerId
      if (winnerId === myPlayerId) playCorrect()
      else playWrong()
    }
  }, [isLive, server?.winnerId, mock.winnerId, myPlayerId])

  // Reset sound tracker on new round
  useEffect(() => {
    if (minigameState === null) prevWinnerId.current = undefined
  }, [minigameState])

  // ── Derived render values ─────────────────────────────────────────────────
  const wires = isLive ? (server?.wires ?? []) : mock.wires
  const eliminated = isLive ? (server?.eliminated ?? []) : mock.eliminated
  const phase = isLive ? (server?.phase ?? 'picking') : mock.phase
  const currentPlayerId = isLive ? (server?.currentPlayerId ?? '') : mock.currentPlayerId
  const lastPick = isLive ? (server?.lastPick ?? null) : mock.lastPick
  const roundNum = isLive ? (server?.roundNum ?? 1) : mock.roundNum
  const winnerId = isLive ? (server?.winnerId ?? null) : mock.winnerId

  const isMyTurn = currentPlayerId === myPlayerId
  const resolved = winnerId !== null
  const iWon = winnerId === myPlayerId

  // Name for "whose turn" display
  const currentName = currentPlayerId === myPlayerId ? 'Your' : `${oppName}'s`

  // ── Per-turn countdown (shown only to the active player) ──────────────────
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (!isMyTurn || phase !== 'picking' || resolved) return
    setCountdown(10)
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isMyTurn, phase, roundNum, resolved])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        flex: 1,
        padding: 24,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 32,
          color: 'var(--black)',
          textAlign: 'center',
          letterSpacing: 1,
        }}
      >
        KABOOM! 💣
      </div>

      {/* Status line */}
      {!resolved && (
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 18,
            color: isMyTurn ? 'var(--blue)' : 'var(--orange)',
            textAlign: 'center',
            minHeight: 28,
          }}
        >
          {phase === 'picking'
            ? isMyTurn
              ? 'Cut a wire…'
              : `${currentName} turn`
            : phase === 'reveal' && lastPick
              ? lastPick.isBomb
                ? '💥 BOOM!'
                : 'Safe wire ✓'
              : ''}
        </div>
      )}

      {/* Per-turn countdown — only shown to the active player */}
      {isMyTurn && phase === 'picking' && !resolved && (
        <div
          key={`timer-${roundNum}`}
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 52,
            lineHeight: 1,
            color:
              countdown <= 3 ? 'var(--red)' : countdown <= 6 ? 'var(--orange)' : 'var(--green)',
            textShadow:
              countdown <= 3
                ? '3px 3px 0 var(--black)'
                : countdown <= 6
                  ? '3px 3px 0 var(--black)'
                  : '3px 3px 0 var(--black)',
            WebkitTextStroke: '1.5px var(--black)',
            transition: 'color 0.3s',
            marginTop: -8,
            marginBottom: -8,
          }}
        >
          {countdown}
        </div>
      )}

      {/* Wire panel — 2 columns × 4 rows */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '2px 8px',
          width: '100%',
          maxWidth: 340,
        }}
      >
        {Array.from({ length: TOTAL_WIRES }, (_, i) => {
          const isEliminated = eliminated.includes(i)
          const isRemaining = wires.includes(i)
          const wasJustPicked = lastPick?.wire === i && phase === 'reveal'
          const isBombReveal = wasJustPicked && lastPick?.isBomb
          const isSafeReveal = wasJustPicked && !lastPick?.isBomb
          const canPick = !resolved && phase === 'picking' && isMyTurn && isRemaining

          return (
            <WireSegment
              key={i}
              color={WIRE_COLORS[i]!}
              isEliminated={isEliminated}
              isBombReveal={isBombReveal}
              isSafeReveal={isSafeReveal}
              canPick={canPick}
              onClick={() => handlePick(i)}
            />
          )
        })}
      </div>

      {/* Result */}
      {resolved && (
        <div
          key={`result-${roundNum}`}
          className="anim-pop"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: iWon ? 'var(--green)' : 'var(--red)',
              WebkitTextStroke: '2px var(--black)',
              textShadow: '3px 3px 0 var(--black)',
            }}
          >
            {iWon ? 'YOU WIN! 🎉' : 'BOOM! 💥'}
          </div>
          <div className="subtitle" style={{ opacity: 0.6 }}>
            {iWon ? `${oppName} cut the bomb wire!` : 'You cut the wrong wire!'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Wire segment ──────────────────────────────────────────────────────────────

function WireSegment({
  color,
  isEliminated,
  isBombReveal,
  isSafeReveal,
  canPick,
  onClick,
}: {
  color: string
  isEliminated: boolean
  isBombReveal: boolean
  isSafeReveal: boolean
  canPick: boolean
  onClick: () => void
}) {
  const [pressed, setPressed] = useState(false)

  // Cut wire: two gray stubs with a gap
  if (isEliminated) {
    return (
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: 0.28,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 14,
            background: '#777',
            borderRadius: '7px 2px 2px 7px',
            boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.3)',
          }}
        />
        <div
          style={{
            flex: 1,
            height: 14,
            background: '#777',
            borderRadius: '2px 7px 7px 2px',
            boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.3)',
          }}
        />
      </div>
    )
  }

  const glowColor = isBombReveal
    ? 'rgba(255, 60, 60, 0.85)'
    : isSafeReveal
      ? 'rgba(50, 220, 100, 0.85)'
      : null

  const cableColor = isBombReveal ? '#1a1a1a' : color

  return (
    <div
      role="button"
      aria-label={`wire ${canPick ? 'pick' : ''}`}
      tabIndex={canPick ? 0 : -1}
      onClick={canPick ? onClick : undefined}
      onPointerDown={() => canPick && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: canPick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {/* Cable body */}
      <div
        style={{
          width: pressed ? '88%' : '96%',
          height: pressed ? 12 : 16,
          background: cableColor,
          borderRadius: 8,
          boxShadow: glowColor
            ? `0 0 14px 5px ${glowColor}, inset 0 -3px 0 rgba(0,0,0,0.25)`
            : `inset 0 -4px 0 rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.3)`,
          transition: 'width 0.07s, height 0.07s, box-shadow 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
        }}
      >
        {isBombReveal && '💥'}
      </div>
    </div>
  )
}
