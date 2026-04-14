import type { SpectatorProps } from './spectatorHelpers'
import type { KaboomState } from '@shared/types'

const WIRE_COLORS = [
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#f06292',
  '#00897b',
]
const WIRE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export default function KaboomSpectator({ state, players }: SpectatorProps) {
  const s = state as KaboomState | null
  const wires = s?.wires ?? Array.from({ length: 8 }, (_, i) => i)
  const eliminated = s?.eliminated ?? []
  const phase = s?.phase ?? 'picking'
  const currentPlayerId = s?.currentPlayerId ?? ''
  const lastPick = s?.lastPick ?? null
  const winnerId = s?.winnerId ?? null

  const currentPlayer = players.find((p) => p.id === currentPlayerId)
  const winner = players.find((p) => p.id === winnerId)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        flex: 1,
        padding: 24,
      }}
    >
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 28 }}>KABOOM! 💣</div>

      {/* Status */}
      <div className="label" style={{ opacity: 0.7, textAlign: 'center' }}>
        {winnerId
          ? `💥 ${winner?.nickname ?? '?'} wins!`
          : phase === 'picking'
            ? `${currentPlayer?.nickname ?? '?'}'s turn to cut`
            : lastPick?.isBomb
              ? '💥 BOOM!'
              : `Wire ${WIRE_LABELS[lastPick?.wire ?? 0]} was safe`}
      </div>

      {/* Wire grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 56px)', gap: 8 }}>
        {Array.from({ length: 8 }, (_, i) => {
          const isEliminated = eliminated.includes(i)
          const isRemaining = wires.includes(i)
          const wasJustPicked = lastPick?.wire === i && phase === 'reveal'
          const isBombReveal = wasJustPicked && lastPick?.isBomb

          return (
            <div
              key={i}
              style={{
                width: 56,
                height: 56,
                background: isBombReveal ? '#1a1a1a' : WIRE_COLORS[i],
                border: '3px solid var(--black)',
                borderRadius: 12,
                boxShadow: isEliminated || !isRemaining ? 'none' : '3px 3px 0 var(--black)',
                opacity: isEliminated ? 0.2 : !isRemaining && !wasJustPicked ? 0.2 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-title)',
                fontSize: wasJustPicked ? 22 : 20,
                color: '#fff',
                textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
                outline: wasJustPicked
                  ? `3px solid ${lastPick?.isBomb ? 'var(--red)' : 'var(--green)'}`
                  : 'none',
                outlineOffset: 2,
                transition: 'opacity 0.2s',
              }}
            >
              {isEliminated
                ? '✓'
                : isBombReveal
                  ? '💥'
                  : wasJustPicked && !lastPick?.isBomb
                    ? '✓'
                    : WIRE_LABELS[i]}
            </div>
          )
        })}
      </div>

      {/* Players */}
      <div style={{ display: 'flex', gap: 32, marginTop: 4 }}>
        {players.map((p) => (
          <div key={p.id} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>
              {winnerId === p.id ? '🏆' : winnerId ? '💀' : p.id === currentPlayerId ? '👆' : '⏳'}
            </div>
            <div className="label" style={{ opacity: 0.7, marginTop: 2 }}>
              {p.nickname}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
