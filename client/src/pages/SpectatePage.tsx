import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { MINIGAME_CONFIGS, type MinigameId } from '@shared/types'
import TimerBar from '../components/TimerBar'

export default function SpectatePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { spectate, wsStatus, roomStatus, disconnect } = useGameStore()

  useEffect(() => {
    if (!roomId) return
    spectate(roomId)
    return () => { disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  if (wsStatus === 'connecting') {
    return (
      <div className="page">
        <div className="subtitle anim-pulse" style={{ opacity: 0.6 }}>Connecting…</div>
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
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 48, color: 'var(--purple)', WebkitTextStroke: '2px var(--black)', textShadow: '3px 3px 0 var(--black)' }}>
          👁 SPECTATING
        </div>
        <div className="subtitle" style={{ opacity: 0.6, marginTop: 8 }}>Room: {roomId}</div>
      </div>

      <div className="card" style={{ textAlign: 'center', minWidth: 320 }}>
        <div className="label" style={{ marginBottom: 16 }}>Players</div>
        {players.length === 0 && (
          <div className="subtitle anim-pulse" style={{ opacity: 0.5 }}>Waiting for players…</div>
        )}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {players.map(p => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 36 }}>😤</div>
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
  const { players, scores, currentRound, currentMinigame, minigameState, roomStatus } = useGameStore()
  const cfg = currentMinigame ? MINIGAME_CONFIGS[currentMinigame] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Spectator banner */}
      <div style={{ background: 'var(--purple)', borderBottom: 'var(--border)', padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 16, color: 'var(--white)', letterSpacing: 2 }}>
          👁 SPECTATING
        </span>
      </div>

      {/* Scoreboard */}
      <SpectateScoreboard players={players} scores={scores} currentRound={currentRound} />

      {/* Minigame label */}
      {cfg && (
        <div style={{ padding: '8px 20px', background: 'var(--orange)', borderBottom: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        {currentMinigame
          ? <SpectateGameState minigameId={currentMinigame} state={minigameState} players={players} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div className="subtitle anim-pulse" style={{ opacity: 0.5 }}>Waiting for next round…</div>
            </div>
        }
      </div>
    </div>
  )
}

function SpectateScoreboard({ players, scores, currentRound }: {
  players: { id: string; nickname: string }[]
  scores: Record<string, number>
  currentRound: number
}) {
  const [p1, p2] = players
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: 'var(--white)', borderBottom: 'var(--border)' }}>
      <PlayerScore nickname={p1?.nickname ?? '…'} score={scores[p1?.id] ?? 0} align="left" color="var(--blue)" />
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 15, opacity: 0.4, textAlign: 'center', lineHeight: 1.3 }}>
        Round<br />{currentRound} / 5
      </div>
      <PlayerScore nickname={p2?.nickname ?? '…'} score={scores[p2?.id] ?? 0} align="right" color="var(--orange)" />
    </div>
  )
}

function PlayerScore({ nickname, score, align, color }: { nickname: string; score: number; align: 'left' | 'right'; color: string }) {
  return (
    <div style={{ textAlign: align, minWidth: 80 }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 36, color, lineHeight: 1 }}>{score}</div>
      <div className="label" style={{ opacity: 0.7 }}>{nickname}</div>
    </div>
  )
}

// ── Per-minigame spectator state ──────────────────────────────────────────────

function SpectateGameState({ minigameId, state, players }: {
  minigameId: MinigameId
  state: unknown
  players: { id: string; nickname: string }[]
}) {
  const [p1, p2] = players

  if (minigameId === 'clickspeed') {
    const s = state as { clicks: Record<string, number> } | null
    return (
      <TwoColState
        p1={{ label: p1?.nickname ?? '…', value: s?.clicks[p1?.id] ?? 0, unit: 'clicks' }}
        p2={{ label: p2?.nickname ?? '…', value: s?.clicks[p2?.id] ?? 0, unit: 'clicks' }}
        color1="var(--blue)" color2="var(--orange)"
      />
    )
  }

  if (minigameId === 'quickmaths') {
    const s = state as { equations: Record<string, { question: string }>; correct: Record<string, number> } | null
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        <MathsPanel nickname={p1?.nickname ?? '…'} equation={s?.equations[p1?.id]?.question ?? '…'} correct={s?.correct[p1?.id] ?? 0} color="var(--blue)" />
        <div style={{ width: 3, background: 'var(--black)', opacity: 0.1 }} />
        <MathsPanel nickname={p2?.nickname ?? '…'} equation={s?.equations[p2?.id]?.question ?? '…'} correct={s?.correct[p2?.id] ?? 0} color="var(--orange)" />
      </div>
    )
  }

  if (minigameId === 'numberguess') {
    const s = state as { phase?: string; guesses?: Record<string, number>; secret?: number } | null
    const p1Guessed = s?.guesses?.[p1?.id] !== undefined
    const p2Guessed = s?.guesses?.[p2?.id] !== undefined
    return (
      <TwoColState
        p1={{ label: p1?.nickname ?? '…', value: p1Guessed ? s!.guesses![p1.id] : '?', unit: p1Guessed ? 'guessed' : 'thinking…' }}
        p2={{ label: p2?.nickname ?? '…', value: p2Guessed ? s!.guesses![p2.id] : '?', unit: p2Guessed ? 'guessed' : 'thinking…' }}
        color1="var(--blue)" color2="var(--orange)"
        extra={s?.phase === 'reveal' && s.secret !== undefined ? `Secret was ${s.secret}` : undefined}
      />
    )
  }

  if (minigameId === 'reactiontest') {
    const s = state as { phase?: string; winnerId?: string } | null
    const phase = s?.phase ?? 'waiting'
    const bg = phase === 'ready' ? 'var(--green)' : phase === 'result' ? '#222' : '#cc2222'
    const label = phase === 'waiting' ? '⚠️ WAIT…' : phase === 'ready' ? '🟢 GO!' : '⏱ Result'
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, transition: 'background 0.2s' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 64, color: 'var(--white)', textShadow: '4px 4px 0 rgba(0,0,0,0.4)' }}>
          {label}
        </div>
      </div>
    )
  }

  if (minigameId === 'coinflip') {
    const s = state as { phase?: string } | null
    const isFlipping = !s || s.phase === 'flipping'
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{
          width: 140, height: 140, borderRadius: '50%',
          border: '5px solid var(--black)', boxShadow: '6px 6px 0 var(--black)',
          background: 'var(--yellow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64,
          animation: isFlipping ? 'coin-spin 0.4s linear infinite' : 'bounce-in 0.4s ease both',
        }}>
          🪙
        </div>
        <div className="subtitle anim-pulse" style={{ opacity: 0.7 }}>{isFlipping ? 'Flipping…' : 'Result!'}</div>
        <style>{`@keyframes coin-spin{0%{transform:scaleX(1)}50%{transform:scaleX(0.1)}100%{transform:scaleX(1)}}`}</style>
      </div>
    )
  }

  return null
}

