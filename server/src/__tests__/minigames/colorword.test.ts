import { describe, it, expect, vi } from 'vitest'
import colorword, { pick } from '../../minigames/colorword'
import { makeRoom, makeMatch } from '../helpers'

type ColorWordState = {
  puzzles: Record<string, { word: string; inkColor: string; seq: number }>
  scores: Record<string, number>
}

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
  it('correct pick increments score and advances only that player puzzle', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    const state = room.match.minigameState as ColorWordState

    const p1WordBefore = state.puzzles['p1']!.word
    const p2SeqBefore = state.puzzles['p2']!.seq

    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: p1WordBefore })

    expect(onRoundDone).not.toHaveBeenCalled()
    expect(state.scores['p1']).toBe(1)
    expect(state.scores['p2']).toBe(0)
    expect(state.puzzles['p1']!.seq).toBe(1) // p1 puzzle advanced
    expect(state.puzzles['p2']!.seq).toBe(p2SeqBefore) // p2 puzzle unchanged
  })

  it('wrong pick advances only that player puzzle without scoring', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    const state = room.match.minigameState as ColorWordState

    const p1InkBefore = state.puzzles['p1']!.inkColor // inkColor is always different from word
    const p2SeqBefore = state.puzzles['p2']!.seq

    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: p1InkBefore })

    expect(onRoundDone).not.toHaveBeenCalled()
    expect(state.scores['p1']).toBe(0)
    expect(state.puzzles['p1']!.seq).toBe(1)
    expect(state.puzzles['p2']!.seq).toBe(p2SeqBefore) // p2 puzzle unchanged
  })

  it('ignores input after round is resolved', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })

    colorword.start(room)
    room.match!.roundResolved = true
    const state = room.match.minigameState as ColorWordState
    const seqBefore = state.puzzles['p1']!.seq

    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: state.puzzles['p1']!.inkColor })

    expect(state.puzzles['p1']!.seq).toBe(seqBefore) // no change
  })

  it('getResult returns player with higher score', () => {
    vi.useFakeTimers()
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', {})

    colorword.start(room)

    // Give p1 two correct picks (advance past rate-limit between each), p2 one correct pick
    const s = room.match.minigameState as ColorWordState
    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: s.puzzles['p1']!.word })
    vi.advanceTimersByTime(200)
    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: s.puzzles['p1']!.word })
    vi.advanceTimersByTime(200)
    colorword.handleInput(room, 'p2', { type: 'PICK_COLOR', color: s.puzzles['p2']!.word })

    const result = colorword.getResult(room)
    expect(result.winnerId).toBe('p1')
    expect(result.reason).toBe('timeout')
    vi.useRealTimers()
  })

  it('getResult returns player with higher score (p2 wins)', () => {
    vi.useFakeTimers()
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', {})

    colorword.start(room)
    const s = room.match.minigameState as ColorWordState

    // p1 gets 1, p2 gets 2 (advance past rate-limit between each)
    colorword.handleInput(room, 'p1', { type: 'PICK_COLOR', color: s.puzzles['p1']!.word })
    vi.advanceTimersByTime(200)
    colorword.handleInput(room, 'p2', { type: 'PICK_COLOR', color: s.puzzles['p2']!.word })
    vi.advanceTimersByTime(200)
    colorword.handleInput(room, 'p2', { type: 'PICK_COLOR', color: s.puzzles['p2']!.word })

    const result = colorword.getResult(room)
    expect(result.winnerId).toBe('p2')
    vi.useRealTimers()
  })

  it('getResult tiebreaks at 0-0 by picking a random winner', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', {})

    colorword.start(room)
    // No picks — both at 0, both firstTimes are Infinity → random tiebreak
    const result = colorword.getResult(room)
    expect(['p1', 'p2']).toContain(result.winnerId)
  })
})
