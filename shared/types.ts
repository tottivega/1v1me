// ─── Room & Player ───────────────────────────────────────────────────────────

export type RoomStatus =
  | 'lobby'
  | 'ready'
  | 'banning'
  | 'round_start'
  | 'playing'
  | 'round_end'
  | 'match_end'
  | 'reconnecting'

// ─── Minigame Registry ───────────────────────────────────────────────────────
// Single source of truth. Add/remove a game here and TypeScript enforces the
// rest: server modules, client components, DevPanel, store, matchController.
//
// Fields:
//   label       — display name
//   emoji       — one emoji shown in banners, DevPanel, gallery
//   timeoutMs   — 0 = self-resolving (module calls onRoundDone itself)
//   category    — used for queue balancing and DevPanel filtering
//   description — one-liner shown in game gallery and tooltips
//   difficulty  — 1 easy / 2 medium / 3 hard (relative to each other)

export type MinigameCategory = 'reflex' | 'math' | 'luck' | 'strategy' | 'trivia'
export type MinigamePlatform = 'all' | 'desktop-only' | 'mobile-only'

export const MINIGAME_CONFIGS = {
  clickspeed: {
    label: 'Click Speed',
    emoji: '👆',
    timeoutMs: 5000,
    category: 'reflex',
    description: 'Click as many times as you can in 5 seconds.',
    difficulty: 1,
    platforms: 'all',
  },
  coinflip: {
    label: 'Coin Flip',
    emoji: '🪙',
    timeoutMs: 0,
    category: 'luck',
    description: '50/50. Pure chaos. No skill required.',
    difficulty: 1,
    platforms: 'all',
  },
  reactiontest: {
    label: 'Reaction Test',
    emoji: '⚡',
    timeoutMs: 0,
    category: 'reflex',
    description: 'Wait for green, then click as fast as humanly possible.',
    difficulty: 2,
    platforms: 'all',
  },
  numberguess: {
    label: 'Number Guess',
    emoji: '🎯',
    timeoutMs: 20000,
    category: 'luck',
    description: 'Guess a number 1–100. Closest to the secret wins.',
    difficulty: 1,
    platforms: 'all',
  },
  quickmaths: {
    label: 'Quick Maths',
    emoji: '🔢',
    timeoutMs: 15000,
    category: 'math',
    description: 'Solve as many equations as you can in 15 seconds.',
    difficulty: 2,
    platforms: 'all',
  },
  memorymatch: {
    label: 'Memory Match',
    emoji: '🧠',
    timeoutMs: 25000,
    category: 'strategy',
    description: 'Memorise a sequence of symbols, then reproduce it perfectly.',
    difficulty: 2,
    platforms: 'all',
  },
  fastesttyper: {
    label: 'Fastest Typer',
    emoji: '⌨️',
    timeoutMs: 30000,
    category: 'reflex',
    description: 'Type the phrase faster than your opponent.',
    difficulty: 2,
    platforms: 'desktop-only',
  },
  rockpaperscissors: {
    label: 'Rock Paper Scissors',
    emoji: '✂️',
    timeoutMs: 0,
    category: 'luck',
    description: 'Best of 3 throws. Pick simultaneously — may the luckiest hand win.',
    difficulty: 1,
    platforms: 'all',
  },
  wordscramble: {
    label: 'Word Scramble',
    emoji: '🔤',
    timeoutMs: 25000,
    category: 'trivia',
    description: 'Unscramble the letters and type the word before your opponent does.',
    difficulty: 2,
    platforms: 'all',
  },
  colorword: {
    label: 'Color Word',
    emoji: '🎨',
    timeoutMs: 10000,
    category: 'reflex',
    description: 'Ignore the text — click the button matching the INK color of the word.',
    difficulty: 2,
    platforms: 'all',
  },
  higherorlower: {
    label: 'Higher or Lower',
    emoji: '📊',
    timeoutMs: 10000,
    category: 'luck',
    description: 'A secret number is near the clue. Is it Higher or Lower?',
    difficulty: 1,
    platforms: 'all',
  },
} as const satisfies Record<
  string,
  {
    label: string
    emoji: string
    timeoutMs: number
    category: MinigameCategory
    description: string
    difficulty: 1 | 2 | 3
    platforms: MinigamePlatform
  }
>

export type MinigameId = keyof typeof MINIGAME_CONFIGS

// ─── Room Config ──────────────────────────────────────────────────────────────

export interface RoomConfig {
  bestOf: 3 | 5 | 7 | 9
  enabledCategories: MinigameCategory[]
  banCount: 0 | 1 | 2 | 3
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  bestOf: 5,
  enabledCategories: ['reflex', 'math', 'luck', 'strategy', 'trivia'],
  banCount: 0,
}

