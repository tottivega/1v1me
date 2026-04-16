import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCorrect, playWrong, playClick } from '../utils/sounds'
import { type ColorWordColor, type ColorWordState } from '@shared/types'

type Color = ColorWordColor

// Exact same hex values as Kaboom wire colors — indices 0-7
const COLOR_HEX: Record<Color, string> = {
  red: '#e53935',
  orange: '#fb8c00',
  yellow: '#fdd835',
  green: '#43a047',
  blue: '#1e88e5',
  purple: '#8e24aa',
  pink: '#f06292',
  white: '#ffffff',
}

const ALL_COLORS: Color[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white']

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
  const myPuzzle = server?.puzzles?.[myPlayerId] ?? null
  const [picked, setPicked] = useState<Color | null>(null)

  // Clear picked when server sends my new puzzle
  useEffect(() => {
    setPicked(null)
  }, [myPuzzle?.seq])

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
  const word = isLive ? (myPuzzle?.word ?? null) : (mockPuzzle?.word ?? null)
  const inkColor = isLive ? (myPuzzle?.inkColor ?? null) : (mockPuzzle?.ink ?? null)
  const puzzleSeq = isLive ? (myPuzzle?.seq ?? 0) : null
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
      if (color === word) playCorrect()
      else playWrong()
      sendInput({ type: 'PICK_COLOR', color })
    } else {
      if (!mockPuzzle || endedRef.current) return
      const correct = color === mockPuzzle.word
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
          CLICK THE WORD 🧠
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 64px)',
            gap: 10,
          }}
        >
          {ALL_COLORS.map((color) => (
            <button
              key={color}
              aria-label={color}
              disabled
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                border: '3px solid var(--black)',
                background: COLOR_HEX[color],
                opacity: 0.3,
                cursor: 'default',
              }}
            />
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
        CLICK THE WORD 🧠
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
            Click what the word <em>says</em> — ignore the color it's written in!
          </p>

          {/* Color word — key forces re-mount animation on each new puzzle */}
          <div
            key={isLive ? puzzleSeq : `${word}-${inkColor}`}
            className="anim-pop"
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 72,
              color: COLOR_HEX[inkColor!],
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
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 64px)',
              gap: 10,
            }}
          >
            {ALL_COLORS.map((color) => (
              <button
                key={color}
                aria-label={color}
                onClick={() => handlePick(color)}
                disabled={isLive && !!picked}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  border: '3px solid var(--black)',
                  boxShadow: picked === color ? 'none' : '3px 3px 0 var(--black)',
                  background: COLOR_HEX[color],
                  cursor: isLive && picked ? 'default' : 'pointer',
                  opacity: isLive && picked && color !== picked ? 0.4 : 1,
                  transform: picked === color ? 'translate(3px, 3px)' : 'none',
                  transition: 'opacity 0.1s, box-shadow 0.08s, transform 0.06s',
                }}
              />
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
