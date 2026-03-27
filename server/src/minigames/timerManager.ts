/**
 * RoomTimerManager — reusable per-room timeout tracker for server minigame modules.
 *
 * Encapsulates the module-level Map<roomId, timeout> pattern so each game module
 * doesn't need to manually manage cleanup. Create one instance per timer role
 * (e.g. one for throw timeouts, one for reveal delays if both need cancellation).
 *
 * @example
 * const throwTimer = new RoomTimerManager()
 *
 * // start (automatically cancels any existing timer for this room)
 * throwTimer.set(room.roomId, THROW_TIMEOUT_MS, () => { resolveThrow(room) })
 *
 * // cancel explicitly (e.g. when both players pick before the timeout)
 * throwTimer.clear(room.roomId)
 */
export class RoomTimerManager {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  /** Schedule fn after delay ms. Cancels any existing timer for this room first. */
  set(roomId: string, delay: number, fn: () => void): void {
    this.clear(roomId)
    this.timers.set(
      roomId,
      setTimeout(() => {
        this.timers.delete(roomId)
        fn()
      }, delay)
    )
  }

  /** Cancel the pending timer for this room (no-op if none). */
  clear(roomId: string): void {
    const t = this.timers.get(roomId)
    if (t !== undefined) {
      clearTimeout(t)
      this.timers.delete(roomId)
    }
  }
}
