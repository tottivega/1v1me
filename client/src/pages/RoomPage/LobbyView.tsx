import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/gameStore'
import { MINIGAME_CONFIGS, AVATARS } from '@shared/types'
import { playClick, playReady } from '../../utils/sounds'
import { CATEGORY_COLORS } from './constants'
import RoomSettings from './RoomSettings'

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
            className="game-card"
            style={{
              borderRadius: 12,
              padding: '10px 12px',
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
  onPickAvatar,
}: {
  player: {
    nickname: string
    avatar: string
    ready: boolean
    connected: boolean
    streak?: number
  } | null
  onPickAvatar?: () => void
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
      <div
        role={onPickAvatar ? 'button' : undefined}
        aria-label={onPickAvatar ? 'Change avatar' : undefined}
        onClick={onPickAvatar}
        style={{
          fontSize: 44,
          cursor: onPickAvatar ? 'pointer' : 'default',
          borderRadius: 12,
          padding: 4,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          if (onPickAvatar)
            (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.06)'
        }}
        onMouseLeave={(e) => {
          if (onPickAvatar) (e.currentTarget as HTMLDivElement).style.background = ''
        }}
      >
        {player ? player.avatar : '❓'}
      </div>
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

function AvatarPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          border: 'var(--border)',
          borderRadius: 20,
          boxShadow: 'var(--shadow)',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <p style={{ fontWeight: 900, fontSize: 16, margin: 0 }}>Pick your avatar</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {AVATARS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onPick(emoji)
                onClose()
              }}
              style={{
                fontSize: 36,
                background: 'none',
                border: '3px solid transparent',
                borderRadius: 12,
                cursor: 'pointer',
                padding: 6,
                transition: 'border-color 0.1s, background 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--black)'
                e.currentTarget.style.background = 'rgba(0,0,0,0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.background = 'none'
              }}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LobbyView({ roomId }: { roomId: string }) {
  const navigate = useNavigate()
  const {
    players,
    myPlayerId,
    setReady,
    disconnect,
    mockAddOpponent,
    wsStatus,
    spectatorCount,
    roomConfig,
    sendRoomConfig,
    sendSetAvatar,
    send,
  } = useGameStore()
  const me = players.find((p) => p.id === myPlayerId)
  const opponent = players.find((p) => p.id !== myPlayerId)
  const isCreator = players[0]?.id === myPlayerId
  const locked = !!(me?.ready || opponent?.ready)
  const inviteUrl = `${window.location.origin}/room/${roomId}`

  // Ping throttle — mirrors server-side 10s rate limit
  const lastPingRef = useRef(0)
  function pingActivity() {
    const now = Date.now()
    if (now - lastPingRef.current < 10_000) return
    lastPingRef.current = now
    send('PING', {})
    resetIdleTimer()
  }

  // Avatar picker
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)

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
    <div className="page" onClick={pingActivity}>
      {/* Back button — fixed top-left, does not affect page flow */}
      <button
        className="btn btn-white btn-sm"
        onClick={() => {
          disconnect()
          navigate('/')
        }}
        style={{ position: 'fixed', top: 14, left: 14, zIndex: 200 }}
      >
        ← Back
      </button>

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
        <PlayerSlot
          player={me ?? null}
          onPickAvatar={!locked && me ? () => setAvatarPickerOpen(true) : undefined}
        />
        <PlayerSlot player={opponent ?? null} />
      </div>

      {avatarPickerOpen && (
        <AvatarPicker
          onPick={(emoji) => sendSetAvatar(emoji)}
          onClose={() => setAvatarPickerOpen(false)}
        />
      )}

      {/* Spectator count */}
      {spectatorCount > 0 && (
        <div className="badge badge-yellow" style={{ fontSize: 13 }}>
          👁 {spectatorCount} watching
        </div>
      )}

      {/* Idle timeout warning */}
      {idleSecsLeft !== null && (
        <div className="badge badge-red anim-pulse" style={{ fontSize: 13 }}>
          ⏰ Room expires in {idleSecsLeft}s due to inactivity
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
