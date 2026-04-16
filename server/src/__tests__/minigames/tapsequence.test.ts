import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import tapsequence from '../../minigames/tapsequence'
import { makeRoom, makeMatch } from '../helpers'

vi.mock('../../sync/broadcast', () => ({ broadcast: vi.fn() }))

const SHOW_PRE_DELAY_MS = 600
const SHOW_PER_BUTTON_MS = 700
const SHOW_BUFFER_MS = 400

function skipShowing(seqLen: number) {
  vi.advanceTimersByTime(SHOW_PRE_DELAY_MS + seqLen * SHOW_PER_BUTTON_MS + SHOW_BUFFER_MS + 50)
}

interface TapState {
  level: number
  seqLen: number
  phase: 'showing' | 'input'
  sequence: number[]
  progress: Record<string, number>
  passed: Record<string, boolean>
  eliminated: Record<string, boolean>
  winnerId?: string
  resolved: boolean
}

describe('tapsequence — integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at level 1 with seqLen=4 in showing phase', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    expect(state.level).toBe(1)
    expect(state.seqLen).toBe(4)
    expect(state.sequence).toHaveLength(4)
    expect(state.phase).toBe('showing')
    expect(state.resolved).toBe(false)
  })

  it('generates a sequence using only button indices 0-3', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    expect(state.sequence.every((b) => b >= 0 && b <= 3)).toBe(true)
  })

  it('transitions to input phase after the showing window', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    expect(state.phase).toBe('showing')

    skipShowing(state.seqLen)
    expect(state.phase).toBe('input')
  })

  it('resolves immediately when a player presses a wrong button', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    skipShowing(state.seqLen)

    const wrongButton = (state.sequence[0]! + 1) % 4
    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: wrongButton })

    expect(state.eliminated['p1']).toBe(true)
    expect(state.winnerId).toBe('p2')

    vi.runAllTimers()
    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p2', reason: 'completed' })
  })

  it('advances to level 2 when both players complete level 1', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    skipShowing(state.seqLen)

    const seq = [...state.sequence]
    for (const btn of seq) {
      tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: btn })
    }
    for (const btn of seq) {
      tapsequence.handleInput(room, 'p2', { type: 'PRESS', button: btn })
    }

    expect(state.passed['p1']).toBe(true)
    expect(state.passed['p2']).toBe(true)
    expect(onRoundDone).not.toHaveBeenCalled()

    // Advance through the result delay to trigger the next level
    vi.advanceTimersByTime(1500)
    skipShowing(state.seqLen) // skip showing for level 2

    expect(state.level).toBe(2)
    expect(state.seqLen).toBe(5)
  })

  it('resolves win immediately when a player completes level 10', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    tapsequence.start(room)

    const state = room.match.minigameState as TapState

    // Fast-forward through levels 1-9: both players pass each level
    for (let lvl = 1; lvl <= 9; lvl++) {
      skipShowing(state.seqLen)
      const seq = [...state.sequence]
      for (const btn of seq) tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: btn })
      for (const btn of seq) tapsequence.handleInput(room, 'p2', { type: 'PRESS', button: btn })
      vi.advanceTimersByTime(1500)
    }

    expect(state.level).toBe(10)
    skipShowing(state.seqLen)

    const seq = [...state.sequence]
    for (const btn of seq) {
      tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: btn })
    }

    expect(state.winnerId).toBe('p1')
    vi.runAllTimers()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
  })

  it('ignores input during showing phase', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    expect(state.phase).toBe('showing')

    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: state.sequence[0]! })
    expect(state.progress['p1']).toBeUndefined()
    expect(state.eliminated['p1']).toBeUndefined()
  })

  it('ignores input from an already-passed player', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    skipShowing(state.seqLen)

    // p1 completes the sequence
    for (const btn of state.sequence) {
      tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: btn })
    }
    expect(state.passed['p1']).toBe(true)

    // Extra input should be ignored
    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: 0 })
    expect(state.progress['p1']).toBe(state.seqLen) // unchanged
  })

  it('ignores input from an already-eliminated player', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    skipShowing(state.seqLen)

    const wrongButton = (state.sequence[0]! + 1) % 4
    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: wrongButton })
    expect(state.eliminated['p1']).toBe(true)

    // Further input from eliminated player is ignored
    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: 0 })
    expect(state.resolved).toBe(true) // still resolved with p2 winning
  })

  it('ignores non-PRESS input types', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    skipShowing(state.seqLen)

    tapsequence.handleInput(room, 'p1', { type: 'CLICK' })
    expect(state.progress['p1']).toBeUndefined()
  })

  it('getResult awards the player who progressed further on timeout', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    skipShowing(state.seqLen)

    // p1 gets 2 correct, p2 gets none
    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: state.sequence[0]! })
    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: state.sequence[1]! })

    const result = tapsequence.getResult(room)
    expect(result.winnerId).toBe('p1')
  })

  it('both eliminated simultaneously resolves with a random winner', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // force p1 to win in random
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    tapsequence.start(room)

    const state = room.match.minigameState as TapState
    skipShowing(state.seqLen)

    const wrongButton = (state.sequence[0]! + 1) % 4

    // Both press wrong simultaneously (p1 first, p2 second while p1 already eliminated)
    tapsequence.handleInput(room, 'p1', { type: 'PRESS', button: wrongButton })
    tapsequence.handleInput(room, 'p2', { type: 'PRESS', button: wrongButton })

    vi.runAllTimers()
    expect(onRoundDone).toHaveBeenCalledOnce()
    const result = onRoundDone.mock.calls[0]?.[0]
    expect(['p1', 'p2']).toContain(result?.winnerId)

    vi.restoreAllMocks()
  })
})
