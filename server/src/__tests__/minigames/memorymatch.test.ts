import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import memorymatch from '../../minigames/memorymatch'
import { makeRoom, makeMatch } from '../helpers'

vi.mock('../../sync/broadcast', () => ({ broadcast: vi.fn() }))

// Helper: advance past the memorize phase for a given seqLen (seqLen × 1.5s)
function skipMemorize(seqLen: number) {
  vi.advanceTimersByTime(Math.ceil(seqLen * 1.5) * 1000)
}

interface MemState {
  roundNum: number
  seqLen: number
  phase: 'memorize' | 'recall'
  sequence: string[]
  submissions: Record<string, string[]>
  resolved: boolean
}

describe('memorymatch — integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in memorize phase with seqLen=3', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    expect(state.roundNum).toBe(1)
    expect(state.seqLen).toBe(3)
    expect(state.phase).toBe('memorize')
    expect(state.sequence).toHaveLength(3)
  })

  it('transitions to recall after memorize time', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    expect(state.phase).toBe('memorize')

    skipMemorize(3) // ceil(3×1.5)=5s
    expect(state.phase).toBe('recall')
  })

  it('resolves with winner when both submit and scores differ', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    skipMemorize(state.seqLen)

    const seq = state.sequence
    const wrong = seq.map(() => '❌')
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: [...seq] })
    memorymatch.handleInput(room, 'p2', { type: 'SUBMIT', sequence: wrong })

    vi.runAllTimers()
    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
  })

  it('advances to round 2 with seqLen=4 when both tie', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    skipMemorize(state.seqLen) // → recall

    // Both submit the same (wrong) sequence → tie (both score 0)
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: ['❌', '❌', '❌'] })
    memorymatch.handleInput(room, 'p2', { type: 'SUBMIT', sequence: ['❌', '❌', '❌'] })

    // Should NOT have ended the game
    expect(onRoundDone).not.toHaveBeenCalled()

    // Advance through just the result delay to trigger round 2 start
    vi.advanceTimersByTime(2000)

    expect(state.roundNum).toBe(2)
    expect(state.seqLen).toBe(4)
    expect(state.sequence).toHaveLength(4)
  })

  it('ignores duplicate submissions from the same player', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    skipMemorize(state.seqLen)

    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: ['🔴', '🔵', '🟡'] })
    const firstSub = [...(state.submissions['p1'] ?? [])]

    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: ['❌', '❌', '❌'] })
    expect(state.submissions['p1']).toEqual(firstSub)
  })

  it('ignores submissions during memorize phase', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    // Still in memorize phase — submission should be ignored
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: ['🔴', '🔵', '🟡'] })
    expect(state.submissions['p1']).toBeUndefined()
  })

  it('truncates overly long submissions to seqLen', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    skipMemorize(state.seqLen)

    const overlong = Array.from({ length: 10 }, () => '🔴')
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: overlong })
    expect(state.submissions['p1']).toHaveLength(state.seqLen)
  })

  it('getResult uses progress-based winner when timer expires', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    skipMemorize(state.seqLen)

    // Only p1 submits the correct sequence
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: [...state.sequence] })

    const result = memorymatch.getResult(room)
    expect(result.winnerId).toBe('p1')
  })

  it('resolves randomly after 10 consecutive ties', () => {
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    memorymatch.start(room)

    const state = room.match.minigameState as MemState

    for (let round = 1; round <= 10; round++) {
      skipMemorize(state.seqLen)
      const wrong = Array.from({ length: state.seqLen }, () => '❌')
      memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: [...wrong] })
      memorymatch.handleInput(room, 'p2', { type: 'SUBMIT', sequence: [...wrong] })
      vi.advanceTimersByTime(2000) // result delay
    }

    // After 10 ties, a winner should have been assigned
    vi.runAllTimers()
    expect(onRoundDone).toHaveBeenCalledOnce()
    const result = onRoundDone.mock.calls[0]?.[0]
    expect(['p1', 'p2']).toContain(result?.winnerId)
  })

  it('ignores non-SUBMIT input types', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    skipMemorize(state.seqLen)

    memorymatch.handleInput(room, 'p1', { type: 'CLICK' })
    expect(state.submissions['p1']).toBeUndefined()
  })

  it('handles non-array sequence input gracefully', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as MemState
    skipMemorize(state.seqLen)

    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: 'not-an-array' })
    expect(state.submissions['p1']).toEqual([])
  })
})
