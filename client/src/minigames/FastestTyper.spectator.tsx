import type { SpectatorProps } from './spectatorHelpers'

export default function FastestTyperSpectator({ state, players }: SpectatorProps) {
  const s = state as { phrase?: string; progress?: Record<string, number> } | null
  const phrase = s?.phrase ?? ''
  const prog = s?.progress ?? {}
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
      <div
        style={{
          background: 'var(--white)',
          border: 'var(--border)',
          borderRadius: 16,
          padding: '18px 28px',
          boxShadow: 'var(--shadow-sm)',
          fontFamily: 'monospace',
          fontSize: 18,
          letterSpacing: 1,
          maxWidth: 480,
          textAlign: 'center',
        }}
      >
        {phrase || '…'}
      </div>
      <div style={{ display: 'flex', gap: 40 }}>
        {players.map((p, i) => {
          const done = prog[p.id] ?? 0
          const pct = phrase ? Math.round((done / phrase.length) * 100) : 0
          const color = i === 0 ? 'var(--blue)' : 'var(--orange)'
          return (
            <div key={p.id} style={{ textAlign: 'center', minWidth: 110 }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 36, color }}>{pct}%</div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(0,0,0,0.1)',
                  margin: '8px 0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 4,
                    transition: 'width 0.1s',
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
    </div>
  )
}
