import { WebSocket } from 'ws'
import type { Room, Player } from '../types'
import { DEFAULT_ROOM_CONFIG, AVATARS } from '@shared/types'

function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]!
}
import { getRoom, setRoom, deleteRoom } from './roomStore'
import { broadcast, send, toPlayerInfos } from '../sync/broadcast'
import { startMatch, forfeitMatch } from '../match/matchController'
import { stopTimer, pauseTimer, resumeTimer } from '../timer/timerController'

const CLEANUP_IDLE_MS = 60_000
const RECONNECT_TIMEOUT = 15_000
const MAX_SPECTATORS = 28

export function touch(room: Room): void {
  room.lastActivityAt = Date.now()
  scheduleCleanup(room)
}

function scheduleCleanup(room: Room): void {
  // Only arm the idle timer in pre-match states.
  // Active match lifecycle is managed by endMatch (POST_MATCH_IDLE_MS).
  // Calling touch() during a match (reconnect, spectator join) must not
  // reset the timer to the short 60s lobby timeout.
  if (room.status !== 'lobby' && room.status !== 'ready') return
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => {
    // Re-check status: the room may have started a match since this was scheduled.
    if (room.status !== 'lobby' && room.status !== 'ready') return
    console.log(`[Room] Cleaning up idle room ${room.roomId}`)
    stopTimer(room)
    // Notify all connected players before the room disappears
    for (const player of room.players) {
      if (player.ws.readyState === WebSocket.OPEN) {
        send(player.ws, 'ERROR', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room closed due to inactivity',
        })
      }
    }
    deleteRoom(room.roomId)
  }, CLEANUP_IDLE_MS)
}

// ── Create / Join ────────────────────────────────────────────────────────────

export function joinOrCreateRoom(
  roomId: string,
  playerId: string,
  nickname: string,
  ws: WebSocket,
  isMobile = false,
  streak = 0,
  userId?: string,
  avatar?: string
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
      config: { ...DEFAULT_ROOM_CONFIG },
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      cleanupTimer: null,
      banPhaseTimer: null,
      rematchVotes: new Set(),
      banVotes: {},
      roomMsgCount: 0,
      roomWindowStart: Date.now(),
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
    avatar: avatar && (AVATARS as readonly string[]).includes(avatar) ? avatar : randomAvatar(),
    ws,
    ready: false,
    connected: true,
    reconnectTimer: null,
    isMobile,
    streak,
    userId,
  }

  room.players.push(player)
  touch(room)

  console.log(`[Room] ${nickname} (${playerId}) joined room ${roomId} (${room.players.length}/2)`)
  return { room }
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function setPlayerAvatar(room: Room, playerId: string, avatar: string): void {
  if (!(AVATARS as readonly string[]).includes(avatar)) return
  if (room.status !== 'lobby') return
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return
  player.avatar = avatar
  // Re-broadcast ROOM_JOINED so both players see the updated avatar
  for (const p of room.players) {
    send(p.ws, 'ROOM_JOINED', {
      roomId: room.roomId,
      playerId: p.id,
      players: toPlayerInfos(room.players),
      spectatorCount: room.spectators.length,
      config: room.config,
    })
  }
}

// ── Ready ────────────────────────────────────────────────────────────────────

export function setPlayerReady(room: Room, playerId: string): void {
  const player = room.players.find((p) => p.id === playerId)
  if (!player) return
  if (player.ready) return // idempotent — ignore duplicate SET_READY

  player.ready = true
  touch(room)

  const bothReady = room.players.length === 2 && room.players.every((p) => p.ready)
  // Broadcast full player state so clients are always authoritative regardless of message order
  broadcast(room, 'PLAYER_READY', { players: toPlayerInfos(room.players), bothReady })

  if (bothReady) {
    room.status = 'ready'
    // Cancel the idle lobby timer — match lifecycle is now managed by the
    // disconnect/forfeit system. A fresh timer is armed when the match ends.
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer)
      room.cleanupTimer = null
    }
    startMatch(room)
  }
}

export function setPlayerUnready(room: Room, playerId: string): void {
  // Only allowed while still in lobby — once both are ready the match is launching
  if (room.status !== 'lobby') return
  const player = room.players.find((p) => p.id === playerId)
  if (!player || !player.ready) return

  player.ready = false
  touch(room)

  broadcast(room, 'PLAYER_READY', { players: toPlayerInfos(room.players), bothReady: false })
}

