import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

interface State {
  winnerId: string
  resolved: boolean
  timer: ReturnType<typeof setTimeout> | null
}

const coinflip: MinigameModule = {
  id: 'coinflip',

  start(room) {
    const [p1, p2] = room.players
    const winnerId = Math.random() < 0.5 ? p1.id : p2.id

    const state: State = { winnerId, resolved: false, timer: null }
    room.match!.minigameState = state

    broadcast(room, 'GAME_UPDATE', { state: { phase: 'flipping' } })

    // Resolve after short delay so client can animate the coin flip
    state.timer = setTimeout(() => {
      if (room.match!.roundResolved) return
      state.resolved = true
      broadcast(room, 'GAME_UPDATE', { state: { phase: 'result', winnerId } })

      setTimeout(() => {
        room.match!.onRoundDone?.({ winnerId, reason: 'completed' })
      }, 1200)
    }, 2000)
  },

  handleInput(_room, _playerId, _input) {
    // No input for coin flip
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    return { winnerId: state.winnerId, reason: 'completed' }
  },
}

export default coinflip