export interface PlayerInfo {
  id: string
  nickname: string
  avatar: string
  ready: boolean
  connected: boolean
  streak?: number
}

// ─── Client Message Payloads ──────────────────────────────────────────────────

export interface SetNicknamePayload {
  nickname: string
  isMobile?: boolean
  streak?: number
  /** Anonymous persistent user ID from localStorage ('1v1me_userId'). Optional — omitted by old clients. */
  userId?: string
  /** Preferred avatar emoji from localStorage ('1v1me_avatar'). Server validates against AVATARS list. */
  avatar?: string
}

export const AVATARS = [
  '🐺',
  '🦊',
  '🐻',
  '🐯',
  '🦁',
  '🐸',
  '🐨',
  '🦝',
  '🦄',
  '🐙',
  '🦖',
  '🐝',
] as const

// ─── WebSocket Messages ───────────────────────────────────────────────────────

// Server → Client
export type ServerMessageType =
  | 'ROOM_JOINED'
  | 'PLAYER_READY'
  | 'BAN_PHASE_START'
  | 'MATCH_START'
  | 'ROUND_START'
  | 'TIMER_TICK'
  | 'GAME_UPDATE'
  | 'ROUND_END'
  | 'MATCH_END'
  | 'PLAYER_DISCONNECTED'
  | 'PLAYER_RECONNECTED'
  | 'FORFEIT'
  | 'SPECTATE_JOINED'
  | 'SPECTATOR_COUNT'
  | 'EMOTE_RECEIVED'
  | 'REMATCH_VOTE'
  | 'ROOM_CONFIG'
  | 'SERVER_RESTARTING'
  | 'ERROR'

// Client → Server
export type ClientMessageType =
  | 'SET_NICKNAME'
  | 'SET_AVATAR'
  | 'SET_READY'
  | 'SET_ROOM_CONFIG'
  | 'SUBMIT_BANS'
  | 'GAME_INPUT'
  | 'RECONNECT'
  | 'REMATCH'
  | 'ROUND_READY'
  | 'SPECTATE'
  | 'EMOTE'

export interface ServerMessage {
  type: ServerMessageType
  payload: unknown
}

export interface ClientMessage {
  type: ClientMessageType
  roomId: string
  playerId: string
  payload: unknown
}

// ─── Server Message Payloads ──────────────────────────────────────────────────

export interface RoomJoinedPayload {
  roomId: string
  playerId: string
  players: PlayerInfo[]
  spectatorCount: number
  config: RoomConfig
}

export interface RoomConfigPayload {
  config: RoomConfig
}

export interface PlayerReadyPayload {
  playerId: string
  bothReady: boolean
}

export interface BanPhaseStartPayload {
  pool: MinigameId[]
  banCount: number
}

export interface MatchStartPayload {
  matchId: string
  players: PlayerInfo[]
}

export interface RoundStartPayload {
  round: number
  minigameId: MinigameId
  timeoutMs: number
}

export interface TimerTickPayload {
  remainingMs: number
}

export interface GameUpdatePayload {
  state: unknown
}

export interface RoundEndPayload {
  winnerId: string | null
  scores: Record<string, number>
  reason: 'completed' | 'timeout' | 'forfeit'
}

export interface RoundRecord {
  round: number
  minigameId: MinigameId
  winnerId: string | null
}

export interface MatchEndPayload {
  winnerId: string
  scores: Record<string, number>
  roundHistory: RoundRecord[]
}

export interface PlayerDisconnectedPayload {
  playerId: string
  reconnectWindowMs: number
}

export interface ForfeitPayload {
  forfeitedPlayerId: string
  winnerId: string
}

export interface SpectateJoinedPayload {
  roomId: string
  players: PlayerInfo[]
  status: RoomStatus
  spectatorCount: number
  match: {
    scores: Record<string, number>
    currentRound: number
    currentMinigame: string | null
    remainingMs: number
    timeoutMs: number
    minigameState: unknown
  } | null
}

export interface SpectatorCountPayload {
  count: number
}

export interface RematchVotePayload {
  waiting: boolean
}

export interface EmotePayload {
  fromPlayerId: string
  fromName?: string // set for spectator emotes instead of looking up by playerId
  emote: string
}

export interface ErrorPayload {
  code: string
  message: string
}

// ─── Minigame Result ─────────────────────────────────────────────────────────

export interface MinigameResult {
  winnerId: string | null
  reason: 'completed' | 'timeout' | 'forfeit'
}

// ─── Minigame Input ───────────────────────────────────────────────────────────
// Open interface: each game defines its own payload shape in its own module.
// The `type` string routes to the correct minigame handler; extra properties
// are unknown at this layer and validated inside each handler.
// Adding a new game does NOT require touching this file.

export interface MinigameInput {
  type: string
  [key: string]: unknown
}
