import { describe, it, expect, vi, beforeEach } from 'vitest'
import numberguess from '../../minigames/numberguess'
import { makeRoom, makeMatch } from '../helpers'
import { broadcast } from '../../sync/broadcast'

vi.mock('../../sync/broadcast', () => ({ broadcast: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('numberguess — integration', () => {
  it('resolves early when both players guess', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    numberguess.start(room)

    const state = room.match.minigameState as { secret: number }
    // Both players guess; p1 is exact, p2 is off
    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: state.secret })
    numberguess.handleInput(room, 'p2', { type: 'GUESS', value: state.secret + 10 })

    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
  })

  it('equidistant guesses still resolve with a winner', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    numberguess.start(room)

    const state = room.match.minigameState as { secret: number }
    // Both players are exactly 5 away from the secret — winner is random but must resolve
    const dir = state.secret <= 50 ? 1 : -1
    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: state.secret + dir * 5 })
    numberguess.handleInput(room, 'p2', { type: 'GUESS', value: state.secret - dir * 5 })

    expect(onRoundDone).toHaveBeenCalledOnce()
    const result = onRoundDone.mock.calls[0]![0] as { winnerId: string; reason: string }
    expect(['p1', 'p2']).toContain(result.winnerId)
    expect(result.reason).toBe('completed')
  })

  it('getResult gives win to the only player who guessed', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    numberguess.start(room)

    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: 50 })
    // p2 never guesses

    const result = numberguess.getResult(room)
    expect(result.winnerId).toBe('p1')
    expect(result.reason).toBe('timeout')
  })

  it('getResult still returns a winner when neither player guessed', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    numberguess.start(room)

    const result = numberguess.getResult(room)
    expect(['p1', 'p2']).toContain(result.winnerId)
    expect(result.reason).toBe('timeout')
  })

  it('ignores a second guess from the same player', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    numberguess.start(room)

    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: 50 })
    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: 99 }) // second guess ignored

    const state = room.match.minigameState as { guesses: Record<string, number> }
    expect(state.guesses['p1']).toBe(50)
    expect(onRoundDone).not.toHaveBeenCalled() // p2 hasn't guessed yet
  })

  it('rejects out-of-range values', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    numberguess.start(room)

    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: 0 })
    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: 101 })

    const state = room.match.minigameState as { guesses: Record<string, number> }
    expect(state.guesses['p1']).toBeUndefined()
  })

  it('rejects non-integer values', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    numberguess.start(room)

    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: 42.5 })

    const state = room.match.minigameState as { guesses: Record<string, number> }
    expect(state.guesses['p1']).toBeUndefined()
  })

  it('ignores non-GUESS input types', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    numberguess.start(room)

    numberguess.handleInput(room, 'p1', { type: 'CLICK' })

    const state = room.match.minigameState as { guesses: Record<string, number> }
    expect(state.guesses['p1']).toBeUndefined()
  })

  it('does not broadcast the secret during the guessing phase', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    numberguess.start(room)

    // Only one player guesses — no reveal yet
    numberguess.handleInput(room, 'p1', { type: 'GUESS', value: 50 })

    // Inspect all broadcast payloads — secret must not appear
    for (const call of vi.mocked(broadcast).mock.calls) {
      const payload = call[2] as { state?: Record<string, unknown> }
      expect(payload.state).not.toHaveProperty('secret')
    }
  })
})
