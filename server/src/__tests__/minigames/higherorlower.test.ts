import { describe, it, expect, vi } from 'vitest'
import higherorlower, { generatePuzzle } from '../../minigames/higherorlower'
import { makeRoom, makeMatch } from '../helpers'

describe('generatePuzzle()', () => {
  it('target and clue are always different', () => {
    for (let i = 0; i < 200; i++) {
      const { target, clue } = generatePuzzle()
      expect(target).not.toBe(clue)
    }
  })

  it('target is always in range 2–99', () => {
    for (let i = 0; i < 200; i++) {
      const { target } = generatePuzzle()
      expect(target).toBeGreaterThanOrEqual(2)
      expect(target).toBeLessThanOrEqual(99)
    }
  })

  it('clue is always in range 1–99', () => {
    for (let i = 0; i < 200; i++) {
      const { clue } = generatePuzzle()
      expect(clue).toBeGreaterThanOrEqual(1)
      expect(clue).toBeLessThanOrEqual(99)
    }
  })

  it('offset between target and clue is 1–20', () => {
    for (let i = 0; i < 200; i++) {
      const { target, clue } = generatePuzzle()
      const diff = Math.abs(target - clue)
      expect(diff).toBeGreaterThanOrEqual(1)
      expect(diff).toBeLessThanOrEqual(20)
    }
  })
})

describe('higherorlower — integration', () => {
  it('resolves with the sole correct answerer as winner', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    higherorlower.start(room)
    const state = room.match.minigameState as { target: number; clue: number }
    const correct: 'higher' | 'lower' = state.target > state.clue ? 'higher' : 'lower'
    const wrong: 'higher' | 'lower' = correct === 'higher' ? 'lower' : 'higher'

    higherorlower.handleInput(room, 'p1', { type: 'PICK_DIRECTION', answer: correct })
    higherorlower.handleInput(room, 'p2', { type: 'PICK_DIRECTION', answer: wrong })

    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith(
      expect.objectContaining({ winnerId: 'p1', reason: 'completed' })
    )
  })

  it('does not resolve until both players have answered', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    higherorlower.start(room)
    const state = room.match.minigameState as { target: number; clue: number }
    const correct: 'higher' | 'lower' = state.target > state.clue ? 'higher' : 'lower'

    higherorlower.handleInput(room, 'p1', { type: 'PICK_DIRECTION', answer: correct })
    expect(onRoundDone).not.toHaveBeenCalled()

    higherorlower.handleInput(room, 'p2', { type: 'PICK_DIRECTION', answer: correct })
    expect(onRoundDone).toHaveBeenCalledOnce()
  })

  it('ignores duplicate answers from the same player', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    higherorlower.start(room)
    const state = room.match.minigameState as { target: number; clue: number }
    const correct: 'higher' | 'lower' = state.target > state.clue ? 'higher' : 'lower'

    higherorlower.handleInput(room, 'p1', { type: 'PICK_DIRECTION', answer: correct })
    higherorlower.handleInput(room, 'p1', { type: 'PICK_DIRECTION', answer: correct }) // duplicate
    // Only p1 answered — should not resolve yet
    expect(onRoundDone).not.toHaveBeenCalled()
  })
})
