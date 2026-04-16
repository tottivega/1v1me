import type { SpectatorProps } from './spectatorHelpers'

const BTN_COLORS = ['#43a047', '#e53935', '#fdd835', '#1e88e5'] as const

export default function TapSequenceSpectator({ state, players }: SpectatorProps) {
  const s = state as {
    level?: number
    seqLen?: number
    phase?: 'showing' | 'input'
    sequence?: number[]
    progress?: Record<string, number>
    passed?: Record<string, boolean>
    eliminated?: Record<string, boolean>
    winnerId?: string
  } | null

  const level = s?.level ?? 1
  const seqLen = s?.seqLen ?? 4
  const phase = s?.phase ?? 'showing'
  const sequence = s?.sequence ?? []
  const progress = s?.progress ?? {}
  const passed = s?.passed ?? {}
  const eliminated = s?.eliminated ?? {}

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
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 20, opacity: 0.8 }}>
          Level {level} — {seqLen} buttons
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: phase === 'showing' ? 'var(--orange)' : 'var(--blue)',
          }}
        >
          {phase === 'showing' ? '👁 Watch' : '🎮 Input'}
        </div>
      </div>

      {/* Sequence preview (color dots) */}
      {sequence.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 320,
          }}
        >
          {sequence.map((btn, i) => (
            <div
              key={i}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: BTN_COLORS[btn] ?? '#888',
                border: '2px solid rgba(0,0,0,0.25)',
              }}
            />
          ))}
        </div>
      )}

      {/* Player progress */}
      <div style={{ display: 'flex', gap: 48 }}>
        {players.map((p) => {
          const prog = progress[p.id] ?? 0
          const isPassed = passed[p.id]
          const isEliminated = eliminated[p.id]
          return (
            <div key={p.id} style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>
                {isPassed ? '✅' : isEliminated ? '❌' : '⏳'}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--font-title)',
                  fontSize: 14,
                  opacity: 0.7,
                }}
              >
                {p.nickname}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>
                {prog}/{seqLen}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
