import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { useGameStore, getStreak } from '../store/gameStore'
import ScoreBoard from '../components/ScoreBoard'
import TimerBar from '../components/TimerBar'
import { MINIGAME_CONFIGS, type MinigameCategory, type RoomConfig } from '@shared/types'
import { MINIGAME_COMPONENTS } from '../minigames/registry'
import {
  playClick,
  playReady,
  playRoundWin,
  playRoundLose,
  playMatchWin,
  playMatchLose,
  playTick,
} from '../utils/sounds'

function getSavedSession(): { roomId: string; playerId: string } | null {
  try {
    return JSON.parse(localStorage.getItem('1v1me_session') ?? 'null')
  } catch {
    return null
  }
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const {
    roomStatus,
    myNickname,
    wsStatus,
    roomNotFound,
    connect,
    reconnectSaved,
    currentMinigame,
    currentRound,
    matchWinnerId,
    myPlayerId,
  } = useGameStore()
  const navigate = useNavigate()
  const [rematchFlash, setRematchFlash] = useState(false)
  const prevStatus = useRef<string>(roomStatus)

  // Document title — reflects current room state
  useEffect(() => {
    const base = '1v1 ME'
    if (roomStatus === 'lobby' || roomStatus === 'ready') {
      document.title = roomId ? `Lobby · ${roomId} · ${base}` : `Lobby · ${base}`
    } else if (roomStatus === 'match_end') {
      const iWon = matchWinnerId === myPlayerId
      document.title = iWon ? `You won! 🏆 · ${base}` : `You lost 💀 · ${base}`
    } else if (currentMinigame) {
      const cfg = MINIGAME_CONFIGS[currentMinigame]
      document.title = cfg
        ? `Round ${currentRound} · ${cfg.label} · ${base}`
        : `Round ${currentRound} · ${base}`
    } else {
      document.title = base
    }
    return () => {
      document.title = base
    }
  }, [roomStatus, roomId, currentMinigame, currentRound, matchWinnerId, myPlayerId])

  // Detect match_end → lobby transition = rematch accepted
  useEffect(() => {
    if (prevStatus.current === 'match_end' && (roomStatus === 'lobby' || roomStatus === 'ready')) {
      setRematchFlash(true)
      const t = setTimeout(() => setRematchFlash(false), 900)
      return () => clearTimeout(t)
    }
    prevStatus.current = roomStatus
  }, [roomStatus])

  // Connect (or reconnect) whenever roomId changes
  useEffect(() => {
    if (!roomId) return
    const saved = getSavedSession()
    if (saved && saved.roomId === roomId) {
      reconnectSaved(roomId, saved.playerId)
    } else if (myNickname) {
      connect(roomId, myNickname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // Room not found
  if (roomNotFound) {
    return (
      <div className="page" style={{ textAlign: 'center', gap: 24 }}>
        <div style={{ fontSize: 72 }}>🚪</div>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 36,
            color: 'var(--red)',
            WebkitTextStroke: '2px var(--black)',
            textShadow: '3px 3px 0 var(--black)',
          }}
        >
          Room Not Found
        </div>
        <p className="subtitle" style={{ opacity: 0.6, maxWidth: 320 }}>
          The room <strong>{roomId}</strong> doesn't exist or has already ended.
        </p>
        <button className="btn btn-orange btn-lg" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
      </div>
    )
  }

  // No nickname yet (direct URL visit) → show a quick name gate
  if (!myNickname) return <NicknameGate roomId={roomId!} />

  if (roomStatus === 'lobby' || roomStatus === 'ready')
    return (
      <>
        {rematchFlash && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
              pointerEvents: 'none',
            }}
          >
            <div
              className="anim-bounce"
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 72,
                color: 'var(--orange)',
                WebkitTextStroke: '3px var(--black)',
                textShadow: '5px 5px 0 var(--black)',
              }}
            >
              🔥 REMATCH!
            </div>
          </div>
        )}
        <LobbyView roomId={roomId!} />
      </>
    )
  if (roomStatus === 'match_end') return <MatchEndView />

  // Connecting overlay while WS is establishing
  if (wsStatus === 'connecting') {
    return (
      <div className="page">
        <div className="subtitle anim-pulse" style={{ opacity: 0.6 }}>
          Connecting…
        </div>
      </div>
    )
  }

  return <MatchView />
}

// ── Nickname gate (direct URL visits) ────────────────────────────────────────

function getSavedNickname() {
  try {
    return localStorage.getItem('nickname') ?? ''
  } catch {
    return ''
  }
}

function NicknameGate({ roomId }: { roomId: string }) {
  const [name, setName] = useState(getSavedNickname)
  const navigate = useNavigate()
  const { setNickname, connect } = useGameStore()

  function join() {
    if (!name.trim()) return
    try {
      localStorage.setItem('nickname', name.trim())
    } catch {}
    setNickname(name.trim())
    connect(roomId, name.trim())
  }

  return (
    <div className="page">
      <div
        className="card anim-pop"
        style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--orange)' }}>
          You've been challenged! ⚔️
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="label">Pick a nickname</label>
          <input
            className="input"
            placeholder="e.g. CoolDude99"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            maxLength={18}
            autoFocus
          />
        </div>
        <button className="btn btn-orange btn-lg" style={{ width: '100%' }} onClick={join}>
          ⚔️ Join Room
        </button>
        <button className="btn btn-white btn-sm" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>
    </div>
  )
}

