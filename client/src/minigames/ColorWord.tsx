import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong, playClick } from '../utils/sounds'

type Color = 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple'

interface ServerState {
  word: Color
  inkColor: Color
  winnerId?: string
}

const COLOR_STYLES: Record<Color, { bg: string; fg: string }> = {
  red: { bg: '#e63946', fg: '#fff' },
  blue: { bg: '#1d3fce', fg: '#fff' },
  green: { bg: '#2dc653', fg: '#fff' },
  yellow: { bg: '#f7c948', fg: '#000' },
  orange: { bg: '#ff6b2b', fg: '#fff' },
  purple: { bg: '#7b2d8b', fg: '#fff' },
}

const COLOR_CSS: Record<Color, string> = {
  red: '#e63946',
  blue: '#1d3fce',
  green: '#2dc653',
  yellow: '#f7c948',
  orange: '#ff6b2b',
  purple: '#7b2d8b',
}

const ALL_COLORS: Color[] = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']

function pickDifferent(base: Color): Color {
  const others = ALL_COLORS.filter((c) => c !== base)
  return others[Math.floor(Math.random() * others.length)]
}

export default function ColorWord() {
  const { myPlayerId, players, minigameState, wsStatus, sendInput } = useGameStore()
  const isLive = wsStatus === 'connected'
  const opponent = players.find((p) => p.id !== myPlayerId)

  // Live state
  const server = isLive ? (minigameState as ServerState | null) : null
  const liveWord = server?.word ?? null
  const liveInk = server?.inkColor ?? null
  const liveWinner = server?.winnerId ?? null

  // Mock state
  const [mockWord, setMockWord] = useState<Color | null>(null)
  const [mockInk, setMockInk] = useState<Color | null>(null)
  const [mockWinner, setMockWinner] = useState<string | null>(null)
  const [picked, setPicked] = useState<Color | null>(null)

  useEffect(() => {
    if (isLive) return
    const word = ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)]
    const ink = pickDifferent(word)
    setMockWord(word)
    setMockInk(ink)
    // Mock opponent picks randomly after 2–5s
    const delay = 2000 + Math.random() * 3000
    const t = setTimeout(() => {
      const oppPick = Math.random() < 0.6 ? ink : pickDifferent(ink)
      if (oppPick === ink) setMockWinner(opponent?.id ?? '')
      else setMockWinner(myPlayerId)
    }, delay)
    return () => clearTimeout(t)
  }, [isLive, myPlayerId, opponent?.id])

  const word = isLive ? liveWord : mockWord
  const inkColor = isLive ? liveInk : mockInk
  const winnerId = isLive ? liveWinner : mockWinner
  const resolved = winnerId !== null

  const iWon = winnerId === myPlayerId

  useEffect(() => {
    if (winnerId) {
      if (iWon) playCorrect()
      else playWrong()
    }
  }, [winnerId, iWon])

  function handlePick(color: Color) {
    if (resolved || picked) return
    setPicked(color)
    playClick()
    if (isLive) {
      sendInput({ type: 'PICK', color })
    } else {
      // In mock mode: check locally
      if (color === inkColor) setMockWinner(myPlayerId)
      // wrong pick: allow retry (don't set winner)
    }
  }

  if (!word || !inkColor) {
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
        gap: 32,
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
        CLICK THE INK COLOR 🎨
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
        What color is the <em>text itself</em>? (Not the word it spells)
      </p>

      {/* The color word displayed in the ink color */}
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 72,
          color: COLOR_CSS[inkColor],
          WebkitTextStroke: '2px var(--black)',
          textShadow: '3px 3px 0 var(--black)',
          letterSpacing: 4,
          userSelect: 'none',
        }}
      >
        {word.toUpperCase()}
      </div>

      {/* Color buttons */}
      {!resolved && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
            maxWidth: 340,
          }}
        >
          {ALL_COLORS.map((color) => (
            <button
              key={color}
              disabled={!!picked && color !== picked}
              onClick={() => handlePick(color)}
              style={{
                width: 90,
                height: 44,
                borderRadius: 8,
                border: '3px solid var(--black)',
                boxShadow: picked === color ? 'none' : '3px 3px 0 var(--black)',
                background: COLOR_STYLES[color].bg,
                color: COLOR_STYLES[color].fg,
                fontWeight: 900,
                fontSize: 13,
                textTransform: 'uppercase',
                cursor: picked ? 'default' : 'pointer',
                opacity: picked && color !== picked ? 0.4 : 1,
                transition: 'opacity 0.15s, box-shadow 0.1s',
              }}
            >
              {color}
            </button>
          ))}
        </div>
      )}

      {/* Result */}
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
            {iWon
              ? 'You read the ink, not the word!'
              : `${opponent?.nickname ?? 'Opponent'} was faster.`}
          </div>
        </div>
      )}
    </div>
  )
}
