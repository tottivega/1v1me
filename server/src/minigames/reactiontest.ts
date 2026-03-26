import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

interface State {
  signalTime: number | null
  reactions: Record<string, number> // playerId → ms after signal
  penalized: Set<string> // clicked before signal
  resolved: boolean
}

// Per-room timer refs — kept off the state object so they don't pollute
// the minigameState snapshot sent to spectators.
const activeTimers = new Map<
  string,
  { signal: ReturnType<typeof setTimeout> | null; window: ReturnType<typeof setTimeout> | null }
>()

const REACTION_WINDOW_MS = 3000
const MIN_DELAY_MS = 1500
const MAX_DELAY_MS = 4000

function clearTimers(roomId: string) {
  const t = activeTimers.get(roomId)
  if (t) {
    if (t.signal) clearTimeout(t.signal)
    if (t.window) clearTimeout(t.window)
    activeTimers.delete(roomId)
  }
}

const reactiontest: MinigameModule = {
  id: 'reactiontest',

  start(room) {
    const state: State = {
      signalTime: null,
      reactions: {},
      penalized: new Set(),
      resolved: false,
    }
    room.match!.minigameState = state

    broadcast(room, 'GAME_UPDATE', { state: { phase: 'waiting' } })

    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
    const timers = {
      signal: null as ReturnType<typeof setTimeout> | null,
      window: null as ReturnType<typeof setTimeout> | null,
    }
    activeTimers.set(room.roomId, timers)

    timers.signal = setTimeout(() => {
      if (state.resolved) return

      state.signalTime = Date.now()
      broadcast(room, 'GAME_UPDATE', { state: { phase: 'ready' } })

      // 3-second window to react
      timers.window = setTimeout(() => {
        if (!state.resolved) resolve(room, state)
      }, REACTION_WINDOW_MS)
    }, delay)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'REACT') return

    const state = room.match!.minigameState as State | null
    if (!state) return // input arrived after round resolved
    if (state.resolved) return
    if (state.reactions[playerId] !== undefined) return // already reacted

    if (state.signalTime === null) {
      // Too early — penalize
      state.penalized.add(playerId)
      broadcast(room, 'GAME_UPDATE', { state: { phase: 'waiting', penalized: playerId } })

      // If both penalized, treat as draw
      if (state.penalized.size >= room.players.length) {
        resolve(room, state)
      }
      return
    }

    state.reactions[playerId] = Date.now() - state.signalTime

    // If all non-penalized players have reacted, resolve
    const eligible = room.players.filter((p) => !state.penalized.has(p.id))
    const allReacted = eligible.every((p) => state.reactions[p.id] !== undefined)
    if (allReacted) resolve(room, state)
  },

  getResult(room): MinigameResult {
    return computeResult(
      room.players.map((p) => p.id),
      room.match!.minigameState as State
    )
  },

  cleanup(room) {
    clearTimers(room.roomId)
  },
}

function resolve(room: Room, state: State): void {
  if (state.resolved) return
  state.resolved = true

  clearTimers(room.roomId)

  const playerIds = room.players.map((p) => p.id)
  const result = computeResult(playerIds, state)

  broadcast(room, 'GAME_UPDATE', {
    state: {
      phase: 'result',
      reactions: state.reactions,
      penalized: [...state.penalized],
      winnerId: result.winnerId,
    },
  })

  setTimeout(() => {
    room.match!.onRoundDone?.(result)
  }, 1500)
}

function computeResult(playerIds: string[], state: State): MinigameResult {
  const eligible = playerIds.filter((id) => !state.penalized.has(id))

  if (eligible.length === 0) {
    // Everyone penalized → random winner
    const winnerId = playerIds[Math.floor(Math.random() * playerIds.length)] ?? null
    return { winnerId, reason: 'completed' }
  }

  if (eligible.length === 1) {
    return { winnerId: eligible[0] ?? null, reason: 'completed' }
  }

  // Compare reaction times — lower is better
  const withReaction = eligible.filter((id) => state.reactions[id] !== undefined)

  if (withReaction.length === 0) {
    // Nobody reacted in window → random winner
    const winnerId = eligible[Math.floor(Math.random() * eligible.length)] ?? null
    return { winnerId, reason: 'timeout' }
  }

  if (withReaction.length === 1) {
    return { winnerId: withReaction[0] ?? null, reason: 'completed' }
  }

  withReaction.sort((a, b) => (state.reactions[a] ?? 0) - (state.reactions[b] ?? 0))
  return { winnerId: withReaction[0] ?? null, reason: 'completed' }
}

export default reactiontest
