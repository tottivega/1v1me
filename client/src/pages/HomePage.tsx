import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useGameStore,
  getStreak,
  getMatchHistory,
  type MatchHistoryEntry,
} from '../store/gameStore'
import { MINIGAME_CONFIGS, type MinigameCategory } from '@shared/types'
import { generateRoomCode } from '../utils/roomCode'
import { playClick, playReady } from '../utils/sounds'

const CATEGORY_COLORS: Record<MinigameCategory, string> = {
  reflex: 'var(--blue)',
  math: 'var(--orange)',
  luck: 'var(--yellow)',
  strategy: 'var(--green)',
  skill: 'var(--red)',
}

const ALL_GAMES = Object.entries(MINIGAME_CONFIGS) as [
  string,
  (typeof MINIGAME_CONFIGS)[keyof typeof MINIGAME_CONFIGS],
][]

const CATEGORIES = ['all', ...Object.keys(CATEGORY_COLORS)] as const
type CategoryFilter = (typeof CATEGORIES)[number]

function getSavedNickname() {
  try {
    return localStorage.getItem('nickname') ?? ''
  } catch {
    return ''
  }
}
function saveNickname(name: string) {
  try {
    localStorage.setItem('nickname', name)
  } catch {}
}

export default function HomePage() {
  const [searchParams] = useSearchParams()
  const prefillCode = searchParams.get('room') ?? ''

  const [nickname, setNickname] = useState(getSavedNickname)
  const [joinCode, setJoinCode] = useState(prefillCode)
  const [mode, setMode] = useState<'pick' | 'join'>(prefillCode ? 'join' : 'pick')
  const [shake, setShake] = useState(false)
  const navigate = useNavigate()
  const setNicknameInStore = useGameStore((s) => s.setNickname)

  // Read once on mount — these only change when a match ends (user is in a room at that point)
  const [streak] = useState(getStreak)
  const [history] = useState(getMatchHistory)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  function validate() {
    if (!nickname.trim()) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return false
    }
    return true
  }

  function commit(name: string) {
    saveNickname(name)
    setNicknameInStore(name)
  }

  function handleCreate() {
    if (!validate()) return
    playReady()
    commit(nickname.trim())
    navigate(`/room/${generateRoomCode()}`)
  }

  function handleJoin() {
    if (!validate()) return
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }
    playReady()
    commit(nickname.trim())
    navigate(`/room/${code}`)
  }

  return (
    <div className="page" style={{ gap: 32, justifyContent: 'flex-start', paddingTop: 56 }}>
      {/* Hero */}
      <div style={{ textAlign: 'center' }}>
        <div className="title" style={{ fontSize: 96 }}>
          1v1 ME
        </div>
        <div className="subtitle" style={{ marginTop: 8, opacity: 0.7 }}>
          Settle it. Once and for all. 🔥
        </div>
      </div>

      {/* Join / Create card */}
      <div
        className="card anim-pop"
        style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="label">Your nickname</label>
          <input
            className={`input ${shake ? 'anim-shake' : ''}`}
            placeholder="e.g. CoolDude99"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={18}
            onKeyDown={(e) =>
              e.key === 'Enter' && (mode === 'join' ? handleJoin() : handleCreate())
            }
            autoFocus
          />
        </div>

        {mode === 'pick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              className="btn btn-orange btn-lg"
              style={{ width: '100%' }}
              onClick={handleCreate}
            >
              ⚔️ Create Room
            </button>
            <button
              className="btn btn-white"
              style={{ width: '100%' }}
              onClick={() => {
                playClick()
                setMode('join')
              }}
            >
              🔗 Join with code
            </button>
            <button
              className="btn btn-white"
              style={{ width: '100%' }}
              onClick={() => {
                playClick()
                navigate('/rooms')
              }}
            >
              🌐 Browse open rooms
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Room code</label>
              <input
                className="input"
                placeholder="e.g. WOLF-42"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={12}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <button className="btn btn-blue btn-lg" style={{ width: '100%' }} onClick={handleJoin}>
              🚀 Let's Go!
            </button>
            <button
              className="btn btn-white btn-sm"
              onClick={() => {
                playClick()
                setMode('pick')
              }}
            >
              ← Back
            </button>
          </div>
        )}
      </div>

      {/* Win streak */}
      {streak >= 2 && (
        <div
          className="badge badge-orange anim-pop"
          style={{ fontSize: 18, padding: '8px 20px', letterSpacing: 1 }}
        >
          🔥 {streak} win streak
        </div>
      )}

      {/* Match history */}
      {history.length > 0 && (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div
            className="label"
            style={{ textAlign: 'center', marginBottom: 10, fontSize: 12, opacity: 0.6 }}
          >
            RECENT MATCHES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((entry, i) => (
              <HistoryRow key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Game Gallery */}
      <div style={{ width: '100%', maxWidth: 820 }}>
        <div className="label" style={{ textAlign: 'center', marginBottom: 14, fontSize: 14 }}>
          ⚔️ {ALL_GAMES.length} MINI GAMES TO SETTLE YOUR BEEF
        </div>

        {/* Category filter */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          {CATEGORIES.map((cat) => {
            const active = categoryFilter === cat
            const color = cat === 'all' ? 'var(--black)' : CATEGORY_COLORS[cat as MinigameCategory]
            const isLight = cat === 'luck'
            return (
              <button
                key={cat}
                className="filter-pill"
                onClick={() => setCategoryFilter(cat)}
                style={{
                  background: active ? color : 'var(--white)',
                  color: active ? (isLight ? 'var(--black)' : 'var(--white)') : 'var(--black)',
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, 190px)',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          {ALL_GAMES.filter(
            ([, cfg]) => categoryFilter === 'all' || cfg.category === categoryFilter
          ).map(([id, cfg]) => (
            <GameCard key={id} cfg={cfg} />
          ))}
        </div>
      </div>

      {/* Decorative */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 24,
          fontSize: 48,
          opacity: 0.15,
          pointerEvents: 'none',
          userSelect: 'none',
          transform: 'rotate(-12deg)',
        }}
      >
        🕹️
      </div>
      <div
        style={{
          position: 'fixed',
          top: 24,
          left: 24,
          fontSize: 36,
          opacity: 0.13,
          pointerEvents: 'none',
          userSelect: 'none',
          transform: 'rotate(8deg)',
        }}
      >
        ⭐
      </div>
    </div>
  )
}

function HistoryRow({ entry }: { entry: MatchHistoryEntry }) {
  const date = new Date(entry.date)
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--white)',
        border: 'var(--border)',
        borderRadius: 10,
        padding: '8px 14px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{ fontSize: 18 }}>{entry.iWon ? '🏆' : '💀'}</span>
      <span
        style={{
          flex: 1,
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--black)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        vs {entry.opponentNickname}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 15,
          color: entry.iWon ? 'var(--green)' : 'var(--red)',
          minWidth: 40,
          textAlign: 'center',
        }}
      >
        {entry.myScore}–{entry.oppScore}
      </span>
      {entry.topGames && entry.topGames.length > 0 && (
        <span style={{ fontSize: 13, letterSpacing: 1, opacity: 0.7 }}>
          {entry.topGames.join('')}
        </span>
      )}
      <span style={{ fontSize: 11, opacity: 0.45, minWidth: 42, textAlign: 'right' }}>{label}</span>
    </div>
  )
}

function GameCard({ cfg }: { cfg: (typeof MINIGAME_CONFIGS)[keyof typeof MINIGAME_CONFIGS] }) {
  const catColor = CATEGORY_COLORS[cfg.category]
  const isLightCat = cfg.category === 'luck'

  return (
    <div className="game-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 32, lineHeight: 1 }}>{cfg.emoji}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span
            style={{
              background: catColor,
              color: isLightCat ? 'var(--black)' : 'var(--white)',
              fontSize: 9,
              fontWeight: 900,
              padding: '2px 7px',
              borderRadius: 5,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              border: '1.5px solid var(--black)',
            }}
          >
            {cfg.category}
          </span>
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 17,
          color: 'var(--black)',
          lineHeight: 1.1,
        }}
      >
        {cfg.label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--black)', opacity: 0.55, lineHeight: 1.4 }}>
        {cfg.description}
      </div>
    </div>
  )
}
