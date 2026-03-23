import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import type { ClientMessage } from '@shared/types'
import { send, toPlayerInfos } from './broadcast'
import { getRoom } from '../rooms/roomStore'
import {
  joinOrCreateRoom,
  setPlayerReady,
  handleDisconnect,
  handleReconnect,
  handleRematchVote,
  joinAsSpectator,
  removeSpectator,
} from '../rooms/roomManager'
import { handleGameInput } from '../match/matchController'

interface ConnState {
  playerId: string
  roomId: string | null
  role: 'player' | 'spectator'
}

const connections = new Map<WebSocket, ConnState>()

export function onConnection(ws: WebSocket): void {
  const playerId = uuidv4()
  connections.set(ws, { playerId, roomId: null, role: 'player' })
  console.log(`[WS] Connection opened, assigned playerId=${playerId}`)

  ws.on('message', (raw) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage
    } catch {
      send(ws, 'ERROR', { code: 'INVALID_JSON', message: 'Malformed message' })
      return
    }
    handleMessage(ws, msg)
  })

  ws.on('close', () => {
    const conn = connections.get(ws)
    if (conn?.roomId) {
      if (conn.role === 'spectator') removeSpectator(conn.roomId, ws)
      else handleDisconnect(conn.roomId, conn.playerId)
    }
    connections.delete(ws)
    console.log(`[WS] Connection closed, playerId=${conn?.playerId}, role=${conn?.role}`)
  })

  ws.on('error', (err) => {
    console.error(`[WS] Error for playerId=${connections.get(ws)?.playerId}:`, err.message)
  })
}

function handleMessage(ws: WebSocket, msg: ClientMessage): void {
  const conn = connections.get(ws)
  if (!conn) return

  switch (msg.type) {
    case 'SET_NICKNAME': {
      const raw = (msg.payload as { nickname: string }).nickname
      const nickname = raw?.trim().replace(/\s+/g, ' ')
      const roomId = msg.roomId

      if (!roomId || !nickname) {
        send(ws, 'ERROR', { code: 'MISSING_FIELDS', message: 'roomId and nickname required' })
        return
      }

      const result = joinOrCreateRoom(roomId, conn.playerId, nickname, ws)

      if ('error' in result) {
        send(ws, 'ERROR', result.error)
        return
      }

      const { room } = result
      conn.roomId = roomId

      // Send ROOM_JOINED to every player (with their own playerId)
      for (const player of room.players) {
        send(player.ws, 'ROOM_JOINED', {
          roomId,
          playerId: player.id,
          players: toPlayerInfos(room.players),
          spectatorCount: room.spectators.length,
        })
      }
      break
    }

    case 'SET_READY': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      setPlayerReady(room, conn.playerId)
      break
    }

    case 'GAME_INPUT': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      handleGameInput(room, conn.playerId, msg.payload)
      break
    }

    case 'SPECTATE': {
      const { roomId } = msg.payload as { roomId: string }
      if (!roomId) {
        send(ws, 'ERROR', { code: 'MISSING_FIELDS', message: 'roomId required' })
        return
      }
      const result = joinAsSpectator(roomId, ws)
      if ('error' in result) {
        send(ws, 'ERROR', result.error)
        return
      }
      conn.roomId = roomId
      conn.role = 'spectator'
      break
    }

    case 'EMOTE': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      const { emote } = msg.payload as { emote: string }
      // Broadcast to all players and spectators in the room
      for (const player of room.players) {
        send(player.ws, 'EMOTE_RECEIVED', { fromPlayerId: conn.playerId, emote })
      }
      for (const spec of room.spectators) {
        send(spec, 'EMOTE_RECEIVED', { fromPlayerId: conn.playerId, emote })
      }
      break
    }

    case 'REMATCH': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      handleRematchVote(room, conn.playerId)
      break
    }

    case 'RECONNECT': {
      const { playerId: oldId, roomId } = msg.payload as { playerId: string; roomId: string }
      if (!oldId || !roomId) return

      const result = handleReconnect(roomId, oldId, ws)
      if ('error' in result) {
        send(ws, 'ERROR', result.error)
        return
      }

      // Update connection state to use the re-attached playerId
      conn.playerId = oldId
      conn.roomId = roomId
      break
    }

    default:
      send(ws, 'ERROR', { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${msg.type}` })
  }
}
