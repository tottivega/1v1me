import { TwoColState, type SpectatorProps, type SpectatorPlayer } from './spectatorHelpers'

export default function NumberGuessSpectator({ state, players }: SpectatorProps) {
  const s = state as { phase?: string; guesses?: Record<string, number>; secret?: number } | null
  const [p1, p2] = players as [SpectatorPlayer | undefined, SpectatorPlayer | undefined]
  const p1Guessed = s?.guesses?.[p1?.id ?? ''] !== undefined
  const p2Guessed = s?.guesses?.[p2?.id ?? ''] !== undefined
  return (
    <TwoColState
      p1={{
        label: p1?.nickname ?? '…',
        value: p1Guessed ? (s!.guesses![p1!.id] ?? '?') : '?',
        unit: p1Guessed ? 'guessed' : 'thinking…',
      }}
      p2={{
        label: p2?.nickname ?? '…',
        value: p2Guessed ? (s!.guesses![p2!.id] ?? '?') : '?',
        unit: p2Guessed ? 'guessed' : 'thinking…',
      }}
      color1="var(--blue)"
      color2="var(--orange)"
      extra={s?.phase === 'reveal' && s.secret !== undefined ? `Secret was ${s.secret}` : undefined}
    />
  )
}
