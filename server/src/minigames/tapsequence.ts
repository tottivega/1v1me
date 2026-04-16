import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'
import { RoomTimerManager } from './timerManager'

const BUTTONS = 4
const START_LEVEL = 1
const MAX_LEVEL = 10
// How long the client has to watch the flash animation before input opens.
// Each button: 500ms ON + 200ms OFF = 700ms, plus a 600ms lead-in.
const SHOW_PER_BUTTON_MS = 700
const SHOW_PRE_DELAY_MS = 600
const SHOW_BUFFER_MS = 400 // extra buffer so animation always finishes first
const INPUT_TIMEOUT_MS = 10000
const RESULT_DELAY_MS = 1500

const phaseTimer = new RoomTimerManager()

function levelToSeqLen(level: number): number {
  return level + 3
}

function generateSequence(len: number): number[] {
  return Array.from({ length: len }, () => Math.floor(Math.random() * BUTTONS))
}

interface State {
  level: number
  seqLen: number
  phase: 'showing' | 'input'
  sequence: number[]
  progress: Record<string, number>
  passed: Record<string, boolean>
  eliminated: Record<string, boolean>
  winnerId?: string
  resolved: boolean
}

function broadcastState(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      level: state.level,
      seqLen: state.seqLen,
      phase: state.phase,
      sequence: state.sequence,
      progress: state.progress,
      passed: state.passed,
      eliminated: state.eliminated,
      winnerId: state.winnerId,
    },
  })
}

function startLevel(room: Room, state: State) {
  const len = levelToSeqLen(state.level)
  state.seqLen = len
  state.sequence = generateSequence(len)
  state.progress = {}
  state.passed = {}
  state.eliminated = {}
  state.phase = 'showing'
  broadcastState(room, state)

  const showDuration = SHOW_PRE_DELAY_MS + len * SHOW_PER_BUTTON_MS + SHOW_BUFFER_MS
  phaseTimer.set(room.roomId, showDuration, () => {
    if (!room.match || state.resolved) return
    state.phase = 'input'
    broadcastState(room, state)

    phaseTimer.set(room.roomId, INPUT_TIMEOUT_MS, () => {
      if (!room.match || state.resolved) return
      resolveByTimeout(room, state)
    })
  })
}

function resolveWith(room: Room, state: State, winnerId: string, reason: MinigameResult['reason']) {
  phaseTimer.clear(room.roomId)
  if (state.resolved) return
  state.resolved = true
  state.winnerId = winnerId
  broadcastState(room, state)
  setTimeout(() => room.match?.onRoundDone?.({ winnerId, reason }), RESULT_DELAY_MS)
}

function resolveByTimeout(room: Room, state: State) {
  if (state.resolved) return
  const [p1, p2] = twoPlayers(room)
  const prog1 = state.progress[p1.id] ?? 0
  const prog2 = state.progress[p2.id] ?? 0
  const winnerId = prog1 > prog2 ? p1.id : prog2 > prog1 ? p2.id : randomWinner(p1, p2)
  resolveWith(room, state, winnerId, 'timeout')
}

const tapsequence: MinigameModule = {
  id: 'tapsequence',

  start(room) {
    const state: State = {
      level: START_LEVEL,
      seqLen: levelToSeqLen(START_LEVEL),
      phase: 'showing',
      sequence: [],
      progress: {},
      passed: {},
      eliminated: {},
      resolved: false,
    }
    room.match!.minigameState = state
    startLevel(room, state)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PRESS') return

    const state = room.match!.minigameState as State | null
    if (!state) return
    if (state.resolved || state.phase !== 'input') return
    if (state.passed[playerId] || state.eliminated[playerId]) return

    const button = input.button as number
    const pos = state.progress[playerId] ?? 0
    const expected = state.sequence[pos]

    if (button !== expected) {
      // Wrong button — this player is eliminated
      state.eliminated[playerId] = true
      broadcastState(room, state)

      const [p1, p2] = twoPlayers(room)
      const opponent = p1.id === playerId ? p2 : p1

      if (state.eliminated[opponent.id]) {
        // Both failed simultaneously — random winner
        resolveWith(room, state, randomWinner(p1, p2), 'completed')
      } else {
        resolveWith(room, state, opponent.id, 'completed')
      }
      return
    }

    // Correct press
    state.progress[playerId] = pos + 1

    if (state.progress[playerId] >= state.seqLen) {
      // Player completed the full sequence
      state.passed[playerId] = true
      broadcastState(room, state)

      if (state.level >= MAX_LEVEL) {
        // Completed level 10 — this player wins immediately
        resolveWith(room, state, playerId, 'completed')
        return
      }

      const [p1, p2] = twoPlayers(room)
      const opponent = p1.id === playerId ? p2 : p1

      if (state.eliminated[opponent.id]) {
        // Opponent already failed — this player wins
        resolveWith(room, state, playerId, 'completed')
      } else if (state.passed[opponent.id]) {
        // Both passed — advance to next level after a short pause
        phaseTimer.clear(room.roomId)
        setTimeout(() => {
          if (!room.match || state.resolved) return
          state.level++
          startLevel(room, state)
        }, RESULT_DELAY_MS)
      }
      // else: opponent still playing — wait for them
    } else {
      broadcastState(room, state)
    }
  },

  getResult(room): MinigameResult {
    phaseTimer.clear(room.roomId)
    const state = room.match!.minigameState as State
    if (state.resolved && state.winnerId) {
      return { winnerId: state.winnerId, reason: 'completed' }
    }
    state.resolved = true
    const [p1, p2] = twoPlayers(room)
    const prog1 = state.progress[p1.id] ?? 0
    const prog2 = state.progress[p2.id] ?? 0
    if (prog1 > prog2) return { winnerId: p1.id, reason: 'timeout' }
    if (prog2 > prog1) return { winnerId: p2.id, reason: 'timeout' }
    return { winnerId: randomWinner(p1, p2), reason: 'timeout' }
  },

  cleanup(room) {
    phaseTimer.clear(room.roomId)
    const state = room.match?.minigameState as State | undefined
    if (state) state.resolved = true
  },

  getSafeState(room) {
    const state = room.match?.minigameState as State | undefined
    if (!state) return null
    return {
      level: state.level,
      seqLen: state.seqLen,
      phase: state.phase,
      sequence: state.sequence,
      progress: state.progress,
      passed: state.passed,
      eliminated: state.eliminated,
      winnerId: state.winnerId,
    }
  },
}

export default tapsequence
