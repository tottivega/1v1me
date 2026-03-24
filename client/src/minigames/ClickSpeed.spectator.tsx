import { TwoColState, type SpectatorProps, type SpectatorPlayer } from './spectatorHelpers'

export default function ClickSpeedSpectator({ state, players }: SpectatorProps) {
  const s = state as { clicks: Record<string, number> } | null
  const [p1, p2] = players as [SpectatorPlayer | undefined, SpectatorPlayer | undefined]
  return (
    <TwoColState
      p1={{ label: p1?.nickname ?? '…', value: s?.clicks[p1?.id ?? ''] ?? 0, unit: 'clicks' }}
      p2={{ label: p2?.nickname ?? '…', value: s?.clicks[p2?.id ?? ''] ?? 0, unit: 'clicks' }}
      color1="var(--blue)"
      color2="var(--orange)"
    />
  )
}
