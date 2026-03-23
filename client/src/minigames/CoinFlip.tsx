import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCoinFlip, playCoinResult } from '../utils/sounds'

type Phase = 'flipping' | 'result'

interface ServerState {
  phase: Phase
  winnerId?: string
}

export default function CoinFlip() {
  const { myPlayerId, players, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected'
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Live mode: driven entirely by server GAME_UPDATE ──────────────────────
  const serverState = isLive ? (minigameState as ServerState | null) : null
  const livePhase = serverState?.phase ?? 'flipping'
  const liveWinnerId = serverState?.winnerId ?? null

  // ── Mock mode: local simulation ───────────────────────────────────────────
  const [mockPhase, setMockPhase] = useState<Phase>('flipping')
  const [mockWinnerId, setMockWinnerId] = useState<string | null>(null)

  useEffect(() => {
    if (isLive) return
    playCoinFlip()
    const t = setTimeout(() => {
      const winnerId = Math.random() < 0.5 ? myPlayerId : (opponent?.id ?? myPlayerId)
      setMockWinnerId(winnerId)
      setMockPhase('result')
    }, 2200)
    return () => clearTimeout(t)
  }, [isLive, myPlayerId, opponent?.id])

  // ── Resolved values ───────────────────────────────────────────────────────
  const phase = isLive ? livePhase : mockPhase
  const winnerId = isLive ? liveWinnerId : mockWinnerId
  const iWon = winnerId === myPlayerId

  // Play sounds on phase transitions
  useEffect(() => {
    if (phase === 'flipping' && isLive) playCoinFlip()
    if (phase === 'result') playCoinResult(iWon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

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
          color: 'var(--yellow)',
          textAlign: 'center',
        }}
      >
        COIN FLIP 🪙
      </div>

      {/* Coin */}
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: '50%',
          border: '5px solid var(--black)',
          boxShadow: '6px 6px 0px var(--black)',
          background: phase === 'flipping' ? 'var(--yellow)' : iWon ? 'var(--green)' : 'var(--red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 72,
          animation:
            phase === 'flipping'
              ? 'coin-flip-3d 0.65s linear infinite'
              : 'bounce-in 0.4s ease both',
          transition: 'background 0.3s',
        }}
      >
        {phase === 'flipping' ? '🪙' : iWon ? '😎' : '💀'}
      </div>

      {/* Result */}
      {phase === 'result' && (
        <div className="anim-bounce" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: iWon ? 'var(--green)' : 'var(--red)',
              WebkitTextStroke: '2px var(--black)',
              textShadow: '3px 3px 0px var(--black)',
            }}
          >
            {iWon ? 'YOU WIN! 🎉' : 'YOU LOSE 😤'}
          </div>
          <div className="subtitle" style={{ opacity: 0.6, marginTop: 8 }}>
            {iWon
              ? 'The coin smiled upon you today.'
              : `${opponent?.nickname ?? 'Opponent'} got lucky this time.`}
          </div>
        </div>
      )}

      {phase === 'flipping' && (
        <div className="subtitle anim-pulse" style={{ opacity: 0.7 }}>
          Flipping…
        </div>
      )}
    </div>
  )
}
