import { useState } from 'react'
import { isMuted, setMuted } from '../utils/sounds'

export default function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted)

  function toggle() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <button
      onClick={toggle}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
      style={{
        position: 'fixed',
        top: 14,
        right: 14,
        zIndex: 200,
        background: 'var(--white)',
        border: 'var(--border)',
        borderRadius: 10,
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        padding: 0,
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
