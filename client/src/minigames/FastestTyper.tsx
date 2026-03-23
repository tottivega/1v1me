import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect } from '../utils/sounds'

interface ServerState {
  phrase: string
  progress: Record<string, number>
  resolved: boolean
  winnerId: string | null
}

export default function FastestTyper() {
  const { myPlayerId, players, sendInput, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected'
  const opponent = players.find(p => p.id !== myPlayerId)

  const [typed, setTyped] = useState('')
  const [finished, setFinished] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const serverState = isLive ? (minigameState as ServerState | null) : null
  const phrase = serverState?.phrase ?? MOCK_PHRASE

  // Mock opponent progress — advances at a random pace in dev/disconnected mode
  const [mockOppProg, setMockOppProg] = useState(0)
  useEffect(() => {
    if (isLive) return
    setMockOppProg(0)
    const id = setInterval(() => {
      setMockOppProg(p => {
        if (p >= phrase.length) { clearInterval(id); return p }
        return Math.min(p + Math.floor(Math.random() * 2) + 1, phrase.length)
      })
    }, 400)
    return () => clearInterval(id)
  }, [isLive, phrase])

  // Correct characters from start (live mode = server tracks; mock = local)
  const myProgress  = isLive ? (serverState?.progress[myPlayerId] ?? 0) : computeProgress(typed, phrase)
  const oppProgress = isLive ? (opponent ? (serverState?.progress[opponent.id] ?? 0) : 0) : mockOppProg

  const isResolved = serverState?.resolved ?? false
  const winnerId   = serverState?.winnerId ?? null

  // Reset on new phrase
  useEffect(() => {
    setTyped('')
    setFinished(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [phrase])

  // Detect when we finish
  useEffect(() => {
    if (!finished && myProgress === phrase.length && phrase.length > 0) {
      setFinished(true)
      playCorrect()
    }
  }, [myProgress, phrase.length])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (finished) return
    const val = e.target.value
    setTyped(val)
    if (isLive) {
      sendInput({ type: 'TYPE', text: val })
    }
  }

  const pct     = phrase.length > 0 ? (myProgress / phrase.length) * 100 : 0
  const oppPct  = phrase.length > 0 ? (oppProgress / phrase.length) * 100 : 0
  const oppName = opponent?.nickname ?? '???'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 28, flex: 1, padding: 28,
    }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 32, color: 'var(--blue)', textAlign: 'center' }}>
        FASTEST TYPER ⌨️
      </div>

      {/* Progress bars */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ProgressBar label="You" pct={pct} color="var(--blue)" />
        <ProgressBar label={oppName} pct={oppPct} color="var(--orange)" />
      </div>

      {/* Phrase display */}
      <div style={{
        background: 'var(--white)', border: 'var(--border)', borderRadius: 16,
        boxShadow: 'var(--shadow)', padding: '20px 28px',
        maxWidth: 480, width: '100%', lineHeight: 1.7, fontFamily: 'monospace', fontSize: 20,
        letterSpacing: 0.5,
      }}>
        {phrase.split('').map((ch, i) => {
          const typedChar = typed[i]
          let color = 'rgba(0,0,0,0.25)'
          if (typedChar === undefined) color = 'var(--black)'
          else if (typedChar === ch) color = 'var(--green)'
          else color = 'var(--red)'
          return (
            <span key={i} style={{ color, transition: 'color 0.1s' }}>
              {ch}
            </span>
          )
        })}
      </div>

      {/* Input */}
      {!isResolved && !finished && (
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
            fontFamily: 'monospace', fontSize: 20,
            width: '100%', maxWidth: 480,
            border: 'var(--border)', borderRadius: 12,
            padding: '12px 18px', background: 'var(--white)',
            boxShadow: 'var(--shadow-sm)', outline: 'none', letterSpacing: 0.5,
          }}
        />
      )}

      {/* Status messages */}
      {(finished || isResolved) && (
        <div className="anim-pop" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {winnerId === myPlayerId || (finished && !isResolved) ? (
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 32, color: 'var(--green)' }}>
              ✅ Done! Waiting for result…
            </div>
          ) : winnerId && winnerId !== myPlayerId ? (
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--orange)' }}>
              {opponent?.nickname ?? 'Opponent'} finished first!
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--green)' }}>
              ✅ Submitted!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 14, background: 'rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden', border: 'var(--border)' }}>
        <div style={{
          height: '100%', background: color, width: `${pct}%`,
          borderRadius: 8, transition: 'width 0.15s ease-out',
        }} />
      </div>
    </div>
  )
}

function computeProgress(typed: string, phrase: string): number {
  let i = 0
  while (i < typed.length && i < phrase.length && typed[i] === phrase[i]) i++
  return i
}

// ── Mock (dev / disconnected mode) ───────────────────────────────────────────
const MOCK_PHRASE = 'the quick brown fox'
