import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong } from '../utils/sounds'

interface ServerState {
  scrambled: string
  attempts: Record<string, number>
  resolved: boolean
  winnerId: string | null
  answer?: string // only present when resolved or timed out
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_WORDS = ['planet', 'castle', 'dragon', 'silver', 'jungle', 'rocket']

function scramble(word: string): string {
  const letters = word.split('')
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[letters[i], letters[j]] = [letters[j]!, letters[i]!]
  }
  const result = letters.join('')
  return result === word ? scramble(word) : result
}

const mockWord = MOCK_WORDS[Math.floor(Math.random() * MOCK_WORDS.length)]!
const mockScramble = scramble(mockWord)

export default function WordScramble() {
  const { myPlayerId, players, sendInput, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected'
  const opponent = players.find((p) => p.id !== myPlayerId)

  const serverState = isLive ? (minigameState as ServerState | null) : null
  const scrambled = serverState?.scrambled ?? mockScramble

  const [typed, setTyped] = useState('')
  const [shaking, setShaking] = useState(false) // wrong-guess shake on input
  const [solved, setSolved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track prev attempts count to detect wrong guess in live mode
  const prevMyAttempts = useRef(0)

  // ── Mock opponent — guesses correctly after a random delay ─────────────────
  const [mockOppSolved, setMockOppSolved] = useState(false)
  const [mockAnswer, setMockAnswer] = useState<string | null>(null)
  useEffect(() => {
    if (isLive) return
    setMockOppSolved(false)
    setMockAnswer(null)
    // Opponent solves somewhere in the 30–75% window of the 25s timer
    const delay = 7500 + Math.random() * 11000
    const t = setTimeout(() => {
      setMockOppSolved(true)
      setMockAnswer(mockWord)
    }, delay)
    return () => clearTimeout(t)
  }, [isLive, scrambled])

  // ── Reset on new round ─────────────────────────────────────────────────────
  useEffect(() => {
    setTyped('')
    setSolved(false)
    setShaking(false)
    prevMyAttempts.current = 0
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [scrambled])

  // ── Detect wrong guess from server (attempts counter ticks up) ─────────────
  useEffect(() => {
    if (!isLive || !serverState) return
    const current = serverState.attempts[myPlayerId] ?? 0
    if (current > prevMyAttempts.current) {
      prevMyAttempts.current = current
      triggerShake()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverState?.attempts[myPlayerId]])

  function triggerShake() {
    playWrong()
    setShaking(true)
    setTimeout(() => setShaking(false), 400)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (solved) return
    setTyped(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    handleSubmit()
  }

  function handleSubmit() {
    if (solved || !typed.trim()) return
    const guess = typed.trim().toLowerCase()

    if (isLive) {
      sendInput({ type: 'GUESS_WORD', word: guess })
      // Optimistic clear so they can retype quickly; wrong feedback comes from server
      setTyped('')
    } else {
      // Mock mode: check locally
      if (guess === mockWord) {
        setSolved(true)
        setMockAnswer(mockWord)
        playCorrect()
      } else {
        triggerShake()
        setTyped('')
      }
    }
  }

  // ── Derived display ────────────────────────────────────────────────────────
  const isResolved = isLive ? (serverState?.resolved ?? false) : solved || mockOppSolved
  const winnerId = isLive
    ? (serverState?.winnerId ?? null)
    : solved
      ? myPlayerId
      : mockOppSolved
        ? (opponent?.id ?? 'opp')
        : null
  const revealWord = isLive ? (serverState?.answer ?? null) : mockAnswer
  const myAttempts = isLive ? (serverState?.attempts[myPlayerId] ?? 0) : 0
  const oppAttempts = isLive ? (serverState?.attempts[opponent?.id ?? ''] ?? 0) : 0
  const iWon = winnerId === myPlayerId
  const oppName = opponent?.nickname ?? '???'

  // Play correct sound when live resolution happens in my favour
  useEffect(() => {
    if (!isLive || !serverState?.resolved) return
    if (serverState.winnerId === myPlayerId) {
      setSolved(true)
      playCorrect()
    } else if (serverState.winnerId) {
      playWrong()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverState?.resolved])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        flex: 1,
        padding: 28,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 32,
          color: 'var(--purple)',
          textAlign: 'center',
        }}
      >
        WORD SCRAMBLE 🔤
      </div>

      {/* Scrambled letters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {scrambled.split('').map((letter, i) => (
          <div
            key={i}
            style={{
              width: 52,
              height: 58,
              background: 'var(--white)',
              border: '3px solid var(--black)',
              borderRadius: 12,
              boxShadow: '4px 4px 0 var(--black)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-title)',
              fontSize: 28,
              color: 'var(--black)',
              textTransform: 'uppercase',
              letterSpacing: 0,
            }}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Answer reveal */}
      {revealWord && (
        <div className="anim-pop" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              opacity: 0.5,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            The word was
          </div>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 42,
              color: 'var(--purple)',
              textTransform: 'uppercase',
              letterSpacing: 4,
            }}
          >
            {revealWord}
          </div>
        </div>
      )}

      {/* Result banner */}
      {isResolved && winnerId && (
        <div className="anim-bounce" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 48,
              color: iWon ? 'var(--green)' : 'var(--red)',
              WebkitTextStroke: '2px var(--black)',
              textShadow: '3px 3px 0 var(--black)',
            }}
          >
            {iWon ? '🏆 YOU GOT IT!' : `${oppName} got it first!`}
          </div>
        </div>
      )}

      {/* Input area */}
      {!isResolved && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            maxWidth: 380,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer…"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              width: '100%',
              fontFamily: 'var(--font-title)',
              fontSize: 22,
              textTransform: 'uppercase',
              letterSpacing: 3,
              border: `3px solid ${shaking ? 'var(--red)' : 'var(--black)'}`,
              borderRadius: 12,
              padding: '12px 18px',
              background: 'var(--white)',
              boxShadow: shaking ? '0 0 0 3px rgba(255,51,51,0.3)' : 'var(--shadow-sm)',
              outline: 'none',
              textAlign: 'center',
              animation: shaking ? 'anim-shake 0.35s ease' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
          <button
            className="btn btn-lg"
            onClick={handleSubmit}
            disabled={!typed.trim()}
            style={{
              background: 'var(--purple)',
              color: 'var(--white)',
              padding: '12px 40px',
              borderRadius: 12,
              fontSize: 18,
            }}
          >
            Submit ↵
          </button>
          <div style={{ fontSize: 12, opacity: 0.4, fontWeight: 700 }}>or press Enter</div>
        </div>
      )}

      {/* Attempt counts — shows tension */}
      {(myAttempts > 0 || oppAttempts > 0) && (
        <div style={{ display: 'flex', gap: 24, fontSize: 13, fontWeight: 700, opacity: 0.55 }}>
          {myAttempts > 0 && (
            <span>
              You: {myAttempts} wrong guess{myAttempts !== 1 ? 'es' : ''}
            </span>
          )}
          {oppAttempts > 0 && (
            <span>
              {oppName}: {oppAttempts} wrong guess{oppAttempts !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
