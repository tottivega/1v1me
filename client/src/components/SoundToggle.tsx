import { useState } from 'react'
import { getVolume, setVolume } from '../utils/sounds'

export default function SoundToggle() {
  const [volume, setVolumeState] = useState(getVolume)

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10) / 100
    setVolume(v)
    setVolumeState(v)
  }

  function toggleMute() {
    const next = volume === 0 ? 0.7 : 0
    setVolume(next)
    setVolumeState(next)
  }

  const icon = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 14,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--white)',
        border: 'var(--border)',
        borderRadius: 10,
        padding: '4px 10px 4px 6px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        onClick={toggleMute}
        title={volume === 0 ? 'Unmute' : 'Mute'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          padding: 0,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {icon}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(volume * 100)}
        onChange={handleSlider}
        title={`Volume: ${Math.round(volume * 100)}%`}
        style={{
          width: 64,
          accentColor: 'var(--orange)',
          cursor: 'pointer',
        }}
      />
    </div>
  )
}
