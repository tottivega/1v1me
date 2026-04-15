import type { Room } from '../types'
import { broadcast } from '../sync/broadcast'

const TICK_INTERVAL_MS = 1000

export function startTimer(room: Room, onTimeout: () => void): void {
  if (!room.match) return
  stopTimer(room)

  // Do NOT reset paused here — it is owned by pauseTimer/resumeTimer.
  // Overwriting it here would undo a disconnect-pause if a new round accidentally
  // starts while a player is still reconnecting (see roundReadyTimer fix).

  room.match.tickInterval = setInterval(() => {
    if (!room.match || room.match.paused) return

    room.match.remainingMs = Math.max(0, room.match.remainingMs - TICK_INTERVAL_MS)
    broadcast(room, 'TIMER_TICK', { remainingMs: room.match.remainingMs })

    if (room.match.remainingMs <= 0) {
      stopTimer(room)
      onTimeout()
    }
  }, TICK_INTERVAL_MS)
}

export function stopTimer(room: Room): void {
  if (room.match?.tickInterval) {
    clearInterval(room.match.tickInterval)
    room.match.tickInterval = null
  }
}

export function pauseTimer(room: Room): void {
  if (room.match) room.match.paused = true
}

export function resumeTimer(room: Room): void {
  if (room.match) room.match.paused = false
}
