import type { SpectatorProps } from './spectatorHelpers'

export default function MemoryMatchSpectator({ state, players }: SpectatorProps) {
  const s = state as {
    roundNum?: number
    seqLen?: number
    phase?: 'memorize' | 'recall'
    sequence?: string[]
    submissions?: Record<string, string[]>
  } | null

  const seq = s?.sequence ?? []
  const subs = s?.submissions ?? {}
  const roundNum = s?.roundNum ?? 1
  const seqLen = s?.seqLen ?? seq.length
  const phase = s?.phase ?? 'memorize'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        flex: 1,
        padding: 32,
      }}
    >
      {/* Round + phase header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 20, opacity: 0.8 }}>
          Round {roundNum} — {seqLen} symbol{seqLen !== 1 ? 's' : ''}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: phase === 'memorize' ? 'var(--blue)' : 'var(--orange)',
          }}
        >
          {phase === 'memorize' ? '👁 Memorize' : '⌨️ Recall'}
        </div>
      </div>

      {/* Sequence */}
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

      {/* Player submission status */}
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
