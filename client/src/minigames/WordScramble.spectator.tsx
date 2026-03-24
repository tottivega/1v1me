import { TwoColState, type SpectatorProps, type SpectatorPlayer } from './spectatorHelpers'

export default function WordScrambleSpectator({ state, players }: SpectatorProps) {
  const s = state as { scrambled?: string; attempts?: Record<string, number> } | null
  const [p1, p2] = players as [SpectatorPlayer | undefined, SpectatorPlayer | undefined]
  const scrambled = s?.scrambled ?? '…'
  const attempts = s?.attempts ?? {}
  return (
    <TwoColState
      p1={{ label: p1?.nickname ?? '…', value: attempts[p1?.id ?? ''] ?? 0, unit: 'wrong guesses' }}
      p2={{ label: p2?.nickname ?? '…', value: attempts[p2?.id ?? ''] ?? 0, unit: 'wrong guesses' }}
      color1="var(--blue)"
      color2="var(--orange)"
      extra={`🔤 ${scrambled}`}
    />
  )
}