// ── Lobby ─────────────────────────────────────────────────────────────────────

function LobbyView({ roomId }: { roomId: string }) {
  const {
    players,
    myPlayerId,
    setReady,
    mockAddOpponent,
    wsStatus,
    spectatorCount,
    roomConfig,
    sendRoomConfig,
  } = useGameStore()
  const me = players.find((p) => p.id === myPlayerId)
  const opponent = players.find((p) => p.id !== myPlayerId)
  const isCreator = players[0]?.id === myPlayerId
  const locked = !!(me?.ready || opponent?.ready)
  const inviteUrl = `${window.location.origin}/room/${roomId}`

  // Copy flash
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  function copyLink() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Idle timeout warning — server deletes room after 60s of inactivity
  const [idleSecsLeft, setIdleSecsLeft] = useState<number | null>(null)
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function resetIdleTimer() {
    if (idleRef.current) clearTimeout(idleRef.current)
    if (idleTickRef.current) clearInterval(idleTickRef.current)
    setIdleSecsLeft(null)
    // Show warning after 50s; room dies at 60s
    idleRef.current = setTimeout(() => {
      setIdleSecsLeft(10)
      idleTickRef.current = setInterval(() => {
        setIdleSecsLeft((s) => (s !== null && s > 1 ? s - 1 : s))
      }, 1000)
    }, 50_000)
  }

  useEffect(() => {
    resetIdleTimer()
    return () => {
      if (idleRef.current) clearTimeout(idleRef.current)
      if (idleTickRef.current) clearInterval(idleTickRef.current)
    }
  }, [opponent?.id, me?.ready, opponent?.ready])

  // Space / Enter to ready up
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== ' ' && e.key !== 'Enter') return
      if (!opponent || me?.ready) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      e.preventDefault()
      playReady()
      setReady()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opponent, me?.ready, setReady])

  return (
    <div className="page">
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 52,
            color: 'var(--orange)',
            WebkitTextStroke: '2px var(--black)',
            textShadow: '3px 3px 0 var(--black)',
          }}
        >
          WAITING ROOM
        </div>
        <div className="subtitle" style={{ opacity: 0.6, marginTop: 4 }}>
          Share the link to challenge someone!
        </div>
      </div>

      {/* Connection badge */}
      <div
        className={`badge ${wsStatus === 'connected' ? 'badge-green' : wsStatus === 'connecting' ? 'badge-yellow' : 'badge-red'}`}
      >
        {wsStatus === 'connected'
          ? '🟢 Connected'
          : wsStatus === 'connecting'
            ? '⏳ Connecting…'
            : '🔴 Disconnected'}
      </div>

      {/* Room code */}
      <div
        className="card"
        style={{
          textAlign: 'center',
          width: '100%',
          maxWidth: 460,
          gap: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="label">Room code</div>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 48,
            letterSpacing: 8,
            color: 'var(--black)',
            background: 'var(--bg)',
            border: 'var(--border)',
            borderRadius: 12,
            padding: '12px 20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {roomId}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-yellow" onClick={copyLink} style={{ flex: 1 }}>
            {copied ? '✅ Copied!' : '📋 Copy Invite Link'}
          </button>
          <button
            className="btn btn-white btn-sm"
            onClick={() => {
              playClick()
              setQrOpen((v) => !v)
            }}
            title="Show QR code"
          >
            {qrOpen ? '✕ QR' : '📱 QR'}
          </button>
          <button
            className="btn btn-white btn-sm"
            onClick={() => {
              playClick()
              navigator.clipboard.writeText(`${window.location.origin}/spectate/${roomId}`)
            }}
            title="Copy spectator link"
          >
            👁 Spectate
          </button>
        </div>
        {qrOpen && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '12px 0 4px',
              animation: 'pop-in 0.2s ease both',
            }}
          >
            <div
              style={{
                background: '#fff',
                border: 'var(--border)',
                borderRadius: 12,
                padding: 12,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <QRCodeSVG value={inviteUrl} size={160} />
            </div>
            <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 700, margin: 0 }}>
              Scan to join this room
            </p>
          </div>
        )}
      </div>

      {/* Room settings */}
      <RoomSettings
        config={roomConfig}
        isCreator={isCreator}
        locked={locked}
        onChange={sendRoomConfig}
      />

      {/* Player slots */}
      <div style={{ display: 'flex', gap: 16, width: '100%', maxWidth: 460 }}>
        <PlayerSlot player={me ?? null} />
        <PlayerSlot player={opponent ?? null} />
      </div>

      {/* Spectator count */}
      {spectatorCount > 0 && (
        <div className="badge badge-yellow" style={{ fontSize: 13 }}>
          👁 {spectatorCount} watching
        </div>
      )}

      {/* Idle timeout warning */}
      {idleSecsLeft !== null && (
        <div className="badge badge-red anim-pulse" style={{ fontSize: 13 }}>
          ⏰ Room expires in {idleSecsLeft}s
        </div>
      )}

      {/* Dev: simulate opponent when not connected to server */}
      {!opponent && wsStatus !== 'connected' && import.meta.env.DEV && (
        <button className="btn btn-white btn-sm" onClick={mockAddOpponent}>
          [DEV] Simulate opponent join
        </button>
      )}

      {/* Ready button — only show when opponent is present */}
      {opponent && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button
            className={`btn btn-lg ${me?.ready ? 'btn-green' : 'btn-orange'}`}
            onClick={() => {
              playReady()
              setReady()
            }}
            disabled={me?.ready}
          >
            {me?.ready ? '✅ Ready!' : '⚔️ Ready Up!'}
          </button>
          {me?.ready && !opponent.ready && (
            <div className="subtitle anim-pulse" style={{ opacity: 0.6, fontSize: 15 }}>
              Waiting for {opponent.nickname}…
            </div>
          )}
          {me?.ready && opponent.ready && (
            <div className="badge badge-green anim-pulse">Both ready! Starting…</div>
          )}
        </div>
      )}

      {!opponent && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="subtitle anim-pulse" style={{ opacity: 0.5 }}>
            Waiting for your opponent to join…
          </div>
          <button className="btn btn-yellow btn-sm" onClick={copyLink}>
            {copied ? '✓ Copied!' : '📋 Share this link to invite a friend'}
          </button>
        </div>
      )}

      {/* Game preview */}
      <LobbyGamePreview />
    </div>
  )
}

