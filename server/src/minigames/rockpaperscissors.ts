import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

type Choice = 'rock' | 'paper' | 'scissors'

const BEATS: Record<Choice, Choice> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
const THROW_TIMEOUT_MS = 8000
const REVEAL_DELAY_MS  = 1500
const THROWS_TO_WIN    = 2
const TOTAL_THROWS     = 3

// Per-room throw timers — not serializable, never broadcast
const throwTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface State {
  throwNum:  number
  phase:     'picking' | 'reveal'
  picks:     Record<string, Choice>   // current throw picks (only populated during reveal)
  scores:    Record<string, number>
  history:   Array<{ picks: Record<string, Choice>; winnerId: string | null }>
  resolved:  boolean
}

function clearThrowTimer(roomId: string) {
  const t = throwTimers.get(roomId)
  if (t) { clearTimeout(t); throwTimers.delete(roomId) }
}

function throwWinner(c1: Choice, c2: Choice, p1Id: string, p2Id: string): string | null {
  if (c1 === c2) return null
  return BEATS[c1] === c2 ? p1Id : p2Id
}

function broadcastPicking(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      phase:    'picking',
      throwNum: state.throwNum,
      submitted: Object.keys(state.picks),  // who has picked — not what they picked
      scores:   state.scores,
      history:  state.history,
    },
  })
}

function broadcastReveal(room: Room, state: State, winnerId: string | null) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      phase:         'reveal',
      throwNum:      state.throwNum,
      picks:         state.picks,
      throwWinnerId: winnerId,
      scores:        state.scores,
      history:       state.history,
    },
  })
}

function resolveThrowAndAdvance(room: Room, state: State, winnerId: string | null) {
  clearThrowTimer(room.roomId)
  if (state.resolved) return

  if (winnerId) state.scores[winnerId] = (state.scores[winnerId] ?? 0) + 1
  state.history.push({ picks: { ...state.picks }, winnerId })
  state.phase = 'reveal'
  broadcastReveal(room, state, winnerId)

  const [p1, p2] = room.players
  const matchWinner = [p1, p2].find(p => (state.scores[p.id] ?? 0) >= THROWS_TO_WIN)
  const allDone = state.history.length >= TOTAL_THROWS

  if (matchWinner || allDone) {
    state.resolved = true
    setTimeout(() => room.match?.onRoundDone?.(computeResult(room, state)), REVEAL_DELAY_MS)
    return
  }

  // Advance to next throw
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
  clearThrowTimer(room.roomId)
  throwTimers.set(room.roomId, setTimeout(() => {
    if (!room.match || room.match.paused || state.resolved) return
    const [p1, p2] = room.players
    const p1Picked = !!state.picks[p1.id]
    const p2Picked = !!state.picks[p2.id]
    // Award throw to whoever picked; if both or neither timed out → null
    const timeoutWinnerId =
      p1Picked && !p2Picked ? p1.id :
      p2Picked && !p1Picked ? p2.id : null
    // Fill in missing picks for history display
    if (!state.picks[p1.id]) state.picks[p1.id] = 'rock'  // placeholder
    if (!state.picks[p2.id]) state.picks[p2.id] = 'rock'
    resolveThrowAndAdvance(room, state, timeoutWinnerId)
  }, THROW_TIMEOUT_MS))
}

function computeResult(room: Room, state: State): MinigameResult {
  const [p1, p2] = room.players
  const s1 = state.scores[p1.id] ?? 0
  const s2 = state.scores[p2.id] ?? 0
  if (s1 > s2) return { winnerId: p1.id, reason: 'completed' }
  if (s2 > s1) return { winnerId: p2.id, reason: 'completed' }
  return { winnerId: Math.random() < 0.5 ? p1.id : p2.id, reason: 'completed' }
}

const rockpaperscissors: MinigameModule = {
  id: 'rockpaperscissors',

  start(room) {
    const [p1, p2] = room.players
    const state: State = {
      throwNum: 1,
      phase:    'picking',
      picks:    {},
      scores:   { [p1.id]: 0, [p2.id]: 0 },
      history:  [],
      resolved: false,
    }
    room.match!.minigameState = state
    broadcastPicking(room, state)
    startThrowTimeout(room, state)
  },

  handleInput(room, playerId, input) {
    const msg = input as { type: string; choice: string }
    if (msg.type !== 'PICK') return

    const state = room.match!.minigameState as State
    if (state.resolved || state.phase !== 'picking') return
    if (state.picks[playerId]) return  // already picked this throw

    const choice = msg.choice as Choice
    if (!['rock', 'paper', 'scissors'].includes(choice)) return

    state.picks[playerId] = choice
    broadcastPicking(room, state)

    const bothPicked = room.players.every(p => state.picks[p.id] !== undefined)
    if (!bothPicked) return

    const [p1, p2] = room.players
    const winner = throwWinner(state.picks[p1.id], state.picks[p2.id], p1.id, p2.id)
    resolveThrowAndAdvance(room, state, winner)
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    clearThrowTimer(room.roomId)
    state.resolved = true
    return computeResult(room, state)
  },
}

export default rockpaperscissors
