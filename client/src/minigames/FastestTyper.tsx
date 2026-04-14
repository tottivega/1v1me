import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong } from '../utils/sounds'
import { type FastestTyperState } from '@shared/types'

// ── Sentence pool (mirrors server) ────────────────────────────────────────────
const PHRASE_POOL = [
  'cats sleep all day',
  'birds fly south fast',
  'big dogs love rain',
  'stars shine at night',
  'fish swim in rivers',
  'run like the wind',
  'time moves very fast',
  'jump over the fence',
  'the sun sets every evening',
  'dogs bark at the moon',
  'never skip a rest day',
  'she reads books every morning',
  'slow and steady wins races',
  'the cold wind blows hard',
  'he scored the final point',
  'we drove all night long',
  'type fast and stay focused',
  'the fox ran very far',
  'we played cards all night long',
  'the rain fell on the roof',
  'go left at the old bridge',
  'every day brings a new chance',
  'the team worked until very late',
  'hold your breath and jump in',
  'the big red barn burned down',
  'she found her keys right away',
  'the bus came just in time',
  'they ran across the open field',
  'the quick brown fox jumps so high',
  'she typed faster than anyone else could',
  'the best things in life are free',
  'the small boat rocked in the waves',
  'we all laughed until our sides hurt',
  'the clock on the wall ticked loudly',
  'the early bird always catches the fat worm',
  'she walked slowly across the old wooden bridge',
  'the bright stars filled the dark winter sky',
  'he ran as fast as his legs allowed',
  'the dog chased the ball across the yard',
  'every great journey begins with a single step',
]

const PHRASE_COUNT = 10

function pickMockPhrases(): string[] {
  return [...PHRASE_POOL].sort(() => Math.random() - 0.5).slice(0, PHRASE_COUNT)
}

/** Character index at which the 3rd-to-last word starts (preview trigger). */
function previewTriggerChar(phrase: string): number {
  const words = phrase.split(' ')
  const n = words.length
  if (n <= 3) return 0
  return words.slice(0, n - 3).join(' ').length + 1
}