const CATEGORY_COLORS: Record<MinigameCategory, string> = {
  reflex: 'var(--blue)',
  math: 'var(--orange)',
  luck: 'var(--yellow)',
  strategy: 'var(--green)',
  trivia: 'var(--purple)',
}

// Dark-tinted backgrounds for the round transition overlay — dark enough to read white text
const CATEGORY_OVERLAY_BG: Record<MinigameCategory, string> = {
  reflex: 'rgba(20,  60, 160, 0.92)',
  math: 'rgba(160, 70,  10, 0.92)',
  luck: 'rgba(130, 110,  0, 0.92)',
  strategy: 'rgba(10,  100, 45, 0.92)',
  trivia: 'rgba(80,  20, 130, 0.92)',
}

const ALL_CATEGORIES: MinigameCategory[] = ['reflex', 'math', 'luck', 'strategy', 'trivia']
const BEST_OF_OPTIONS = [3, 5, 7, 9] as const

const CATEGORY_LABEL: Record<MinigameCategory, string> = {
  reflex: '⚡ Reflex',
  math: '🔢 Math',
  luck: '🎲 Luck',
  strategy: '🧠 Strategy',
  trivia: '🔤 Trivia',
}

function RoomSettings({
  config,
  isCreator,
  locked,
  onChange,
}: {
  config: RoomConfig
  isCreator: boolean
  locked: boolean
  onChange: (cfg: RoomConfig) => void
}) {
  const interactive = isCreator && !locked

  function setBestOf(n: 3 | 5 | 7 | 9) {
    if (!interactive) return
    onChange({ ...config, bestOf: n })
  }

  function toggleCategory(cat: MinigameCategory) {
    if (!interactive) return
    const enabled = config.enabledCategories.includes(cat)
    // Must keep at least one category
    if (enabled && config.enabledCategories.length === 1) return
    const next = enabled
      ? config.enabledCategories.filter((c) => c !== cat)
      : [...config.enabledCategories, cat]
    onChange({ ...config, enabledCategories: next })
  }

  return (
    <div
      className="card"
      style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div className="label" style={{ fontSize: 11, opacity: 0.6 }}>
        MATCH SETTINGS {!isCreator && <span style={{ fontWeight: 400 }}>(set by host)</span>}
        {locked && <span style={{ fontWeight: 400 }}> — locked</span>}
      </div>

      {/* Best-of selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--black)' }}>Best of</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {BEST_OF_OPTIONS.map((n) => (
            <button
              key={n}
              className={`btn btn-sm ${config.bestOf === n ? 'btn-orange' : 'btn-white'}`}
              style={{ flex: 1, opacity: interactive || config.bestOf === n ? 1 : 0.5 }}
              onClick={() => setBestOf(n)}
              disabled={!interactive}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--black)' }}>Game types</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_CATEGORIES.map((cat) => {
            const on = config.enabledCategories.includes(cat)
            return (
              <button
                key={cat}
                className={`btn btn-sm ${on ? 'btn-white' : 'btn-white'}`}
                style={{
                  opacity: interactive ? 1 : on ? 1 : 0.35,
                  background: on ? CATEGORY_COLORS[cat] : 'var(--cream)',
                  color: on && cat !== 'luck' ? 'var(--white)' : 'var(--black)',
                  border: '2px solid var(--black)',
                  fontWeight: 800,
                  fontSize: 11,
                }}
                onClick={() => toggleCategory(cat)}
                disabled={!interactive}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Game pool summary */}
      {(() => {
        const count = Object.values(MINIGAME_CONFIGS).filter(
          (cfg) =>
            config.enabledCategories.length === 0 || config.enabledCategories.includes(cfg.category)
        ).length
        return (
          <div
            style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 700, textAlign: 'right' }}
          >
            {count} game{count !== 1 ? 's' : ''} in pool · best of {config.bestOf}
          </div>
        )
      })()}
    </div>
  )
}

