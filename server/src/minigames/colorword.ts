import type { MinigameModule } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] as const
type Color = (typeof COLORS)[number]

interface State {
  word: Color // the text shown
  inkColor: Color // the CSS color — must differ from word
  resolved: boolean
}

export function pick(): { word: Color; inkColor: Color } {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)]!
  const others = COLORS.filter((c) => c !== word)
  const inkColor = others[Math.floor(Math.random() * others.length)]!
  return { word, inkColor }
}

const colorword: MinigameModule = {
  id: 'colorword',

  start(room) {
    const { word, inkColor } = pick()
    const state: State = { word, inkColor, resolved: false }
    room.match!.minigameState = state
    broadcast(room, 'GAME_UPDATE', { state: { word, inkColor } })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PICK_COLOR') return

    const state = room.match!.minigameState as State | null
    if (!state) return // input arrived after round resolved
    if (state.resolved) return
    if (room.match!.roundResolved) return

    const correct = input.color === state.inkColor
    if (!correct) return // wrong pick — ignore, let them try again (timer ends it)

    state.resolved = true
    broadcast(room, 'GAME_UPDATE', {
      state: { word: state.word, inkColor: state.inkColor, winnerId: playerId },
    })
    room.match!.onRoundDone?.({ winnerId: playerId, reason: 'completed' })
  },

  getResult(room): MinigameResult {
    // Timeout: random winner
    const [p1, p2] = twoPlayers(room)
    const winnerId = randomWinner(p1, p2)
    broadcast(room, 'GAME_UPDATE', {
      state: {
        word: (room.match!.minigameState as State).word,
        inkColor: (room.match!.minigameState as State).inkColor,
        winnerId,
      },
    })
    return { winnerId, reason: 'timeout' }
  },
}

export default colorword
