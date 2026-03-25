import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  joinOrCreateRoom,
  setPlayerAvatar,
  handleDisconnect,
  handleReconnect,
  handleRematchVote,
  joinAsSpectator,
  removeSpectator,
} from '../rooms/roomManager'
import { deleteRoom, getRoom } from '../rooms/roomStore'
import { makeWs, makeMatch } from './helpers'

vi.mock('../sync/broadcast', () => ({
  broadcast: vi.fn(),
  broadcastAll: vi.fn(),
  send: vi.fn(),
  toPlayerInfos: vi.fn(
    (
      players: {
        id: string
        nickname: string
        avatar: string
        ready: boolean
        connected: boolean
      }[]
    ) =>
      players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        ready: p.ready,
        connected: p.connected,
      }))
  ),
}))
vi.mock('../match/matchController', () => ({ startMatch: vi.fn(), forfeitMatch: vi.fn() }))
vi.mock('../timer/timerController', () => ({
  stopTimer: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  startTimer: vi.fn(),
}))

import { send } from '../sync/broadcast'

const ROOM_ID = 'room-abc'

beforeEach(() => {
  vi.useFakeTimers()
  deleteRoom(ROOM_ID)
  vi.clearAllMocks()
})

describe('joinOrCreateRoom()', () => {
  it('creates a new room and returns it', () => {
    const ws = makeWs()
    const result = joinOrCreateRoom(ROOM_ID, 'player-1', 'Alice', ws)
    expect('room' in result).toBe(true)
    if (!('room' in result)) return
    expect(result.room.roomId).toBe(ROOM_ID)
    expect(result.room.players).toHaveLength(1)
    expect(result.room.players[0]!.nickname).toBe('Alice')
  })

  it('adds a second player to an existing room', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    const result = joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    expect('room' in result).toBe(true)
    if (!('room' in result)) return
    expect(result.room.players).toHaveLength(2)
  })

  it('rejects a third player with ROOM_FULL', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const result = joinOrCreateRoom(ROOM_ID, 'p3', 'Charlie', makeWs())
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error.code).toBe('ROOM_FULL')
  })

  it('trims and caps nickname at 18 chars', () => {
    const result = joinOrCreateRoom(ROOM_ID, 'p1', '  VeryLongNicknameExceeding18Chars  ', makeWs())
    if (!('room' in result)) return
    expect(result.room.players[0]!.nickname.length).toBeLessThanOrEqual(18)
  })
})

describe('handleDisconnect()', () => {
  it('removes a player who disconnects from the lobby', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    handleDisconnect(ROOM_ID, 'p1')
    const room = getRoom(ROOM_ID)
    expect(room!.players).toHaveLength(0)
  })

  it('marks player disconnected and starts reconnect timer during a match', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const room = getRoom(ROOM_ID)!
    room.status = 'playing'
    room.match = makeMatch('p1', 'p2')

    handleDisconnect(ROOM_ID, 'p1')

    const player = room.players.find((p) => p.id === 'p1')!
    expect(player.connected).toBe(false)
    expect(player.reconnectTimer).not.toBeNull()
  })
})

describe('handleReconnect()', () => {
  it('returns error if room not found', () => {
    const result = handleReconnect('nonexistent', 'p1', makeWs())
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error.code).toBe('ROOM_NOT_FOUND')
  })

  it('re-attaches socket and marks player connected', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const room = getRoom(ROOM_ID)!
    room.status = 'playing'
    room.match = makeMatch('p1', 'p2')
    handleDisconnect(ROOM_ID, 'p1')

    const newWs = makeWs()
    const result = handleReconnect(ROOM_ID, 'p1', newWs)

    expect('room' in result).toBe(true)
    const player = room.players.find((p) => p.id === 'p1')!
    expect(player.connected).toBe(true)
    expect(player.ws).toBe(newWs)
    expect(player.reconnectTimer).toBeNull()
  })
})

describe('handleRematchVote()', () => {
  it('sends REMATCH_VOTE { waiting: true } to the first voter', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const room = getRoom(ROOM_ID)!
    room.status = 'match_end'

    handleRematchVote(room, 'p1')

    expect(send).toHaveBeenCalledWith(expect.anything(), 'REMATCH_VOTE', { waiting: true })
  })

  it('fires rematch (sends ROOM_JOINED to both) when both vote', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const room = getRoom(ROOM_ID)!
    room.status = 'match_end'
    room.match = makeMatch('p1', 'p2')

    handleRematchVote(room, 'p1')
    handleRematchVote(room, 'p2')

    const calls = (send as ReturnType<typeof vi.fn>).mock.calls
    const roomJoinedCalls = calls.filter(([, type]) => type === 'ROOM_JOINED')
    expect(roomJoinedCalls).toHaveLength(2)
    expect(room.rematchVotes.size).toBe(0)
    expect(room.status).toBe('lobby')
  })
})

