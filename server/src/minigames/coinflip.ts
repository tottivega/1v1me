import type { MinigameModule } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'

interface State {
  winnerId: string
  resolved: boolean
  timer: ReturnType<typeof setTimeout> | null
}

const coinflip: MinigameModule = {
  id: 'coinflip',

  start(room) {
    const [p1, p2] = twoPlayers(room)
    const winnerId = randomWinner(p1, p2)

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
    }, 4000)
  },

  handleInput(_room, _playerId, _input) {
    // No input for coin flip
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    return { winnerId: state.winnerId, reason: 'completed' }
  },

  cleanup(room) {
    const state = room.match?.minigameState as State | undefined
    if (state?.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
  },

  getSafeState(room) {
    const state = room.match?.minigameState as State | undefined
    if (!state) return null
    // Hide the winner until the flip animation resolves — spectators who join
    // mid-round must not see winnerId before the reveal broadcast.
    return {
      phase: state.resolved ? 'result' : 'flipping',
      ...(state.resolved ? { winnerId: state.winnerId } : {}),
    }
  },
}

export default coinflip
