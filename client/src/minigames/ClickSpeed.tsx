import { useState, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playClickHit } from '../utils/sounds'
import { type ClickSpeedState, CLICKSPEED_CPS_CAP } from '@shared/types'

interface Ripple {
  id: number
  x: number
  y: number
}

export default function ClickSpeed() {
  const { myPlayerId, players, sendInput, minigameState, isMockMatch } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)

  const [localMyClicks, setLocalMyClicks] = useState(0)
  const [localOppClicks, setLocalOppClicks] = useState(0)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [isPressed, setIsPressed] = useState(false)
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
    if (clickTimestamps.current.length >= CLICKSPEED_CPS_CAP) return
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
          Click as fast as you can for 10 seconds!
        </div>
      </div>

      <div
        style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 480, alignItems: 'flex-end' }}
      >
        <ClickBar label="You" clicks={myClicks} color="var(--blue)" />
        <ClickBar label={opponent?.nickname ?? '???'} clicks={oppClicks} color="var(--orange)" />
      </div>

      {/* Bomb button */}
      <div style={{ perspective: 600 }}>
        <button
          ref={btnRef}
          onMouseDown={(e) => {
            setIsPressed(true)
            handleClick(e.clientX, e.clientY)
          }}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => setIsPressed(false)}
          onTouchStart={(e) => {
            e.preventDefault()
            setIsPressed(true)
            const t = e.touches[0]!
            handleClick(t.clientX, t.clientY)
          }}
          onTouchEnd={() => setIsPressed(false)}
          style={{
            position: 'relative',
            overflow: 'hidden',
            width: 180,
            height: 180,
            borderRadius: '50%',
            lineHeight: 1,
            touchAction: 'manipulation',
            cursor: 'pointer',
            border: '5px solid var(--black)',
            background: isPressed
              ? 'radial-gradient(circle at 40% 38%, #ff5555 0%, #bb0000 55%, #6b0000 100%)'
              : 'radial-gradient(circle at 32% 28%, #ff8888 0%, #dd0000 50%, #880000 100%)',
            boxShadow: isPressed
              ? '0 2px 0 #550000, 2px 5px 0 var(--black)'
              : '0 10px 0 #770000, 5px 16px 0 var(--black)',
            transform: isPressed
              ? 'rotateX(20deg) translateY(8px)'
              : 'rotateX(20deg) translateY(0)',
            transition: 'transform 0.06s, box-shadow 0.06s, background 0.06s',
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
                background: 'rgba(255,255,255,0.35)',
                animation: 'ripple 0.5s ease-out forwards',
                pointerEvents: 'none',
              }}
            />
          ))}
        </button>
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
            width: `${Math.min(100, (clicks / 200) * 100)}%`,
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
