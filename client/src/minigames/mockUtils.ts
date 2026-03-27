/**
 * Mock mode utilities for minigame components.
 * Use these inside useEffect to simulate opponent actions without a server.
 */

/**
 * Schedule fn to run after a random delay between minMs and maxMs.
 * Returns a cancel function — pass it directly as the useEffect cleanup return.
 *
 * @example
 * useEffect(() => {
 *   if (isLive || resolved) return
 *   return randomDelay(1500, 4500, () => {
 *     setMockWinnerId(Math.random() < 0.5 ? myPlayerId : oppId)
 *   })
 * }, [isLive, resolved, myPlayerId, oppId])
 */
export function randomDelay(minMs: number, maxMs: number, fn: () => void): () => void {
  const delay = minMs + Math.random() * (maxMs - minMs)
  const id = setTimeout(fn, delay)
  return () => clearTimeout(id)
}
