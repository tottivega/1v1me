import type { WebSocket } from 'ws'
import type {
  RoomStatus,
  MinigameId,
  MinigameInput,
  MinigameResult,
  RoundRecord,
  RoomConfig,
} from '@shared/types'

export interface Player {
  id: string
  nickname: string
  avatar: string
  ws: WebSocket
  ready: boolean
  connected: boolean
  reconnectTimer: ReturnType<typeof setTimeout> | null
  isMobile: boolean
  streak: number
}

export interface MatchState {
  matchId: string
  scores: Record<string, number>
  minigameQueue: MinigameId[]
  currentRound: number
  currentMinigame: MinigameId | null
  minigameState: unknown
  roundHistory: RoundRecord[]
  // Timer
  tickInterval: ReturnType<typeof setInterval> | null
  remainingMs: number
  timeoutMs: number
  paused: boolean
  // Round lifecycle
  roundResolved: boolean
  onRoundDone: ((result: MinigameResult) => void) | null
  roundReadyVotes: Set<string>
  roundReadyTimer: ReturnType<typeof setTimeout> | null
}

export interface Room {
  roomId: string
  players: Player[]
  spectators: WebSocket[]
  status: RoomStatus
  match: MatchState | null
  config: RoomConfig
  createdAt: number
  lastActivityAt: number
  cleanupTimer: ReturnType<typeof setTimeout> | null
  rematchVotes: Set<string>
}

export interface MinigameModule {
  id: MinigameId
  start(room: Room): void
  handleInput(room: Room, playerId: string, input: MinigameInput): void
  getResult(room: Room): MinigameResult
}