// ── Disconnect / Reconnect ───────────────────────────────────────────────────

export function handleDisconnect(roomId: string, playerId: string): void {
  const room = getRoom(roomId)
  if (!room) return

  const player = room.players.find((p) => p.id === playerId)
  if (!player) return

  player.connected = false
  console.log(`[Room] ${player.nickname} disconnected from room ${roomId}`)

  if (
    room.status === 'lobby' ||
    room.status === 'ready' ||
    room.status === 'banning' ||
    room.status === 'match_end'
  ) {
    // No reconnect window needed: pre-match or match already over
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
    // endMatch (called by forfeitMatch) arms a POST_MATCH_IDLE_MS cleanup timer,
    // but we're deleting immediately — cancel it to avoid an orphaned 2-min timer.
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer)
      room.cleanupTimer = null
    }
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

  // Only unpause when every player is back — if the other player is still in their
  // reconnect window the clock must not tick against an absent opponent.
  if (room.players.every((p) => p.connected)) {
    resumeTimer(room)
  }
  broadcast(room, 'PLAYER_RECONNECTED', { playerId, status: room.status })

  // Send full current state to the reconnecting player.
  // isReconnect=true tells the client not to reset match state (scores, round, etc.)
  send(player.ws, 'ROOM_JOINED', {
    roomId,
    playerId,
    players: toPlayerInfos(room.players),
    spectatorCount: room.spectators.length,
    config: room.config,
    isReconnect: true,
  })

  if (room.match) {
    // Always send ROUND_START first — establishes currentRound / currentMinigame context.
    send(player.ws, 'ROUND_START', {
      round: room.match.currentRound,
      minigameId: room.match.currentMinigame,
      timeoutMs: room.match.timeoutMs,
      scores: room.match.scores, // restore scoreboard — ROOM_JOINED resets it to {}
    })

    if (room.status === 'round_end') {
      // Between rounds: follow up with ROUND_END so the client shows the result
      // overlay rather than a blank playing state.
      const lastRound = room.match.roundHistory[room.match.roundHistory.length - 1]
      send(player.ws, 'ROUND_END', {
        winnerId: lastRound?.winnerId ?? null,
        scores: room.match.scores,
        reason: 'timeout' as const,
      })
    } else {
      send(player.ws, 'TIMER_TICK', { remainingMs: room.match.remainingMs })
      const safeState = room.match.getSafeState?.(room) ?? room.match.minigameState
      send(player.ws, 'GAME_UPDATE', { state: safeState })
    }
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

  if (room.spectators.length >= MAX_SPECTATORS) {
    return {
      error: {
        code: 'SPECTATOR_LIMIT_REACHED',
        message: `Spectator limit reached (max ${MAX_SPECTATORS})`,
      },
    }
  }

  room.spectators.push(ws)
  touch(room)

  // Send spectator the current room state so they can pick up mid-match
  const spectatorMatchState = room.match
    ? {
        scores: room.match.scores,
        currentRound: room.match.currentRound,
        currentMinigame: room.match.currentMinigame,
        remainingMs: room.match.remainingMs,
        timeoutMs: room.match.timeoutMs,
        minigameState: room.match.getSafeState?.(room) ?? room.match.minigameState,
      }
    : null
  send(ws, 'SPECTATE_JOINED', {
    roomId,
    players: toPlayerInfos(room.players),
    status: room.status,
    spectatorCount: room.spectators.length,
    config: room.config,
    match: spectatorMatchState,
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
  // Cancel the ban-phase safety timer if a rematch is triggered while banning
  if (room.banPhaseTimer) {
    clearTimeout(room.banPhaseTimer)
    room.banPhaseTimer = null
  }
  // Cancel any pending between-round auto-advance timer
  if (room.match?.roundReadyTimer) {
    clearTimeout(room.match.roundReadyTimer)
    room.match.roundReadyTimer = null
  }
  room.match = null
  room.status = 'lobby'
  room.rematchVotes.clear()
  room.banVotes = {}
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
        config: room.config,
      })
    }
  }
  console.log(`[Room] Rematch triggered for room ${room.roomId}`)
}

export function handleRematchVote(room: Room, playerId: string): void {
  // Rematch is only valid once the match is fully over; ignore stray votes from
  // earlier states (e.g. a player spamming REMATCH during round_end).
  if (room.status !== 'match_end') return
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
