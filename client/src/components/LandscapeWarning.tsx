import { useState, useEffect } from 'react'

function isNarrowLandscape() {
  return window.innerHeight < 380 && window.innerWidth > window.innerHeight
}

export default function LandscapeWarning() {
  const [show, setShow] = useState(isNarrowLandscape)

  useEffect(() => {
    function update() {
      setShow(isNarrowLandscape())
    }
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--yellow)',
        borderBottom: 'var(--border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 13 }}>
        📱 Rotate your phone for a better experience
      </span>
      <button
        onClick={() => setShow(false)}
        style={{
          background: 'none',
          border: 'none',
          fontWeight: 900,
          fontSize: 16,
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