function LobbyGamePreview() {
  const { roomConfig } = useGameStore()
  const enabledCategories = roomConfig.enabledCategories
  const games = Object.entries(MINIGAME_CONFIGS).filter(
    ([, cfg]) => enabledCategories.length === 0 || enabledCategories.includes(cfg.category)
  )
  return (
    <div style={{ width: '100%', maxWidth: 460 }}>
      <div
        className="label"
        style={{ textAlign: 'center', marginBottom: 10, fontSize: 12, opacity: 0.6 }}
      >
        ⚔️ YOU MIGHT FACE…
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 8,
        }}
      >
        {games.map(([id, cfg]) => (
          <div
            key={id}
            style={{
              background: 'var(--white)',
              border: 'var(--border)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-sm)',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
              <span
                style={{
                  background: CATEGORY_COLORS[cfg.category],
                  color: cfg.category === 'luck' ? 'var(--black)' : 'var(--white)',
                  fontSize: 8,
                  fontWeight: 900,
                  padding: '2px 5px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  border: '1.5px solid var(--black)',
                }}
              >
                {cfg.category}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 13,
                color: 'var(--black)',
                lineHeight: 1.1,
              }}
            >
              {cfg.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayerSlot({
  player,
}: {
  player: {
    nickname: string
    avatar: string
    ready: boolean
    connected: boolean
    streak?: number
  } | null
}) {
  return (
    <div
      style={{
        flex: 1,
        background: player ? 'var(--white)' : 'rgba(0,0,0,0.04)',
        border: `3px solid ${player ? 'var(--black)' : 'rgba(0,0,0,0.15)'}`,
        borderRadius: 16,
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        boxShadow: player ? 'var(--shadow)' : 'none',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ fontSize: 44 }}>{player ? player.avatar : '❓'}</div>
      {/* Nickname + live dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {player && (
          <span
            className={player.connected ? 'anim-pulse' : ''}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: player.connected ? 'var(--green)' : 'rgba(0,0,0,0.2)',
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontWeight: 900,
            fontSize: 16,
            color: player ? 'var(--black)' : 'rgba(0,0,0,0.3)',
          }}
        >
          {player ? player.nickname : 'Waiting…'}
        </span>
        {player?.streak != null && player.streak >= 2 && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              background: 'var(--orange)',
              color: 'var(--white)',
              border: '2px solid var(--black)',
              borderRadius: 8,
              padding: '1px 6px',
            }}
          >
            🔥 {player.streak}
          </span>
        )}
      </div>
      {player && (
        <div className={`badge ${player.ready ? 'badge-green' : 'badge-orange'}`}>
          {player.ready ? '✅ Ready' : '⏳ Not ready'}
        </div>
      )}
    </div>
  )
}

// ── Match ─────────────────────────────────────────────────────────────────────

const EMOTES = ['😂', '🔥', '💀', '👏']

function MatchView() {
  const {
    currentMinigame,
    roomStatus,
    currentRound,
    reconnectCountdown,
    players,
    myPlayerId,
    scores,
    roomConfig,
    send,
    incomingEmote,
  } = useGameStore()
  const MinigameComp = currentMinigame ? MINIGAME_COMPONENTS[currentMinigame] : null
  const cfg = currentMinigame ? MINIGAME_CONFIGS[currentMinigame] : null

  const [showTransition, setShowTransition] = useState(false)
  const [transitionData, setTransitionData] = useState<{
    round: number
    cfg: typeof cfg
    matchPointFor: string | null // playerId if someone is on match point, else null
    isFinalRound: boolean
  } | null>(null)
  const [countNum, setCountNum] = useState<number | null>(null)
  const prevRound = useRef(0)

  useEffect(() => {
    if (currentRound !== prevRound.current && currentMinigame && cfg) {
      prevRound.current = currentRound
      const winsNeeded = Math.ceil(roomConfig.bestOf / 2)
      const opponent = players.find((p) => p.id !== myPlayerId)
      const myWins = scores[myPlayerId] ?? 0
      const oppWins = opponent ? (scores[opponent.id] ?? 0) : 0
      const matchPointFor =
        myWins === winsNeeded - 1
          ? myPlayerId
          : oppWins === winsNeeded - 1
            ? (opponent?.id ?? null)
            : null
      const isFinalRound = currentRound === roomConfig.bestOf
      setTransitionData({ round: currentRound, cfg, matchPointFor, isFinalRound })
      setShowTransition(true)
      setCountNum(null)
      const t1 = setTimeout(() => {
        setCountNum(3)
        playTick()
      }, 350)
      const t2 = setTimeout(() => {
        setCountNum(2)
        playTick()
      }, 900)
      const t3 = setTimeout(() => {
        setCountNum(1)
        playTick(true)
      }, 1450)
      const t4 = setTimeout(() => {
        setCountNum(0) // 0 = "GO!"
      }, 1900)
      const t5 = setTimeout(() => {
        setShowTransition(false)
        setCountNum(null)
      }, 2300)
      return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound, currentMinigame])

  // Emote keyboard shortcuts (1/2/3/4)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const idx = ['1', '2', '3', '4'].indexOf(e.key)
      if (idx === -1) return
      const emote = EMOTES[idx]
      if (!emote) return
      playClick()
      send('EMOTE', { emote })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send])

  // How-to-play tooltip
  const [showTooltip, setShowTooltip] = useState(false)
  useEffect(() => {
    setShowTooltip(false)
  }, [currentMinigame])
  useEffect(() => {
    if (!showTooltip) return
    const t = setTimeout(() => setShowTooltip(false), 4000)
    return () => clearTimeout(t)
  }, [showTooltip])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <ScoreBoard />

      {/* Minigame label banner */}
      {cfg && (
        <div
          style={{
            position: 'relative',
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
          {/* How to play */}
          <button
            onClick={() => setShowTooltip((v) => !v)}
            style={{
              position: 'absolute',
              right: 12,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              border: '2px solid rgba(255,255,255,0.6)',
              color: 'var(--white)',
              fontWeight: 900,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ?
          </button>
          {showTooltip && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 8,
                zIndex: 50,
                background: 'var(--black)',
                color: 'var(--white)',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '10px 14px',
                maxWidth: 240,
                fontWeight: 700,
                fontSize: 13,
                lineHeight: 1.5,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              {cfg.description}
            </div>
          )}
        </div>
      )}

      {/* Timer — only show for games with a countdown */}
      {cfg && cfg.timeoutMs > 0 && <TimerBar />}

      {/* Round transition overlay */}
      {roomStatus === 'round_end' && <RoundEndOverlay />}

      {/* Reconnect waiting overlay */}
      {roomStatus === 'reconnecting' &&
        (() => {
          const disconnected = players.find((p) => p.id !== myPlayerId && !p.connected)
          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 105,
                background: 'rgba(0,0,0,0.82)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                pointerEvents: 'none',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: 48,
                    color: 'var(--yellow)',
                    textShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  ⏳ Connection lost
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 700,
                    fontSize: 18,
                    marginTop: 8,
                  }}
                >
                  {disconnected
                    ? `${disconnected.nickname} disconnected…`
                    : 'Opponent disconnected…'}
                </div>
                {reconnectCountdown !== null && (
                  <div
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: 72,
                      color: reconnectCountdown <= 5 ? 'var(--red)' : 'var(--white)',
                      marginTop: 16,
                      textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                      transition: 'color 0.3s',
                    }}
                  >
                    {reconnectCountdown}
                  </div>
                )}
                <div
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 700,
                    fontSize: 14,
                    marginTop: 8,
                  }}
                >
                  Game paused — waiting for reconnect
                </div>
              </div>
            </div>
          )
        })()}

      {/* Round count-in overlay */}
      {showTransition && transitionData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: CATEGORY_OVERLAY_BG[transitionData.cfg!.category],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            pointerEvents: 'all',
            cursor: 'default',
          }}
        >
          <div className="anim-pop" style={{ textAlign: 'center' }}>
            {/* Match point / final round label */}
            {(transitionData.matchPointFor || transitionData.isFinalRound) && (
              <div
                className="badge anim-pulse"
                style={{
                  background:
                    transitionData.matchPointFor === myPlayerId
                      ? 'var(--green)'
                      : transitionData.isFinalRound
                        ? 'var(--yellow)'
                        : 'var(--red)',
                  color:
                    transitionData.isFinalRound && !transitionData.matchPointFor
                      ? 'var(--black)'
                      : 'var(--white)',
                  fontSize: 13,
                  letterSpacing: 2,
                  marginBottom: 12,
                  display: 'inline-block',
                }}
              >
                {transitionData.matchPointFor === myPlayerId
                  ? '🏆 MATCH POINT'
                  : transitionData.matchPointFor
                    ? '⚠️ THEIR MATCH POINT'
                    : '⚡ FINAL ROUND'}
              </div>
            )}
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 18,
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: 4,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Round {transitionData.round} of {roomConfig.bestOf}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 60,
                color: 'var(--yellow)',
                textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
              }}
            >
              {transitionData.cfg!.emoji} {transitionData.cfg!.label}
            </div>
          </div>
          {/* Count-in number — key forces remount so anim-count-in replays each tick */}
          <div
            style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {countNum !== null && (
              <div
                key={countNum}
                className="anim-count-in"
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: countNum === 0 ? 72 : 88,
                  color: countNum <= 1 ? 'var(--green)' : 'var(--white)',
                  textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                  lineHeight: 1,
                }}
              >
                {countNum === 0 ? 'GO!' : countNum}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming emote pop */}
      {incomingEmote &&
        (() => {
          const sender = players.find((p) => p.id === incomingEmote.fromPlayerId)
          const senderName = sender
            ? sender.id === myPlayerId
              ? 'You'
              : sender.nickname
            : (incomingEmote.fromName ?? null)
          return (
            <div
              className="anim-pop"
              style={{
                position: 'fixed',
                top: 80,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 120,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {senderName && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 8,
                  }}
                >
                  {senderName}
                </div>
              )}
              <div style={{ fontSize: 64, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
                {incomingEmote.emote}
              </div>
            </div>
          )
        })()}

      {/* Emote buttons */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {EMOTES.map((e) => (
          <button
            key={e}
            onClick={() => {
              playClick()
              send('EMOTE', { emote: e })
            }}
            style={{
              width: 44,
              height: 44,
              fontSize: 22,
              background: 'var(--white)',
              border: 'var(--border)',
              borderRadius: 12,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Minigame area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {MinigameComp ? (
          <Suspense
            fallback={
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: 0.5,
                }}
              >
                <div style={{ fontSize: 48 }}>{cfg?.emoji ?? '🎮'}</div>
                <div className="label">{cfg?.label ?? 'Loading…'}</div>
              </div>
            }
          >
            <MinigameComp />
          </Suspense>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="subtitle" style={{ opacity: 0.5 }}>
              Select a minigame in the dev panel →
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RoundEndOverlay() {
  const { lastRoundWinnerId, myPlayerId, players, scores, wsStatus, send } = useGameStore()
  const iWon = lastRoundWinnerId === myPlayerId
  const winner = players.find((p) => p.id === lastRoundWinnerId)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    iWon ? playRoundWin() : playRoundLose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function confirm() {
    if (confirmed) return
    setConfirmed(true)
    playClick()
    send('ROUND_READY')
  }

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
        gap: 20,
      }}
    >
      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 60,
            color: iWon ? 'var(--yellow)' : 'var(--red)',
            textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
          }}
        >
          {iWon
            ? '🏆 You won that!'
            : lastRoundWinnerId === null
              ? '🤝 Draw!'
              : `${winner?.nickname ?? 'Opponent'} wins!`}
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 16, justifyContent: 'center' }}>
          {players.map((p) => (
            <div key={p.id} style={{ textAlign: 'center', color: 'var(--white)' }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>
                {scores[p.id] ?? 0}
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 700 }}>
                {p.id === myPlayerId ? 'You' : p.nickname}
              </div>
            </div>
          ))}
        </div>
      </div>

      {wsStatus === 'connected' ? (
        confirmed ? (
          <div className="subtitle anim-pulse" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Waiting for opponent…
          </div>
        ) : (
          <button className="btn btn-orange btn-lg" onClick={confirm} style={{ minWidth: 200 }}>
            Next Round →
          </button>
        )
      ) : (
        <div className="subtitle" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Next round starting…
        </div>
      )}
    </div>
  )
}

