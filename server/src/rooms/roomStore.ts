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

export function getOpenRooms(): Array<{
  roomId: string
  creatorNickname: string
  createdAt: number
}> {
  const result: Array<{ roomId: string; creatorNickname: string; createdAt: number }> = []
  for (const room of rooms.values()) {
    if (room.players.length === 1 && room.status === 'lobby') {
      result.push({
        roomId: room.roomId,
        creatorNickname: room.players[0].nickname,
        createdAt: room.createdAt,
      })
    }
  }
  return result
}
