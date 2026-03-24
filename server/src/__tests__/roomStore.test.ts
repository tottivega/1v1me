import { describe, it, expect, beforeEach } from 'vitest'
import { setRoom, getRoomCount, getOpenRooms, clearAllRooms } from '../rooms/roomStore'
import { makeRoom, makePlayer } from './helpers'

beforeEach(() => {
  clearAllRooms()
})

describe('getRoomCount()', () => {
  it('returns 0 when no rooms exist', () => {
    expect(getRoomCount()).toBe(0)
  })

  it('increments when a room is added', () => {
    setRoom(makeRoom('r1'))
    expect(getRoomCount()).toBe(1)
    setRoom(makeRoom('r2'))
    expect(getRoomCount()).toBe(2)
  })
})

describe('getOpenRooms()', () => {
  it('returns empty array when no rooms', () => {
    expect(getOpenRooms().rooms).toEqual([])
  })

  it('includes lobby rooms with exactly 1 player', () => {
    const room = makeRoom('r1')
    room.players = [makePlayer('p1', 'Alice')]
    room.status = 'lobby'
    setRoom(room)

    const { rooms } = getOpenRooms()
    expect(rooms).toHaveLength(1)
    expect(rooms[0]!.roomId).toBe('r1')
    expect(rooms[0]!.creatorNickname).toBe('Alice')
    expect(typeof rooms[0]!.createdAt).toBe('number')
  })

  it('excludes rooms with 2 players', () => {
    // makeRoom() creates a room with 2 players by default
    setRoom(makeRoom('r2'))
    expect(getOpenRooms().rooms).toHaveLength(0)
  })

  it('excludes rooms with status other than lobby', () => {
    const room = makeRoom('r3')
    room.players = [makePlayer('p1', 'Alice')]
    room.status = 'playing'
    setRoom(room)

    expect(getOpenRooms().rooms).toHaveLength(0)
  })
})
