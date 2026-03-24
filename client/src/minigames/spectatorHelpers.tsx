// Shared UI primitives used by *.spectator.tsx files.
// Not a game component — excluded from MINIGAME_COMPONENTS by the registry filter.

export type SpectatorPlayer = { id: string; nickname: string }

export type SpectatorProps = {
  state: unknown
  players: SpectatorPlayer[]
}

export function TwoColState({
  p1,
  p2,
  color1,
  color2,
  extra,
}: {
  p1: { label: string; value: number | string; unit: string }
  p2: { label: string; value: number | string; unit: string }
  color1: string
  color2: string
  extra?: string
}) {
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
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        <StatPill label={p1.label} value={p1.value} unit={p1.unit} color={color1} />
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 28, opacity: 0.25 }}>vs</span>
        <StatPill label={p2.label} value={p2.value} unit={p2.unit} color={color2} />
      </div>
      {extra && (
        <div className="label" style={{ opacity: 0.6 }}>
          {extra}
        </div>
      )}
    </div>
  )
}

export function StatPill({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number | string
  unit: string
  color: string
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 64, color, lineHeight: 1 }}>
        {value}
      </div>
      <div className="label" style={{ marginTop: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, opacity: 0.5, fontWeight: 700, marginTop: 2 }}>{unit}</div>
    </div>
  )
}

export function MathsPanel({
  nickname,
  equation,
  correct,
  color,
}: {
  nickname: string
  equation: string
  correct: number
  color: string
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
      }}
    >
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 52, color, lineHeight: 1 }}>
        {correct}
      </div>
      <div className="label" style={{ opacity: 0.6 }}>
        {nickname}
      </div>
      <div
        style={{
          background: 'var(--white)',
          border: 'var(--border)',
          borderRadius: 16,
          padding: '16px 28px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 36, color: 'var(--black)' }}>
          {equation} = ?
        </div>
      </div>
    </div>
  )
}
