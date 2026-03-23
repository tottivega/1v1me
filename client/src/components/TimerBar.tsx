import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

export default function TimerBar() {
  const { remainingMs, timeoutMs, mockSetRemainingMs, roomStatus, wsStatus } = useGameStore()
  const intervalRef = useRef<number | null>(null)
  const isPlaying = roomStatus === 'playing'
  const useMockTimer = wsStatus !== 'connected'

  // Local tick only in mock/dev mode — real ticks come from server TIMER_TICK
  useEffect(() => {
    if (!isPlaying || !useMockTimer) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = window.setInterval(() => {
      const current = useGameStore.getState().remainingMs
      if (current <= 0) clearInterval(intervalRef.current!)
      else mockSetRemainingMs(Math.max(0, current - 100))
    }, 100)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, useMockTimer, mockSetRemainingMs])

  const pct = timeoutMs > 0 ? remainingMs / timeoutMs : 0
  const secs = Math.ceil(remainingMs / 1000)
  const color = pct > 0.33 ? 'var(--green)' : pct > 0.15 ? 'var(--yellow)' : 'var(--red)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', background: 'var(--white)', borderBottom: 'var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-title)', fontSize: 28, color, minWidth: 36, textAlign: 'right', transition: 'color 0.3s' }}>
        {secs}
      </span>
      <div style={{ flex: 1, height: 18, background: '#e0e0e0', border: '2px solid var(--black)', borderRadius: 99, overflow: 'hidden' }}>
        <div data-testid="timer-bar-fill" style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 99, transition: 'width 0.1s linear, background 0.3s' }} />
      </div>
    </div>
  )
}