export default function FastestTyper() {
  const { myPlayerId, players, sendInput, minigameState, isMockMatch } = useGameStore()
  const isLive = !isMockMatch
  const isLiveRef = useRef(isLive)
  isLiveRef.current = isLive

  const opponent = players.find((p) => p.id !== myPlayerId)
  const oppId = opponent?.id ?? 'opp'
  const oppName = opponent?.nickname ?? '???'

  // ── Live state ─────────────────────────────────────────────────────────────
  const server = isLive ? (minigameState as FastestTyperState | null) : null

  // ── Mock phrases — stable for the lifetime of this mount ─────────────────
  const [mockPhrases] = useState<string[]>(pickMockPhrases)

  // ── Player local state ────────────────────────────────────────────────────
  const [typed, setTyped] = useState('')
  const [localCompleted, setLocalCompleted] = useState(0)
  // Highest 0-based sentence index that has been revealed to the player
  const [revealedUpTo, setRevealedUpTo] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const sentenceBottomRef = useRef<HTMLDivElement>(null)

  const activePhrases = isLive ? (server?.phrases ?? []) : mockPhrases
  const currentPhrase = activePhrases[localCompleted] ?? ''

  const sendProgress = useCallback(
    (completed: number, chars: number) => {
      if (isLiveRef.current) sendInput({ type: 'PROGRESS', completed, chars })
    },
    [sendInput]
  )

  // ── Mock opponent — completes one sentence every 4.5–7.5 s ───────────────
  const [mockOppCompleted, setMockOppCompleted] = useState(0)
  useEffect(() => {
    if (isLive) return
    let cancelled = false
    function scheduleNext(current: number) {
      if (current >= PHRASE_COUNT || cancelled) return
      setTimeout(
        () => {
          if (cancelled) return
          setMockOppCompleted((c) => {
            const next = Math.min(c + 1, PHRASE_COUNT)
            scheduleNext(next)
            return next
          })
        },
        4500 + Math.random() * 3000
      )
    }
    scheduleNext(0)
    return () => {
      cancelled = true
    }
  }, [isLive])

  // ── Reset on new game ─────────────────────────────────────────────────────
  useEffect(() => {
    if (minigameState === null) {
      setTyped('')
      setLocalCompleted(0)
      setRevealedUpTo(0)
      setMockOppCompleted(0)
    }
  }, [minigameState])

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Scroll sentence list to bottom when new sentence is revealed
  useEffect(() => {
    sentenceBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [revealedUpTo, localCompleted])

  // ── Sound on live result ──────────────────────────────────────────────────
  const prevWinnerId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const wId = server?.winnerId
    if (wId !== undefined && wId !== prevWinnerId.current) {
      prevWinnerId.current = wId
      if (wId === myPlayerId) playCorrect()
      else playWrong()
    }
  }, [server?.winnerId, myPlayerId])

  // ── Input handler ─────────────────────────────────────────────────────────
  const resolved = isLive ? (server?.resolved ?? false) : localCompleted >= PHRASE_COUNT

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (resolved) return
    const val = e.target.value

    if (val === currentPhrase) {
      // Sentence complete — auto-advance
      const next = localCompleted + 1
      setLocalCompleted(next)
      setTyped('')
      setRevealedUpTo((r) => Math.max(r, next))
      sendProgress(next, 0)
    } else {
      setTyped(val)
      sendProgress(localCompleted, val.length)
      // Show next sentence preview when player starts the 3rd-to-last word
      const trigger = previewTriggerChar(currentPhrase)
      if (val.length >= trigger && localCompleted + 1 < activePhrases.length) {
        setRevealedUpTo((r) => Math.max(r, localCompleted + 1))
      }
    }
  }

  // ── Progress values ───────────────────────────────────────────────────────
  const myCompleted = isLive ? (server?.completed[myPlayerId] ?? 0) : localCompleted
  const oppCompleted = isLive ? (server?.completed[oppId] ?? 0) : mockOppCompleted

  function smoothPct(completed: number, chars: number, phraseIdx: number): number {
    const phrase = activePhrases[phraseIdx] ?? ''
    const partial = phrase.length > 0 ? chars / phrase.length : 0
    return ((completed + partial) / PHRASE_COUNT) * 100
  }

  const myChars = isLive ? (server?.charProgress[myPlayerId] ?? 0) : typed.length
  const oppChars = isLive ? (server?.charProgress[oppId] ?? 0) : 0
  const myPct = smoothPct(myCompleted, myChars, myCompleted)
  const oppPct = smoothPct(oppCompleted, oppChars, oppCompleted)

  const winnerId = server?.winnerId ?? null
  const iWon = winnerId === myPlayerId || (!isLive && localCompleted >= PHRASE_COUNT)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        flex: 1,
        padding: '20px 24px',
        overflow: 'hidden',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 28,
          color: 'var(--blue)',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        FASTEST TYPER ⌨️
      </div>

      {/* Progress bars */}
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <ProgressBar label={`You (${myCompleted}/10)`} pct={myPct} color="var(--blue)" />
        <ProgressBar label={`${oppName} (${oppCompleted}/10)`} pct={oppPct} color="var(--orange)" />
      </div>

      {/* Sentence stack — scrollable */}
      <div
        style={{
          width: '100%',
          maxWidth: 500,
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          paddingRight: 4,
        }}
      >
        {Array.from({ length: revealedUpTo + 1 }, (_, i) => {
          const phrase = activePhrases[i]
          if (!phrase) return null
          const isDone = i < localCompleted
          const isActive = i === localCompleted
          const isPreview = i > localCompleted

          return (
            <div
              key={i}
              style={{
                background: isActive ? 'var(--white)' : 'transparent',
                border: isActive ? 'var(--border)' : '2px solid transparent',
                borderRadius: 12,
                padding: isActive ? '14px 18px' : '6px 18px',
                boxShadow: isActive ? 'var(--shadow)' : 'none',
                fontFamily: 'monospace',
                fontSize: isActive ? 20 : 17,
                letterSpacing: 0.4,
                lineHeight: 1.7,
                opacity: isPreview ? 0.35 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              {isDone && (
                <span style={{ color: 'var(--green)', opacity: 0.7 }}>
                  {phrase} <span style={{ fontSize: 13 }}>✓</span>
                </span>
              )}
              {isActive &&
                phrase.split('').map((ch, ci) => {
                  const typedCh = typed[ci]
                  let color = 'rgba(0,0,0,0.3)'
                  let bg = 'transparent'
                  if (typedCh !== undefined) {
                    if (typedCh === ch) {
                      color = 'var(--green)'
                    } else {
                      color = 'var(--red)'
                      bg = 'rgba(220,50,50,0.12)'
                    }
                  }
                  return (
                    <span
                      key={ci}
                      style={{ color, background: bg, borderRadius: 2, transition: 'color 0.08s' }}
                    >
                      {ch}
                    </span>
                  )
                })}
              {isPreview && <span style={{ color: 'rgba(0,0,0,0.45)' }}>{phrase}</span>}
            </div>
          )
        })}
        <div ref={sentenceBottomRef} />
      </div>

      {/* Input */}
      {!resolved && (
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={handleChange}
          placeholder="Start typing…"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          style={{
            fontFamily: 'monospace',
            fontSize: 18,
            width: '100%',
            maxWidth: 500,
            border: 'var(--border)',
            borderRadius: 12,
            padding: '12px 18px',
            background: 'var(--white)',
            boxShadow: 'var(--shadow-sm)',
            outline: 'none',
            letterSpacing: 0.4,
            flexShrink: 0,
          }}
        />
      )}

      {/* Result */}
      {resolved && (
        <div
          className="anim-pop"
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {iWon ? (
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 32, color: 'var(--green)' }}>
              ✅ Done! Waiting for result…
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--orange)' }}>
              {oppName} finished first!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13,
          fontWeight: 700,
          opacity: 0.7,
        }}
      >
        <span>{label}</span>
        <span>{Math.round(Math.min(100, pct))}%</span>
      </div>
      <div
        style={{
          height: 12,
          background: 'rgba(0,0,0,0.08)',
          borderRadius: 8,
          overflow: 'hidden',
          border: 'var(--border)',
        }}
      >
        <div
          style={{
            height: '100%',
            background: color,
            width: `${Math.min(100, pct)}%`,
            borderRadius: 8,
            transition: 'width 0.15s ease-out',
          }}
        />
      </div>
    </div>
  )
}
