import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers } from '../utils/gameUtils'
import { RoomTimerManager } from './timerManager'

const TOTAL_WIRES = 8
const PICK_TIMEOUT_MS = 10_000
const REVEAL_DELAY_MS = 1_500

// One timer per room — covers pick timeouts
const pickTimer = new RoomTimerManager()

interface State {
  bombWire: number // 0-7, secret — never sent to clients
  wires: number[] // remaining wire indices (shrinks as wires are safely cut)
  eliminated: number[] // safely cut wire indices
  phase: 'picking' | 'reveal'
  currentPlayerId: string // whose turn it is
  picks: Array<{ playerId: string; wire: number; isBomb: boolean }> // history
  roundNum: number // increments each pick
  resolved: boolean
}

function broadcastPicking(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      wires: state.wires,
      eliminated: state.eliminated,
      phase: 'picking',
      currentPlayerId: state.currentPlayerId,
      roundNum: state.roundNum,
    },
  })
}

function broadcastReveal(room: Room, state: State, winnerId?: string) {
  const lastPick = state.picks[state.picks.length - 1]
  broadcast(room, 'GAME_UPDATE', {
    state: {
      wires: state.wires,
      eliminated: state.eliminated,
      phase: 'reveal',
      currentPlayerId: state.currentPlayerId,
      lastPick,
      roundNum: state.roundNum,
      ...(winnerId !== undefined ? { winnerId } : {}),
    },
  })
}

function startPickPhase(room: Room, state: State) {
  pickTimer.set(room.roomId, PICK_TIMEOUT_MS, () => {
    if (!room.match || state.resolved) return
    // Auto-pick a random remaining wire for the current player
    const wire = state.wires[Math.floor(Math.random() * state.wires.length)]!
    processPick(room, state, state.currentPlayerId, wire)
  })
  broadcastPicking(room, state)
}

function processPick(room: Room, state: State, playerId: string, wire: number) {
  pickTimer.clear(room.roomId)
  if (state.resolved) return

  const isBomb = wire === state.bombWire
  state.picks.push({ playerId, wire, isBomb })
  state.roundNum++

  if (isBomb) {
    // The picker loses — the other player wins
    state.resolved = true
    const winner = room.players.find((p) => p.id !== playerId)!
    broadcastReveal(room, state, winner.id)
    setTimeout(
      () => room.match?.onRoundDone?.({ winnerId: winner.id, reason: 'completed' }),
      REVEAL_DELAY_MS
    )
    return
  }

  // Safe wire — eliminate it and switch turns
  state.eliminated.push(wire)
  state.wires = state.wires.filter((w) => w !== wire)

  const [p1, p2] = twoPlayers(room)
  state.currentPlayerId = state.currentPlayerId === p1.id ? p2.id : p1.id

  broadcastReveal(room, state)

  // Brief reveal before next pick
  setTimeout(() => {
    if (!room.match || state.resolved) return
    state.phase = 'picking'
    startPickPhase(room, state)
  }, REVEAL_DELAY_MS)
}

const kaboom: MinigameModule = {
  id: 'kaboom',

  start(room) {
    const bombWire = Math.floor(Math.random() * TOTAL_WIRES)
    const [p1] = twoPlayers(room)
    const state: State = {
      bombWire,
      wires: Array.from({ length: TOTAL_WIRES }, (_, i) => i),
      eliminated: [],
      phase: 'picking',
      currentPlayerId: p1.id, // p1 always goes first
      picks: [],
      roundNum: 1,
      resolved: false,
    }
    room.match!.minigameState = state
    startPickPhase(room, state)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PICK_WIRE') return

    const state = room.match!.minigameState as State | null
    if (!state || state.resolved || state.phase !== 'picking') return
    if (playerId !== state.currentPlayerId) return // not your turn

    const wire = Number(input.wire)
    if (!Number.isFinite(wire) || !state.wires.includes(wire)) return

    state.phase = 'reveal' // block duplicate inputs during reveal delay
    processPick(room, state, playerId, wire)
  },

  getResult(room): MinigameResult {
    // Called only on global timeout (shouldn't happen with timeoutMs:0, but as a safety net)
    pickTimer.clear(room.roomId)
    const state = room.match!.minigameState as State
    state.resolved = true
    const [p1, p2] = twoPlayers(room)
    // Current player loses for not picking in time
    const winnerId = state.currentPlayerId === p1.id ? p2.id : p1.id
    return { winnerId, reason: 'timeout' }
  },

  cleanup(room) {
    pickTimer.clear(room.roomId)
    const state = room.match?.minigameState as State | undefined
    if (state) state.resolved = true
  },

  getSafeState(room) {
    const state = room.match?.minigameState as State | undefined
    if (!state) return null
     
    const { bombWire: _secret, ...safe } = state
    return safe
  },
}

export default kaboom
