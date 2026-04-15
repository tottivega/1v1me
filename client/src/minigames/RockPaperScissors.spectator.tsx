import type { SpectatorProps } from './spectatorHelpers'

const EMOJI: Record<string, string> = { rock: '✊', paper: '🖐️', scissors: '✌️' }

export default function RockPaperScissorsSpectator({ state, players }: SpectatorProps) {
  const s = state as {
    phase?: string
    throwNum?: number
    history?: string[][]
    submitted?: string[]
    picks?: Record<string, string>
    scores?: Record<string, number>
  } | null
  const phase = s?.phase ?? 'picking'
  const throwNum = Math.min(3, (s?.history?.length ?? 0) + 1)
  const scores = s?.scores ?? {}
  const picks = s?.picks ?? {}
  const submitted = s?.submitted ?? Object.keys(picks)
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
      <div className="label" style={{ opacity: 0.5 }}>
        Throw {throwNum} / 3
      </div>
      <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
        {players.map((p, i) => {
          const hasPicked = submitted.includes(p.id) || !!picks[p.id]
          const pick = phase === 'reveal' ? picks[p.id] : null
          const color = i === 0 ? 'var(--blue)' : 'var(--orange)'
          return (
            <div key={p.id} style={{ textAlign: 'center' }}>
              <div
                style={{ fontFamily: 'var(--font-title)', fontSize: 28, color, marginBottom: 8 }}
              >
                {scores[p.id] ?? 0}
              </div>
              <div style={{ fontSize: 56, lineHeight: 1.1 }}>
                {pick ? (EMOJI[pick] ?? '?') : hasPicked ? '✅' : '⏳'}
              </div>
              <div className="label" style={{ opacity: 0.6, marginTop: 6 }}>
                {p.nickname}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
