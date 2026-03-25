import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { MINIGAME_CONFIGS, type MinigamePlatform } from '@shared/types'

const BAN_TIMEOUT_SECS = 10
const isMobile = window.matchMedia('(pointer: coarse)').matches

export default function BanPhaseView() {
  const { banPhasePool, banPhaseCount, send, isMockMatch, mockSubmitBans } = useGameStore()
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [secsLeft, setSecsLeft] = useState(BAN_TIMEOUT_SECS)
  const submittedRef = useRef(false)
  const selectedRef = useRef<string[]>([])

  const rawPool = banPhasePool ?? []
  // Filter out games that can't run on the current platform
  const pool = rawPool.filter((id) => {
    const platforms = MINIGAME_CONFIGS[id].platforms as MinigamePlatform
    return (platforms !== 'desktop-only' || !isMobile) && (platforms !== 'mobile-only' || isMobile)
  })
  const remaining = banPhaseCount - selected.length

  // Keep refs in sync so the timer callback always sees latest values
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  // Countdown timer — auto-submit on expiry
  useEffect(() => {
    const interval = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          if (!submittedRef.current) doSubmit(selectedRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function doSubmit(bannedIds: string[]) {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    if (isMockMatch) {
      // Mock mode: opponent also "submits" instantly — game starts immediately
      mockSubmitBans(bannedIds)
    } else {
      send('SUBMIT_BANS', { bannedGameIds: bannedIds })
    }
  }

  function toggle(id: string) {
    if (submitted) return
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < banPhaseCount
          ? [...prev, id]
          : prev
    )
  }

  const urgent = secsLeft <= 5 && !submitted

  return (
    <div className="page" style={{ gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 40,
            color: 'var(--red)',
            WebkitTextStroke: '2px var(--black)',
            textShadow: '3px 3px 0 var(--black)',
          }}
        >
          🚫 BAN PHASE
        </div>
        <div className="subtitle" style={{ opacity: 0.6, marginTop: 6 }}>
          {submitted
            ? 'Bans submitted — waiting for opponent…'
            : remaining > 0
              ? `Pick up to ${banPhaseCount} game${banPhaseCount !== 1 ? 's' : ''} to ban · ${remaining} left`
              : `${banPhaseCount} ban${banPhaseCount !== 1 ? 's' : ''} selected`}
        </div>
        {/* Countdown timer */}
        {!submitted && (
          <div
            className={urgent ? 'anim-pulse' : ''}
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-title)',
              fontSize: 20,
              color: urgent ? 'var(--red)' : 'rgba(0,0,0,0.35)',
            }}
          >
            ⏱ {secsLeft}s
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 8,
          width: '100%',
          maxWidth: 500,
        }}
      >
        {pool.map((id) => {
          const cfg = MINIGAME_CONFIGS[id]
          if (!cfg) return null
          const isBanned = selected.includes(id)
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={submitted || (!isBanned && remaining === 0)}
              style={{
                background: isBanned ? 'var(--red)' : 'var(--white)',
                border: `3px solid ${isBanned ? 'var(--red)' : 'var(--black)'}`,
                borderRadius: 12,
                padding: '10px 8px',
                cursor: submitted || (!isBanned && remaining === 0) ? 'default' : 'pointer',
                opacity: submitted && !isBanned ? 0.45 : !isBanned && remaining === 0 ? 0.5 : 1,
                transition: 'background 0.15s, opacity 0.15s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                boxShadow: isBanned ? 'none' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: 28 }}>{isBanned ? '🚫' : cfg.emoji}</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: isBanned ? 'var(--white)' : 'var(--black)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  textDecoration: isBanned ? 'line-through' : 'none',
                }}
              >
                {cfg.label}
              </div>
            </button>
          )
        })}
      </div>

      {!submitted && (
        <button
          className="btn btn-orange btn-lg"
          style={{ minWidth: 200 }}
          onClick={() => doSubmit(selected)}
        >
          {selected.length === 0
            ? 'Skip Bans →'
            : `Ban ${selected.length} Game${selected.length !== 1 ? 's' : ''} →`}
        </button>
      )}

      {submitted && <div className="badge badge-yellow anim-pulse">⏳ Waiting for opponent…</div>}
    </div>
  )
}
