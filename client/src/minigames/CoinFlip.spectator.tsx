import type { SpectatorProps } from './spectatorHelpers'

export default function CoinFlipSpectator({ state }: SpectatorProps) {
  const s = state as { phase?: string } | null
  const isFlipping = !s || s.phase === 'flipping'
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          border: '5px solid var(--black)',
          boxShadow: '6px 6px 0 var(--black)',
          background: 'var(--yellow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 64,
          animation: isFlipping ? 'coin-spin 0.4s linear infinite' : 'bounce-in 0.4s ease both',
        }}
      >
        🪙
      </div>
      <div className="subtitle anim-pulse" style={{ opacity: 0.7 }}>
        {isFlipping ? 'Flipping…' : 'Result!'}
      </div>
      <style>{`@keyframes coin-spin{0%{transform:scaleX(1)}50%{transform:scaleX(0.1)}100%{transform:scaleX(1)}}`}</style>
    </div>
  )
}
