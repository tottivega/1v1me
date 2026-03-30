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
  it('correct pick increments score and advances puzzle without resolving round', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    const state = room.match.minigameState as {
      inkColor: string
      scores: Record<string, number>
      puzzleSeq: number
    }

    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: state.inkColor })

    expect(onRoundDone).not.toHaveBeenCalled()
    expect(state.scores['p1']).toBe(1)
    expect(state.scores['p2']).toBe(0)
    expect(state.puzzleSeq).toBe(1)
  })

  it('wrong pick advances puzzle without scoring', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    const state = room.match.minigameState as {
      word: string
      scores: Record<string, number>
      puzzleSeq: number
    }

    // word is always different from inkColor — guaranteed by pick()
    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: state.word })

    expect(onRoundDone).not.toHaveBeenCalled()
    expect(state.scores['p1']).toBe(0)
    expect(state.puzzleSeq).toBe(1)
  })

  it('ignores input after round is resolved', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    room.match!.roundResolved = true
    const state = room.match.minigameState as { inkColor: string; puzzleSeq: number }

    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: state.inkColor })

    expect(state.puzzleSeq).toBe(0) // no change
  })

  it('getResult returns player with higher score', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', {})

    colorword.start(room)

    // Give p1 two correct picks, p2 one correct pick
    for (let i = 0; i < 2; i++) {
      const s = room.match.minigameState as { inkColor: string }
      colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: s.inkColor })
    }
    const s = room.match.minigameState as { inkColor: string }
    colorword.handleInput(room, 'p2', { type: 'PICK_COLOR', color: s.inkColor })

    const result = colorword.getResult(room)
    expect(result.winnerId).toBe('p1')
    expect(result.reason).toBe('timeout')
  })

  it('getResult returns player with higher score (p2 wins)', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', {})

    colorword.start(room)

    // p1 gets 1, p2 gets 2
    const s1 = room.match.minigameState as { inkColor: string }
    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: s1.inkColor })
    for (let i = 0; i < 2; i++) {
      const s = room.match.minigameState as { inkColor: string }
      colorword.handleInput(room, 'p2', { type: 'PICK_COLOR', color: s.inkColor })
    }

    const result = colorword.getResult(room)
    expect(result.winnerId).toBe('p2')
  })

  it('getResult tiebreaks at 0-0 by defaulting to p1', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', {})

    colorword.start(room)
    // No picks — both at 0
    const result = colorword.getResult(room)
    expect(result.winnerId).toBe('p1') // Infinity <= Infinity → p1
  })
})