// ── Match End ─────────────────────────────────────────────────────────────────

function MatchEndView() {
  const {
    myPlayerId,
    players,
    scores,
    matchWinnerId,
    disconnect,
    send,
    roundHistory,
    rematchVoting,
    matchStartedAt,
  } = useGameStore()
  const navigate = useNavigate()
  const iWon = matchWinnerId === myPlayerId

  const matchDuration = matchStartedAt
    ? (() => {
        const secs = Math.round((Date.now() - matchStartedAt) / 1000)
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return m > 0 ? `${m}m ${s}s` : `${s}s`
      })()
    : null

  useEffect(() => {
    iWon ? playMatchWin() : playMatchLose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const me = players.find((p) => p.id === myPlayerId)
  const opponent = players.find((p) => p.id !== myPlayerId)
  const myScore = scores[myPlayerId] ?? 0
  const oppScore = opponent ? (scores[opponent.id] ?? 0) : 0

  const [displayedScores, setDisplayedScores] = useState({ my: 0, opp: 0 })
  useEffect(() => {
    const duration = 600
    const start = Date.now()
    const tick = () => {
      const ease = 1 - Math.pow(1 - Math.min((Date.now() - start) / duration, 1), 3)
      setDisplayedScores({ my: Math.round(myScore * ease), opp: Math.round(oppScore * ease) })
      if (ease < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [myScore, oppScore])

  function goHome() {
    playClick()
    disconnect()
    navigate('/')
  }

  function rematch() {
    playClick()
    send('REMATCH')
  }

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      {iWon && <Confetti />}

      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 80,
            color: iWon ? 'var(--yellow)' : 'var(--red)',
            WebkitTextStroke: '3px var(--black)',
            textShadow: '5px 5px 0 var(--black)',
            lineHeight: 1,
          }}
        >
          {iWon ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
        </div>
        {iWon ? (
          <div className="subtitle" style={{ marginTop: 12, opacity: 0.7 }}>
            Get rekt, opponent! gg ez no re 😤
          </div>
        ) : (
          <div className="subtitle" style={{ marginTop: 12, opacity: 0.7 }}>
            Touch grass and try again. 🌱
          </div>
        )}
      </div>

      <div className="card" style={{ minWidth: 300, width: '100%', maxWidth: 420 }}>
        {/* Score header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 56,
                color: 'var(--blue)',
                lineHeight: 1,
              }}
            >
              {displayedScores.my}
            </div>
            <div className="label">{me?.nickname ?? 'You'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 32, opacity: 0.3 }}>—</div>
            {matchDuration && (
              <div style={{ fontSize: 11, opacity: 0.45, fontWeight: 700, marginTop: 4 }}>
                ⏱ {matchDuration}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 56,
                color: 'var(--orange)',
                lineHeight: 1,
              }}
            >
              {displayedScores.opp}
            </div>
            <div className="label">{opponent?.nickname ?? 'Opponent'}</div>
          </div>
        </div>

        {/* Round-by-round breakdown */}
        {roundHistory.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              borderTop: '2px solid rgba(0,0,0,0.08)',
              paddingTop: 16,
            }}
          >
            <div className="label" style={{ marginBottom: 6, textAlign: 'center' }}>
              Round Breakdown
            </div>
            {roundHistory.map((r) => {
              const cfg = MINIGAME_CONFIGS[r.minigameId]
              const iWonRound = r.winnerId === myPlayerId
              const isDraw = r.winnerId === null
              const winnerName =
                r.winnerId === myPlayerId
                  ? (me?.nickname ?? 'You')
                  : (opponent?.nickname ?? 'Opponent')
              return (
                <div
                  key={r.round}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: iWonRound
                      ? 'rgba(68,204,68,0.08)'
                      : isDraw
                        ? 'rgba(0,0,0,0.03)'
                        : 'rgba(255,51,51,0.06)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    border: `1.5px solid ${iWonRound ? 'rgba(68,204,68,0.3)' : isDraw ? 'rgba(0,0,0,0.08)' : 'rgba(255,51,51,0.2)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{cfg.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 700 }}>
                        Round {r.round}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: 13,
                      color: iWonRound ? 'var(--green)' : isDraw ? 'var(--black)' : 'var(--red)',
                    }}
                  >
                    {isDraw ? '🤝 Draw' : `${iWonRound ? '🏆' : '💀'} ${winnerName}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="match-end-actions" style={{ display: 'flex', gap: 12 }}>
        {rematchVoting ? (
          <>
            <button className="btn btn-orange btn-lg anim-pulse" disabled>
              ⏳ Waiting for opponent…
            </button>
            <button
              className="btn btn-white"
              onClick={() => {
                playClick()
                disconnect()
                navigate('/')
              }}
            >
              ✕ Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-orange btn-lg" onClick={rematch}>
            🔁 Rematch
          </button>
        )}
        <button className="btn btn-white" onClick={goHome}>
          🏠 Home
        </button>
        <ShareButton
          iWon={iWon}
          myNickname={me?.nickname ?? 'Player'}
          oppNickname={opponent?.nickname ?? 'Opponent'}
          myScore={myScore}
          oppScore={oppScore}
        />
      </div>
    </div>
  )
}

function ShareButton({
  iWon,
  myNickname,
  oppNickname,
  myScore,
  oppScore,
}: {
  iWon: boolean
  myNickname: string
  oppNickname: string
  myScore: number
  oppScore: number
}) {
  const { roundHistory, myPlayerId } = useGameStore()
  const [saved, setSaved] = useState(false)
  const [discordCopied, setDiscordCopied] = useState(false)

  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://1v1me.vercel.app'
  const shareText = iWon
    ? `I beat ${oppNickname} ${myScore}–${oppScore} in 1v1 ME 🏆`
    : `Close one — ${oppNickname} beat me ${oppScore}–${myScore} in 1v1 ME 😤`

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${appUrl}`)}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${appUrl}`)}`
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(appUrl)}&title=${encodeURIComponent(shareText)}`
  const discordText = iWon
    ? `🎮 **1v1 ME** — I beat ${oppNickname} ${myScore}–${oppScore}\n👉 ${appUrl}`
    : `🎮 **1v1 ME** — ${oppNickname} beat me ${oppScore}–${myScore}\n👉 ${appUrl}`

  async function copyDiscord() {
    playClick()
    try {
      await navigator.clipboard.writeText(discordText)
    } catch {
      // silent
    }
    setDiscordCopied(true)
    setTimeout(() => setDiscordCopied(false), 2500)
  }

  async function buildCard(): Promise<Blob> {
    const PAD = 32
    const W = 560
    const ROW_H = 40
    const HEADER_H = 160
    const FOOTER_H = 40
    const ROUNDS_H = roundHistory.length > 0 ? roundHistory.length * ROW_H + 12 : 0
    const H = HEADER_H + ROUNDS_H + FOOTER_H

    const accent = iWon ? '#f7c948' : '#e63946'
    const BG = '#18181b'
    const streak = getStreak()

    // Top-3 most-played games from round history
    const counts: Record<string, number> = {}
    for (const r of roundHistory) counts[r.minigameId] = (counts[r.minigameId] ?? 0) + 1
    const top3 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => MINIGAME_CONFIGS[id as keyof typeof MINIGAME_CONFIGS]?.emoji ?? '🎮')
      .join(' ')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const canvas = document.createElement('canvas')
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Dark background
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)

    // Top accent bar
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, W, 6)

    // Win/lose title
    ctx.textAlign = 'left'
    ctx.fillStyle = accent
    ctx.font = '900 48px "Arial Black", Arial, sans-serif'
    ctx.fillText(iWon ? '🏆 YOU WIN!' : '💀 YOU LOSE', PAD, 68)

    // Big score
    ctx.font = '900 64px "Arial Black", Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${myScore}`, PAD, 138)
    ctx.font = '700 32px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('–', PAD + 60, 130)
    ctx.font = '900 64px "Arial Black", Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText(`${oppScore}`, PAD + 84, 138)

    // Nicknames under scores
    ctx.font = '700 14px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'left'
    ctx.fillText(myNickname, PAD, 156)
    ctx.fillText(oppNickname, PAD + 84, 156)

    // Streak badge (right side of header)
    if (iWon && streak >= 2) {
      ctx.font = '900 15px Arial, sans-serif'
      ctx.fillStyle = '#f7c948'
      ctx.textAlign = 'right'
      ctx.fillText(`🔥 ${streak} win streak`, W - PAD, 68)
    }

    // Top-3 game emojis (right side)
    if (top3) {
      ctx.font = '22px Arial, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(top3, W - PAD, 110)
    }

    if (roundHistory.length > 0) {
      // Divider
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD, HEADER_H)
      ctx.lineTo(W - PAD, HEADER_H)
      ctx.stroke()

      roundHistory.forEach((r, idx) => {
        const cfg = MINIGAME_CONFIGS[r.minigameId]
        const iWonRow = r.winnerId === myPlayerId
        const isDraw = r.winnerId === null
        const y = HEADER_H + idx * ROW_H + 6

        // Row tint
        ctx.fillStyle = iWonRow
          ? 'rgba(45,198,83,0.12)'
          : isDraw
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(230,57,70,0.12)'
        ctx.fillRect(PAD - 8, y, W - PAD * 2 + 16, ROW_H - 4)

        // Game label
        ctx.font = '700 14px Arial, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.textAlign = 'left'
        ctx.fillText(`${cfg.emoji}  ${cfg.label}`, PAD, y + 22)

        // Result
        ctx.font = '900 12px Arial, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillStyle = iWonRow ? '#2dc653' : isDraw ? '#888' : '#e63946'
        ctx.fillText(
          isDraw ? '🤝 Draw' : iWonRow ? `🏆 ${myNickname}` : `💀 ${oppNickname}`,
          W - PAD,
          y + 22
        )
      })
    }

    // Footer
    ctx.textAlign = 'center'
    ctx.font = '700 12px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fillText('⚔️  1v1 ME  •  Settle it. Once and for all.', W / 2, H - 12)

    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))),
        'image/png'
      )
    )
  }

  async function share() {
    playClick()

    // Tier 1: native share with result card image (mobile, supports file share)
    try {
      const blob = await buildCard()
      const file = new File([blob], '1v1me-result.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: iWon ? 'I won! 🏆' : 'GG 💀',
          text: shareText,
          url: appUrl,
        })
        return
      }
    } catch {
      // fall through to next tier
    }

    // Tier 2: text-only native share (desktop Chrome, Safari, etc.)
    if (navigator.share) {
      try {
        await navigator.share({ title: '1v1 ME', text: shareText, url: appUrl })
        return
      } catch {
        // user cancelled or not supported — fall through
      }
    }

    // Tier 3: clipboard copy with ✓ flash
    try {
      await navigator.clipboard.writeText(`${shareText}\n${appUrl}`)
    } catch {
      // clipboard unavailable — silent fail
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
      <button className="btn btn-white" onClick={share}>
        {saved ? '✓ Copied!' : '🔗 Share Result'}
      </button>
      <div style={{ display: 'flex', gap: 6 }}>
        <a
          className="btn btn-sm btn-white"
          href={twitterUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => playClick()}
          title="Share on X / Twitter"
          style={{ fontSize: 12 }}
        >
          𝕏
        </a>
        <a
          className="btn btn-sm btn-white"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => playClick()}
          title="Share on WhatsApp"
          style={{ fontSize: 12 }}
        >
          WA
        </a>
        <a
          className="btn btn-sm btn-white"
          href={redditUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => playClick()}
          title="Share on Reddit"
          style={{ fontSize: 12 }}
        >
          Reddit
        </a>
        <button
          className="btn btn-sm btn-white"
          onClick={copyDiscord}
          title="Copy for Discord"
          style={{ fontSize: 12 }}
        >
          {discordCopied ? '✓' : 'Discord'}
        </button>
      </div>
    </div>
  )
}

function Confetti() {
  const COLORS = [
    'var(--orange)',
    'var(--yellow)',
    'var(--green)',
    'var(--blue)',
    'var(--pink)',
    'var(--purple)',
  ]
  // Stabilise all random values so they don't recalculate on re-renders
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const r = Math.random()
        // Three shapes: circle, square, or thin strip (wide or tall)
        const shape = r < 0.4 ? 'circle' : r < 0.7 ? 'square' : r < 0.85 ? 'strip-h' : 'strip-v'
        const base = 6 + Math.random() * 10 // 6–16px
        return {
          left: Math.random() * 100,
          width: shape === 'strip-h' ? base * 2.5 : base,
          height: shape === 'strip-v' ? base * 2.5 : base,
          color: COLORS[i % COLORS.length],
          radius: shape === 'circle' ? '50%' : '2px',
          delay: Math.random() * 1.6,
          duration: 1.6 + Math.random() * 2,
          drift: (Math.random() - 0.5) * 240, // –120 to +120px horizontal arc
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: -20,
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            border: '2px solid var(--black)',
            borderRadius: p.radius,
            animation: `confetti-fall ${p.duration}s ease ${p.delay}s forwards`,
            ['--drift' as string]: `${p.drift}px`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      ))}
    </>
  )
}
