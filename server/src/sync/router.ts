import { WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { MINIGAME_CATEGORIES } from '@shared/types'
import type { ClientMessage, RoomConfig, SetNicknamePayload } from '@shared/types'
import { send, toPlayerInfos } from './broadcast'
import { getRoom } from '../rooms/roomStore'
import {
  joinOrCreateRoom,
  setPlayerAvatar,
  setPlayerReady,
  handleDisconnect,
  handleReconnect,
  handleRematchVote,
  joinAsSpectator,
  removeSpectator,
  touch,
} from '../rooms/roomManager'
import { handleGameInput, handleRoundReady, handleBanSubmit } from '../match/matchController'

const RATE_LIMIT = 60 // max messages per window per connection
const RATE_WINDOW_MS = 1000 // sliding window size
const ROOM_RATE_LIMIT = 120 // max messages per window across all players in a room
const EMOTE_RATE_MS = 5000 // minimum ms between emotes per connection

interface ConnState {
  playerId: string
  roomId: string | null
  role: 'player' | 'spectator'
  spectatorNickname?: string
  spectatorNum?: number
  msgCount: number
  windowStart: number
  lastEmoteAt: number
  lastPingAt: number
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
    lastEmoteAt: 0,
    lastPingAt: 0,
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

    // Per-room rate limit: 120 msg/s across all players combined
    if (conn.roomId) {
      const room = getRoom(conn.roomId)
      if (room) {
        if (now - room.roomWindowStart >= RATE_WINDOW_MS) {
          room.roomWindowStart = now
          room.roomMsgCount = 0
        }
        room.roomMsgCount++
        if (room.roomMsgCount > ROOM_RATE_LIMIT) {
          send(ws, 'ERROR', { code: 'ROOM_RATE_LIMITED', message: 'Room message limit exceeded' })
          return
        }
      }
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
      const p = msg.payload as SetNicknamePayload
      const nickname = p.nickname?.trim().replace(/\s+/g, ' ')
      const isMobile = !!p.isMobile
      const streak = Math.max(0, Math.min(999, parseInt(String(p.streak ?? 0), 10) || 0))
      const userId = typeof p.userId === 'string' && p.userId.length <= 64 ? p.userId : undefined
      const avatar = typeof p.avatar === 'string' ? p.avatar : undefined
      const roomId = msg.roomId

      if (!roomId || !nickname) {
        send(ws, 'ERROR', { code: 'MISSING_FIELDS', message: 'roomId and nickname required' })
        return
      }

      const result = joinOrCreateRoom(
        roomId,
        conn.playerId,
        nickname,
        ws,
        isMobile,
        streak,
        userId,
        avatar
      )

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

      const { bestOf, enabledCategories, banCount } = msg.payload as Partial<RoomConfig>
      const validBestOf = [3, 5, 7, 9]
      if (!bestOf || !validBestOf.includes(bestOf)) return
      if (
        !Array.isArray(enabledCategories) ||
        enabledCategories.length === 0 ||
        !enabledCategories.every((c) => (MINIGAME_CATEGORIES as readonly string[]).includes(c))
      )
        return
      const validBanCount = [0, 1, 2, 3]
      const resolvedBanCount = validBanCount.includes(banCount ?? -1)
        ? (banCount as 0 | 1 | 2 | 3)
        : 0

      room.config = { bestOf, enabledCategories, banCount: resolvedBanCount }
      for (const player of room.players) {
        send(player.ws, 'ROOM_CONFIG', { config: room.config })
      }
      break
    }

    case 'SUBMIT_BANS': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      const { bannedGameIds } = msg.payload as { bannedGameIds?: unknown[] }
      const ids = Array.isArray(bannedGameIds)
        ? (bannedGameIds.filter((id) => typeof id === 'string') as string[])
        : []
      handleBanSubmit(room, conn.playerId, ids as import('@shared/types').MinigameId[])
      break
    }

    case 'SET_AVATAR': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      const { avatar } = msg.payload as { avatar: string }
      if (typeof avatar === 'string') setPlayerAvatar(room, conn.playerId, avatar)
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
      const { roomId, nickname } = msg.payload as { roomId: string; nickname?: string }
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
      conn.spectatorNum = result.room.spectators.length // 1-based after push
      const rawNick = nickname?.trim().slice(0, 18) || undefined
      if (rawNick) {
        const isImpostor = result.room.players.some(
          (p) => p.nickname.toLowerCase() === rawNick.toLowerCase()
        )
        conn.spectatorNickname = isImpostor ? `${rawNick} (Impostor)` : rawNick
      }
      break
    }

    case 'EMOTE': {
      if (!conn.roomId) return
      const room = getRoom(conn.roomId)
      if (!room) return
      const { emote } = msg.payload as { emote: string }
      if (!emote || typeof emote !== 'string' || emote.length > 10) return
      // Rate limit: 1 emote per EMOTE_RATE_MS per connection (silently drop excess)
      const emoteNow = Date.now()
      if (emoteNow - conn.lastEmoteAt < EMOTE_RATE_MS) return
      conn.lastEmoteAt = emoteNow
      // For spectators, resolve display name; for players, send playerId for client lookup
      const fromName =
        conn.role === 'spectator'
          ? (conn.spectatorNickname ?? `Spectator ${conn.spectatorNum ?? '?'}`)
          : undefined
      const payload = fromName
        ? { fromPlayerId: '', fromName, emote }
        : { fromPlayerId: conn.playerId, emote }
      for (const player of room.players) {
        send(player.ws, 'EMOTE_RECEIVED', payload)
      }
      for (const spec of room.spectators) {
        send(spec, 'EMOTE_RECEIVED', payload)
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

    case 'PING': {
      if (conn.role === 'spectator' || !conn.roomId) return
      const now = Date.now()
      if (now - conn.lastPingAt < 10_000) return
      conn.lastPingAt = now
      const room = getRoom(conn.roomId)
      if (room) touch(room)
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
