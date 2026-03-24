import { MathsPanel, type SpectatorProps } from './spectatorHelpers'

export default function QuickMathsSpectator({ state, players }: SpectatorProps) {
  const s = state as {
    equations: Record<string, { question: string }>
    correct: Record<string, number>
  } | null
  const [p1, p2] = players
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <MathsPanel
        nickname={p1?.nickname ?? '…'}
        equation={s?.equations[p1?.id]?.question ?? '…'}
        correct={s?.correct[p1?.id] ?? 0}
        color="var(--blue)"
      />
      <div style={{ width: 3, background: 'var(--black)', opacity: 0.1 }} />
      <MathsPanel
        nickname={p2?.nickname ?? '…'}
        equation={s?.equations[p2?.id]?.question ?? '…'}
        correct={s?.correct[p2?.id] ?? 0}
        color="var(--orange)"
      />
    </div>
  )
}
