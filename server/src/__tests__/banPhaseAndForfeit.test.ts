import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startMatch, handleDraftSubmit, forfeitMatch, resolveRound } from '../match/matchController'
import { makeRoom, makeMatch } from './helpers'
import { clearAllRooms } from '../rooms/roomStore'

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
const ALL_GAMES = [
  'clickspeed',
  'coinflip',
  'reactiontest',
  'quickmaths',
  'memorymatch',
  'fastesttyper',
  'rockpaperscissors',
  'colorword',
  'tapsequence',
] as const

vi.mock('../minigames/index', () => ({
  getMinigame: vi.fn(() => ({
    id: 'clickspeed',
    start: vi.fn(),
    handleInput: vi.fn(),
    getResult: vi.fn(() => ({ winnerId: null, reason: 'timeout' as const })),
  })),
  // Respects bannedIds so we can assert on the resulting queue
  shuffleQueue: vi.fn(
    (_bestOf: number, _cats: string[], _platforms: string[], bannedIds: string[]) =>
      ALL_GAMES.filter((id) => !bannedIds.includes(id))
  ),
}))

beforeEach(() => {
  clearAllRooms()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

// ── Ban phase ─────────────────────────────────────────────────────────────────

describe('ban phase', () => {
  it('enters banning status when draftCount > 0', () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 1 }
    startMatch(room)
    expect(room.status).toBe('banning')
  })

  it('skips ban phase and goes to round_start when draftCount === 0', () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 0 }
    startMatch(room)
    // launchMatch sets status to round_start synchronously before the 1500ms timeout
    expect(room.status).toBe('round_start')
  })

  it('stays in banning after only one player submits', () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 1 }
    startMatch(room)

    handleDraftSubmit(room, 'p1', ['clickspeed'])
    expect(room.status).toBe('banning')
  })

  it('launches match after both players submit bans', () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 1 }
    startMatch(room)

    handleDraftSubmit(room, 'p1', ['clickspeed'])
    handleDraftSubmit(room, 'p2', ['coinflip'])

    expect(room.status).toBe('round_start')
  })

  it('merges bans from both players (union)', () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 2 }
    startMatch(room)

    handleDraftSubmit(room, 'p1', ['clickspeed', 'coinflip'])
    handleDraftSubmit(room, 'p2', ['coinflip', 'reactiontest'])

    // clickspeed, coinflip, reactiontest all banned — queue should not contain them
    expect(room.match!.minigameQueue).not.toContain('clickspeed')
    expect(room.match!.minigameQueue).not.toContain('coinflip')
    expect(room.match!.minigameQueue).not.toContain('reactiontest')
  })

  it('clamps ban submissions to configured draftCount', () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 1 }
    startMatch(room)

    // Player tries to submit 2 bans when only 1 is allowed
    handleDraftSubmit(room, 'p1', ['clickspeed', 'coinflip'])
    handleDraftSubmit(room, 'p2', [])

    // Only 1 ban from p1 should be applied
    expect(room.match!.minigameQueue).not.toContain('clickspeed')
    expect(room.match!.minigameQueue).toContain('coinflip')
  })

  it('auto-launches match after BAN_PHASE_TIMEOUT_MS if a player never submits', () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 1 }
    startMatch(room)

    // Only p1 submits
    handleDraftSubmit(room, 'p1', ['clickspeed'])
    expect(room.status).toBe('banning')

    // 30s timeout fires — should auto-launch with p1's ban + empty bans for p2
    vi.advanceTimersByTime(30_000)

    expect(room.status).toBe('round_start')
    expect(room.match!.minigameQueue).not.toContain('clickspeed')
  })

  it('does not double-launch if both players submit before timeout', async () => {
    const room = makeRoom()
    room.config = { ...room.config, draftCount: 1 }
    startMatch(room)

    handleDraftSubmit(room, 'p1', ['clickspeed'])
    handleDraftSubmit(room, 'p2', ['coinflip'])
    const queueAfterBothSubmit = [...room.match!.minigameQueue]

    // Timeout fires but status is no longer 'banning' — should be a no-op
    // (shuffleQueue mock should not be called a second time)
    const { shuffleQueue } = vi.mocked(await import('../minigames/index'))
    const callsBefore = shuffleQueue.mock.calls.length

    vi.advanceTimersByTime(30_000)

    expect(shuffleQueue.mock.calls.length).toBe(callsBefore)
    expect(room.match!.minigameQueue).toEqual(queueAfterBothSubmit)
  })
})

// ── Forfeit during active minigame ────────────────────────────────────────────

describe('forfeit during active round', () => {
  it('ends match with correct winner', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    room.status = 'playing'

    forfeitMatch(room, 'p1')

    expect(room.status).toBe('match_end')
  })

  it('nulls onRoundDone so stale timers cannot trigger resolveRound', () => {
    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    room.match.onRoundDone = vi.fn()
    room.status = 'playing'

    forfeitMatch(room, 'p1')

    expect(room.match!.onRoundDone).toBeNull()
  })

  it('does not double-broadcast ROUND_END after forfeit fires a stale timer', async () => {
    const { broadcast } = vi.mocked(await import('../sync/broadcast'))
    broadcast.mockClear()

    const room = makeRoom()
    room.match = makeMatch('p1', 'p2')
    room.status = 'playing'

    forfeitMatch(room, 'p1')

    // Simulate a stale minigame timer firing — resolveRound should be a no-op
    // because roundResolved is true and onRoundDone is null after endMatch.
    resolveRound(room, { winnerId: 'p2', reason: 'timeout' })

    const roundEndCalls = (broadcast as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => args[1] === 'ROUND_END'
    )
    expect(roundEndCalls).toHaveLength(0)
  })
})
