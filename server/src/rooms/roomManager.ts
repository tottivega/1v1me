import { WebSocket } from 'ws'
import type { Room, Player } from '../types'
import { getRoom, setRoom, deleteRoom } from './roomStore'
import { broadcast, send, toPlayerInfos } from '../sync/broadcast'
import { startMatch, forfeitMatch } from '../match/matchController'
import { stopTimer, pauseTimer, resumeTimer } from '../timer/timerController'

const CLEANUP_IDLE_MS = 60_000
const RECONNECT_TIMEOUT = 15_000

function touch(room: Room): void {
  room.lastActivityAt = Date.now()
  scheduleCleanup(room)
}

function scheduleCleanup(room: Room): void {
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => {
    console.log(`[Room] Cleaning up idle room ${room.roomId}`)
    stopTimer(room)
    deleteRoom(room.roomId)
  }, CLEANUP_IDLE_MS)
}

// ── Create / Join ────────────────────────────────────────────────────────────

export function joinOrCreateRoom(
  roomId: string,
  playerId: string,
  nickname: string,
  ws: WebSocket
): { room: Room } | { error: { code: string; message: string } } {
  let room = getRoom(roomId)

  if (!room) {
    // Create new room
    room = {
      roomId,
      players: [],
      spectators: [],
      status: 'lobby',
      match: null,
      lastActivityAt: Date.now(),
      cleanupTimer: null,
      rematchVotes: new Set(),
    }
    setRoom(room)
    scheduleCleanup(room)
    console.log(`[Room] Created room ${roomId}`)
  }

  if (room.players.length >= 2) {
    return { error: { code: 'ROOM_FULL', message: 'Room is full (2 players max)' } }
  }

  // Check for duplicate player
  if (room.players.some((p) => p.id === playerId)) {
    return { error: { code: 'ALREADY_JOINED', message: 'Already in this room' } }
  }

  const player: Player = {
    id: playerId,
    nickname: nickname.trim().slice(0, 18) || 'Player',
    ws,
    ready: false,
    connected: true,
    reconnectTimer: null,
  }

  room.players.push(player)
  touch(room)

  console.log(`[Room] ${nickname} (${playerId}) joined room ${roomId} (${room.players.length}/2)`)
  return { room }
}

// ── Ready ────────────────────────────────────────────────────────────────────

export function setPlayerReady(room: Room, playerId: string): void {
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return

  player.ready = true
  touch(room)

  const bothReady = room.players.length === 2 && room.players.every((p) => p.ready)
  broadcast(room, 'PLAYER_READY', { playerId, bothReady })

  if (bothReady) {
    room.status = 'ready'
    startMatch(room)
  }
}

// ── Disconnect / Reconnect ───────────────────────────────────────────────────

export function handleDisconnect(roomId: string, playerId: string): void {
  const room = getRoom(roomId)
  if (!room) return

  const player = room.players.find((p) => p.id === playerId)
  if (!player) return

  player.connected = false
  console.log(`[Room] ${player.nickname} disconnected from room ${roomId}`)

  if (room.status === 'lobby' || room.status === 'ready') {
    // Just remove the player; no reconnect window needed pre-match
    room.players = room.players.filter((p) => p.id !== playerId)
    broadcast(room, 'PLAYER_DISCONNECTED', { playerId, reconnectWindowMs: 0 })
    return
  }

  // In-match disconnect: pause and start reconnect window
  pauseTimer(room)
  broadcast(room, 'PLAYER_DISCONNECTED', { playerId, reconnectWindowMs: RECONNECT_TIMEOUT })

  player.reconnectTimer = setTimeout(() => {
    console.log(`[Room] Reconnect window expired for ${player.nickname}`)
    forfeitMatch(room, playerId)
    deleteRoom(roomId)
  }, RECONNECT_TIMEOUT)
}

