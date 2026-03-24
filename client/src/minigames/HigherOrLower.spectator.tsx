import type { SpectatorProps } from './spectatorHelpers'

export default function HigherOrLowerSpectator({ state, players }: SpectatorProps) {
  const s = state as {
    clue?: number
    phase?: string
    submitted?: string[]
    answers?: Record<string, string>
    target?: number
    correct?: string
  } | null
  const clue = s?.clue ?? '?'
  const submitted = s?.submitted ?? (s?.answers ? Object.keys(s.answers) : [])
  const isReveal = s?.phase === 'reveal' || s?.target !== undefined
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        flex: 1,
        padding: 32,
      }}
    >
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 96, lineHeight: 1 }}>{clue}</div>
      <div className="label" style={{ opacity: 0.5 }}>
        Clue number — is the secret Higher or Lower?
      </div>
      {isReveal && s?.target !== undefined && (
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 28,
            color: 'var(--green)',
            marginTop: 4,
          }}
        >
          Answer: {s.target} ({s.correct})
        </div>
      )}
      <div style={{ display: 'flex', gap: 40, marginTop: 8 }}>
        {players.map((p) => {
          const answered = submitted.includes(p.id)
          const answer = s?.answers?.[p.id]
          return (
            <div key={p.id} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36 }}>
                {isReveal && answer ? (answer === 'higher' ? '📈' : '📉') : answered ? '✅' : '⏳'}
              </div>
              <div className="label" style={{ opacity: 0.6, marginTop: 4 }}>
                {p.nickname}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
