import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../../store/gameStore'
import { MINIGAME_CONFIGS, type MinigameId, type MinigamePlatform } from '@shared/types'

const DRAFT_TIMEOUT_SECS = 10
const isMobile = window.matchMedia('(pointer: coarse)').matches

export default function DraftPhaseView() {
  const { roomStatus, draftPhasePool, draftPhaseCount, send, isMockMatch, mockSubmitDraft } =
    useGameStore()
  const [selected, setSelected] = useState<MinigameId[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [secsLeft, setSecsLeft] = useState(DRAFT_TIMEOUT_SECS)
  const submittedRef = useRef(false)
  const selectedRef = useRef<MinigameId[]>([])

  const isBan = roomStatus === 'banning'
  const pool = (draftPhasePool ?? []).filter((id) => {
    const platforms = MINIGAME_CONFIGS[id].platforms as MinigamePlatform
    return (platforms !== 'desktop-only' || !isMobile) && (platforms !== 'mobile-only' || isMobile)
  })
  const remaining = draftPhaseCount - selected.length

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

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

  function doSubmit(ids: MinigameId[]) {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    if (isMockMatch) {
      mockSubmitDraft(ids)
    } else {
      send('SUBMIT_DRAFT', { gameIds: ids })
    }
  }

  function toggle(id: MinigameId) {
    if (submitted) return
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < draftPhaseCount
          ? [...prev, id]
          : prev
    )
  }

  const urgent = secsLeft <= 5 && !submitted
  const accentColor = isBan ? 'var(--red)' : 'var(--green)'
  const n = draftPhaseCount
  const verb = isBan ? 'Ban' : 'Pick'

  return (
    <div className="page" style={{ gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 40,
            color: accentColor,
            WebkitTextStroke: '2px var(--black)',
            textShadow: '3px 3px 0 var(--black)',
          }}
        >
          {isBan ? '🚫' : '✅'} {verb.toUpperCase()} PHASE
        </div>
        <div className="subtitle" style={{ opacity: 0.6, marginTop: 6 }}>
          {submitted
            ? `${verb}s submitted — waiting for opponent…`
            : remaining > 0
              ? `${isBan ? 'Pick up to' : 'Pick up to'} ${n} game${n !== 1 ? 's' : ''} to ${verb.toLowerCase()} · ${remaining} left`
              : `${n} ${verb.toLowerCase()}${n !== 1 ? 's' : ''} selected`}
        </div>
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
          const isSelected = selected.includes(id)
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={submitted || (!isSelected && remaining === 0)}
              style={{
                background: isSelected ? accentColor : 'var(--white)',
                border: `3px solid ${isSelected ? accentColor : 'var(--black)'}`,
                borderRadius: 12,
                padding: '10px 8px',
                cursor: submitted || (!isSelected && remaining === 0) ? 'default' : 'pointer',
                opacity: submitted && !isSelected ? 0.45 : !isSelected && remaining === 0 ? 0.5 : 1,
                transition: 'background 0.15s, opacity 0.15s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                boxShadow: isSelected ? 'none' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: 28 }}>{isBan && isSelected ? '🚫' : cfg.emoji}</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: isSelected ? 'var(--white)' : 'var(--black)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  textDecoration: isBan && isSelected ? 'line-through' : 'none',
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
            ? `Skip ${verb}s →`
            : `${verb} ${selected.length} Game${selected.length !== 1 ? 's' : ''} →`}
        </button>
      )}

      {submitted && <div className="badge badge-yellow anim-pulse">⏳ Waiting for opponent…</div>}
    </div>
  )
}