export function handleReconnect(
  roomId: string,
  playerId: string,
  ws: WebSocket
): { room: Room } | { error: { code: string; message: string } } {
  const room = getRoom(roomId)
  if (!room) return { error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } }

  const player = room.players.find((p) => p.id === playerId)
  if (!player) return { error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found in room' } }

  if (player.reconnectTimer) {
    clearTimeout(player.reconnectTimer)
    player.reconnectTimer = null
  }

  player.ws = ws
  player.connected = true
  touch(room)

  resumeTimer(room)
  broadcast(room, 'PLAYER_RECONNECTED', { playerId })

  // Send full current state to the reconnecting player
  send(player.ws, 'ROOM_JOINED', {
    roomId,
    playerId,
    players: toPlayerInfos(room.players),
    spectatorCount: room.spectators.length,
  })

  if (room.match) {
    send(player.ws, 'ROUND_START', {
      round: room.match.currentRound,
      minigameId: room.match.currentMinigame,
      timeoutMs: room.match.timeoutMs,
    })
    send(player.ws, 'TIMER_TICK', { remainingMs: room.match.remainingMs })
    send(player.ws, 'GAME_UPDATE', { state: room.match.minigameState })
  }

  console.log(`[Room] ${player.nickname} reconnected to room ${roomId}`)
  return { room }
}

// ── Spectators ───────────────────────────────────────────────────────────────

export function joinAsSpectator(
  roomId: string,
  ws: WebSocket
): { room: Room } | { error: { code: string; message: string } } {
  const room = getRoom(roomId)
  if (!room) return { error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } }

  room.spectators.push(ws)
  touch(room)

  // Send spectator the current room state so they can pick up mid-match
  send(ws, 'SPECTATE_JOINED', {
    roomId,
    players: toPlayerInfos(room.players),
    status: room.status,
    spectatorCount: room.spectators.length,
    match: room.match
      ? {
          scores: room.match.scores,
          currentRound: room.match.currentRound,
          currentMinigame: room.match.currentMinigame,
          remainingMs: room.match.remainingMs,
          timeoutMs: room.match.timeoutMs,
          minigameState: room.match.minigameState,
        }
      : null,
  })

  // Let players know the spectator count changed
  for (const player of room.players) {
    if (player.connected) send(player.ws, 'SPECTATOR_COUNT', { count: room.spectators.length })
  }

  console.log(`[Room] Spectator joined room ${roomId} (${room.spectators.length} spectating)`)
  return { room }
}

export function removeSpectator(roomId: string, ws: WebSocket): void {
  const room = getRoom(roomId)
  if (!room) return
  room.spectators = room.spectators.filter((s) => s !== ws)
  // Let players know the spectator count changed
  for (const player of room.players) {
    if (player.connected) send(player.ws, 'SPECTATOR_COUNT', { count: room.spectators.length })
  }
  console.log(`[Room] Spectator left room ${roomId} (${room.spectators.length} remaining)`)
}

// ── Rematch ──────────────────────────────────────────────────────────────────

function doRematch(room: Room): void {
  stopTimer(room)
  room.match = null
  room.status = 'lobby'
  room.rematchVotes.clear()
  for (const player of room.players) {
    player.ready = false
  }
  touch(room)
  // Send each player back to the lobby with their own playerId
  for (const player of room.players) {
    if (player.connected) {
      send(player.ws, 'ROOM_JOINED', {
        roomId: room.roomId,
        playerId: player.id,
        players: toPlayerInfos(room.players),
        spectatorCount: room.spectators.length,
      })
    }
  }
  console.log(`[Room] Rematch triggered for room ${room.roomId}`)
}

export function handleRematchVote(room: Room, playerId: string): void {
  room.rematchVotes.add(playerId)
  const allVoted = room.players.every((p) => room.rematchVotes.has(p.id))
  if (allVoted) {
    doRematch(room)
  } else {
    // Tell the voter to wait
    const voter = room.players.find((p) => p.id === playerId)
    if (voter) send(voter.ws, 'REMATCH_VOTE', { waiting: true })
  }
}
