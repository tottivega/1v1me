import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'

interface Equation {
  question: string
  answer: number
}

interface State {
  equations: Record<string, Equation> // current equation per player
  correct: Record<string, number> // correct answer count per player
  lastCorrectTime: Record<string, number> // timestamp of each player's last correct answer
}

function generate(): Equation {
  const roll = Math.random()

  if (roll < 0.35) {
    // Addition: 2–25 + 2–25
    const a = Math.floor(Math.random() * 24) + 2
    const b = Math.floor(Math.random() * 24) + 2
    return { question: `${a} + ${b}`, answer: a + b }
  }

  if (roll < 0.65) {
    // Subtraction: always positive result, range 10–40 minus 2–15
    const b = Math.floor(Math.random() * 14) + 2
    const a = b + Math.floor(Math.random() * 20) + 1 // a > b guaranteed
    return { question: `${a} − ${b}`, answer: a - b }
  }

  // Multiplication: 2–12 × 2–12 (times-table range)
  const a = Math.floor(Math.random() * 11) + 2
  const b = Math.floor(Math.random() * 11) + 2
  return { question: `${a} × ${b}`, answer: a * b }
}

function broadcastState(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      equations: state.equations,
      correct: state.correct,
    },
  })
}

const quickmaths: MinigameModule = {
  id: 'quickmaths',

  start(room) {
    const state: State = { equations: {}, correct: {}, lastCorrectTime: {} }
    for (const p of room.players) {
      state.equations[p.id] = generate()
      state.correct[p.id] = 0
    }
    room.match!.minigameState = state
    broadcastState(room, state)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'ANSWER') return

    const state = room.match!.minigameState as State | null
    if (!state) return
    if (!state.equations[playerId]) return

    const submitted = Number(input.answer)
    if (!Number.isFinite(submitted)) return

    if (Math.round(submitted) === state.equations[playerId]!.answer) {
      state.correct[playerId] = (state.correct[playerId] ?? 0) + 1
      state.lastCorrectTime[playerId] = Date.now()
    }

    // Always rotate to a new equation (wrong answer = new problem, no penalty)
    state.equations[playerId] = generate()
    broadcastState(room, state)
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    const [p1, p2] = twoPlayers(room)
    const c1 = state.correct[p1.id] ?? 0
    const c2 = state.correct[p2.id] ?? 0

    if (c1 > c2) return { winnerId: p1.id, reason: 'timeout' }
    if (c2 > c1) return { winnerId: p2.id, reason: 'timeout' }

    // Tied on count — first to reach that score wins
    const t1 = state.lastCorrectTime[p1.id] ?? Infinity
    const t2 = state.lastCorrectTime[p2.id] ?? Infinity
    if (t1 !== t2) return { winnerId: t1 < t2 ? p1.id : p2.id, reason: 'timeout' }

    return { winnerId: randomWinner(p1, p2), reason: 'timeout' }
  },
}

export default quickmaths
