import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong, playClick } from '../utils/sounds'

type Phase = 'guessing' | 'reveal'

interface ServerState {
  clue: number
  phase: Phase
  submitted?: string[]
  target?: number
  correct?: 'higher' | 'lower'
  answers?: Record<string, 'higher' | 'lower'>
  winnerId?: string
}

export default function HigherOrLower() {
  const { myPlayerId, players, minigameState, wsStatus, sendInput } = useGameStore()
  const isLive = wsStatus === 'connected'
  const opponent = players.find((p) => p.id !== myPlayerId)

  // Live state
  const server = isLive ? (minigameState as ServerState | null) : null

  // Mock state
  const [mockClue, setMockClue] = useState<number | null>(null)
  const [mockTarget, setMockTarget] = useState<number | null>(null)
  const [mockCorrect, setMockCorrect] = useState<'higher' | 'lower' | null>(null)
  const [mockWinnerId, setMockWinnerId] = useState<string | null>(null)
  const [mockAnswers, setMockAnswers] = useState<Record<string, 'higher' | 'lower'>>({})

  const [myAnswer, setMyAnswer] = useState<'higher' | 'lower' | null>(null)

  useEffect(() => {
    if (isLive) return
    const target = Math.floor(Math.random() * 98) + 2
    const offset = Math.floor(Math.random() * 20) + 1
    const clue = Math.random() < 0.5 ? Math.max(1, target - offset) : Math.min(99, target + offset)
    setMockClue(clue)
    setMockTarget(target)
    setMockCorrect(target > clue ? 'higher' : 'lower')
  }, [isLive])

  // Mock opponent answers after delay
  useEffect(() => {
    if (isLive || mockClue === null || mockTarget === null) return
    const delay = 1500 + Math.random() * 3000
    const t = setTimeout(() => {
      const oppAnswer: 'higher' | 'lower' =
        Math.random() < 0.6 ? mockCorrect! : mockCorrect === 'higher' ? 'lower' : 'higher'
      setMockAnswers((prev) => ({ ...prev, [opponent?.id ?? 'opp']: oppAnswer }))
    }, delay)
    return () => clearTimeout(t)
  }, [isLive, mockClue, mockTarget, mockCorrect, opponent?.id])

  // Resolve mock when both answered
  useEffect(() => {
    if (isLive || !myAnswer || !mockAnswers[opponent?.id ?? 'opp'] || mockTarget === null) return
    const correct = mockCorrect!
    const myRight = myAnswer === correct
    const oppRight = mockAnswers[opponent?.id ?? 'opp'] === correct
    let winner: string
    if (myRight && !oppRight) winner = myPlayerId
    else if (oppRight && !myRight) winner = opponent?.id ?? myPlayerId
    else winner = Math.random() < 0.5 ? myPlayerId : (opponent?.id ?? myPlayerId)
    setMockWinnerId(winner)
  }, [isLive, myAnswer, mockAnswers, mockTarget, mockCorrect, myPlayerId, opponent?.id])

  // Derived values
  const clue = isLive ? (server?.clue ?? null) : mockClue
  const phase = isLive ? (server?.phase ?? 'guessing') : mockWinnerId ? 'reveal' : 'guessing'
  const target = isLive ? (server?.target ?? null) : mockTarget
  const correct = isLive ? (server?.correct ?? null) : mockCorrect
  const winnerId = isLive ? (server?.winnerId ?? null) : mockWinnerId
  const resolved = phase === 'reveal' && winnerId !== null
  const iWon = winnerId === myPlayerId
  const iSubmitted = isLive ? (server?.submitted?.includes(myPlayerId) ?? false) : myAnswer !== null

  useEffect(() => {
    if (resolved) {
      if (iWon) playCorrect()
      else playWrong()
    }
  }, [resolved, iWon])

  function handleAnswer(answer: 'higher' | 'lower') {
    if (iSubmitted) return
    setMyAnswer(answer)
    playClick()
    if (isLive) {
      sendInput({ type: 'ANSWER', answer })
    }
  }

  if (clue === null) {
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
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 36,
          color: 'var(--black)',
          textAlign: 'center',
        }}
      >
        HIGHER OR LOWER? 📊
      </div>

      <p
        style={{
          fontSize: 13,
          color: 'rgba(0,0,0,0.5)',
          fontWeight: 700,
          margin: 0,
          textAlign: 'center',
        }}
      >
        The secret number is close to the clue. Is it <strong>Higher</strong> or{' '}
        <strong>Lower</strong>?
      </p>

      {/* Clue number */}
      <div
        style={{
          background: 'var(--white)',
          border: 'var(--border)',
          borderRadius: 16,
          boxShadow: '4px 4px 0 var(--black)',
          padding: '24px 48px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 2,
            opacity: 0.4,
          }}
        >
          Clue number
        </div>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 80,
            lineHeight: 1,
            color: 'var(--blue)',
            textShadow: '3px 3px 0 var(--black)',
          }}
        >
          {clue}
        </div>
      </div>

      {/* Buttons */}
      {!resolved && (
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            className="btn btn-green btn-lg"
            disabled={iSubmitted}
            style={{ minWidth: 130, opacity: iSubmitted && myAnswer !== 'higher' ? 0.4 : 1 }}
            onClick={() => handleAnswer('higher')}
          >
            ⬆️ Higher
          </button>
          <button
            className="btn btn-red btn-lg"
            disabled={iSubmitted}
            style={{ minWidth: 130, opacity: iSubmitted && myAnswer !== 'lower' ? 0.4 : 1 }}
            onClick={() => handleAnswer('lower')}
          >
            ⬇️ Lower
          </button>
        </div>
      )}

      {iSubmitted && !resolved && (
        <p className="subtitle anim-pulse" style={{ opacity: 0.6 }}>
          Waiting for opponent…
        </p>
      )}

      {/* Reveal */}
      {resolved && (
        <div
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.6 }}>
            Secret was{' '}
            <span
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 24,
                color: correct === 'higher' ? 'var(--green)' : 'var(--red)',
              }}
            >
              {target}
            </span>{' '}
            ({correct === 'higher' ? '↑ Higher' : '↓ Lower'} than {clue})
          </div>
          <div
            className="anim-bounce"
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
          <div className="subtitle" style={{ opacity: 0.6 }}>
            {iWon ? 'Your gut was right!' : `${opponent?.nickname ?? 'Opponent'} guessed better.`}
          </div>
        </div>
      )}
    </div>
  )
}
