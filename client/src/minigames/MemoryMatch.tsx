import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong, playClick } from '../utils/sounds'
import { type MemoryMatchState } from '@shared/types'

const SYMBOLS = ['🔴', '🔵', '🟡', '🟢', '🟠', '🟣', '⬛', '⬜']
const MIN_SEQ_LEN = 3
const MAX_ROUNDS = 10

function generateSeq(len: number): string[] {
  return Array.from({ length: len }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!)
}

export default function MemoryMatch() {
  const { myPlayerId, players, sendInput, minigameState, isMockMatch } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Shared input state ─────────────────────────────────────────────────────
  const [picks, setPicks] = useState<string[]>([])
  const [phase, setPhase] = useState<'memorize' | 'recall' | 'submitted'>('memorize')
  const [countdown, setCountdown] = useState(Math.ceil(MIN_SEQ_LEN * 1.5))
  const picksRef = useRef<string[]>([])
  const mySubmitTimeRef = useRef<number | null>(null)

  // ── Live server state ──────────────────────────────────────────────────────
  const serverState = isLive ? (minigameState as MemoryMatchState | null) : null

  // ── Mock state ─────────────────────────────────────────────────────────────
  const [mockRoundNum, setMockRoundNum] = useState(1)
  const [mockSeqLen, setMockSeqLen] = useState(MIN_SEQ_LEN)
  const [mockSequence, setMockSequence] = useState<string[]>(() => generateSeq(MIN_SEQ_LEN))
  const [mockOppSub, setMockOppSub] = useState<string[] | null>(null)
  const [mockWinnerId, setMockWinnerId] = useState<string | null>(null)

  // Refs for mock callbacks (avoid stale closures)
  const mockSeqLenRef = useRef(MIN_SEQ_LEN)
  const mockRoundNumRef = useRef(1)
  const mockSequenceRef = useRef<string[]>(mockSequence)
  const mockOppSubRef = useRef<string[] | null>(null)
  const mockOppSubmitTimeRef = useRef<number | null>(null)
  const mockEndedRef = useRef(false)
  const oppIdRef = useRef(opponent?.id)
  useEffect(() => {
    oppIdRef.current = opponent?.id
  }, [opponent?.id])

  // ── Unified display values ────────────────────────────────────────────────
  const roundNum = isLive ? (serverState?.roundNum ?? 1) : mockRoundNum
  const seqLen = isLive ? (serverState?.seqLen ?? MIN_SEQ_LEN) : mockSeqLen
  const sequence = isLive ? (serverState?.sequence ?? []) : mockSequence
  const serverPhase = serverState?.phase ?? null
  const submissions = serverState?.submissions

  const oppSubmitted = isLive ? !!(opponent && submissions?.[opponent.id]) : !!mockOppSub
  const resolved = !isLive && mockWinnerId !== null
  const iWon = mockWinnerId === myPlayerId

  // ── Reset on new round ────────────────────────────────────────────────────
  useEffect(() => {
    setPhase('memorize')
    setCountdown(Math.ceil(seqLen * 1.5))
    setPicks([])
    picksRef.current = []
    mySubmitTimeRef.current = null
  }, [roundNum, seqLen])

  // ── Live: sync phase from server ──────────────────────────────────────────
  useEffect(() => {
    if (!isLive || !serverPhase) return
    if (serverPhase === 'recall' && phase === 'memorize') {
      setPhase('recall')
      setCountdown(Math.ceil(seqLen * 1.5))
    }
  }, [isLive, serverPhase, phase, seqLen])

  // ── Live: mark submitted when server confirms ─────────────────────────────
  useEffect(() => {
    if (isLive && submissions?.[myPlayerId]) setPhase('submitted')
  }, [isLive, submissions, myPlayerId])

  // ── Countdown (memorize and recall phases) ────────────────────────────────
  useEffect(() => {
    if (phase !== 'memorize' && phase !== 'recall') return
    if (countdown <= 0) {
      if (!isLive && phase === 'memorize') setPhase('recall')
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, isLive])

  // Reset countdown when phase switches memorize → recall
  useEffect(() => {
    if (!isLive && phase === 'recall') {
      setCountdown(Math.ceil(seqLen * 1.5))
    }
  }, [isLive, phase, seqLen])

  // ── Mock: resolve round outcome ───────────────────────────────────────────
  const resolveMockRound = useCallback(
    (myPicks: string[], oppSub: string[], mySubmitTime: number, oppSubmitTime: number) => {
      const seq = mockSequenceRef.current
      const myScore = myPicks.filter((s, i) => s === seq[i]).length
      const oppScore = oppSub.filter((s, i) => s === seq[i]).length

      setTimeout(() => {
        if (mockEndedRef.current) return

        if (myScore !== oppScore) {
          mockEndedRef.current = true
          setMockWinnerId(myScore > oppScore ? myPlayerId : (oppIdRef.current ?? myPlayerId))
          return
        }
        if (mockRoundNumRef.current >= MAX_ROUNDS) {
          // Tiebreak: fastest submission in this round wins
          mockEndedRef.current = true
          setMockWinnerId(
            mySubmitTime <= oppSubmitTime ? myPlayerId : (oppIdRef.current ?? myPlayerId)
          )
          return
        }

        // Tie — start next round
        const newSeqLen = mockSeqLenRef.current + 1
        const newSeq = generateSeq(newSeqLen)
        mockSeqLenRef.current = newSeqLen
        mockRoundNumRef.current++
        mockSequenceRef.current = newSeq
        mockOppSubRef.current = null
        mockOppSubmitTimeRef.current = null
        setMockRoundNum((r) => r + 1)
        setMockSeqLen(newSeqLen)
        setMockSequence(newSeq)
        setMockOppSub(null)
      }, 2000)
    },
    [myPlayerId]
  )

  // ── Mock: opponent submits the correct sequence during recall ─────────────
  useEffect(() => {
    if (isLive || phase !== 'recall' || mockEndedRef.current) return
    setMockOppSub(null)
    mockOppSubRef.current = null
    mockOppSubmitTimeRef.current = null

    // Opponent always submits the correct sequence — used to force all 10 rounds for testing
    const delay = 1500 + Math.random() * 1500
    const t = setTimeout(() => {
      if (mockEndedRef.current) return
      const sub = [...mockSequenceRef.current] // always correct
      const oppSubmitTime = Date.now()
      setMockOppSub(sub)
      mockOppSubRef.current = sub
      mockOppSubmitTimeRef.current = oppSubmitTime
      // If player already submitted, both are done — resolve now
      if (picksRef.current.length === mockSeqLenRef.current && mySubmitTimeRef.current !== null) {
        resolveMockRound(picksRef.current, sub, mySubmitTimeRef.current, oppSubmitTime)
      }
    }, delay)
    return () => clearTimeout(t)
  }, [isLive, phase, roundNum, resolveMockRound])

  // ── Input handlers ────────────────────────────────────────────────────────
  function addPick(sym: string) {
    if (phase !== 'recall') return
    if (picks.length >= seqLen) return
    playClick()
    const next = [...picks, sym]
    setPicks(next)
    picksRef.current = next

    if (next.length === seqLen) {
      const correct = next.every((s, i) => s === sequence[i])
      correct ? playCorrect() : playWrong()
      const submitTime = Date.now()
      mySubmitTimeRef.current = submitTime
      if (isLive) {
        sendInput({ type: 'SUBMIT', sequence: next })
        setPhase('submitted')
      } else {
        setPhase('submitted')
        const oppSub = mockOppSubRef.current
        const oppSubmitTime = mockOppSubmitTimeRef.current
        if (oppSub && oppSubmitTime !== null) {
          resolveMockRound(next, oppSub, submitTime, oppSubmitTime)
        }
        // If opponent hasn't submitted yet, the opponent timer effect will call resolveMockRound
      }
    }
  }

  function removeLast() {
    if (phase !== 'recall' || picks.length === 0) return
    const next = picks.slice(0, -1)
    setPicks(next)
    picksRef.current = next
  }

  function scoreOf(sub: string[]) {
    return sub.filter((s, i) => s === sequence[i]).length
  }

  const mySubmission = isLive ? (submissions?.[myPlayerId] ?? null) : picks
  const oppSubmission = isLive
    ? opponent
      ? (submissions?.[opponent.id] ?? null)
      : null
    : (mockOppSub ?? null)
  const myScore = phase === 'submitted' && mySubmission ? scoreOf(mySubmission) : null
  const oppScore = oppSubmission ? scoreOf(oppSubmission) : null
  const roundTotal = Math.ceil(seqLen * 1.5)

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* Round badge */}
      {!resolved && (
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 15,
            color: 'rgba(0,0,0,0.45)',
            letterSpacing: 1,
          }}
        >
          ROUND {roundNum} — {seqLen} BALLS
        </div>
      )}

      {/* ── Memorize phase ── */}
      {!resolved && phase === 'memorize' && (
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
          <CountdownRing value={countdown} total={roundTotal} />
        </>
      )}

      {/* ── Recall phase ── */}
      {!resolved && phase === 'recall' && (
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

          {/* Timer strip */}
          <CountdownRing value={countdown} total={roundTotal} color="var(--blue)" />

          {/* Slots */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: seqLen }).map((_, i) => (
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
                disabled={picks.length >= seqLen}
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
                  opacity: picks.length >= seqLen ? 0.4 : 1,
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
      {!resolved && phase === 'submitted' && (
        <div
          className="anim-pop"
          style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <SequenceDisplay sequence={sequence} revealed />

          {/* My answer with colour-coded slots */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {(mySubmission ?? []).map((sym: string, i: number) => (
              <div
                key={i}
                style={{
                  width: 52,
                  height: 52,
                  background: sym === sequence[i] ? 'rgba(68,204,68,0.15)' : 'rgba(255,51,51,0.12)',
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
                  myScore >= seqLen
                    ? 'var(--green)'
                    : myScore >= Math.ceil(seqLen * 0.6)
                      ? 'var(--orange)'
                      : 'var(--red)',
              }}
            >
              {myScore}/{seqLen} correct!
            </div>
          )}

          {oppSubmitted && oppScore !== null ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.5)' }}>
                {opponent?.nickname ?? 'Opponent'}: {oppScore}/{seqLen}
              </div>
              {myScore !== null && myScore === oppScore && (
                <div
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: 18,
                    color: 'var(--orange)',
                  }}
                >
                  TIE! Next round ↗
                </div>
              )}
            </>
          ) : (
            <div
              className="anim-pulse"
              style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.4)' }}
            >
              Waiting for {opponent?.nickname ?? 'opponent'}…
            </div>
          )}
        </div>
      )}

      {/* ── Result (mock mode only — live winner handled by match controller) ── */}
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
            After {roundNum} round{roundNum > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SequenceDisplay({ sequence, revealed }: { sequence: string[]; revealed: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
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

function CountdownRing({
  value,
  total,
  color = 'var(--orange)',
}: {
  value: number
  total: number
  color?: string
}) {
  const pct = Math.max(0, Math.min(1, value / total))
  const isUrgent = value <= 2 && value > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 64,
          lineHeight: 1,
          color: isUrgent ? 'var(--red)' : color,
          transition: 'color 0.3s',
        }}
      >
        {value}
      </div>
      {/* Progress bar */}
      <div
        style={{
          width: 160,
          height: 8,
          background: 'rgba(0,0,0,0.1)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: isUrgent ? 'var(--red)' : color,
            borderRadius: 4,
            transition: 'width 0.9s linear, background 0.3s',
          }}
        />
      </div>
    </div>
  )
}
