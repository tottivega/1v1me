import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { MINIGAME_CONFIGS } from '@shared/types'
import LobbyView from './LobbyView'
import BanPhaseView from './BanPhaseView'
import MatchView from './MatchView'
import MatchEndView from './MatchEndView'

function getSavedSession(): { roomId: string; playerId: string } | null {
  try {
    return JSON.parse(localStorage.getItem('1v1me_session') ?? 'null')
  } catch {
    return null
  }
}

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
    return () => {
      useGameStore.getState().ws?.close()
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
  if (roomStatus === 'banning') return <BanPhaseView />
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
