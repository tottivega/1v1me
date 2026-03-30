import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong, playClick } from '../utils/sounds'
import { type ColorWordColor, type ColorWordState } from '@shared/types'

type Color = ColorWordColor

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

function generatePuzzle(): { word: Color; ink: Color } {
  const word = ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)]!
  const others = ALL_COLORS.filter((c) => c !== word)
  const ink = others[Math.floor(Math.random() * others.length)]!
  return { word, ink }
}

export default function ColorWord() {
  const { myPlayerId, players, minigameState, isMockMatch, sendInput } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Live mode ─────────────────────────────────────────────────────────────
  const server = isLive ? (minigameState as ColorWordState | null) : null
  const [picked, setPicked] = useState<Color | null>(null)

  // Clear picked when server sends a new puzzle
  useEffect(() => {
    setPicked(null)
  }, [server?.puzzleSeq])

  // ── Mock mode ─────────────────────────────────────────────────────────────
  const [mockPuzzle, setMockPuzzle] = useState<{ word: Color; ink: Color } | null>(null)
  const [mockScores, setMockScores] = useState({ my: 0, opp: 0 })
  const [mockWinnerId, setMockWinnerId] = useState<string | null>(null)

  // Refs to avoid stale closures in timers
  const mockScoresRef = useRef({ my: 0, opp: 0 })
  const mockFirstTimesRef = useRef<{ my: Record<number, number>; opp: Record<number, number> }>({
    my: {},
    opp: {},
  })
  const mockInkRef = useRef<Color | null>(null)
  const endedRef = useRef(false)
  const oppTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isLive) return

    endedRef.current = false
    mockScoresRef.current = { my: 0, opp: 0 }
    mockFirstTimesRef.current = { my: {}, opp: {} }
    setMockScores({ my: 0, opp: 0 })
    setMockWinnerId(null)

    const first = generatePuzzle()
    setMockPuzzle(first)
    mockInkRef.current = first.ink

    // Mock opponent picks every 1.2–2s with 75% accuracy
    function scheduleOppPick() {
      oppTimerRef.current = setTimeout(
        () => {
          if (endedRef.current) return
          if (Math.random() < 0.75) {
            mockScoresRef.current.opp++
            const s = mockScoresRef.current.opp
            if (!mockFirstTimesRef.current.opp[s]) {
              mockFirstTimesRef.current.opp[s] = Date.now()
            }
            setMockScores({ ...mockScoresRef.current })
          }
          scheduleOppPick()
        },
        1200 + Math.random() * 800
      )
    }
    scheduleOppPick()

    // 30s game timer
    const gameTimer = setTimeout(() => {
      endedRef.current = true
      if (oppTimerRef.current) clearTimeout(oppTimerRef.current)

      const { my, opp } = mockScoresRef.current
      let winnerId: string
      if (my > opp) {
        winnerId = myPlayerId
      } else if (opp > my) {
        winnerId = opponent?.id ?? myPlayerId
      } else {
        const myFirst = mockFirstTimesRef.current.my[my] ?? Infinity
        const oppFirst = mockFirstTimesRef.current.opp[opp] ?? Infinity
        winnerId = myFirst <= oppFirst ? myPlayerId : (opponent?.id ?? myPlayerId)
      }
      setMockWinnerId(winnerId)
    }, 30000)

    return () => {
      endedRef.current = true
      clearTimeout(gameTimer)
      if (oppTimerRef.current) clearTimeout(oppTimerRef.current)
    }
  }, [isLive, myPlayerId, opponent?.id])

  // ── Unified values ────────────────────────────────────────────────────────
  const word = isLive ? (server?.word ?? null) : (mockPuzzle?.word ?? null)
  const inkColor = isLive ? (server?.inkColor ?? null) : (mockPuzzle?.ink ?? null)
  const myScore = isLive ? (server?.scores?.[myPlayerId] ?? 0) : mockScores.my
  const oppScore = isLive ? (server?.scores?.[opponent?.id ?? ''] ?? 0) : mockScores.opp
  const winnerId = isLive ? (server?.winnerId ?? null) : mockWinnerId
  const resolved = winnerId !== null
  const iWon = winnerId === myPlayerId

  function handlePick(color: Color) {
    if (resolved) return
    if (isLive) {
      if (picked) return // already waiting for server response
      setPicked(color)
      if (color === inkColor) playCorrect()
      else playWrong()
      sendInput({ type: 'PICK_COLOR', color })
    } else {
      if (!mockPuzzle || endedRef.current) return
      const correct = color === mockInkRef.current
      if (correct) {
        playCorrect()
        mockScoresRef.current.my++
        const s = mockScoresRef.current.my
        if (!mockFirstTimesRef.current.my[s]) mockFirstTimesRef.current.my[s] = Date.now()
      } else {
        playWrong()
      }
      playClick()
      setMockScores({ ...mockScoresRef.current })
      const next = generatePuzzle()
      setMockPuzzle(next)
      mockInkRef.current = next.ink
    }
  }

  // Loading state — puzzle not yet received from server
  if (!word || !inkColor) {
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
              disabled
              style={{
                width: 90,
                height: 52,
                borderRadius: 8,
                border: '3px solid var(--black)',
                background: COLOR_STYLES[color].bg,
                color: COLOR_STYLES[color].fg,
                fontWeight: 900,
                fontSize: 13,
                textTransform: 'uppercase',
                opacity: 0.3,
                cursor: 'default',
              }}
            >
              {color}
            </button>
          ))}
        </div>
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
        gap: 24,
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

      {/* Live scores */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        <ScoreChip label="You" score={myScore} color="var(--blue)" />
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 22, opacity: 0.35 }}>VS</span>
        <ScoreChip label={opponent?.nickname ?? '???'} score={oppScore} color="var(--orange)" />
      </div>

      {!resolved && (
        <>
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

          {/* Color word — key forces re-mount animation on each new puzzle */}
          <div
            key={`${word}-${inkColor}`}
            className="anim-pop"
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
                onClick={() => handlePick(color)}
                disabled={isLive && !!picked}
                style={{
                  width: 90,
                  height: 52,
                  borderRadius: 8,
                  border: '3px solid var(--black)',
                  boxShadow: picked === color ? 'none' : '3px 3px 0 var(--black)',
                  background: COLOR_STYLES[color].bg,
                  color: COLOR_STYLES[color].fg,
                  fontWeight: 900,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  cursor: isLive && picked ? 'default' : 'pointer',
                  opacity: isLive && picked && color !== picked ? 0.4 : 1,
                  transition: 'opacity 0.1s, box-shadow 0.08s',
                }}
              >
                {color}
              </button>
            ))}
          </div>
        </>
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
              ? `${myScore} correct — you read the ink!`
              : `${oppScore} vs ${myScore}. ${opponent?.nickname ?? 'Opponent'} was sharper.`}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreChip({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 48, color, lineHeight: 1 }}>
        {score}
      </div>
      <div className="label">{label}</div>
    </div>
  )
}
