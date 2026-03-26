import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import {
  MINIGAME_CONFIGS,
  type RoomStatus,
  type MinigameId,
  type MinigameCategory,
} from '@shared/types'

const STATUSES: RoomStatus[] = [
  'lobby',
  'ready',
  'banning',
  'playing',
  'round_end',
  'match_end',
  'reconnecting',
]
const ALL_MINIGAMES = Object.keys(MINIGAME_CONFIGS) as MinigameId[]
const ALL_CATEGORIES = [
  ...new Set(ALL_MINIGAMES.map((id) => MINIGAME_CONFIGS[id].category)),
] as MinigameCategory[]

const CATEGORY_COLORS: Record<MinigameCategory, string> = {
  reflex: '#0099ff',
  math: '#ff6600',
  luck: '#ffdd00',
  strategy: '#44cc44',
  skill: '#ff2244',
}

const BEST_OF_OPTIONS = [3, 5, 7, 9] as const

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const [gameSearch, setGameSearch] = useState('')
  const [catFilter, setCatFilter] = useState<MinigameCategory | 'all'>('all')

  const {
    roomStatus,
    currentMinigame,
    players,
    myPlayerId,
    scores,
    remainingMs,
    currentRound,
    roomConfig,
    mockSetStatus,
    mockSetMinigame,
    mockAddOpponent,
    mockRemoveOpponent,
    mockToggleReady,
    mockSetScore,
    mockSetRound,
    mockSetWinner,
    mockForceRoundEnd,
    mockSetBestOf,
    mockNextRound,
    minigameState,
  } = useGameStore()

  const opponent = players.find((p) => p.id !== myPlayerId)
  const me = players.find((p) => p.id === myPlayerId)
  const winsNeeded = Math.ceil(roomConfig.bestOf / 2)
  // Score buttons: 0 up to winsNeeded (one beyond winning score to allow arbitrary testing)
  const scoreRange = Array.from({ length: winsNeeded + 1 }, (_, i) => i)
  const roundRange = Array.from({ length: roomConfig.bestOf }, (_, i) => i + 1)

  const visibleGames = ALL_MINIGAMES.filter((id) => {
    const cfg = MINIGAME_CONFIGS[id]
    const matchesCat = catFilter === 'all' || cfg.category === catFilter
    const matchesSearch =
      cfg.label.toLowerCase().includes(gameSearch.toLowerCase()) ||
      cfg.description.toLowerCase().includes(gameSearch.toLowerCase())
    return matchesCat && matchesSearch
  })

  const myScore = scores[myPlayerId] ?? 0
  const oppScore = opponent ? (scores[opponent.id] ?? 0) : 0

  const timerSecs = Math.ceil(remainingMs / 1000)
  const timerPct =
    roomConfig && currentMinigame && MINIGAME_CONFIGS[currentMinigame].timeoutMs > 0
      ? remainingMs / MINIGAME_CONFIGS[currentMinigame].timeoutMs
      : 0

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'var(--black)',
          color: 'var(--yellow)',
          border: '2px solid var(--yellow)',
          borderRadius: 8,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
          letterSpacing: 1,
          textTransform: 'uppercase',
          boxShadow: '2px 2px 0 var(--yellow)',
        }}
      >
        {open ? '✕ Dev Panel' : '🛠 Dev Panel'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 44,
            right: 0,
            width: 320,
            background: 'var(--black)',
            border: '2px solid var(--yellow)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '4px 4px 0 var(--yellow)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              color: 'var(--yellow)',
              fontWeight: 900,
              fontSize: 13,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            🛠 Dev Controls
          </div>

          {/* ── Status bar ──────────────────────────────────────────── */}
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {/* Game + round */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--white)', fontWeight: 800, fontSize: 12 }}>
                {currentMinigame
                  ? `${MINIGAME_CONFIGS[currentMinigame].emoji} ${MINIGAME_CONFIGS[currentMinigame].label}`
                  : '—'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                Round {currentRound}/{roomConfig.bestOf} · Bo{roomConfig.bestOf}
              </span>
            </div>

            {/* Scores */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#4488ff', fontWeight: 900, fontSize: 14 }}>Me {myScore}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>vs</span>
              <span style={{ color: '#ff6b35', fontWeight: 900, fontSize: 14 }}>
                {oppScore} Opp
              </span>
            </div>

            {/* Timer bar (only during playing with a timed game) */}
            {roomStatus === 'playing' && timerPct > 0 && (
              <div>
                <div
                  style={{
                    height: 4,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${timerPct * 100}%`,
                      background:
                        timerPct > 0.33 ? '#44cc44' : timerPct > 0.15 ? '#ffdd00' : '#ff3333',
                      transition: 'width 0.9s linear, background 0.3s',
                    }}
                  />
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 10,
                    marginTop: 2,
                    textAlign: 'right',
                  }}
                >
                  {timerSecs}s left
                </div>
              </div>
            )}

            {/* Status badge */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span
                style={{
                  background: 'rgba(255,221,0,0.15)',
                  color: 'var(--yellow)',
                  fontSize: 9,
                  fontWeight: 900,
                  padding: '2px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {roomStatus}
              </span>
            </div>
          </div>

          {/* ── Round outcome (playing only) ─────────────────────────── */}
          {roomStatus === 'playing' && (
            <Section label="Round Outcome">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <DevBtn
                  active={false}
                  onClick={() => mockForceRoundEnd(myPlayerId)}
                  color="#44cc44"
                >
                  ✓ Win Round
                </DevBtn>
                {opponent && (
                  <DevBtn
                    active={false}
                    onClick={() => mockForceRoundEnd(opponent.id)}
                    color="#ff3333"
                  >
                    ✗ Lose Round
                  </DevBtn>
                )}
                <DevBtn
                  active={false}
                  onClick={() =>
                    mockForceRoundEnd(
                      Math.random() < 0.5 ? myPlayerId : (opponent?.id ?? myPlayerId)
                    )
                  }
                  color="#ffdd00"
                >
                  ⏩ Skip Timer
                </DevBtn>
              </div>
            </Section>
          )}

          {/* ── Advance from round_end ───────────────────────────────── */}
          {roomStatus === 'round_end' && (
            <Section label="Round End">
              <DevBtn active={false} onClick={mockNextRound}>
                → Next Round
              </DevBtn>
            </Section>
          )}

          {/* ── Room Status ──────────────────────────────────────────── */}
          <Section label="Room Status">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES.map((s) => (
                <DevBtn key={s} active={roomStatus === s} onClick={() => mockSetStatus(s)}>
                  {s}
                </DevBtn>
              ))}
            </div>
          </Section>

          {/* ── Best Of ─────────────────────────────────────────────── */}
          <Section label="Best Of">
            <div style={{ display: 'flex', gap: 6 }}>
              {BEST_OF_OPTIONS.map((n) => (
                <DevBtn key={n} active={roomConfig.bestOf === n} onClick={() => mockSetBestOf(n)}>
                  {n}
                </DevBtn>
              ))}
            </div>
          </Section>

          {/* ── Minigame picker ──────────────────────────────────────── */}
          <Section label={`Minigame — ${visibleGames.length} / ${ALL_MINIGAMES.length} shown`}>
            <input
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              placeholder="Search games…"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 12,
                color: 'var(--white)',
                outline: 'none',
                width: '100%',
                fontFamily: 'var(--font-body)',
              }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              <CatTab
                active={catFilter === 'all'}
                color="rgba(255,255,255,0.6)"
                onClick={() => setCatFilter('all')}
              >
                all
              </CatTab>
              {ALL_CATEGORIES.map((cat) => (
                <CatTab
                  key={cat}
                  active={catFilter === cat}
                  color={CATEGORY_COLORS[cat]}
                  onClick={() => setCatFilter(cat)}
                >
                  {cat}
                </CatTab>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {visibleGames.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '4px 0' }}>
                  No games match.
                </div>
              )}
              {visibleGames.map((id) => {
                const cfg = MINIGAME_CONFIGS[id]
                const isActive = currentMinigame === id
                return (
                  <button
                    key={id}
                    onClick={() => mockSetMinigame(id)}
                    style={{
                      background: isActive ? 'rgba(255,221,0,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1.5px solid ${isActive ? 'var(--yellow)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 8,
                      padding: '7px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      textAlign: 'left',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          color: isActive ? 'var(--yellow)' : 'var(--white)',
                          fontWeight: 800,
                          fontSize: 12,
                        }}
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {cfg.platforms !== 'all' && (
                          <span
                            style={{
                              background: 'rgba(255,255,255,0.15)',
                              color: 'rgba(255,255,255,0.7)',
                              fontSize: 9,
                              fontWeight: 900,
                              padding: '2px 6px',
                              borderRadius: 4,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            {cfg.platforms === 'desktop-only' ? '🖥' : '📱'}
                          </span>
                        )}
                        <span
                          style={{
                            background: CATEGORY_COLORS[cfg.category],
                            color: cfg.category === 'luck' ? 'var(--black)' : 'var(--white)',
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          {cfg.category}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, lineHeight: 1.3 }}>
                      {cfg.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* ── Players ──────────────────────────────────────────────── */}
          <Section label="Players">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DevBtn active={false} onClick={() => mockToggleReady(myPlayerId)}>
                Toggle my ready ({me?.ready ? '✅' : '❌'})
              </DevBtn>
              {opponent ? (
                <>
                  <DevBtn active={false} onClick={() => mockToggleReady(opponent.id)}>
                    Toggle opp ready ({opponent.ready ? '✅' : '❌'})
                  </DevBtn>
                  <DevBtn active={false} onClick={mockRemoveOpponent}>
                    Remove opponent
                  </DevBtn>
                </>
              ) : (
                <DevBtn active={false} onClick={mockAddOpponent}>
                  + Add opponent
                </DevBtn>
              )}
            </div>
          </Section>

          {/* ── Scores ───────────────────────────────────────────────── */}
          <Section label="Scores">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, minWidth: 28 }}>
                Me:
              </span>
              {scoreRange.map((n) => (
                <DevBtn
                  key={n}
                  active={scores[myPlayerId] === n}
                  onClick={() => mockSetScore(myPlayerId, n)}
                >
                  {n}
                </DevBtn>
              ))}
            </div>
            {opponent && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, minWidth: 28 }}>
                  Opp:
                </span>
                {scoreRange.map((n) => (
                  <DevBtn
                    key={n}
                    active={scores[opponent.id] === n}
                    onClick={() => mockSetScore(opponent.id, n)}
                  >
                    {n}
                  </DevBtn>
                ))}
              </div>
            )}
          </Section>

          {/* ── Round ────────────────────────────────────────────────── */}
          <Section label="Round">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {roundRange.map((n) => (
                <DevBtn key={n} active={currentRound === n} onClick={() => mockSetRound(n)}>
                  {n}
                </DevBtn>
              ))}
            </div>
          </Section>

          {/* ── Match End ────────────────────────────────────────────── */}
          <Section label="Match End">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <DevBtn active={false} onClick={() => mockSetWinner(myPlayerId)}>
                I win
              </DevBtn>
              {opponent && (
                <DevBtn active={false} onClick={() => mockSetWinner(opponent.id)}>
                  I lose
                </DevBtn>
              )}
            </div>
          </Section>

          {/* ── Raw minigameState ────────────────────────────────────── */}
          <Section label="minigameState (raw)">
            {minigameState === null ? (
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, fontStyle: 'italic' }}>
                null
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: '8px 10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.75)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                  fontFamily: 'monospace',
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {JSON.stringify(minigameState, null, 2)}
              </pre>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function DevBtn({
  children,
  active,
  onClick,
  color,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  color?: string
}) {
  const activeColor = color ?? 'var(--yellow)'
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? activeColor : 'rgba(255,255,255,0.1)',
        color: active
          ? color === '#ffdd00'
            ? 'var(--black)'
            : 'var(--white)'
          : (color ?? 'var(--white)'),
        border: active
          ? `2px solid ${activeColor}`
          : `2px solid ${color ? color + '66' : 'rgba(255,255,255,0.2)'}`,
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
        textTransform: 'lowercase',
        letterSpacing: 0.5,
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  )
}

function CatTab({
  children,
  active,
  color,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color : 'transparent',
        color: active
          ? color === 'rgba(255,221,0,0.7)' || color === CATEGORY_COLORS.luck
            ? 'var(--black)'
            : 'var(--white)'
          : 'rgba(255,255,255,0.4)',
        border: `1.5px solid ${active ? color : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 4,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: 800,
        cursor: 'pointer',
        textTransform: 'lowercase',
        letterSpacing: 0.5,
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  )
}
