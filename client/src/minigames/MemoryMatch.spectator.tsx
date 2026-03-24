import type { SpectatorProps } from './spectatorHelpers'

export default function MemoryMatchSpectator({ state, players }: SpectatorProps) {
  const s = state as { sequence?: string[]; submissions?: Record<string, string[]> } | null
  const seq = s?.sequence ?? []
  const subs = s?.submissions ?? {}
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
      <div style={{ display: 'flex', gap: 10 }}>
        {seq.map((sym, i) => (
          <div
            key={i}
            style={{
              width: 52,
              height: 52,
              border: 'var(--border)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              background: 'var(--white)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {sym}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 40 }}>
        {players.map((p) => (
          <div key={p.id} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36 }}>{subs[p.id] !== undefined ? '✅' : '⏳'}</div>
            <div className="label" style={{ opacity: 0.6, marginTop: 4 }}>
              {p.nickname}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
