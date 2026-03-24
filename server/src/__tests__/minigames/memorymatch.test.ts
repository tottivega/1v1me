import { describe, it, expect, vi } from 'vitest'
import memorymatch from '../../minigames/memorymatch'
import { makeRoom, makeMatch } from '../helpers'

vi.mock('../../sync/broadcast', () => ({ broadcast: vi.fn() }))

describe('memorymatch — integration', () => {
  it('resolves early when both players submit, winner has more matches', () => {
    vi.useFakeTimers()
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    memorymatch.start(room)

    const state = room.match.minigameState as { sequence: string[] }
    const seq = state.sequence

    // p1 submits the full correct sequence; p2 submits all wrong
    const wrong = seq.map(() => '❌')
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: [...seq] })
    memorymatch.handleInput(room, 'p2', { type: 'SUBMIT', sequence: wrong })

    vi.runAllTimers()
    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
  })

  it('ignores duplicate submissions from the same player', () => {
    vi.useFakeTimers()
    const room = makeRoom()
    const onRoundDone = vi.fn()
    room.match = makeMatch('p1', 'p2', { onRoundDone })
    memorymatch.start(room)

    const state = room.match.minigameState as {
      sequence: string[]
      submissions: Record<string, string[]>
    }
    const seq = state.sequence

    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: [...seq] })
    const firstSubmission = [...state.submissions['p1']]

    // Second submit should be ignored
    memorymatch.handleInput(room, 'p1', {
      type: 'SUBMIT',
      sequence: ['❌', '❌', '❌', '❌', '❌'],
    })

    expect(state.submissions['p1']).toEqual(firstSubmission)
  })

  it('truncates overly long submissions to SEQ_LEN', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as {
      sequence: string[]
      submissions: Record<string, string[]>
    }
    const seq = state.sequence
    const overlong = [...seq, '🔴', '🔵', '🟡'] // 8 items, seq is 5

    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: overlong })
    expect(state.submissions['p1']).toHaveLength(seq.length)
  })

  it('getResult uses progress-based winner when timer expires before both submit', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as { sequence: string[] }
    const seq = state.sequence

    // Only p1 submits — p2 has no submission (empty array via getResult)
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: [...seq] })

    const result = memorymatch.getResult(room)
    expect(result.winnerId).toBe('p1')
  })

  it('ignores non-SUBMIT input types', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as { submissions: Record<string, string[]> }
    memorymatch.handleInput(room, 'p1', { type: 'CLICK' })
    expect(state.submissions['p1']).toBeUndefined()
  })

  it('handles non-array sequence input gracefully', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    memorymatch.start(room)

    const state = room.match.minigameState as { submissions: Record<string, string[]> }
    // sequence is not an array — should be treated as empty
    memorymatch.handleInput(room, 'p1', { type: 'SUBMIT', sequence: 'not-an-array' })
    expect(state.submissions['p1']).toEqual([])
  })
})
