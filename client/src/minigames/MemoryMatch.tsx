import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong, playClick } from '../utils/sounds'

const SYMBOLS = ['🔴', '🔵', '🟡', '🟢', '🟠', '🟣', '⬛', '⬜']
const SEQ_LEN = 5
const MEMORIZE_SECS = 4

interface ServerState {
  sequence: string[]
  submissions: Record<string, string[]>
}

export default function MemoryMatch() {
  const { myPlayerId, players, sendInput, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected' && minigameState !== null
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Phase tracking ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'memorize' | 'recall' | 'submitted'>('memorize')
  const [countdown, setCountdown] = useState(MEMORIZE_SECS)
  const [picks, setPicks] = useState<string[]>([])

  // Live server state — declared early so effects below can reference `sequence`
  const serverState = isLive ? (minigameState as ServerState | null) : null
  const sequence = serverState?.sequence ?? mockSequence
  const submissions = serverState?.submissions ?? {}

  const iSubmitted = !!submissions[myPlayerId]
  const oppSubmitted = !!(opponent && submissions[opponent.id])

  // Mock opponent — submits a random sequence after a short delay in dev/disconnected mode
  const [mockOppSub, setMockOppSub] = useState<string[] | null>(null)
  useEffect(() => {
    if (isLive) return
    setMockOppSub(null)
    const t = setTimeout(
      () => {
        setMockOppSub(
          Array.from(
            { length: SEQ_LEN },
            () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!
          )
        )
      },
      2500 + Math.random() * 2000
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, sequence.join(',')])

  // Reset on new round (minigameState goes null → new state)
  useEffect(() => {
    setPhase('memorize')
    setCountdown(MEMORIZE_SECS)
    setPicks([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence.join(',')])

  // Memorize countdown
  useEffect(() => {
    if (phase !== 'memorize') return
    if (countdown <= 0) {
      setPhase('recall')
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // Switch to submitted view when server confirms our submission
  useEffect(() => {
    if (iSubmitted) setPhase('submitted')
  }, [iSubmitted])

  function addPick(sym: string) {
    if (phase !== 'recall') return
    if (picks.length >= SEQ_LEN) return
    playClick()
    const next = [...picks, sym]
    setPicks(next)
    if (next.length === SEQ_LEN) {
      // Auto-submit when all slots filled
      const correct = next.every((s, i) => s === sequence[i])
      correct ? playCorrect() : playWrong()
      sendInput({ type: 'SUBMIT', sequence: next })
      setPhase('submitted')
    }
  }

  function removeLast() {
    if (phase !== 'recall' || picks.length === 0) return
    setPicks((p) => p.slice(0, -1))
  }

  function scoreOf(sub: string[]) {
    return sub.filter((s, i) => s === sequence[i]).length
  }

  // In live mode use server submissions; in mock mode use local picks / mock opponent
  const myScore =
    phase === 'submitted'
      ? submissions[myPlayerId]
        ? scoreOf(submissions[myPlayerId])
        : scoreOf(picks)
      : null
  const effectiveOppSub = opponent
    ? (submissions[opponent.id] ?? (!isLive ? (mockOppSub ?? undefined) : undefined))
    : undefined
  const oppScore = effectiveOppSub ? scoreOf(effectiveOppSub) : null
  const effectiveOppSubmitted = isLive ? oppSubmitted : !!mockOppSub

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        flex: 1,
        padding: 24,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 32,
          color: 'var(--green)',
          textAlign: 'center',
        }}
      >
        MEMORY MATCH 🧠
      </div>

      {/* ── Memorize phase ── */}
      {phase === 'memorize' && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 18,
              color: 'rgba(0,0,0,0.5)',
              letterSpacing: 2,
            }}
          >
            MEMORISE THIS SEQUENCE
          </div>
          <SequenceDisplay sequence={sequence} revealed />
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 72,
              color: countdown <= 1 ? 'var(--red)' : 'var(--orange)',
              transition: 'color 0.3s',
            }}
          >
            {countdown}
          </div>
        </>
      )}

      {/* ── Recall phase ── */}
      {phase === 'recall' && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 18,
              color: 'rgba(0,0,0,0.5)',
              letterSpacing: 2,
            }}
          >
            REPRODUCE THE SEQUENCE
          </div>
          {/* Slots showing current picks */}
          <div style={{ display: 'flex', gap: 10 }}>
            {Array.from({ length: SEQ_LEN }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 52,
                  height: 52,
                  background: picks[i] ? 'var(--white)' : 'rgba(0,0,0,0.06)',
                  border: picks[i] ? 'var(--border)' : '3px dashed rgba(0,0,0,0.2)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  boxShadow: picks[i] ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.1s',
                }}
              >
                {picks[i] ?? ''}
              </div>
            ))}
          </div>

          {/* Symbol buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                onClick={() => addPick(sym)}
                disabled={picks.length >= SEQ_LEN}
                style={{
                  width: 60,
                  height: 60,
                  fontSize: 28,
                  background: 'var(--white)',
                  border: 'var(--border)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  opacity: picks.length >= SEQ_LEN ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {sym}
              </button>
            ))}
          </div>

          {picks.length > 0 && (
            <button className="btn btn-white btn-sm" onClick={removeLast} style={{ minHeight: 44 }}>
              ← Undo last
            </button>
          )}
        </>
      )}

      {/* ── Submitted phase ── */}
      {phase === 'submitted' && (
        <>
          <div
            className="anim-pop"
            style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <SequenceDisplay sequence={sequence} revealed />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {(picks.length > 0 ? picks : (submissions[myPlayerId] ?? [])).map((sym, i) => (
                <div
                  key={i}
                  style={{
                    width: 52,
                    height: 52,
                    background:
                      sym === sequence[i] ? 'rgba(68,204,68,0.15)' : 'rgba(255,51,51,0.12)',
                    border: `3px solid ${sym === sequence[i] ? 'var(--green)' : 'var(--red)'}`,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                  }}
                >
                  {sym}
                </div>
              ))}
            </div>
            {myScore !== null && (
              <div
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: 22,
                  color:
                    myScore >= 4 ? 'var(--green)' : myScore >= 2 ? 'var(--orange)' : 'var(--red)',
                }}
              >
                {myScore}/{SEQ_LEN} correct!
              </div>
            )}
            {effectiveOppSubmitted && oppScore !== null ? (
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.5)' }}>
                {opponent?.nickname ?? 'Opponent'}: {oppScore}/{SEQ_LEN}
              </div>
            ) : (
              <div
                className="anim-pulse"
                style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.4)' }}
              >
                Waiting for {opponent?.nickname ?? 'opponent'}…
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SequenceDisplay({ sequence, revealed }: { sequence: string[]; revealed: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {sequence.map((sym, i) => (
        <div
          key={i}
          style={{
            width: 52,
            height: 52,
            background: 'var(--white)',
            border: 'var(--border)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            boxShadow: 'var(--shadow)',
          }}
        >
          {revealed ? sym : '?'}
        </div>
      ))}
    </div>
  )
}

// ── Mock data (dev / disconnected mode) ──────────────────────────────────────
const mockSequence = ['🔴', '🟢', '🔵', '🟡', '🟣']
