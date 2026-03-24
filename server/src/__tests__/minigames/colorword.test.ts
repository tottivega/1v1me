import { describe, it, expect, vi } from 'vitest'
import colorword, { pick } from '../../minigames/colorword'
import { makeRoom, makeMatch } from '../helpers'

describe('pick()', () => {
  it('word and inkColor are always different', () => {
    for (let i = 0; i < 200; i++) {
      const { word, inkColor } = pick()
      expect(word).not.toBe(inkColor)
    }
  })

  it('always returns valid colors from the pool', () => {
    const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
    for (let i = 0; i < 50; i++) {
      const { word, inkColor } = pick()
      expect(COLORS).toContain(word)
      expect(COLORS).toContain(inkColor)
    }
  })

  it('covers all 6 colors as word across many picks', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      seen.add(pick().word)
    }
    expect(seen.size).toBe(6)
  })
})

describe('colorword — integration', () => {
  it('resolves with the first player to pick the correct ink color', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    const state = room.match.minigameState as { inkColor: string }

    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: state.inkColor })

    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
  })

  it('ignores a pick of the wrong color', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    const state = room.match.minigameState as { word: string; inkColor: string }
    // The word itself is always a wrong pick (word !== inkColor guaranteed by pick())
    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: state.word })

    expect(onRoundDone).not.toHaveBeenCalled()
  })

  it('ignores input after the round is resolved', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    const state = room.match.minigameState as { inkColor: string }

    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: state.inkColor })
    colorword.handleInput(room, 'p2', { type: 'PICK_COLOR', color: state.inkColor }) // late pick

    expect(onRoundDone).toHaveBeenCalledOnce() // still only once
  })
})
