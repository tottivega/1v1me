import { describe, it, expect, vi, beforeEach } from 'vitest'
import kaboom from '../../minigames/kaboom'
import { makeRoom, makeMatch } from '../helpers'

vi.mock('../../sync/broadcast', () => ({ broadcast: vi.fn() }))

function setup(onRoundDone = vi.fn()) {
  const room = makeRoom()
  room.match = makeMatch('p1', 'p2', { onRoundDone })
  kaboom.start(room)
  const state = room.match.minigameState as {
    bombWire: number
    wires: number[]
    eliminated: number[]
    phase: string
    currentPlayerId: string
    picks: Array<{ playerId: string; wire: number; isBomb: boolean }>
    roundNum: number
    resolved: boolean
  }
  return { room, state, onRoundDone }
}

describe('kaboom — integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('starts in picking phase with p1 as first picker', () => {
    const { state } = setup()
    expect(state.phase).toBe('picking')
    expect(state.currentPlayerId).toBe('p1')
    expect(state.wires).toHaveLength(8)
    expect(state.eliminated).toHaveLength(0)
  })

  it('ignores input from the wrong player', () => {
    const { state, room } = setup()
    const safeWire = state.wires.find((w) => w !== state.bombWire)!
    kaboom.handleInput(room, 'p2', { type: 'PICK_WIRE', wire: safeWire })
    // Nothing should change — still p1's turn
    expect(state.currentPlayerId).toBe('p1')
    expect(state.picks).toHaveLength(0)
  })

  it('ignores invalid wire indices', () => {
    const { state, room } = setup()
    kaboom.handleInput(room, 'p1', { type: 'PICK_WIRE', wire: 99 })
    expect(state.picks).toHaveLength(0)
  })

  it('ignores non-PICK_WIRE input types', () => {
    const { state, room } = setup()
    kaboom.handleInput(room, 'p1', { type: 'CLICK' })
    expect(state.picks).toHaveLength(0)
  })

  it('safe pick eliminates the wire and switches turns to p2', () => {
    const { state, room } = setup()
    const safeWire = state.wires.find((w) => w !== state.bombWire)!

    kaboom.handleInput(room, 'p1', { type: 'PICK_WIRE', wire: safeWire })

    expect(state.picks).toHaveLength(1)
    expect(state.picks[0]).toMatchObject({ playerId: 'p1', wire: safeWire, isBomb: false })

    // Reveal phase immediately; transition to picking after reveal delay
    expect(state.phase).toBe('reveal')
    vi.advanceTimersByTime(1500)
    expect(state.phase).toBe('picking')
    expect(state.eliminated).toContain(safeWire)
    expect(state.wires).not.toContain(safeWire)
    expect(state.currentPlayerId).toBe('p2')
  })

  it('bomb pick resolves with the other player winning', () => {
    const { state, room, onRoundDone } = setup()

    kaboom.handleInput(room, 'p1', { type: 'PICK_WIRE', wire: state.bombWire })

    expect(state.resolved).toBe(true)
    expect(state.picks[0]).toMatchObject({ playerId: 'p1', wire: state.bombWire, isBomb: true })

    vi.advanceTimersByTime(1500)
    expect(onRoundDone).toHaveBeenCalledWith(
      expect.objectContaining({ winnerId: 'p2', reason: 'completed' })
    )
  })

  it('alternates turns correctly across multiple safe picks', () => {
    const { state, room } = setup()

    // p1 picks safe
    const safe1 = state.wires.find((w) => w !== state.bombWire)!
    kaboom.handleInput(room, 'p1', { type: 'PICK_WIRE', wire: safe1 })
    vi.advanceTimersByTime(1500) // reveal → picking
    expect(state.currentPlayerId).toBe('p2')

    // p2 picks safe
    const safe2 = state.wires.find((w) => w !== state.bombWire)!
    kaboom.handleInput(room, 'p2', { type: 'PICK_WIRE', wire: safe2 })
    vi.advanceTimersByTime(1500)
    expect(state.currentPlayerId).toBe('p1')
  })

  it('p2 picks bomb → p1 wins', () => {
    const { state, room, onRoundDone } = setup()

    // p1 picks safe first
    const safe = state.wires.find((w) => w !== state.bombWire)!
    kaboom.handleInput(room, 'p1', { type: 'PICK_WIRE', wire: safe })
    vi.advanceTimersByTime(1500)

    // p2 picks bomb
    kaboom.handleInput(room, 'p2', { type: 'PICK_WIRE', wire: state.bombWire })
    vi.advanceTimersByTime(1500)

    expect(onRoundDone).toHaveBeenCalledWith(
      expect.objectContaining({ winnerId: 'p1', reason: 'completed' })
    )
  })

  it('auto-picks for idle player on timeout', () => {
    const { state } = setup()
    const initialRoundNum = state.roundNum

    vi.advanceTimersByTime(10_000) // pick timeout fires

    expect(state.picks).toHaveLength(1)
    expect(state.roundNum).toBe(initialRoundNum + 1)
  })

  it('getResult gives win to non-current player on timeout fallback', () => {
    const { state, room } = setup()
    expect(state.currentPlayerId).toBe('p1')

    const result = kaboom.getResult(room)
    // p1 didn't pick → p2 wins
    expect(result.winnerId).toBe('p2')
    expect(result.reason).toBe('timeout')
  })

  it('ignores duplicate input during reveal phase', () => {
    const { state, room } = setup()
    const safeWire = state.wires.find((w) => w !== state.bombWire)!

    kaboom.handleInput(room, 'p1', { type: 'PICK_WIRE', wire: safeWire })
    expect(state.picks).toHaveLength(1)

    // Try to pick again while in reveal
    const anotherWire = state.wires.find((w) => w !== state.bombWire && w !== safeWire) ?? safeWire
    kaboom.handleInput(room, 'p1', { type: 'PICK_WIRE', wire: anotherWire })
    expect(state.picks).toHaveLength(1) // no second pick recorded
  })
})
