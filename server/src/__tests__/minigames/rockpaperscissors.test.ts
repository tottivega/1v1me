import { describe, it, expect, vi } from 'vitest'
import { throwWinner } from '../../minigames/rockpaperscissors'
import rockpaperscissors from '../../minigames/rockpaperscissors'
import { makeRoom, makeMatch } from '../helpers'

describe('throwWinner()', () => {
  it('rock beats scissors', () => {
    expect(throwWinner('rock', 'scissors', 'p1', 'p2')).toBe('p1')
    expect(throwWinner('scissors', 'rock', 'p1', 'p2')).toBe('p2')
  })

  it('scissors beats paper', () => {
    expect(throwWinner('scissors', 'paper', 'p1', 'p2')).toBe('p1')
    expect(throwWinner('paper', 'scissors', 'p1', 'p2')).toBe('p2')
  })

  it('paper beats rock', () => {
    expect(throwWinner('paper', 'rock', 'p1', 'p2')).toBe('p1')
    expect(throwWinner('rock', 'paper', 'p1', 'p2')).toBe('p2')
  })

  it('tie returns null', () => {
    expect(throwWinner('rock', 'rock', 'p1', 'p2')).toBeNull()
    expect(throwWinner('paper', 'paper', 'p1', 'p2')).toBeNull()
    expect(throwWinner('scissors', 'scissors', 'p1', 'p2')).toBeNull()
  })
})

describe('rockpaperscissors — integration', () => {
  it('draw does not score or resolve the round', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    rockpaperscissors.start(room)
    const state = room.match.minigameState as {
      scores: Record<string, number>
      history: unknown[]
      phase: string
    }

    rockpaperscissors.handleInput(room, 'p1', { type: 'PICK', choice: 'rock' })
    rockpaperscissors.handleInput(room, 'p2', { type: 'PICK', choice: 'rock' })

    expect(onRoundDone).not.toHaveBeenCalled()
    expect(state.scores['p1']).toBe(0)
    expect(state.scores['p2']).toBe(0)
    expect(state.history).toHaveLength(0) // draws are not in history
    expect(state.phase).toBe('reveal')
  })

  it('win after a draw scores correctly and goes in history', async () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    rockpaperscissors.start(room)
    const state = room.match.minigameState as {
      scores: Record<string, number>
      history: Array<{ winnerId: string | null }>
      throwNum: number
      phase: string
      picks: Record<string, string>
    }

    // Draw
    rockpaperscissors.handleInput(room, 'p1', { type: 'PICK', choice: 'rock' })
    rockpaperscissors.handleInput(room, 'p2', { type: 'PICK', choice: 'rock' })
    expect(state.history).toHaveLength(0)
    const throwNumAfterDraw = state.throwNum

    // Advance throwNum (simulate the server's setTimeout advancing to next pick)
    state.throwNum++
    state.picks = {}
    state.phase = 'picking'

    // p1 wins
    rockpaperscissors.handleInput(room, 'p1', { type: 'PICK', choice: 'rock' })
    rockpaperscissors.handleInput(room, 'p2', { type: 'PICK', choice: 'scissors' })

    expect(state.scores['p1']).toBe(1)
    expect(state.scores['p2']).toBe(0)
    expect(state.history).toHaveLength(1)
    expect(state.history[0]?.winnerId).toBe('p1')
    expect(state.throwNum).toBeGreaterThan(throwNumAfterDraw)
  })

  it('match ends when a player reaches 2 wins', () => {
    vi.useFakeTimers()
    try {
      const room = makeRoom()
      const onRoundDone = vi.fn()
      room.match = makeMatch('p1', 'p2', { onRoundDone })

      rockpaperscissors.start(room)
      const state = room.match.minigameState as {
        scores: Record<string, number>
        history: unknown[]
        phase: string
        picks: Record<string, string>
        throwNum: number
      }

      // Win 1 for p1
      rockpaperscissors.handleInput(room, 'p1', { type: 'PICK', choice: 'rock' })
      rockpaperscissors.handleInput(room, 'p2', { type: 'PICK', choice: 'scissors' })
      state.throwNum++
      state.picks = {}
      state.phase = 'picking'

      // Win 2 for p1 — should resolve after reveal delay
      rockpaperscissors.handleInput(room, 'p1', { type: 'PICK', choice: 'rock' })
      rockpaperscissors.handleInput(room, 'p2', { type: 'PICK', choice: 'scissors' })

      expect(state.scores['p1']).toBe(2)
      expect(state.history).toHaveLength(2)

      vi.runAllTimers()
      expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('10 consecutive draws auto-resolve the throw with a random winner', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    rockpaperscissors.start(room)
    const state = room.match.minigameState as {
      scores: Record<string, number>
      history: unknown[]
      drawsThisThrow: number
      phase: string
      picks: Record<string, string>
      throwNum: number
    }

    // Simulate 10 draws in a row
    for (let i = 0; i < 10; i++) {
      state.phase = 'picking'
      state.picks = {}
      rockpaperscissors.handleInput(room, 'p1', { type: 'PICK', choice: 'rock' })
      rockpaperscissors.handleInput(room, 'p2', { type: 'PICK', choice: 'rock' })
      if (i < 9) {
        // Not yet auto-resolved, advance manually
        state.throwNum++
        state.picks = {}
        state.phase = 'picking'
      }
    }

    // After 10 draws, a winner should have been assigned
    const total = (state.scores['p1'] ?? 0) + (state.scores['p2'] ?? 0)
    expect(total).toBe(1) // exactly one decisive win was assigned
    expect(state.history).toHaveLength(1) // recorded in history
    expect(state.drawsThisThrow).toBe(0) // reset after auto-resolve
  })
})
