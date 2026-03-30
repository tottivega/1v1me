import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { playCoinResult } from '../utils/sounds'
import { type CoinFlipPhase, type CoinFlipState } from '@shared/types'

type Phase = CoinFlipPhase

// Coin spin duration — must match coin-flip-3d and coin-face-* CSS animations
const SPIN_DURATION = '1.4s'

export default function CoinFlip() {
  const { myPlayerId, players, minigameState, isMockMatch } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Live mode: driven entirely by server GAME_UPDATE ──────────────────────
  const serverState = isLive ? (minigameState as CoinFlipState | null) : null
  const livePhase = serverState?.phase ?? 'flipping'
  const liveWinnerId = serverState?.winnerId ?? null

  // ── Mock mode: local simulation ───────────────────────────────────────────
  const [mockPhase, setMockPhase] = useState<Phase>('flipping')
  const [mockWinnerId, setMockWinnerId] = useState<string | null>(null)

  useEffect(() => {
    if (isLive) return
    const t = setTimeout(() => {
      const winnerId = Math.random() < 0.5 ? myPlayerId : (opponent?.id ?? myPlayerId)
      setMockWinnerId(winnerId)
      setMockPhase('result')
    }, 4200)
    return () => clearTimeout(t)
  }, [isLive, myPlayerId, opponent?.id])

  // ── Resolved values ───────────────────────────────────────────────────────
  const phase = isLive ? livePhase : mockPhase
  const winnerId = isLive ? liveWinnerId : mockWinnerId
  const iWon = winnerId === myPlayerId

  // Play result sound on reveal
  useEffect(() => {
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

      {/* Coin — outer ring (always gold) */}
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: '50%',
          border: '5px solid var(--black)',
          boxShadow: '6px 6px 0px var(--black)',
          background: '#c9960a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation:
            phase === 'flipping'
              ? `coin-flip-3d ${SPIN_DURATION} linear infinite`
              : 'bounce-in 0.4s ease both',
        }}
      >
        {/* Shaded rim */}
        <div
          style={{
            width: 152,
            height: 152,
            borderRadius: '50%',
            background: '#a07808',
            boxShadow: 'inset 3px 3px 10px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Inner circle */}
          <div
            style={{
              width: 118,
              height: 118,
              borderRadius: '50%',
              background: '#f5c518',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              position: 'relative',
            }}
          >
            {phase === 'flipping' ? (
              <>
                {/* Front face (😊) and back face (💀) swap via CSS, synced to scaleX */}
                <span
                  style={{
                    position: 'absolute',
                    animation: `coin-face-front ${SPIN_DURATION} linear infinite`,
                  }}
                >
                  😊
                </span>
                <span
                  style={{
                    position: 'absolute',
                    animation: `coin-face-back ${SPIN_DURATION} linear infinite`,
                  }}
                >
                  💀
                </span>
              </>
            ) : (
              <span>{iWon ? '😎' : '💀'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Result text */}
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
