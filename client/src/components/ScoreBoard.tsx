import { useRef, useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

export default function ScoreBoard() {
  const {
    players,
    scores,
    myPlayerId,
    currentRound,
    myColor,
    oppColor,
    spectatorCount,
    roomConfig,
  } = useGameStore()
  const winsNeeded = Math.ceil(roomConfig.bestOf / 2)

  const me = players.find((p) => p.id === myPlayerId)
  const opponent = players.find((p) => p.id !== myPlayerId)
  const myScore = scores[myPlayerId] ?? 0
  const oppScore = opponent ? (scores[opponent.id] ?? 0) : 0

  // Track previous scores to detect a point being scored
  const prevScores = useRef({ me: 0, opp: 0 })
  const [myPopKey, setMyPopKey] = useState(0)
  const [oppPopKey, setOppPopKey] = useState(0)

  useEffect(() => {
    if (myScore > prevScores.current.me) setMyPopKey((k) => k + 1)
    if (oppScore > prevScores.current.opp) setOppPopKey((k) => k + 1)
    prevScores.current = { me: myScore, opp: oppScore }
  }, [myScore, oppScore])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '12px 24px',
        background: 'var(--black)',
        borderBottom: 'var(--border)',
      }}
    >
      {/* Me */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          flex: 1,
        }}
      >
        <span
          style={{
            color: '#fff',
            fontWeight: 900,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: 1,
            opacity: 0.7,
          }}
        >
          {me?.nickname ?? 'You'}
        </span>
        <span
          key={myPopKey}
          className={myPopKey > 0 ? 'anim-score-pop' : ''}
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 48,
            color: myColor,
            lineHeight: 1,
            textShadow: '2px 2px 0px rgba(0,0,0,0.5)',
            display: 'inline-block',
          }}
        >
          {myScore}
        </span>
      </div>

      {/* Round info */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          minWidth: 80,
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Round
        </span>
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--white)' }}>
          {currentRound}/{roomConfig.bestOf}
        </span>
        {spectatorCount > 0 ? (
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}>
            👁 {spectatorCount} watching
          </span>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700 }}>
            First to {winsNeeded} wins
          </span>
        )}
      </div>

      {/* Opponent */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
          flex: 1,
        }}
      >
        <span
          style={{
            color: '#fff',
            fontWeight: 900,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: 1,
            opacity: 0.7,
          }}
        >
          {opponent?.nickname ?? '???'}
        </span>
        <span
          key={oppPopKey}
          className={oppPopKey > 0 ? 'anim-score-pop' : ''}
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 48,
            color: oppColor,
            lineHeight: 1,
            textShadow: '2px 2px 0px rgba(0,0,0,0.5)',
            display: 'inline-block',
          }}
        >
          {oppScore}
        </span>
      </div>
    </div>
  )
}
