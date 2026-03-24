import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { MINIGAME_CONFIGS, type MinigameId } from '@shared/types'
import TimerBar from '../components/TimerBar'
import { SPECTATOR_COMPONENTS } from '../minigames/spectatorRegistry'

export default function SpectatePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { spectate, wsStatus, roomStatus, disconnect } = useGameStore()

  useEffect(() => {
    if (!roomId) return
    spectate(roomId)
    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (wsStatus === 'connecting') {
    return (
      <div className="page">
        <div className="subtitle anim-pulse" style={{ opacity: 0.6 }}>
          Connecting…
        </div>
      </div>
    )
  }

  if (wsStatus === 'error' || wsStatus === 'disconnected') {
    return <SpectateError roomId={roomId!} />
  }

  if (roomStatus === 'lobby' || roomStatus === 'ready') {
    return <SpectateWaiting roomId={roomId!} />
  }

  if (roomStatus === 'match_end') {
    return <SpectateMatchEnd />
  }

  return <SpectateMatchView />
}

// ── Waiting for match ─────────────────────────────────────────────────────────

function SpectateWaiting({ roomId }: { roomId: string }) {
  const { players } = useGameStore()

  return (
    <div className="page">
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 48,
            color: 'var(--purple)',
            WebkitTextStroke: '2px var(--black)',
            textShadow: '3px 3px 0 var(--black)',
          }}
        >
          👁 SPECTATING
        </div>
        <div className="subtitle" style={{ opacity: 0.6, marginTop: 8 }}>
          Room: {roomId}
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', minWidth: 320 }}>
        <div className="label" style={{ marginBottom: 16 }}>
          Players
        </div>
        {players.length === 0 && (
          <div className="subtitle anim-pulse" style={{ opacity: 0.5 }}>
            Waiting for players…
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {players.map((p) => (
            <div
              key={p.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
            >
              <div style={{ fontSize: 36 }}>{p.avatar ?? '❓'}</div>
              <div style={{ fontWeight: 900 }}>{p.nickname}</div>
              <div className={`badge ${p.ready ? 'badge-green' : 'badge-orange'}`}>
                {p.ready ? '✅ Ready' : '⏳ Not ready'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="badge badge-yellow anim-pulse">Waiting for match to start…</div>
    </div>
  )
}

// ── Live match view ───────────────────────────────────────────────────────────

function SpectateMatchView() {
  const { players, scores, currentRound, currentMinigame, minigameState, roomStatus, roomConfig } =
    useGameStore()
  const cfg = currentMinigame ? MINIGAME_CONFIGS[currentMinigame] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Spectator banner */}
      <div
        style={{
          background: 'var(--purple)',
          borderBottom: 'var(--border)',
          padding: '6px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 16,
            color: 'var(--white)',
            letterSpacing: 2,
          }}
        >
          👁 SPECTATING
        </span>
      </div>

      {/* Scoreboard */}
      <SpectateScoreboard
        players={players}
        scores={scores}
        currentRound={currentRound}
        bestOf={roomConfig.bestOf}
      />

      {/* Minigame label */}
      {cfg && (
        <div
          style={{
            padding: '8px 20px',
            background: 'var(--orange)',
            borderBottom: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--white)' }}>
            {cfg.emoji} {cfg.label}
          </span>
        </div>
      )}

      {/* Timer */}
      {cfg && cfg.timeoutMs > 0 && <TimerBar />}

      {/* Round end overlay */}
      {roomStatus === 'round_end' && <SpectateRoundEndOverlay />}

      {/* Game state */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {currentMinigame ? (
          <SpectateGameState minigameId={currentMinigame} state={minigameState} players={players} />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <div className="subtitle anim-pulse" style={{ opacity: 0.5 }}>
              Waiting for next round…
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SpectateScoreboard({
  players,
  scores,
  currentRound,
  bestOf,
}: {
  players: { id: string; nickname: string; avatar?: string }[]
  scores: Record<string, number>
  currentRound: number
  bestOf: number
}) {
  const [p1, p2] = players
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        background: 'var(--white)',
        borderBottom: 'var(--border)',
      }}
    >
      <PlayerScore
        nickname={p1?.nickname ?? '…'}
        avatar={p1?.avatar}
        score={scores[p1?.id ?? ''] ?? 0}
        align="left"
        color="var(--blue)"
      />
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 15,
          opacity: 0.4,
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        Round
        <br />
        {currentRound} / {bestOf}
      </div>
      <PlayerScore
        nickname={p2?.nickname ?? '…'}
        avatar={p2?.avatar}
        score={scores[p2?.id ?? ''] ?? 0}
        align="right"
        color="var(--orange)"
      />
    </div>
  )
}

function PlayerScore({
  nickname,
  avatar,
  score,
  align,
  color,
}: {
  nickname: string
  avatar?: string
  score: number
  align: 'left' | 'right'
  color: string
}) {
  return (
    <div style={{ textAlign: align, minWidth: 80 }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 36, color, lineHeight: 1 }}>
        {score}
      </div>
      <div className="label" style={{ opacity: 0.7 }}>
        {avatar} {nickname}
      </div>
    </div>
  )
}

// ── Per-minigame spectator state ──────────────────────────────────────────────

function SpectateGameState({
  minigameId,
  state,
  players,
}: {
  minigameId: MinigameId
  state: unknown
  players: { id: string; nickname: string }[]
}) {
  const Comp = SPECTATOR_COMPONENTS[minigameId]
  if (!Comp) return null
  return <Comp state={state} players={players} />
}

// ── Round end overlay ─────────────────────────────────────────────────────────

function SpectateRoundEndOverlay() {
  const { lastRoundWinnerId, players, scores } = useGameStore()
  const winner = players.find((p) => p.id === lastRoundWinnerId)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 56,
            color: 'var(--yellow)',
            textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
          }}
        >
          {winner ? `🏆 ${winner.nickname} wins!` : '🤝 Draw!'}
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 16, justifyContent: 'center' }}>
          {players.map((p) => (
            <div key={p.id} style={{ textAlign: 'center', color: 'var(--white)' }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>
                {scores[p.id] ?? 0}
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 700 }}>{p.nickname}</div>
            </div>
          ))}
        </div>
        <div className="subtitle" style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>
          Next round starting…
        </div>
      </div>
    </div>
  )
}

