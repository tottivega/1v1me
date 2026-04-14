import type { SpectatorProps } from './spectatorHelpers'
import type { FastestTyperState } from '@shared/types'

export default function FastestTyperSpectator({ state, players }: SpectatorProps) {
  const s = state as FastestTyperState | null
  const completed = s?.completed ?? {}
  const charProgress = s?.charProgress ?? {}
  const phrases = s?.phrases ?? []
  const total = phrases.length || 10

  function smoothPct(playerId: string): number {
    const done = completed[playerId] ?? 0
    const chars = charProgress[playerId] ?? 0
    const phrase = phrases[done] ?? ''
    const partial = phrase.length > 0 ? chars / phrase.length : 0
    return ((done + partial) / total) * 100
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        flex: 1,
        padding: 32,
      }}
    >
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 24, color: 'var(--blue)' }}>
        FASTEST TYPER ⌨️
      </div>
      <div style={{ display: 'flex', gap: 48 }}>
        {players.map((p, i) => {
          const done = completed[p.id] ?? 0
          const pct = smoothPct(p.id)
          const color = i === 0 ? 'var(--blue)' : 'var(--orange)'
          return (
            <div key={p.id} style={{ textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 52, color, lineHeight: 1 }}>
                {done}
                <span style={{ fontSize: 22, opacity: 0.5 }}>/10</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(0,0,0,0.1)',
                  margin: '10px 0 6px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, pct)}%`,
                    background: color,
                    borderRadius: 4,
                    transition: 'width 0.15s',
                  }}
                />
              </div>
              <div className="label" style={{ opacity: 0.6 }}>
                {p.nickname}
              </div>
            </div>
          )
        })}
      </div>
      {phrases[0] && (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 14,
            opacity: 0.4,
            textAlign: 'center',
            maxWidth: 380,
          }}
        >
          {phrases[0]}…
        </div>
      )}
    </div>
  )
}
