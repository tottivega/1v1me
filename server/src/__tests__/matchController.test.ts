import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveRound } from '../match/matchController'
import { persistRoundResult } from '../db/index'
import { makeRoom, makeMatch } from './helpers'

// Mock all side effects so resolveRound is isolated to its core logic
vi.mock('../sync/broadcast', () => ({ broadcast: vi.fn(), toPlayerInfos: vi.fn(() => []) }))
vi.mock('../timer/timerController', () => ({
  stopTimer: vi.fn(),
  startTimer: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
}))
vi.mock('../db/index', () => ({
  persistMatchResult: vi.fn().mockResolvedValue(undefined),
  persistRoundResult: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../minigames/index', () => ({
  getMinigame: vi.fn(() => ({
    id: 'clickspeed',
    start: vi.fn(),
    handleInput: vi.fn(),
    getResult: vi.fn(() => ({ winnerId: null, reason: 'timeout' as const })),
  })),
  shuffleQueue: vi.fn(() => [
    'clickspeed',
    'coinflip',
    'reactiontest',
    'quickmaths',
    'memorymatch',
  ]),
}))

describe('resolveRound()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('increments the winner score', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    room.status = 'playing'

    resolveRound(room, { winnerId: 'p1', reason: 'completed' })

    expect(room.match!.scores['p1']).toBe(1)
    expect(room.match!.scores['p2']).toBe(0)
  })

  it('records round in history', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')

    resolveRound(room, { winnerId: 'p2', reason: 'completed' })

    expect(room.match!.roundHistory).toHaveLength(1)
    expect(room.match!.roundHistory[0]!).toMatchObject({
      round: 1,
      minigameId: 'clickspeed',
      winnerId: 'p2',
    })
  })

  it('calls persistRoundResult with correct round data', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')

    resolveRound(room, { winnerId: 'p1', reason: 'completed' })

    expect(persistRoundResult).toHaveBeenCalledWith({
      matchId: 'match-1',
      roundNumber: 1,
      minigameId: 'clickspeed',
      winnerId: 'p1',
    })
  })

  it('calls persistRoundResult with null winnerId on draw', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')

    resolveRound(room, { winnerId: null, reason: 'timeout' })

    expect(persistRoundResult).toHaveBeenCalledWith(expect.objectContaining({ winnerId: null }))
  })

  it('does not double-resolve if called twice', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')

    resolveRound(room, { winnerId: 'p1', reason: 'completed' })
    resolveRound(room, { winnerId: 'p2', reason: 'completed' }) // should be ignored

    expect(room.match!.scores['p1']).toBe(1)
    expect(room.match!.scores['p2']).toBe(0)
  })

  it('sets roomStatus to round_end', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    room.status = 'playing'

    resolveRound(room, { winnerId: 'p1', reason: 'completed' })

    expect(room.status).toBe('round_end')
  })

  it('handles draw — no scores change', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')

    resolveRound(room, { winnerId: null, reason: 'timeout' })

    expect(room.match!.scores['p1']).toBe(0)
    expect(room.match!.scores['p2']).toBe(0)
    expect(room.match!.roundHistory[0]!.winnerId).toBeNull()
  })

  it('transitions to match_end when a player reaches 3 wins', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', { scores: { p1: 2, p2: 0 }, currentRound: 3 })

    resolveRound(room, { winnerId: 'p1', reason: 'completed' })
    vi.runAllTimers()

    expect(room.status).toBe('match_end')
  })

  it('transitions to match_end after 5 rounds if no one has 3 wins', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2', { scores: { p1: 2, p2: 2 }, currentRound: 5 })

    resolveRound(room, { winnerId: 'p1', reason: 'completed' })
    vi.runAllTimers()

    expect(room.status).toBe('match_end')
  })
})
