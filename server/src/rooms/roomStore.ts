import type { Room } from '../types'

const rooms = new Map<string, Room>()

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId)
}

export function setRoom(room: Room): void {
  rooms.set(room.roomId, room)
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId)
}

export function getRoomByPlayerId(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.id === playerId)) return room
  }
  return undefined
}

export function getRoomCount(): number {
  return rooms.size
}

/** Remove all rooms. Intended for use in tests only. */
export function clearAllRooms(): void {
  rooms.clear()
}

export function getOpenRooms(
  limit = 20,
  offset = 0
): { rooms: Array<{ roomId: string; creatorNickname: string; createdAt: number }>; total: number } {
  const all: Array<{ roomId: string; creatorNickname: string; createdAt: number }> = []
  for (const room of rooms.values()) {
    if (room.players.length === 1 && room.status === 'lobby') {
      all.push({
        roomId: room.roomId,
        creatorNickname: room.players[0]!.nickname,
        createdAt: room.createdAt,
      })
    }
  }
  // Sort newest-first, then paginate
  all.sort((a, b) => b.createdAt - a.createdAt)
  return { rooms: all.slice(offset, offset + limit), total: all.length }
}
