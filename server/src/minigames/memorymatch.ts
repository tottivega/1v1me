import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'
import { RoomTimerManager } from './timerManager'

const SYMBOLS = ['🔴', '🔵', '🟡', '🟢', '🟠', '🟣', '⬛', '⬜']
const MIN_SEQ_LEN = 3
const MAX_ROUNDS = 10
const RESULT_DELAY_MS = 2000

// One timer slot per room — covers both memorize and recall phases (chained)
const phaseTimer = new RoomTimerManager()

interface State {
  roundNum: number // 1-indexed
  seqLen: number // starts at MIN_SEQ_LEN, +1 on tie
  phase: 'memorize' | 'recall'
  sequence: string[]
  submissions: Record<string, string[]>
  submissionTimes: Record<string, number> // Date.now() when each player submitted
  resolved: boolean
}

function generateSequence(len: number): string[] {
  return Array.from({ length: len }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!)
}

function scoreSubmission(sequence: string[], submission: string[]): number {
  let correct = 0
  for (let i = 0; i < sequence.length; i++) {
    if (submission[i] === sequence[i]) correct++
  }
  return correct
}

function roundMs(seqLen: number): number {
  return Math.ceil(seqLen * 1.5) * 1000
}

function broadcastState(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      roundNum: state.roundNum,
      seqLen: state.seqLen,
      phase: state.phase,
      // Omit sequence during recall — clients must rely on memory, not the wire
      sequence: state.phase === 'recall' ? [] : state.sequence,
      submissions: state.submissions,
    },
  })
}

function startRound(room: Room, state: State) {
  state.sequence = generateSequence(state.seqLen)
  state.submissions = {}
  state.submissionTimes = {}
  state.phase = 'memorize'
  broadcastState(room, state)

  // Memorize phase → recall phase after seqLen × 1.5 seconds
  phaseTimer.set(room.roomId, roundMs(state.seqLen), () => {
    if (!room.match || state.resolved) return
    state.phase = 'recall'
    broadcastState(room, state)

    // Recall timeout — auto-resolve with whatever has been submitted so far
    phaseTimer.set(room.roomId, roundMs(state.seqLen), () => {
      if (!room.match || state.resolved) return
      resolveRound(room, state)
    })
  })
}

function resolveRound(room: Room, state: State) {
  phaseTimer.clear(room.roomId)
  if (state.resolved) return

  const [p1, p2] = twoPlayers(room)
  const s1 = scoreSubmission(state.sequence, state.submissions[p1.id] ?? [])
  const s2 = scoreSubmission(state.sequence, state.submissions[p2.id] ?? [])

  if (s1 !== s2) {
    // Decisive — one player got more correct
    state.resolved = true
    const winnerId = s1 > s2 ? p1.id : p2.id
    setTimeout(() => room.match?.onRoundDone?.({ winnerId, reason: 'completed' }), RESULT_DELAY_MS)
    return
  }

  if (state.roundNum >= MAX_ROUNDS) {
    // Still tied after 10 rounds — fastest submission in this round wins
    state.resolved = true
    const t1 = state.submissionTimes[p1.id] ?? Infinity
    const t2 = state.submissionTimes[p2.id] ?? Infinity
    const winnerId = t1 <= t2 ? p1.id : p2.id
    setTimeout(() => room.match?.onRoundDone?.({ winnerId, reason: 'completed' }), RESULT_DELAY_MS)
    return
  }

  // Tie — advance to next round with one more ball
  setTimeout(() => {
    if (!room.match || state.resolved) return
    state.roundNum++
    state.seqLen++
    startRound(room, state)
  }, RESULT_DELAY_MS)
}

const memorymatch: MinigameModule = {
  id: 'memorymatch',

  start(room) {
    const state: State = {
      roundNum: 1,
      seqLen: MIN_SEQ_LEN,
      phase: 'memorize',
      sequence: [],
      submissions: {},
      submissionTimes: {},
      resolved: false,
    }
    room.match!.minigameState = state
    startRound(room, state)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'SUBMIT') return

    const state = room.match!.minigameState as State | null
    if (!state) return
    if (state.resolved || state.phase !== 'recall') return
    if (state.submissions[playerId]) return // already submitted

    const submission = Array.isArray(input.sequence)
      ? (input.sequence as string[]).slice(0, state.seqLen)
      : []
    state.submissions[playerId] = submission
    state.submissionTimes[playerId] = Date.now()
    broadcastState(room, state)

    const allSubmitted = room.players.every((p) => state.submissions[p.id] !== undefined)
    if (allSubmitted) resolveRound(room, state)
  },

  getResult(room): MinigameResult {
    phaseTimer.clear(room.roomId)
    const state = room.match!.minigameState as State
    state.resolved = true
    const [p1, p2] = twoPlayers(room)
    const s1 = scoreSubmission(state.sequence, state.submissions[p1.id] ?? [])
    const s2 = scoreSubmission(state.sequence, state.submissions[p2.id] ?? [])
    if (s1 > s2) return { winnerId: p1.id, reason: 'completed' }
    if (s2 > s1) return { winnerId: p2.id, reason: 'completed' }
    const t1 = state.submissionTimes[p1.id] ?? Infinity
    const t2 = state.submissionTimes[p2.id] ?? Infinity
    if (t1 !== t2) return { winnerId: t1 < t2 ? p1.id : p2.id, reason: 'completed' }
    return { winnerId: randomWinner(p1, p2), reason: 'completed' }
  },

  cleanup(room) {
    phaseTimer.clear(room.roomId)
    const state = room.match?.minigameState as State | undefined
    if (state) state.resolved = true
  },

  getSafeState(room) {
    const state = room.match?.minigameState as State | undefined
    if (!state) return null
    // Mirror the same hiding logic as broadcastState: omit the sequence during
    // recall so that a reconnecting player cannot read what they should have
    // memorised. Spectators joining during recall also get the hidden sequence —
    // they can follow the submissions without seeing the answer.
    return {
      roundNum: state.roundNum,
      seqLen: state.seqLen,
      phase: state.phase,
      sequence: state.phase === 'recall' ? [] : state.sequence,
      submissions: state.submissions,
    }
  },
}

export default memorymatch
