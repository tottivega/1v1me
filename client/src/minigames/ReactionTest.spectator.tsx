import type { SpectatorProps } from './spectatorHelpers'

export default function ReactionTestSpectator({ state }: SpectatorProps) {
  const s = state as { phase?: string } | null
  const phase = s?.phase ?? 'waiting'
  const bg = phase === 'ready' ? 'var(--green)' : phase === 'result' ? '#222' : '#cc2222'
  const label = phase === 'waiting' ? '⚠️ WAIT…' : phase === 'ready' ? '🟢 GO!' : '⏱ Result'
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        transition: 'background 0.2s',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 64,
          color: 'var(--white)',
          textShadow: '4px 4px 0 rgba(0,0,0,0.4)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
