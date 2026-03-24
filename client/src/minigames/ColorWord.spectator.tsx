import type { SpectatorProps } from './spectatorHelpers'

const COLOR_CSS: Record<string, string> = {
  red: '#e53e3e',
  blue: '#3182ce',
  green: '#38a169',
  yellow: '#d69e2e',
  orange: '#dd6b20',
  purple: '#805ad5',
}

export default function ColorWordSpectator({ state }: SpectatorProps) {
  const s = state as { word?: string; inkColor?: string } | null
  const ink = s?.inkColor ? (COLOR_CSS[s.inkColor] ?? 'var(--black)') : 'var(--black)'
  const word = (s?.word ?? '').toUpperCase()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 72,
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
