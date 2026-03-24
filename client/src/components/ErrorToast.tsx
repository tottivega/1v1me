import { useGameStore } from '../store/gameStore'

const BG: Record<string, string> = {
  error: 'var(--red)',
  success: 'var(--green)',
  info: 'var(--blue)',
}
const ICON: Record<string, string> = { error: '⚠️', success: '✅', info: 'ℹ️' }

export default function ErrorToast() {
  const toasts = useGameStore((s) => s.toasts)
  const dismissToast = useGameStore((s) => s.dismissToast)
  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-pop"
          onClick={() => dismissToast(t.id)}
          style={{
            background: BG[t.type] ?? BG.error,
            color: 'var(--white)',
            fontFamily: 'var(--font-title)',
            fontSize: 16,
            padding: '12px 24px',
            borderRadius: 12,
            border: 'var(--border)',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
            pointerEvents: 'all',
            cursor: 'pointer',
          }}
        >
          {ICON[t.type]} {t.message}
        </div>
      ))}
    </div>
  )
}
