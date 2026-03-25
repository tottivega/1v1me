import { useState, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playClickHit } from '../utils/sounds'
import { type ClickSpeedState } from '@shared/types'

const CPS_CAP = 20

interface Ripple {
  id: number
  x: number
  y: number
}

export default function ClickSpeed() {
  const { myPlayerId, players, sendInput, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected' && minigameState !== null
  const opponent = players.find((p) => p.id !== myPlayerId)

  const [localMyClicks, setLocalMyClicks] = useState(0)
  const [localOppClicks, setLocalOppClicks] = useState(0)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const clickTimestamps = useRef<number[]>([])
  const btnRef = useRef<HTMLButtonElement>(null)

  const serverState = isLive ? (minigameState as ClickSpeedState | null) : null
  const myClicks = isLive
    ? Math.max(localMyClicks, serverState?.clicks[myPlayerId] ?? 0)
    : localMyClicks
  const oppClicks = isLive ? (serverState?.clicks[opponent?.id ?? ''] ?? 0) : localOppClicks

  function spawnRipple(clientX: number, clientY: number) {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const id = Date.now() + Math.random()
    setRipples((prev) => [...prev, { id, x: clientX - rect.left, y: clientY - rect.top }])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 550)
  }

  function handleClick(clientX = 0, clientY = 0) {
    const now = Date.now()
    clickTimestamps.current = clickTimestamps.current.filter((t) => now - t < 1000)
    if (clickTimestamps.current.length >= CPS_CAP) return
    clickTimestamps.current.push(now)

    playClickHit()
    spawnRipple(clientX, clientY)
    setLocalMyClicks((c) => c + 1)
    sendInput({ type: 'CLICK' })

    if (!isLive && Math.random() < 0.7) {
      setTimeout(() => setLocalOppClicks((c) => c + 1), Math.random() * 150)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        flex: 1,
        padding: 32,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 36, color: 'var(--orange)' }}>
          CLICK SPEED 👆
        </div>
        <div className="subtitle" style={{ opacity: 0.6, fontSize: 15 }}>
          Click as fast as you can!
        </div>
      </div>

      <div
        style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 480, alignItems: 'flex-end' }}
      >
        <ClickBar label="You" clicks={myClicks} color="var(--blue)" />
        <ClickBar label={opponent?.nickname ?? '???'} clicks={oppClicks} color="var(--orange)" />
      </div>

      <button
        ref={btnRef}
        className="btn btn-orange"
        onMouseDown={(e) => handleClick(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          e.preventDefault()
          const t = e.touches[0]!
          handleClick(t.clientX, t.clientY)
        }}
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: 180,
          height: 180,
          borderRadius: '50%',
          fontSize: 52,
          border: '4px solid var(--black)',
          boxShadow: '6px 6px 0px var(--black)',
          lineHeight: 1,
          touchAction: 'manipulation',
        }}
      >
        {ripples.map((r) => (
          <span
            key={r.id}
            style={{
              position: 'absolute',
              left: r.x - 16,
              top: r.y - 16,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.45)',
              animation: 'ripple 0.5s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        ))}
        👊
      </button>

      <div className="label" style={{ opacity: 0.5 }}>
        Smash that button!
      </div>
    </div>
  )
}

function ClickBar({ label, clicks, color }: { label: string; clicks: number; color: string }) {
  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
    >
      <span style={{ fontFamily: 'var(--font-title)', fontSize: 48, color, lineHeight: 1 }}>
        {clicks}
      </span>
      <div
        style={{
          width: '100%',
          height: 12,
          background: '#e0e0e0',
          border: '2px solid var(--black)',
          borderRadius: 99,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, (clicks / 80) * 100)}%`,
            background: color,
            borderRadius: 99,
            transition: 'width 0.1s',
          }}
        />
      </div>
      <span className="label">{label}</span>
    </div>
  )
}
