import { TwoColState, type SpectatorProps, type SpectatorPlayer } from './spectatorHelpers'

const COLOR_CSS: Record<string, string> = {
  red: '#e53e3e',
  blue: '#3182ce',
  green: '#38a169',
  yellow: '#d69e2e',
  orange: '#dd6b20',
  purple: '#805ad5',
}

export default function ColorWordSpectator({ state, players }: SpectatorProps) {
  const s = state as { word?: string; inkColor?: string; scores?: Record<string, number> } | null
  const [p1, p2] = players as [SpectatorPlayer | undefined, SpectatorPlayer | undefined]
  const ink = s?.inkColor ? (COLOR_CSS[s.inkColor] ?? 'var(--black)') : 'var(--black)'
  const word = (s?.word ?? '').toUpperCase()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        flex: 1,
      }}
    >
      <TwoColState
        p1={{ label: p1?.nickname ?? '…', value: s?.scores?.[p1?.id ?? ''] ?? 0, unit: 'pts' }}
        p2={{ label: p2?.nickname ?? '…', value: s?.scores?.[p2?.id ?? ''] ?? 0, unit: 'pts' }}
        color1="var(--blue)"
        color2="var(--orange)"
      />
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 64,
          color: ink,
          WebkitTextStroke: '2px rgba(0,0,0,0.15)',
          textShadow: '4px 4px 0 rgba(0,0,0,0.1)',
        }}
      >
        {word || '…'}
      </div>
    </div>
  )
}
