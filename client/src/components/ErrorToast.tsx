import { useGameStore } from '../store/gameStore'

export default function ErrorToast() {
  const errorMessage = useGameStore(s => s.errorMessage)
  if (!errorMessage) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--red)',
      color: 'var(--white)',
      fontFamily: 'var(--font-title)',
      fontSize: 16,
      padding: '12px 24px',
      borderRadius: 12,
      border: 'var(--border)',
      boxShadow: '4px 4px 0 rgba(0,0,0,0.4)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}
      className="anim-pop"
    >
      ⚠️ {errorMessage}
    </div>
  )
}
