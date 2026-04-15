import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fastesttyper from '../../minigames/fastesttyper'
import { makeRoom, makeMatch } from '../helpers'

vi.mock('../../sync/broadcast', () => ({ broadcast: vi.fn() }))

const PHRASE_COUNT = 10
const MIN_MS = 800 // must match MIN_MS_PER_PHRASE in fastesttyper.ts

function setup(onRoundDone = vi.fn()) {
  const room = makeRoom()
  room.match = makeMatch('p1', 'p2', { onRoundDone })
  fastesttyper.start(room)
  const state = room.match.minigameState as {
    phrases: string[]
    completed: Record<string, number>
    charProgress: Record<string, number>
    lastCompleteTime: Record<string, number>
    resolved: boolean
    winnerId: string | null
  }
  return { room, state, onRoundDone }
}

/** Advance fake clock by MIN_MS and send one phrase completion. */
function completePhrase(room: ReturnType<typeof makeRoom>, playerId: string, n: number, chars = 0) {
  vi.advanceTimersByTime(MIN_MS)
  fastesttyper.handleInput(room, playerId, { type: 'PROGRESS', completed: n, chars })
}

/** Complete `count` phrases in sequence for a player, starting from their current position. */
function completePhrases(room: ReturnType<typeof makeRoom>, playerId: string, count: number) {
  const state = room.match!.minigameState as { completed: Record<string, number> }
  const start = state.completed[playerId] ?? 0
  for (let i = start + 1; i <= start + count; i++) {
    completePhrase(room, playerId, i)
  }
}

describe('fastesttyper — integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with 10 phrases and zero progress for each player', () => {
    const { state } = setup()
    expect(state.phrases).toHaveLength(PHRASE_COUNT)
    expect(state.completed['p1']).toBe(0)
    expect(state.completed['p2']).toBe(0)
    expect(state.charProgress['p1']).toBe(0)
    expect(state.charProgress['p2']).toBe(0)
    expect(state.resolved).toBe(false)
  })

  it('ignores non-PROGRESS input types', () => {
    const { state, room } = setup()
    fastesttyper.handleInput(room, 'p1', { type: 'TYPE', text: 'hello' })
    expect(state.completed['p1']).toBe(0)
  })

  it('records completed sentences and char progress', () => {
    const { state, room } = setup()
    completePhrases(room, 'p1', 3)
    // Update chars within the current phrase (same completed count — no rate limit applies)
    fastesttyper.handleInput(room, 'p1', { type: 'PROGRESS', completed: 3, chars: 7 })
    expect(state.completed['p1']).toBe(3)
    expect(state.charProgress['p1']).toBe(7)
    expect(state.completed['p2']).toBe(0) // p2 unaffected
  })

  it('resolves immediately when a player completes all 10 sentences', () => {
    const { state, room, onRoundDone } = setup()
    completePhrases(room, 'p1', PHRASE_COUNT)
    expect(state.resolved).toBe(true)
    expect(state.winnerId).toBe('p1')
    expect(onRoundDone).toHaveBeenCalledOnce()
    expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
  })

  it('ignores input after round is resolved', () => {
    const { room, onRoundDone } = setup()
    completePhrases(room, 'p1', PHRASE_COUNT)
    onRoundDone.mockClear()
    // p2 attempts to complete all phrases — all rejected since resolved
    completePhrases(room, 'p2', PHRASE_COUNT)
    expect(onRoundDone).not.toHaveBeenCalled()
  })

  it('getResult returns player with more sentences on timeout', () => {
    const { room } = setup()
    completePhrases(room, 'p1', 5)
    completePhrases(room, 'p2', 3)
    const result = fastesttyper.getResult(room)
    expect(result.winnerId).toBe('p1')
    expect(result.reason).toBe('timeout')
  })

  it('getResult tiebreaks on chars in partial sentence', () => {
    const { room } = setup()
    completePhrases(room, 'p1', 4)
    completePhrases(room, 'p2', 4)
    // Update char progress without changing completion count (no rate limit)
    fastesttyper.handleInput(room, 'p1', { type: 'PROGRESS', completed: 4, chars: 10 })
    fastesttyper.handleInput(room, 'p2', { type: 'PROGRESS', completed: 4, chars: 3 })
    const result = fastesttyper.getResult(room)
    expect(result.winnerId).toBe('p1')
  })

  it('getResult tiebreaks on last completion time when sentences and chars tie', () => {
    vi.setSystemTime(0)
    const { room } = setup()
    // p1 finishes 4 phrases early (completions at 800, 1600, 2400, 3200ms)
    completePhrases(room, 'p1', 4)
    // Jump forward so p2 completes the same count much later
    vi.setSystemTime(10_000)
    completePhrases(room, 'p2', 4) // completions at 10800, 11600, 12400, 13200ms
    // Same char progress for both
    fastesttyper.handleInput(room, 'p1', { type: 'PROGRESS', completed: 4, chars: 5 })
    fastesttyper.handleInput(room, 'p2', { type: 'PROGRESS', completed: 4, chars: 5 })
    const result = fastesttyper.getResult(room)
    expect(result.winnerId).toBe('p1')
  })

  it('does not let completed count decrease', () => {
    const { state, room } = setup()
    completePhrases(room, 'p1', 2)
    // Server must reject backward movement
    fastesttyper.handleInput(room, 'p1', { type: 'PROGRESS', completed: 1, chars: 0 })
    expect(state.completed['p1']).toBe(2)
  })

  it('clamps completed to PHRASE_COUNT', () => {
    const { state, room, onRoundDone } = setup()
    // Reach phrase 9 legitimately
    completePhrases(room, 'p1', PHRASE_COUNT - 1)
    onRoundDone.mockClear()
    // Overshoot — Math.min clamps to 10, which is prevCompleted + 1 → valid
    vi.advanceTimersByTime(MIN_MS)
    fastesttyper.handleInput(room, 'p1', {
      type: 'PROGRESS',
      completed: PHRASE_COUNT + 5,
      chars: 0,
    })
    expect(state.completed['p1']).toBe(PHRASE_COUNT)
    expect(onRoundDone).toHaveBeenCalledOnce()
  })
})
