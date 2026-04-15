import type { MinigameModule } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] as const
type Color = (typeof COLORS)[number]

// Minimum ms a player must wait between picks. Human Stroop-task reaction is
// 300ms+; 150ms is generous for network jitter but blocks rapid-fire exploits.
const MIN_PICK_INTERVAL_MS = 150

interface PlayerPuzzle {
  word: Color
  inkColor: Color
  seq: number
}

interface State {
  puzzles: Record<string, PlayerPuzzle> // per-player independent puzzles
  scores: Record<string, number>
  firstTimes: Record<string, Record<number, number>> // playerId → score → timestamp
  lastPickTime: Record<string, number> // playerId → timestamp of last accepted pick
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
    const p1Puzzle = pick()
    const p2Puzzle = pick()
    const state: State = {
      puzzles: {
        [p1.id]: { ...p1Puzzle, seq: 0 },
        [p2.id]: { ...p2Puzzle, seq: 0 },
      },
      scores: { [p1.id]: 0, [p2.id]: 0 },
      firstTimes: { [p1.id]: {}, [p2.id]: {} },
      lastPickTime: {},
    }
    room.match!.minigameState = state
    broadcast(room, 'GAME_UPDATE', {
      state: { puzzles: state.puzzles, scores: state.scores },
    })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PICK_COLOR') return

    const state = room.match!.minigameState as State | null
    if (!state) return
    if (room.match!.roundResolved) return

    const now = Date.now()
    const lastPick = state.lastPickTime[playerId] ?? 0
    if (now - lastPick < MIN_PICK_INTERVAL_MS) return
    state.lastPickTime[playerId] = now

    const puzzle = state.puzzles[playerId]
    if (!puzzle) return

    const correct = input.color === puzzle.inkColor
    if (correct) {
      state.scores[playerId] = (state.scores[playerId] ?? 0) + 1
      const score = state.scores[playerId]!
      if (!state.firstTimes[playerId]) state.firstTimes[playerId] = {}
      if (!state.firstTimes[playerId]![score]) {
        state.firstTimes[playerId]![score] = Date.now()
      }
    }

    // Advance only this player's puzzle
    const { word, inkColor } = pick()
    state.puzzles[playerId] = { word, inkColor, seq: puzzle.seq + 1 }

    broadcast(room, 'GAME_UPDATE', {
      state: { puzzles: state.puzzles, scores: state.scores },
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
      // Tie: whoever reached score N first wins; true dead-heat → random
      const tied = s1
      const t1 = (state.firstTimes[p1.id] ?? {})[tied] ?? Infinity
      const t2 = (state.firstTimes[p2.id] ?? {})[tied] ?? Infinity
      winnerId = t1 < t2 ? p1.id : t2 < t1 ? p2.id : randomWinner(p1, p2)
    }

    broadcast(room, 'GAME_UPDATE', {
      state: {
        puzzles: state.puzzles,
        scores: state.scores,
        winnerId,
      },
    })
    return { winnerId, reason: 'timeout' }
  },
}

export default colorword
