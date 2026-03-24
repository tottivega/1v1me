import type { MinigameModule } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

interface State {
  secret: number
  guesses: Record<string, number> // playerId → guess (first only)
}

const numberguess: MinigameModule = {
  id: 'numberguess',

  start(room) {
    const secret = Math.floor(Math.random() * 100) + 1
    const state: State = { secret, guesses: {} }
    room.match!.minigameState = state
    // Don't reveal secret yet
    broadcast(room, 'GAME_UPDATE', { state: { phase: 'guessing' } })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'GUESS') return

    const state = room.match!.minigameState as State
    if (state.guesses[playerId] !== undefined) return // first guess only

    const value = Number(input.value)
    if (!Number.isInteger(value) || value < 1 || value > 100) return

    state.guesses[playerId] = value

    // Acknowledge this player submitted (don't reveal to others)
    broadcast(room, 'GAME_UPDATE', {
      state: {
        submitted: Object.keys(state.guesses),
        count: Object.keys(state.guesses).length,
      },
    })

    // If all players guessed, resolve early
    const allGuessed = room.players.every((p) => state.guesses[p.id] !== undefined)
    if (allGuessed) {
      room.match!.onRoundDone?.(this.getResult(room))
    }
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    const [p1, p2] = room.players

    const g1 = state.guesses[p1.id]
    const g2 = state.guesses[p2.id]

    // Player who didn't guess loses
    if (g1 === undefined && g2 === undefined) {
      const winnerId = Math.random() < 0.5 ? p1.id : p2.id
      return { winnerId, reason: 'timeout' }
    }
    if (g1 === undefined) return { winnerId: p2.id, reason: 'timeout' }
    if (g2 === undefined) return { winnerId: p1.id, reason: 'timeout' }

    const d1 = Math.abs(g1 - state.secret)
    const d2 = Math.abs(g2 - state.secret)

    let winnerId: string
    if (d1 < d2) winnerId = p1.id
    else if (d2 < d1) winnerId = p2.id
    else winnerId = Math.random() < 0.5 ? p1.id : p2.id // equidistant → random

    // Broadcast reveal (guesses + secret) before resolving
    broadcast(room, 'GAME_UPDATE', {
      state: {
        phase: 'reveal',
        secret: state.secret,
        guesses: state.guesses,
        winnerId,
      },
    })

    return { winnerId, reason: 'completed' }
  },
}

export default numberguess