function TwoColState({ p1, p2, color1, color2, extra }: {
  p1: { label: string; value: number | string; unit: string }
  p2: { label: string; value: number | string; unit: string }
  color1: string; color2: string
  extra?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, flex: 1, padding: 32 }}>
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        <StatPill label={p1.label} value={p1.value} unit={p1.unit} color={color1} />
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 28, opacity: 0.25 }}>vs</span>
        <StatPill label={p2.label} value={p2.value} unit={p2.unit} color={color2} />
      </div>
      {extra && <div className="label" style={{ opacity: 0.6 }}>{extra}</div>}
    </div>
  )
}

function StatPill({ label, value, unit, color }: { label: string; value: number | string; unit: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 64, color, lineHeight: 1 }}>{value}</div>
      <div className="label" style={{ marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 12, opacity: 0.5, fontWeight: 700, marginTop: 2 }}>{unit}</div>
    </div>
  )
}

function MathsPanel({ nickname, equation, correct, color }: { nickname: string; equation: string; correct: number; color: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 52, color, lineHeight: 1 }}>{correct}</div>
      <div className="label" style={{ opacity: 0.6 }}>{nickname}</div>
      <div style={{ background: 'var(--white)', border: 'var(--border)', borderRadius: 16, padding: '16px 28px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 36, color: 'var(--black)' }}>{equation} = ?</div>
      </div>
    </div>
  )
}

// ── Round end overlay ─────────────────────────────────────────────────────────

function SpectateRoundEndOverlay() {
  const { lastRoundWinnerId, players, scores } = useGameStore()
  const winner = players.find(p => p.id === lastRoundWinnerId)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 56, color: 'var(--yellow)', textShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}>
          {winner ? `🏆 ${winner.nickname} wins!` : '🤝 Draw!'}
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 16, justifyContent: 'center' }}>
          {players.map(p => (
            <div key={p.id} style={{ textAlign: 'center', color: 'var(--white)' }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>{scores[p.id] ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 700 }}>{p.nickname}</div>
            </div>
          ))}
        </div>
        <div className="subtitle" style={{ color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>Next round starting…</div>
      </div>
    </div>
  )
}

// ── Match end ─────────────────────────────────────────────────────────────────

function SpectateMatchEnd() {
  const { players, scores, matchWinnerId, disconnect } = useGameStore()
  const navigate = useNavigate()
  const winner = players.find(p => p.id === matchWinnerId)
  const [p1, p2] = players

  function goHome() { disconnect(); navigate('/') }

  return (
    <div className="page">
      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 64, color: 'var(--yellow)', WebkitTextStroke: '2px var(--black)', textShadow: '4px 4px 0 var(--black)', lineHeight: 1 }}>
          🏆 {winner?.nickname ?? 'Someone'} wins!
        </div>
        <div className="subtitle" style={{ marginTop: 12, opacity: 0.6 }}>What a match!</div>
      </div>

      <div className="card" style={{ textAlign: 'center', minWidth: 300 }}>
        <div className="label" style={{ marginBottom: 16 }}>Final Score</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 56, color: 'var(--blue)' }}>{scores[p1?.id] ?? 0}</div>
            <div className="label">{p1?.nickname ?? '…'}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: 32, opacity: 0.3 }}>—</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 56, color: 'var(--orange)' }}>{scores[p2?.id] ?? 0}</div>
            <div className="label">{p2?.nickname ?? '…'}</div>
          </div>
        </div>
      </div>

      <button className="btn btn-white" onClick={goHome}>🏠 Home</button>
    </div>
  )
}

// ── Error ─────────────────────────────────────────────────────────────────────

function SpectateError({ roomId }: { roomId: string }) {
  const navigate = useNavigate()
  return (
    <div className="page">
      <div className="card anim-pop" style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--red)', marginBottom: 8 }}>
          Room not found 😬
        </div>
        <div className="subtitle" style={{ opacity: 0.6, fontSize: 15, marginBottom: 20 }}>
          Room <strong>{roomId}</strong> doesn't exist or has already ended.
        </div>
        <button className="btn btn-orange btn-lg" style={{ width: '100%' }} onClick={() => navigate('/')}>
          🏠 Go Home
        </button>
      </div>
    </div>
  )
}
