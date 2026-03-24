import type { MinigameModule } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

const CPS_CAP = 20
const WINDOW_MS = 1000

interface State {
  clicks: Record<string, number>
  timestamps: Record<string, number[]> // for CPS cap
  // First-to-N tiebreaker: track when each player hit each click count
  firstTimes: Record<string, Record<number, number>>
}

const clickspeed: MinigameModule = {
  id: 'clickspeed',

  start(room) {
    const state: State = { clicks: {}, timestamps: {}, firstTimes: {} }
    for (const p of room.players) {
      state.clicks[p.id] = 0
      state.timestamps[p.id] = []
      state.firstTimes[p.id] = {}
    }
    room.match!.minigameState = state
    broadcast(room, 'GAME_UPDATE', { state: { clicks: state.clicks } })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'CLICK') return

    const state = room.match!.minigameState as State
    const now = Date.now()

    // CPS cap
    state.timestamps[playerId] = state.timestamps[playerId].filter((t) => now - t < WINDOW_MS)
    if (state.timestamps[playerId].length >= CPS_CAP) return

    state.timestamps[playerId].push(now)
    state.clicks[playerId]++
    const count = state.clicks[playerId]
    if (!state.firstTimes[playerId][count]) {
      state.firstTimes[playerId][count] = now
    }

    broadcast(room, 'GAME_UPDATE', { state: { clicks: state.clicks } })
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    const [p1, p2] = room.players
    const c1 = state.clicks[p1.id] ?? 0
    const c2 = state.clicks[p2.id] ?? 0

    if (c1 > c2) return { winnerId: p1.id, reason: 'timeout' }
    if (c2 > c1) return { winnerId: p2.id, reason: 'timeout' }

    // Tie: whoever hit their shared click count first
    const tied = c1
    const t1 = state.firstTimes[p1.id][tied] ?? Infinity
    const t2 = state.firstTimes[p2.id][tied] ?? Infinity
    const winnerId = t1 <= t2 ? p1.id : p2.id
    return { winnerId, reason: 'timeout' }
  },
}

export default clickspeed
