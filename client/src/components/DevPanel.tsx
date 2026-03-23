import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { MINIGAME_CONFIGS, type RoomStatus, type MinigameId, type MinigameCategory } from '@shared/types'

const STATUSES: RoomStatus[] = ['lobby', 'ready', 'playing', 'round_end', 'match_end', 'reconnecting']
const ALL_MINIGAMES = Object.keys(MINIGAME_CONFIGS) as MinigameId[]
const ALL_CATEGORIES = [...new Set(ALL_MINIGAMES.map(id => MINIGAME_CONFIGS[id].category))] as MinigameCategory[]

const CATEGORY_COLORS: Record<MinigameCategory, string> = {
  reflex:   '#0099ff',
  math:     '#ff6600',
  luck:     '#ffdd00',
  strategy: '#44cc44',
  trivia:   '#9933ff',
}

const DIFFICULTY_STARS = (d: number) => '★'.repeat(d) + '☆'.repeat(3 - d)

export default function DevPanel() {
  const [open, setOpen]               = useState(false)
  const [gameSearch, setGameSearch]   = useState('')
  const [catFilter, setCatFilter]     = useState<MinigameCategory | 'all'>('all')

  const {
    roomStatus, currentMinigame, players, myPlayerId, scores,
    mockSetStatus, mockSetMinigame, mockAddOpponent, mockRemoveOpponent,
    mockToggleReady, mockSetScore, mockSetRound, mockSetWinner, currentRound,
  } = useGameStore()

  const opponent = players.find(p => p.id !== myPlayerId)
  const me       = players.find(p => p.id === myPlayerId)

  const visibleGames = ALL_MINIGAMES.filter(id => {
    const cfg = MINIGAME_CONFIGS[id]
    const matchesCat    = catFilter === 'all' || cfg.category === catFilter
    const matchesSearch = cfg.label.toLowerCase().includes(gameSearch.toLowerCase()) ||
                          cfg.description.toLowerCase().includes(gameSearch.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, fontFamily: 'var(--font-body)' }}>
      {/* Toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--black)', color: 'var(--yellow)',
          border: '2px solid var(--yellow)', borderRadius: 8,
          padding: '6px 12px', fontSize: 12, fontWeight: 800,
          cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
          boxShadow: '2px 2px 0 var(--yellow)',
        }}
      >
        {open ? '✕ Dev Panel' : '🛠 Dev Panel'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 44, right: 0, width: 300,
          background: 'var(--black)', border: '2px solid var(--yellow)',
          borderRadius: 12, padding: 16, boxShadow: '4px 4px 0 var(--yellow)',
          display: 'flex', flexDirection: 'column', gap: 14,
          maxHeight: '85vh', overflowY: 'auto',
        }}>
          <div style={{ color: 'var(--yellow)', fontWeight: 900, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
            🛠 Dev Controls
          </div>

          {/* Room Status */}
          <Section label="Room Status">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES.map(s => (
                <DevBtn key={s} active={roomStatus === s} onClick={() => mockSetStatus(s)}>
                  {s}
                </DevBtn>
              ))}
            </div>
          </Section>

          {/* Minigame picker */}
          <Section label={`Minigame — ${visibleGames.length} / ${ALL_MINIGAMES.length} shown`}>
            {/* Search */}
            <input
              value={gameSearch}
              onChange={e => setGameSearch(e.target.value)}
              placeholder="Search games…"
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: 6, padding: '5px 10px', fontSize: 12, color: 'var(--white)',
                outline: 'none', width: '100%', fontFamily: 'var(--font-body)',
              }}
            />

            {/* Category filter tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              <CatTab active={catFilter === 'all'} color="rgba(255,255,255,0.6)" onClick={() => setCatFilter('all')}>
                all
              </CatTab>
              {ALL_CATEGORIES.map(cat => (
                <CatTab key={cat} active={catFilter === cat} color={CATEGORY_COLORS[cat]} onClick={() => setCatFilter(cat)}>
                  {cat}
                </CatTab>
              ))}
            </div>

            {/* Game list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {visibleGames.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '4px 0' }}>No games match.</div>
              )}
              {visibleGames.map(id => {
                const cfg = MINIGAME_CONFIGS[id]
                const isActive = currentMinigame === id
                return (
                  <button
                    key={id}
                    onClick={() => mockSetMinigame(id)}
                    style={{
                      background: isActive ? 'rgba(255,221,0,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1.5px solid ${isActive ? 'var(--yellow)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: isActive ? 'var(--yellow)' : 'var(--white)', fontWeight: 800, fontSize: 12 }}>
                        {cfg.emoji} {cfg.label}
                      </span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{
                          background: CATEGORY_COLORS[cfg.category],
                          color: cfg.category === 'luck' ? 'var(--black)' : 'var(--white)',
                          fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4,
                          textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>
                          {cfg.category}
                        </span>
                        <span style={{ color: 'rgba(255,221,0,0.7)', fontSize: 10 }}>
                          {DIFFICULTY_STARS(cfg.difficulty)}
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

          {/* Players */}
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
                  <DevBtn active={false} onClick={mockRemoveOpponent}>Remove opponent</DevBtn>
                </>
              ) : (
                <DevBtn active={false} onClick={mockAddOpponent}>+ Add opponent</DevBtn>
              )}
            </div>
          </Section>

          {/* Scores */}
          <Section label="Scores">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, minWidth: 28 }}>Me:</span>
              {[0,1,2,3].map(n => (
                <DevBtn key={n} active={scores[myPlayerId] === n} onClick={() => mockSetScore(myPlayerId, n)}>{n}</DevBtn>
              ))}
            </div>
            {opponent && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, minWidth: 28 }}>Opp:</span>
                {[0,1,2,3].map(n => (
                  <DevBtn key={n} active={scores[opponent.id] === n} onClick={() => mockSetScore(opponent.id, n)}>{n}</DevBtn>
                ))}
              </div>
            )}
          </Section>

          {/* Round */}
          <Section label="Round">
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5].map(n => (
                <DevBtn key={n} active={currentRound === n} onClick={() => mockSetRound(n)}>{n}</DevBtn>
              ))}
            </div>
          </Section>

          {/* Match end */}
          <Section label="Match End">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <DevBtn active={false} onClick={() => mockSetWinner(myPlayerId)}>I win</DevBtn>
              {opponent && (
                <DevBtn active={false} onClick={() => mockSetWinner(opponent.id)}>I lose</DevBtn>
              )}
            </div>
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
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function DevBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--yellow)' : 'rgba(255,255,255,0.1)',
        color: active ? 'var(--black)' : 'var(--white)',
        border: active ? '2px solid var(--yellow)' : '2px solid rgba(255,255,255,0.2)',
        borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 800,
        cursor: 'pointer', textTransform: 'lowercase', letterSpacing: 0.5, transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  )
}

function CatTab({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color : 'transparent',
        color: active ? (color === 'rgba(255,221,0,0.7)' || color === CATEGORY_COLORS.luck ? 'var(--black)' : 'var(--white)') : 'rgba(255,255,255,0.4)',
        border: `1.5px solid ${active ? color : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 800,
        cursor: 'pointer', textTransform: 'lowercase', letterSpacing: 0.5, transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  )
}
