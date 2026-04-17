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
  /** Anonymous persistent user ID from client localStorage. May be undefined for old clients. */
  userId?: string
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
  /** Returns a sanitized copy of the current minigame state safe for spectators/reconnecting
   *  players. Set by matchController when a round starts; null when no secrets to hide. */
  getSafeState: ((room: Room) => unknown) | null
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
  /** Safety timer for draft phase (ban or pick) — cancelled when all votes arrive or room resets. */
  draftPhaseTimer: ReturnType<typeof setTimeout> | null
  rematchVotes: Set<string>
  draftVotes: Record<string, MinigameId[]> // playerId → selected game ids (ban or pick phase)
  // Per-room rate limit (120 msg/s across all players)
  roomMsgCount: number
  roomWindowStart: number
}

export interface MinigameModule {
  id: MinigameId
  start(room: Room): void
  handleInput(room: Room, playerId: string, input: MinigameInput): void
  getResult(room: Room): MinigameResult
  /** Called when the round ends for any reason (win, timeout, forfeit).
   *  Use to cancel any module-level timers keyed on roomId. */
  cleanup?(room: Room): void
  /** Returns a sanitized copy of the minigame state safe to send to clients
   *  (spectators, reconnecting players). Implement when the internal state
   *  contains secrets (e.g. Kaboom's bombWire, Memory Match sequence during recall).
   *  Falls back to minigameState as-is when not implemented. */
  getSafeState?(room: Room): unknown
}
