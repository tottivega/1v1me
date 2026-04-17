import { vi } from 'vitest'
import type { WebSocket } from 'ws'
import type { Room } from '../types'
import type { MatchState } from '../types'
import type { MinigameId } from '@shared/types'
import { DEFAULT_ROOM_CONFIG } from '@shared/types'

export function makeWs() {
  return { send: vi.fn(), readyState: 1 } as unknown as WebSocket
}

export function makePlayer(id: string, nickname = 'Player') {
  return {
    id,
    nickname,
    avatar: '🐺',
    ws: makeWs(),
    ready: false,
    connected: true,
    reconnectTimer: null,
    isMobile: false,
    streak: 0,
  }
}

export function makeRoom(roomId = 'test-room'): Room {
  const p1 = makePlayer('p1', 'Alice')
  const p2 = makePlayer('p2', 'Bob')
  return {
    roomId,
    players: [p1, p2],
    spectators: [],
    status: 'lobby',
    match: null,
    config: { ...DEFAULT_ROOM_CONFIG },
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    cleanupTimer: null,
    draftPhaseTimer: null,
    rematchVotes: new Set(),
    draftVotes: {},
    roomMsgCount: 0,
    roomWindowStart: Date.now(),
  }
}

export function makeMatch(
  p1Id: string,
  p2Id: string,
  overrides: Partial<MatchState> = {}
): MatchState {
  return {
    matchId: 'match-1',
    scores: { [p1Id]: 0, [p2Id]: 0 },
    minigameQueue: [
      'clickspeed',
      'coinflip',
      'reactiontest',
      'numberguess',
      'quickmaths',
    ] as MinigameId[],
    currentRound: 1,
    currentMinigame: 'clickspeed',
    minigameState: null,
    roundHistory: [],
    tickInterval: null,
    remainingMs: 5000,
    timeoutMs: 5000,
    paused: false,
    roundResolved: false,
    onRoundDone: null,
    roundReadyVotes: new Set(),
    roundReadyTimer: null,
    getSafeState: null,
    ...overrides,
  }
}
