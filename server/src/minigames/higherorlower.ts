import type { MinigameModule } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'

interface State {
  target: number
  clue: number
  answers: Record<string, 'higher' | 'lower'>
}

export function generatePuzzle(): { target: number; clue: number } {
  const target = Math.floor(Math.random() * 98) + 2 // 2–99
  const offset = Math.floor(Math.random() * 20) + 1
  const goHigher = Math.random() < 0.5
  // Clamping can make clue === target (e.g. target=99, going higher).
  // Fall back to the opposite direction in that case.
  let clue = goHigher ? Math.min(99, target + offset) : Math.max(1, target - offset)
  if (clue === target)
    clue = goHigher ? Math.max(1, target - offset) : Math.min(99, target + offset)
  return { target, clue }
}

const higherorlower: MinigameModule = {
  id: 'higherorlower',

  start(room) {
    const { target, clue } = generatePuzzle()
    const state: State = { target, clue, answers: {} }
    room.match!.minigameState = state
    // Only send clue — keep target hidden
    broadcast(room, 'GAME_UPDATE', { state: { clue, phase: 'guessing' } })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PICK_DIRECTION') return

    const state = room.match!.minigameState as State
    if (state.answers[playerId] !== undefined) return // already answered

    state.answers[playerId] = input.answer as 'higher' | 'lower'

    broadcast(room, 'GAME_UPDATE', {
      state: { clue: state.clue, phase: 'guessing', submitted: Object.keys(state.answers) },
    })

    const allAnswered = room.players.every((p) => state.answers[p.id] !== undefined)
    if (allAnswered) {
      room.match!.onRoundDone?.(this.getResult(room))
    }
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    const correct: 'higher' | 'lower' = state.target > state.clue ? 'higher' : 'lower'

    const scorers = room.players.filter((p) => state.answers[p.id] === correct)
    let winnerId: string

    if (scorers.length === 1) {
      winnerId = scorers[0]!.id
    } else {
      // Both correct or both wrong (or timeout) → random
      const [p1, p2] = twoPlayers(room)
      winnerId = randomWinner(p1, p2)
    }

    broadcast(room, 'GAME_UPDATE', {
      state: {
        clue: state.clue,
        phase: 'reveal',
        target: state.target,
        correct,
        answers: state.answers,
        winnerId,
      },
    })

    const reason = room.players.every((p) => state.answers[p.id] !== undefined)
      ? 'completed'
      : 'timeout'
    return { winnerId, reason }
  },
}

export default higherorlower
