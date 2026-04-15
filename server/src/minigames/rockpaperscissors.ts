import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'
import { RoomTimerManager } from './timerManager'

type Choice = 'rock' | 'paper' | 'scissors'

const BEATS: Record<Choice, Choice> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
const THROW_TIMEOUT_MS = 8000
const REVEAL_DELAY_MS = 1500
const THROWS_TO_WIN = 2
const MAX_DRAWS_PER_THROW = 10

// Per-room throw timers — not serializable, never broadcast
const throwTimer = new RoomTimerManager()

interface State {
  throwNum: number // increments on every throw including draws — used to trigger client effects
  phase: 'picking' | 'reveal'
  picks: Record<string, Choice>
  scores: Record<string, number>
  history: Array<{ picks: Record<string, Choice>; winnerId: string | null }> // decisive throws only
  drawsThisThrow: number // consecutive draws on the current decisive throw
  resolved: boolean
}

export function throwWinner(c1: Choice, c2: Choice, p1Id: string, p2Id: string): string | null {
  if (c1 === c2) return null
  return BEATS[c1] === c2 ? p1Id : p2Id
}

function broadcastPicking(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      phase: 'picking',
      throwNum: state.throwNum,
      submitted: Object.keys(state.picks),
      scores: state.scores,
      history: state.history,
    },
  })
}

function broadcastReveal(room: Room, state: State, winnerId: string | null) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      phase: 'reveal',
      throwNum: state.throwNum,
      picks: state.picks,
      throwWinnerId: winnerId,
      scores: state.scores,
      history: state.history,
    },
  })
}

function resolveThrowAndAdvance(room: Room, state: State, winnerId: string | null) {
  throwTimer.clear(room.roomId)
  if (state.resolved) return

  let effectiveWinnerId = winnerId

  if (winnerId === null) {
    // Draw — count consecutive draws for this decisive throw
    state.drawsThisThrow++
    if (state.drawsThisThrow >= MAX_DRAWS_PER_THROW) {
      // Too many draws: quietly pick a random winner and move on
      const [p1, p2] = twoPlayers(room)
      effectiveWinnerId = randomWinner(p1, p2)
      state.drawsThisThrow = 0
    }
  } else {
    state.drawsThisThrow = 0
  }

  // Only decisive outcomes go into history and scoring
  if (effectiveWinnerId) {
    state.scores[effectiveWinnerId] = (state.scores[effectiveWinnerId] ?? 0) + 1
    state.history.push({ picks: { ...state.picks }, winnerId: effectiveWinnerId })
  }

  state.phase = 'reveal'
  broadcastReveal(room, state, effectiveWinnerId)

  const [p1, p2] = twoPlayers(room)
  const matchWinner = [p1, p2].find((p) => (state.scores[p.id] ?? 0) >= THROWS_TO_WIN)

  if (matchWinner) {
    state.resolved = true
    setTimeout(() => room.match?.onRoundDone?.(computeResult(room, state)), REVEAL_DELAY_MS)
    return
  }

  // Advance to next throw — same decisive round if draw, next if decisive
  setTimeout(() => {
    if (!room.match || state.resolved) return
    state.throwNum++
    state.picks = {}
    state.phase = 'picking'
    broadcastPicking(room, state)
    startThrowTimeout(room, state)
  }, REVEAL_DELAY_MS)
}

function startThrowTimeout(room: Room, state: State) {
  throwTimer.set(room.roomId, THROW_TIMEOUT_MS, () => {
    if (!room.match || room.match.paused || state.resolved) return
    const [p1, p2] = twoPlayers(room)
    const p1Picked = !!state.picks[p1.id]
    const p2Picked = !!state.picks[p2.id]
    const timeoutWinnerId = p1Picked && !p2Picked ? p1.id : p2Picked && !p1Picked ? p2.id : null
    if (!state.picks[p1.id]) state.picks[p1.id] = 'rock' // placeholder for display
    if (!state.picks[p2.id]) state.picks[p2.id] = 'rock'
    resolveThrowAndAdvance(room, state, timeoutWinnerId)
  })
}

function computeResult(room: Room, state: State): MinigameResult {
  const [p1, p2] = twoPlayers(room)
  const s1 = state.scores[p1.id] ?? 0
  const s2 = state.scores[p2.id] ?? 0
  if (s1 > s2) return { winnerId: p1.id, reason: 'completed' }
  if (s2 > s1) return { winnerId: p2.id, reason: 'completed' }
  return { winnerId: randomWinner(p1, p2), reason: 'completed' }
}

const rockpaperscissors: MinigameModule = {
  id: 'rockpaperscissors',

  start(room) {
    const [p1, p2] = twoPlayers(room)
    const state: State = {
      throwNum: 1,
      phase: 'picking',
      picks: {},
      scores: { [p1.id]: 0, [p2.id]: 0 },
      history: [],
      drawsThisThrow: 0,
      resolved: false,
    }
    room.match!.minigameState = state
    broadcastPicking(room, state)
    startThrowTimeout(room, state)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PICK') return

    const state = room.match!.minigameState as State | null
    if (!state) return
    if (state.resolved || state.phase !== 'picking') return
    if (state.picks[playerId]) return

    const choice = input.choice as Choice
    if (!['rock', 'paper', 'scissors'].includes(choice)) return

    state.picks[playerId] = choice
    broadcastPicking(room, state)

    const bothPicked = room.players.every((p) => state.picks[p.id] !== undefined)
    if (!bothPicked) return

    const [p1, p2] = twoPlayers(room)
    const winner = throwWinner(state.picks[p1.id]!, state.picks[p2.id]!, p1.id, p2.id)
    resolveThrowAndAdvance(room, state, winner)
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    throwTimer.clear(room.roomId)
    state.resolved = true
    return computeResult(room, state)
  },

  cleanup(room) {
    throwTimer.clear(room.roomId)
    const state = room.match?.minigameState as State | undefined
    if (state) state.resolved = true
  },

  getSafeState(room) {
    const state = room.match?.minigameState as State | undefined
    if (!state) return null
    // During picking, hide each player's choice until both have locked in.
    // Only send who has submitted (submitted: string[]), not what they chose.
    // During reveal, picks are already public — include them, and derive the
    // throw winner from the most recent decisive-throw history entry.
    if (state.phase === 'reveal') {
      const lastDecisive = state.history[state.history.length - 1]
      return {
        phase: 'reveal',
        throwNum: state.throwNum,
        picks: state.picks,
        throwWinnerId: lastDecisive?.winnerId ?? null,
        scores: state.scores,
        history: state.history,
      }
    }
    return {
      phase: 'picking',
      throwNum: state.throwNum,
      submitted: Object.keys(state.picks),
      scores: state.scores,
      history: state.history,
    }
  },
}

export default rockpaperscissors
