import { TwoColState, type SpectatorProps, type SpectatorPlayer } from './spectatorHelpers'

const COLOR_CSS: Record<string, string> = {
  red: '#e53e3e',
  blue: '#3182ce',
  green: '#38a169',
  yellow: '#d69e2e',
  orange: '#dd6b20',
  purple: '#805ad5',
}

type Puzzle = { word?: string; inkColor?: string }

export default function ColorWordSpectator({ state, players }: SpectatorProps) {
  const s = state as {
    puzzles?: Record<string, Puzzle>
    scores?: Record<string, number>
  } | null
  const [p1, p2] = players as [SpectatorPlayer | undefined, SpectatorPlayer | undefined]

  const p1Puzzle = p1 ? (s?.puzzles?.[p1.id] ?? null) : null
  const p2Puzzle = p2 ? (s?.puzzles?.[p2.id] ?? null) : null

  function WordDisplay({ puzzle, label }: { puzzle: Puzzle | null; label: string }) {
    const ink = puzzle?.inkColor ? (COLOR_CSS[puzzle.inkColor] ?? 'var(--black)') : 'var(--black)'
    const word = (puzzle?.word ?? '').toUpperCase()
    return (
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div className="label" style={{ opacity: 0.6, marginBottom: 8 }}>
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 40,
            color: ink,
            WebkitTextStroke: '1px rgba(0,0,0,0.15)',
            textShadow: '3px 3px 0 rgba(0,0,0,0.1)',
          }}
        >
          {word || '…'}
        </div>
      </div>
    )
  }

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
      <div style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'center' }}>
        <WordDisplay puzzle={p1Puzzle} label={p1?.nickname ?? '…'} />
        <WordDisplay puzzle={p2Puzzle} label={p2?.nickname ?? '…'} />
      </div>
    </div>
  )
}
