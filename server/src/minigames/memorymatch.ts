import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

const SYMBOLS = ['🔴', '🔵', '🟡', '🟢', '🟠', '🟣', '⬛', '⬜']
const SEQ_LEN = 5

interface State {
  sequence: string[]
  submissions: Record<string, string[]>
  resolved: boolean
}

function generateSequence(): string[] {
  const seq: string[] = []
  for (let i = 0; i < SEQ_LEN; i++) {
    seq.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
  }
  return seq
}

function scoreSubmission(sequence: string[], submission: string[]): number {
  let correct = 0
  for (let i = 0; i < sequence.length; i++) {
    if (submission[i] === sequence[i]) correct++
  }
  return correct
}

const memorymatch: MinigameModule = {
  id: 'memorymatch',

  start(room) {
    const state: State = {
      sequence: generateSequence(),
      submissions: {},
      resolved: false,
    }
    room.match!.minigameState = state
    broadcast(room, 'GAME_UPDATE', {
      state: { sequence: state.sequence, submissions: {} },
    })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'SUBMIT') return

    const state = room.match!.minigameState as State
    if (state.resolved) return
    if (state.submissions[playerId]) return // already submitted

    const submission = Array.isArray(input.sequence)
      ? (input.sequence as string[]).slice(0, SEQ_LEN)
      : []
    state.submissions[playerId] = submission

    broadcast(room, 'GAME_UPDATE', {
      state: { sequence: state.sequence, submissions: state.submissions },
    })

    // If both players have submitted, resolve early
    const allSubmitted = room.players.every((p) => state.submissions[p.id] !== undefined)
    if (allSubmitted) {
      state.resolved = true
      const result = computeResult(room, state)
      setTimeout(() => {
        room.match?.onRoundDone?.(result)
      }, 1200)
    }
  },

  getResult(room): MinigameResult {
    return computeResult(room, room.match!.minigameState as State)
  },
}

function computeResult(room: Room, state: State): MinigameResult {
  const [p1, p2] = room.players
  const s1 = scoreSubmission(state.sequence, state.submissions[p1.id] ?? [])
  const s2 = scoreSubmission(state.sequence, state.submissions[p2.id] ?? [])

  if (s1 > s2) return { winnerId: p1.id, reason: 'completed' }
  if (s2 > s1) return { winnerId: p2.id, reason: 'completed' }
  return { winnerId: Math.random() < 0.5 ? p1.id : p2.id, reason: 'completed' }
}

export default memorymatch
