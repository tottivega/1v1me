// ─── Room & Player ───────────────────────────────────────────────────────────

export type RoomStatus =
  | 'lobby'
  | 'ready'
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

export const MINIGAME_CONFIGS = {
  clickspeed: {
    label: 'Click Speed',
    emoji: '👆',
    timeoutMs: 5000,
    category: 'reflex',
    description: 'Click as many times as you can in 5 seconds.',
    difficulty: 1,
  },
  coinflip: {
    label: 'Coin Flip',
    emoji: '🪙',
    timeoutMs: 0,
    category: 'luck',
    description: '50/50. Pure chaos. No skill required.',
    difficulty: 1,
  },
  reactiontest: {
    label: 'Reaction Test',
    emoji: '⚡',
    timeoutMs: 0,
    category: 'reflex',
    description: 'Wait for green, then click as fast as humanly possible.',
    difficulty: 2,
  },
  numberguess: {
    label: 'Number Guess',
    emoji: '🎯',
    timeoutMs: 20000,
    category: 'luck',
    description: 'Guess a number 1–100. Closest to the secret wins.',
    difficulty: 1,
  },
  quickmaths: {
    label: 'Quick Maths',
    emoji: '🔢',
    timeoutMs: 15000,
    category: 'math',
    description: 'Solve as many equations as you can in 15 seconds.',
    difficulty: 2,
  },
  memorymatch: {
    label: 'Memory Match',
    emoji: '🧠',
    timeoutMs: 25000,
    category: 'strategy',
    description: 'Memorise a sequence of symbols, then reproduce it perfectly.',
    difficulty: 2,
  },
  fastesttyper: {
    label: 'Fastest Typer',
    emoji: '⌨️',
    timeoutMs: 30000,
    category: 'reflex',
    description: 'Type the phrase faster than your opponent.',
    difficulty: 2,
  },
  rockpaperscissors: {
    label: 'Rock Paper Scissors',
    emoji: '✂️',
    timeoutMs: 0,
    category: 'luck',
    description: 'Best of 3 throws. Pick simultaneously — may the luckiest hand win.',
    difficulty: 1,
  },
  wordscramble: {
    label: 'Word Scramble',
    emoji: '🔤',
    timeoutMs: 25000,
    category: 'trivia',
    description: 'Unscramble the letters and type the word before your opponent does.',
    difficulty: 2,
  },
  colorword: {
    label: 'Color Word',
    emoji: '🎨',
    timeoutMs: 10000,
    category: 'reflex',
    description: 'Ignore the text — click the button matching the INK color of the word.',
    difficulty: 2,
  },
  higherorlower: {
    label: 'Higher or Lower',
    emoji: '📊',
    timeoutMs: 10000,
    category: 'luck',
    description: 'A secret number is near the clue. Is it Higher or Lower?',
    difficulty: 1,
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
  }
>

export type MinigameId = keyof typeof MINIGAME_CONFIGS

// ─── Room Config ──────────────────────────────────────────────────────────────

export interface RoomConfig {
  bestOf: 3 | 5 | 7 | 9
  enabledCategories: MinigameCategory[]
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  bestOf: 5,
  enabledCategories: ['reflex', 'math', 'luck', 'strategy', 'trivia'],
}

export interface PlayerInfo {
  id: string
  nickname: string
  ready: boolean
  connected: boolean
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────

// Server → Client
export type ServerMessageType =
  | 'ROOM_JOINED'
  | 'PLAYER_READY'
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
  | 'ERROR'

// Client → Server
export type ClientMessageType =
  | 'SET_NICKNAME'
  | 'SET_READY'
  | 'SET_ROOM_CONFIG'
  | 'GAME_INPUT'
  | 'RECONNECT'
  | 'REMATCH'
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