// ── Match end ─────────────────────────────────────────────────────────────────

function SpectateMatchEnd() {
  const { players, scores, matchWinnerId, disconnect } = useGameStore()
  const navigate = useNavigate()
  const winner = players.find((p) => p.id === matchWinnerId)
  const [p1, p2] = players

  function goHome() {
    disconnect()
    navigate('/')
  }

  return (
    <div className="page">
      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 64,
            color: 'var(--yellow)',
            WebkitTextStroke: '2px var(--black)',
            textShadow: '4px 4px 0 var(--black)',
            lineHeight: 1,
          }}
        >
          🏆 {winner?.nickname ?? 'Someone'} wins!
        </div>
        <div className="subtitle" style={{ marginTop: 12, opacity: 0.6 }}>
          What a match!
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', minWidth: 300 }}>
        <div className="label" style={{ marginBottom: 16 }}>
          Final Score
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 56, color: 'var(--blue)' }}>
              {scores[p1?.id ?? ''] ?? 0}
            </div>
            <div className="label">{p1?.nickname ?? '…'}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: 32, opacity: 0.3 }}>—</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 56, color: 'var(--orange)' }}>
              {scores[p2?.id ?? ''] ?? 0}
            </div>
            <div className="label">{p2?.nickname ?? '…'}</div>
          </div>
        </div>
      </div>

      <button className="btn btn-white" onClick={goHome}>
        🏠 Home
      </button>
    </div>
  )
}

// ── Error ─────────────────────────────────────────────────────────────────────

function SpectateError({ roomId }: { roomId: string }) {
  const navigate = useNavigate()
  return (
    <div className="page">
      <div className="card anim-pop" style={{ textAlign: 'center', maxWidth: 360 }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 28,
            color: 'var(--red)',
            marginBottom: 8,
          }}
        >
          Room not found 😬
        </div>
        <div className="subtitle" style={{ opacity: 0.6, fontSize: 15, marginBottom: 20 }}>
          Room <strong>{roomId}</strong> doesn't exist or has already ended.
        </div>
        <button
          className="btn btn-orange btn-lg"
          style={{ width: '100%' }}
          onClick={() => navigate('/')}
        >
          🏠 Go Home
        </button>
      </div>
    </div>
  )
}
