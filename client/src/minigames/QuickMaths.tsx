import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong } from '../utils/sounds'
import { type QuickMathsEquation, type QuickMathsState } from '@shared/types'

type Equation = QuickMathsEquation
type Flash = 'correct' | 'wrong' | null

const MAX_DIGITS = 4

export default function QuickMaths() {
  const { myPlayerId, players, sendInput, minigameState, isMockMatch } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)

  const [displayVal, setDisplayVal] = useState('')
  const [flash, setFlash] = useState<Flash>(null)

  // Stable refs so callbacks never go stale
  const displayValRef = useRef('')
  displayValRef.current = displayVal
  const isLiveRef = useRef(isLive)
  isLiveRef.current = isLive

  const prevCorrect = useRef(0)
  const prevQuestion = useRef('')

  // ── Live mode ─────────────────────────────────────────────────────────────
  const serverState = isLive ? (minigameState as QuickMathsState | null) : null
  const myEquation = serverState?.equations[myPlayerId] ?? null
  const myCorrect = serverState?.correct[myPlayerId] ?? 0
  const oppCorrect = opponent ? (serverState?.correct[opponent.id] ?? 0) : 0

  const myEquationRef = useRef(myEquation)
  myEquationRef.current = myEquation

  const triggerFlash = useCallback((type: Flash) => {
    setFlash(type)
    if (type === 'correct') playCorrect()
    else if (type === 'wrong') playWrong()
    setTimeout(() => setFlash(null), 350)
  }, [])

  // Detect server response (equation changed) → show flash feedback
  useEffect(() => {
    if (!isLive || !myEquation) return
    if (myEquation.question === prevQuestion.current) return

    if (prevQuestion.current === '') {
      prevCorrect.current = myCorrect
      prevQuestion.current = myEquation.question
      setDisplayVal('')
      return
    }

    const wasCorrect = myCorrect > prevCorrect.current
    triggerFlash(wasCorrect ? 'correct' : 'wrong')
    prevCorrect.current = myCorrect
    prevQuestion.current = myEquation.question
    setDisplayVal('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEquation?.question, isLive, myCorrect, triggerFlash])

  // Reset on new round
  useEffect(() => {
    if (minigameState === null) {
      prevCorrect.current = 0
      prevQuestion.current = ''
      setDisplayVal('')
      setFlash(null)
    }
  }, [minigameState])

  // ── Mock mode ─────────────────────────────────────────────────────────────
  const [mockEquation, setMockEquation] = useState<Equation>(mockGenerate)
  const [mockMyCorrect, setMockMyCorrect] = useState(0)
  const [mockOppCorrect, setMockOppCorrect] = useState(0)

  const mockEquationRef = useRef(mockEquation)
  mockEquationRef.current = mockEquation

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

  // ── Calculator handlers ───────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const val = displayValRef.current
    const num = parseInt(val, 10)
    if (isNaN(num)) return
    setDisplayVal('')

    if (isLiveRef.current) {
      prevQuestion.current = myEquationRef.current?.question ?? ''
      sendInput({ type: 'ANSWER', answer: num })
    } else {
      const correct = num === mockEquationRef.current.answer
      // triggerFlash captured via closure — it's stable (useCallback [])
      setFlash(correct ? 'correct' : 'wrong')
      if (correct) playCorrect()
      else playWrong()
      setTimeout(() => setFlash(null), 350)
      if (correct) setMockMyCorrect((c) => c + 1)
      setMockEquation(mockGenerate())
      sendInput({ type: 'ANSWER', answer: num })
    }
  }, [sendInput])

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        setDisplayVal((v) => (v.length >= MAX_DIGITS ? v : v + e.key))
      } else if (e.key === 'Backspace') {
        setDisplayVal((v) => v.slice(0, -1))
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        setDisplayVal('')
      } else if (e.key === 'Enter') {
        handleSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSubmit])

  // ── Shared render values ──────────────────────────────────────────────────
  const question = isLive ? (myEquation?.question ?? '…') : mockEquation.question
  const myScore = isLive ? myCorrect : mockMyCorrect
  const oppScore = isLive ? oppCorrect : mockOppCorrect
  const oppName = opponent?.nickname ?? '???'

  const flashShadow =
    flash === 'correct'
      ? '4px 4px 0 var(--green)'
      : flash === 'wrong'
        ? '4px 4px 0 var(--red)'
        : 'var(--shadow)'

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
          fontSize: 28,
          color: 'var(--blue)',
          textAlign: 'center',
        }}
      >
        QUICK MATHS 🔢
      </div>

      {/* Score bar */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <ScorePill label="You" score={myScore} color="var(--blue)" />
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 20, opacity: 0.3 }}>vs</span>
        <ScorePill label={oppName} score={oppScore} color="var(--orange)" />
      </div>

      {/* Calculator display */}
      <div
        style={{
          background: '#1a2a1a',
          border: '3px solid var(--black)',
          borderRadius: 16,
          boxShadow: flashShadow,
          padding: '14px 20px',
          width: '100%',
          maxWidth: 320,
          transition: 'box-shadow 0.1s',
        }}
      >
        {/* Question row */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 28,
            color: '#5aaa5a',
            opacity: 0.85,
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          {question} = <span style={{ color: '#00e676' }}>{displayVal}</span>
        </div>

        {/* Flash feedback */}
        {flash === 'correct' && (
          <div
            className="anim-pop"
            style={{
              color: '#00e676',
              fontWeight: 900,
              fontSize: 13,
              textAlign: 'right',
              marginTop: 4,
            }}
          >
            ✓ Correct!
          </div>
        )}
        {flash === 'wrong' && (
          <div
            className="anim-shake"
            style={{
              color: '#ff5555',
              fontWeight: 900,
              fontSize: 13,
              textAlign: 'right',
              marginTop: 4,
            }}
          >
            ✗ Next one →
          </div>
        )}
      </div>

      {/* Keypad */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 80px)',
          gap: 8,
        }}
      >
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
          <CalcButton
            key={d}
            label={String(d)}
            onClick={() => setDisplayVal((v) => (v.length >= MAX_DIGITS ? v : v + d))}
          />
        ))}
        <CalcButton label="C" onClick={() => setDisplayVal('')} textColor="var(--red)" />
        <CalcButton
          label="0"
          onClick={() => setDisplayVal((v) => (v.length >= MAX_DIGITS ? v : v + '0'))}
        />
        <CalcButton
          label="⌫"
          onClick={() => setDisplayVal((v) => v.slice(0, -1))}
          textColor="var(--orange)"
        />
      </div>

      {/* Enter button */}
      <button
        onClick={handleSubmit}
        disabled={!displayVal}
        style={{
          width: 256,
          height: 56,
          fontFamily: 'var(--font-title)',
          fontSize: 20,
          letterSpacing: 2,
          background: displayVal ? 'var(--green)' : 'rgba(0,0,0,0.08)',
          color: displayVal ? 'var(--white)' : 'rgba(0,0,0,0.25)',
          border: '3px solid var(--black)',
          borderRadius: 14,
          boxShadow: displayVal ? '4px 4px 0 var(--black)' : 'none',
          cursor: displayVal ? 'pointer' : 'default',
          transition: 'all 0.08s',
        }}
      >
        ENTER ↵
      </button>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScorePill({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 48, color, lineHeight: 1 }}>
        {score}
      </div>
      <div className="label" style={{ opacity: 0.6 }}>
        {label}
      </div>
    </div>
  )
}

function CalcButton({
  label,
  onClick,
  textColor = 'var(--black)',
}: {
  label: string
  onClick: () => void
  textColor?: string
}) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        height: 64,
        fontFamily: 'var(--font-title)',
        fontSize: 26,
        fontWeight: 900,
        background: 'var(--white)',
        border: '3px solid var(--black)',
        borderRadius: 12,
        boxShadow: pressed ? 'none' : '3px 3px 0 var(--black)',
        transform: pressed ? 'translate(3px, 3px)' : 'none',
        cursor: 'pointer',
        color: textColor,
        transition: 'transform 0.05s, box-shadow 0.05s',
      }}
    >
      {label}
    </button>
  )
}

// ── Mock equation generator ───────────────────────────────────────────────────
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