describe('stale room cleanup', () => {
  it('deletes a room when the host disconnects before anyone joins and idle timer fires', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    handleDisconnect(ROOM_ID, 'p1')

    // Room still exists (cleanup timer not yet fired)
    expect(getRoom(ROOM_ID)).toBeDefined()

    // Advance past the 60s idle cleanup window
    vi.advanceTimersByTime(60_001)

    expect(getRoom(ROOM_ID)).toBeUndefined()
  })

  it('deletes a room when both players disconnect during a match and neither reconnects', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const room = getRoom(ROOM_ID)!
    room.status = 'playing'
    room.match = makeMatch('p1', 'p2')

    handleDisconnect(ROOM_ID, 'p1')
    handleDisconnect(ROOM_ID, 'p2')

    // Both players are marked disconnected with reconnect timers
    expect(room.players.every((p) => !p.connected)).toBe(true)
    expect(room.players.every((p) => p.reconnectTimer !== null)).toBe(true)

    // Room still exists — giving players a chance to reconnect
    expect(getRoom(ROOM_ID)).toBeDefined()

    // Advance past the 15s reconnect window — forfeit fires, room is deleted
    vi.advanceTimersByTime(15_001)

    expect(getRoom(ROOM_ID)).toBeUndefined()
  })
})

describe('setPlayerAvatar()', () => {
  it('updates the player avatar when a valid emoji is given', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    const room = getRoom(ROOM_ID)!
    setPlayerAvatar(room, 'p1', '🦊')
    expect(room.players[0]!.avatar).toBe('🦊')
  })

  it('rejects an invalid emoji (not in AVATARS list)', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    const room = getRoom(ROOM_ID)!
    const original = room.players[0]!.avatar
    setPlayerAvatar(room, 'p1', '🍕')
    expect(room.players[0]!.avatar).toBe(original)
  })

  it('does nothing when the room status is not lobby', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const room = getRoom(ROOM_ID)!
    room.status = 'playing'
    const original = room.players[0]!.avatar
    setPlayerAvatar(room, 'p1', '🦊')
    expect(room.players[0]!.avatar).toBe(original)
  })

  it('broadcasts ROOM_JOINED to all players after a valid change', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    joinOrCreateRoom(ROOM_ID, 'p2', 'Bob', makeWs())
    const room = getRoom(ROOM_ID)!
    vi.clearAllMocks()
    setPlayerAvatar(room, 'p1', '🦊')
    const calls = (send as ReturnType<typeof vi.fn>).mock.calls
    const roomJoinedCalls = calls.filter(([, type]) => type === 'ROOM_JOINED')
    expect(roomJoinedCalls).toHaveLength(2)
  })
})

describe('joinAsSpectator() / removeSpectator()', () => {
  it('adds spectator and sends SPECTATE_JOINED', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    const spectatorWs = makeWs()
    const room = getRoom(ROOM_ID)!

    joinAsSpectator(ROOM_ID, spectatorWs)

    expect(room.spectators).toContain(spectatorWs)
    expect(send).toHaveBeenCalledWith(spectatorWs, 'SPECTATE_JOINED', expect.any(Object))
  })

  it('removes spectator and broadcasts count', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    const spectatorWs = makeWs()
    joinAsSpectator(ROOM_ID, spectatorWs)
    const room = getRoom(ROOM_ID)!

    removeSpectator(ROOM_ID, spectatorWs)

    expect(room.spectators).not.toContain(spectatorWs)
  })

  it('rejects the 29th spectator with SPECTATOR_LIMIT_REACHED', () => {
    joinOrCreateRoom(ROOM_ID, 'p1', 'Alice', makeWs())
    // Fill up to the 28-spectator cap
    for (let i = 0; i < 28; i++) {
      const result = joinAsSpectator(ROOM_ID, makeWs())
      expect('error' in result).toBe(false)
    }
    // The 29th attempt must be rejected
    const overflow = joinAsSpectator(ROOM_ID, makeWs())
    expect('error' in overflow).toBe(true)
    if ('error' in overflow) {
      expect(overflow.error.code).toBe('SPECTATOR_LIMIT_REACHED')
    }
    // Room still has exactly 28
    expect(getRoom(ROOM_ID)!.spectators).toHaveLength(28)
  })
})
