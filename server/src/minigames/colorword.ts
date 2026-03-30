import type { MinigameModule } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers } from '../utils/gameUtils'

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] as const
type Color = (typeof COLORS)[number]

interface State {
  word: Color
  inkColor: Color
  scores: Record<string, number>
  firstTimes: Record<string, Record<number, number>> // playerId → score → timestamp
  puzzleSeq: number
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
    const [p1, p2] = twoPlayers(room)
    const { word, inkColor } = pick()
    const state: State = {
      word,
      inkColor,
      scores: { [p1.id]: 0, [p2.id]: 0 },
      firstTimes: { [p1.id]: {}, [p2.id]: {} },
      puzzleSeq: 0,
    }
    room.match!.minigameState = state
    broadcast(room, 'GAME_UPDATE', {
      state: { word, inkColor, scores: state.scores, puzzleSeq: 0 },
    })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PICK_COLOR') return

    const state = room.match!.minigameState as State | null
    if (!state) return
    if (room.match!.roundResolved) return

    const correct = input.color === state.inkColor
    if (correct) {
      state.scores[playerId] = (state.scores[playerId] ?? 0) + 1
      const score = state.scores[playerId]!
      if (!state.firstTimes[playerId]) state.firstTimes[playerId] = {}
      if (!state.firstTimes[playerId]![score]) {
        state.firstTimes[playerId]![score] = Date.now()
      }
    }

    // New puzzle regardless of correct or wrong
    const { word, inkColor } = pick()
    state.word = word
    state.inkColor = inkColor
    state.puzzleSeq++

    broadcast(room, 'GAME_UPDATE', {
      state: { word, inkColor, scores: state.scores, puzzleSeq: state.puzzleSeq },
    })
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    const [p1, p2] = twoPlayers(room)
    const s1 = state.scores[p1.id] ?? 0
    const s2 = state.scores[p2.id] ?? 0

    let winnerId: string
    if (s1 > s2) {
      winnerId = p1.id
    } else if (s2 > s1) {
      winnerId = p2.id
    } else {
      // Tie: whoever reached score N first wins
      const tied = s1
      const t1 = (state.firstTimes[p1.id] ?? {})[tied] ?? Infinity
      const t2 = (state.firstTimes[p2.id] ?? {})[tied] ?? Infinity
      winnerId = t1 <= t2 ? p1.id : p2.id
    }

    broadcast(room, 'GAME_UPDATE', {
      state: { ...pick(), scores: state.scores, puzzleSeq: state.puzzleSeq + 1, winnerId },
    })
    return { winnerId, reason: 'timeout' }
  },
}

export default colorword
