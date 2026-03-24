import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import type { ClientMessage, MinigameCategory, RoomConfig } from '@shared/types'
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
import { handleGameInput, handleRoundReady } from '../match/matchController'

const RATE_LIMIT = 60 // max messages per window
const RATE_WINDOW_MS = 1000 // sliding window size

interface ConnState {
  playerId: string
  roomId: string | null
  role: 'player' | 'spectator'
  msgCount: number
  windowStart: number
}

const connections = new Map<WebSocket, ConnState>()

export function onConnection(ws: WebSocket): void {
  const playerId = uuidv4()
  connections.set(ws, {
    playerId,
    roomId: null,
    role: 'player',
    msgCount: 0,
    windowStart: Date.now(),
  })
  console.log(`[WS] Connection opened, assigned playerId=${playerId}`)

  ws.on('message', (raw) => {
    const conn = connections.get(ws)
    if (!conn) return

    // Sliding-window rate limit
    const now = Date.now()
    if (now - conn.windowStart >= RATE_WINDOW_MS) {
      conn.windowStart = now
      conn.msgCount = 0
    }
    conn.msgCount++
    if (conn.msgCount > RATE_LIMIT) {
      send(ws, 'ERROR', { code: 'RATE_LIMITED', message: 'Too many messages — slow down' })
      return
    }

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
          config: room.config,
        })
      }
      break
    }

    case 'SET_ROOM_CONFIG': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      // Only the room creator (first player) may change config, and only before anyone readies
      if (room.players[0]?.id !== conn.playerId) return
      if (room.status !== 'lobby' || room.players.some((p) => p.ready)) return

      const { bestOf, enabledCategories } = msg.payload as Partial<RoomConfig>
      const validBestOf = [3, 5, 7, 9]
      if (!bestOf || !validBestOf.includes(bestOf)) return
      if (
        !Array.isArray(enabledCategories) ||
        enabledCategories.length === 0 ||
        !enabledCategories.every((c) =>
          ['reflex', 'math', 'luck', 'strategy', 'trivia'].includes(c as MinigameCategory)
        )
      )
        return

      room.config = { bestOf, enabledCategories }
      for (const player of room.players) {
        send(player.ws, 'ROOM_CONFIG', { config: room.config })
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
      if (!emote || typeof emote !== 'string' || emote.length > 10) return
      // Broadcast to all players and spectators in the room
      for (const player of room.players) {
        send(player.ws, 'EMOTE_RECEIVED', { fromPlayerId: conn.playerId, emote })
      }
      for (const spec of room.spectators) {
        send(spec, 'EMOTE_RECEIVED', { fromPlayerId: conn.playerId, emote })
      }
      break
    }

    case 'ROUND_READY': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      handleRoundReady(room, conn.playerId)
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
