import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong } from '../utils/sounds'
import { type QuickMathsEquation, type QuickMathsState } from '@shared/types'

type Equation = QuickMathsEquation

type Flash = 'correct' | 'wrong' | null

export default function QuickMaths() {
  const { myPlayerId, players, sendInput, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected' && minigameState !== null
  const opponent = players.find((p) => p.id !== myPlayerId)

  const [inputVal, setInputVal] = useState('')
  const [flash, setFlash] = useState<Flash>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track previous correct count so we can detect right/wrong after server responds
  const prevCorrect = useRef(0)
  const prevQuestion = useRef('')

  // ── Live mode ─────────────────────────────────────────────────────────────
  const serverState = isLive ? (minigameState as QuickMathsState | null) : null
  const myEquation = serverState?.equations[myPlayerId] ?? null
  const myCorrect = serverState?.correct[myPlayerId] ?? 0
  const oppCorrect = opponent ? (serverState?.correct[opponent.id] ?? 0) : 0

  // Detect server response (equation changed) → show flash feedback
  useEffect(() => {
    if (!isLive || !myEquation) return
    if (myEquation.question === prevQuestion.current) return // no change yet

    const wasCorrect = myCorrect > prevCorrect.current
    triggerFlash(wasCorrect ? 'correct' : 'wrong')

    prevCorrect.current = myCorrect
    prevQuestion.current = myEquation.question
    setInputVal('')
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEquation?.question, isLive, myCorrect])

  // Focus input on mount and whenever equation changes
  useEffect(() => {
    inputRef.current?.focus()
  }, [myEquation?.question])

  // Reset tracking on new round
  useEffect(() => {
    if (minigameState === null) {
      prevCorrect.current = 0
      prevQuestion.current = ''
      setInputVal('')
      setFlash(null)
    }
  }, [minigameState])

  function triggerFlash(type: Flash) {
    setFlash(type)
    if (type === 'correct') playCorrect()
    else if (type === 'wrong') playWrong()
    setTimeout(() => setFlash(null), 350)
  }

  function submitLive() {
    const num = parseInt(inputVal, 10)
    if (isNaN(num)) return
    prevQuestion.current = myEquation?.question ?? ''
    sendInput({ type: 'ANSWER', answer: num })
    setInputVal('')
  }

  // ── Mock mode ─────────────────────────────────────────────────────────────
  const [mockEquation, setMockEquation] = useState<Equation>(mockGenerate)
  const [mockMyCorrect, setMockMyCorrect] = useState(0)
  const [mockOppCorrect, setMockOppCorrect] = useState(0)

  // Simulate opponent answering at random intervals in mock mode
  useEffect(() => {
    if (isLive) return
    const interval = setInterval(
      () => {
        if (Math.random() < 0.65) setMockOppCorrect((c) => c + 1)
      },
      1200 + Math.random() * 800
    )
    return () => clearInterval(interval)
  }, [isLive])

  function submitMock() {
    const num = parseInt(inputVal, 10)
    if (isNaN(num)) return
    const correct = num === mockEquation.answer
    triggerFlash(correct ? 'correct' : 'wrong')
    if (correct) setMockMyCorrect((c) => c + 1)
    setMockEquation(mockGenerate())
    setInputVal('')
    sendInput({ type: 'ANSWER', answer: num })
    inputRef.current?.focus()
  }

  const handleSubmit = useCallback(() => {
    if (isLive) submitLive()
    else submitMock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, inputVal, myEquation])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit()
  }

  // ── Shared render values ──────────────────────────────────────────────────
  const question = isLive ? (myEquation?.question ?? '…') : mockEquation.question
  const myScore = isLive ? myCorrect : mockMyCorrect
  const oppScore = isLive ? oppCorrect : mockOppCorrect
  const oppName = opponent?.nickname ?? '???'

  const flashBg =
    flash === 'correct'
      ? 'rgba(68,204,68,0.18)'
      : flash === 'wrong'
        ? 'rgba(255,51,51,0.18)'
        : 'transparent'

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
        transition: 'background 0.15s',
        background: flashBg,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 32,
          color: 'var(--blue)',
          textAlign: 'center',
        }}
      >
        QUICK MATHS 🔢
      </div>

      {/* Score bar */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <ScorePill label="You" score={myScore} color="var(--blue)" />
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 22, opacity: 0.3 }}>vs</span>
        <ScorePill label={oppName} score={oppScore} color="var(--orange)" />
      </div>

      {/* Equation */}
      <div
        style={{
          background: 'var(--white)',
          border: 'var(--border)',
          borderRadius: 20,
          boxShadow:
            flash === 'correct'
              ? '4px 4px 0 var(--green)'
              : flash === 'wrong'
                ? '4px 4px 0 var(--red)'
                : 'var(--shadow)',
          padding: '28px 48px',
          textAlign: 'center',
          transition: 'box-shadow 0.1s',
          minWidth: 280,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 64,
            color: 'var(--black)',
            lineHeight: 1,
          }}
        >
          {question} = ?
        </div>
        {flash === 'correct' && (
          <div
            className="anim-pop"
            style={{ color: 'var(--green)', fontWeight: 900, fontSize: 18, marginTop: 8 }}
          >
            ✅ Correct!
          </div>
        )}
        {flash === 'wrong' && (
          <div
            className="anim-shake"
            style={{ color: 'var(--red)', fontWeight: 900, fontSize: 18, marginTop: 8 }}
          >
            ❌ Nope! New one →
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={onKey}
          placeholder="?"
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 40,
            width: 140,
            textAlign: 'center',
            border: 'var(--border)',
            borderRadius: 12,
            padding: '10px 16px',
            boxShadow: 'var(--shadow-sm)',
            outline: 'none',
            background: 'var(--white)',
            MozAppearance: 'textfield',
          }}
        />
        <button
          className="btn btn-blue btn-lg"
          onClick={handleSubmit}
          style={{ fontSize: 22, padding: '14px 28px' }}
        >
          ↵
        </button>
      </div>

      <div className="label" style={{ opacity: 0.45 }}>
        Press Enter to submit
      </div>
    </div>
  )
}

function ScorePill({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 52, color, lineHeight: 1 }}>
        {score}
      </div>
      <div className="label" style={{ opacity: 0.6 }}>
        {label}
      </div>
    </div>
  )
}

// ── Mock equation generator (client-side only) ────────────────────────────────
function mockGenerate(): Equation {
  const roll = Math.random()
  if (roll < 0.35) {
    const a = Math.floor(Math.random() * 24) + 2
    const b = Math.floor(Math.random() * 24) + 2
    return { question: `${a} + ${b}`, answer: a + b }
  }
  if (roll < 0.65) {
    const b = Math.floor(Math.random() * 14) + 2
    const a = b + Math.floor(Math.random() * 20) + 1
    return { question: `${a} − ${b}`, answer: a - b }
  }
  const a = Math.floor(Math.random() * 11) + 2
  const b = Math.floor(Math.random() * 11) + 2
  return { question: `${a} × ${b}`, answer: a * b }
}
