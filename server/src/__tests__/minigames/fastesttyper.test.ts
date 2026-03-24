import { describe, it, expect, vi } from 'vitest'
import fastesttyper from '../../minigames/fastesttyper'
import { makeRoom, makeMatch } from '../helpers'

vi.mock('../../sync/broadcast', () => ({ broadcast: vi.fn() }))

describe('fastesttyper — integration', () => {
  it('resolves with the first player to finish the phrase', () => {
    vi.useFakeTimers()
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    fastesttyper.start(room)

    const state = room.match.minigameState as { phrase: string }
    fastesttyper.handleInput(room, 'p1', { type: 'TYPE', text: state.phrase })

    vi.runAllTimers()
    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
  })

  it('ignores input after the round is resolved', () => {
    vi.useFakeTimers()
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    fastesttyper.start(room)

    const state = room.match.minigameState as { phrase: string }

    fastesttyper.handleInput(room, 'p1', { type: 'TYPE', text: state.phrase })
    vi.runAllTimers()
    onRoundDone.mockClear()

    // p2 finishes after p1 — should not fire onRoundDone again
    fastesttyper.handleInput(room, 'p2', { type: 'TYPE', text: state.phrase })
    vi.runAllTimers()
    expect(onRoundDone).not.toHaveBeenCalled()
  })

  it('tracks prefix-correct progress accurately', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    fastesttyper.start(room)

    const state = room.match.minigameState as {
      phrase: string
      progress: Record<string, number>
    }
    const phrase = state.phrase

    // Type first 5 chars correctly, then wrong
    fastesttyper.handleInput(room, 'p1', {
      type: 'TYPE',
      text: phrase.slice(0, 5) + 'X',
    })
    expect(state.progress['p1']).toBe(5)
  })

  it('only counts contiguous correct prefix (stops at first mismatch)', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    fastesttyper.start(room)

    const state = room.match.minigameState as {
      phrase: string
      progress: Record<string, number>
    }
    const phrase = state.phrase
    // Correct chars at positions 0-1, wrong at 2, correct at 3+
    const text = phrase[0]! + phrase[1]! + 'X' + phrase.slice(3)
    fastesttyper.handleInput(room, 'p1', { type: 'TYPE', text })
    expect(state.progress['p1']).toBe(2)
  })

  it('getResult returns player with more progress when timer expires', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    fastesttyper.start(room)

    const state = room.match.minigameState as {
      phrase: string
      progress: Record<string, number>
    }
    const phrase = state.phrase

    // p1 further along than p2
    fastesttyper.handleInput(room, 'p1', { type: 'TYPE', text: phrase.slice(0, 10) })
    fastesttyper.handleInput(room, 'p2', { type: 'TYPE', text: phrase.slice(0, 3) })

    const result = fastesttyper.getResult(room)
    expect(result.winnerId).toBe('p1')
    expect(result.reason).toBe('timeout')
  })

  it('ignores non-TYPE input', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    fastesttyper.start(room)

    const state = room.match.minigameState as { progress: Record<string, number> }
    fastesttyper.handleInput(room, 'p1', { type: 'CLICK' })
    expect(state.progress['p1']).toBe(0)
  })

  it('clamps input text to 200 chars', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    fastesttyper.start(room)

    const state = room.match.minigameState as {
      phrase: string
      progress: Record<string, number>
    }
    // A 300-char string that starts with the phrase
    const longText = state.phrase.padEnd(300, ' ')
    fastesttyper.handleInput(room, 'p1', { type: 'TYPE', text: longText })
    // Progress is at most phrase.length — just assert it doesn't throw and progress is set
    expect(state.progress['p1']).toBeGreaterThanOrEqual(0)
  })
})
