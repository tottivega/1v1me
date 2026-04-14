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

export const MINIGAME_CATEGORIES = ['reflex', 'math', 'luck', 'strategy', 'skill'] as const
export type MinigameCategory = (typeof MINIGAME_CATEGORIES)[number]
export type MinigamePlatform = 'all' | 'desktop-only' | 'mobile-only'

export const MINIGAME_CONFIGS = {
  clickspeed: {
    label: 'Click Speed',
    emoji: '👆',
    timeoutMs: 10000,
    category: 'skill',
    description: 'Click as many times as you can in 10 seconds.',
    platforms: 'all',
  },
  coinflip: {
    label: 'Coin Flip',
    emoji: '🪙',
    timeoutMs: 0,
    category: 'luck',
    description: '50/50. Pure chaos. No skill required.',
    platforms: 'all',
  },
  reactiontest: {
    label: 'Reaction Test',
    emoji: '⚡',
    timeoutMs: 0,
    category: 'reflex',
    description: 'Wait for green, then click as fast as humanly possible.',
    platforms: 'all',
  },
  quickmaths: {
    label: 'Quick Maths',
    emoji: '🔢',
    timeoutMs: 30000,
    category: 'math',
    description: 'Solve as many equations as you can in 15 seconds.',
    platforms: 'all',
  },
  memorymatch: {
    label: 'Memory Match',
    emoji: '🧠',
    timeoutMs: 0,
    category: 'strategy',
    description: 'Memorise a growing sequence of symbols across up to 10 rounds.',
    platforms: 'all',
  },
  fastesttyper: {
    label: 'Fastest Typer',
    emoji: '⌨️',
    timeoutMs: 60000,
    category: 'skill',
    description: 'Type 10 sentences faster than your opponent.',
    platforms: 'desktop-only',
  },
  rockpaperscissors: {
    label: 'Rock Paper Scissors',
    emoji: '✂️',
    timeoutMs: 0,
    category: 'strategy',
    description: 'Best of 3 throws. Pick simultaneously — may the luckiest hand win.',
    platforms: 'all',
  },
  colorword: {
    label: 'Color Word',
    emoji: '🎨',
    timeoutMs: 30000,
    category: 'reflex',
    description: 'Get as many correct ink color picks as you can in 30 seconds.',
    platforms: 'all',
  },
  kaboom: {
    label: 'Kaboom!',
    emoji: '💣',
    timeoutMs: 0,
    category: 'luck',
    description: 'Take turns cutting wires. Cut the bomb wire and you lose!',
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
    platforms: MinigamePlatform
  }
>

export type MinigameId = keyof typeof MINIGAME_CONFIGS

// ─── Per-game balance constants (shared so client + server stay in sync) ──────
export const CLICKSPEED_CPS_CAP = 20

// ─── Minigame State Types (shared between server and client) ──────────────────
// Every state has a `kind` discriminant injected by the client store when it
// receives GAME_UPDATE. Use it to narrow MinigameState without duck-typing:
//   if (state.kind === 'clickspeed') { /* state is ClickSpeedState */ }

export interface ClickSpeedState {
  kind: 'clickspeed'
  clicks: Record<string, number>
}

export type CoinFlipPhase = 'flipping' | 'result'
export interface CoinFlipState {
  kind: 'coinflip'
  phase: CoinFlipPhase
  winnerId?: string
}

export interface ReactionTestState {
  kind: 'reactiontest'
  phase: 'waiting' | 'ready' | 'result'
  reactions?: Record<string, number>
  penalized?: string[]
  winnerId?: string | null
}

export interface QuickMathsEquation {
  question: string
  answer: number
}
export interface QuickMathsState {
  kind: 'quickmaths'
  equations: Record<string, QuickMathsEquation>
  correct: Record<string, number>
}

export interface MemoryMatchState {
  kind: 'memorymatch'
  roundNum: number
  seqLen: number
  phase: 'memorize' | 'recall'
  sequence: string[]
  submissions: Record<string, string[]>
}

export interface FastestTyperState {
  kind: 'fastesttyper'
  phrases: string[] // 10 sentences, identical for both players
  completed: Record<string, number> // sentences fully completed per player (0-10)
  charProgress: Record<string, number> // chars typed in current sentence per player
  resolved: boolean
  winnerId: string | null
}

export type RPSChoice = 'rock' | 'paper' | 'scissors'
export interface RPSThrowRecord {
  picks: Record<string, RPSChoice>
  winnerId: string | null
}
export interface RockPaperScissorsStatePicking {
  kind: 'rockpaperscissors'
  phase: 'picking'
  throwNum: number
  submitted: string[]
  scores: Record<string, number>
  history: RPSThrowRecord[]
}
export interface RockPaperScissorsStateReveal {
  kind: 'rockpaperscissors'
  phase: 'reveal'
  throwNum: number
  picks: Record<string, RPSChoice>
  throwWinnerId: string | null
  scores: Record<string, number>
  history: RPSThrowRecord[]
}
export type RockPaperScissorsState = RockPaperScissorsStatePicking | RockPaperScissorsStateReveal

export type ColorWordColor = 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple'
export interface ColorWordState {
  kind: 'colorword'
  word: ColorWordColor
  inkColor: ColorWordColor
  scores: Record<string, number>
  puzzleSeq: number
  winnerId?: string
}

export interface KaboomLastPick {
  playerId: string
  wire: number
  isBomb: boolean
}
export interface KaboomState {
  kind: 'kaboom'
  wires: number[] // remaining wire indices not yet cut
  eliminated: number[] // safely cut wire indices
  phase: 'picking' | 'reveal'
  currentPlayerId: string // whose turn it is to pick
  lastPick?: KaboomLastPick // set during reveal phase
  roundNum: number // increments each pick (for animation reset)
  winnerId?: string // set when game resolves
}

/**
 * Maps every MinigameId to its live state type.
 * To add a game: add one entry here — MinigameState is derived automatically.
 * TypeScript will error on `MinigameState` below if a MinigameId has no entry.
 */
export type MinigameStateMap = {
  clickspeed: ClickSpeedState
  coinflip: CoinFlipState
  reactiontest: ReactionTestState
  quickmaths: QuickMathsState
  memorymatch: MemoryMatchState
  fastesttyper: FastestTyperState
  rockpaperscissors: RockPaperScissorsState
  colorword: ColorWordState
  kaboom: KaboomState
}

/**
 * Discriminated union of all minigame states broadcast via GAME_UPDATE.
 * The `kind` field is injected by the client store on receipt — server modules
 * do not need to include it. Narrow with `state.kind === 'clickspeed'` etc.
 *
 * Do not edit this type directly — add entries to MinigameStateMap above.
 */
export type MinigameState = MinigameStateMap[MinigameId]

// ─── Room Config ──────────────────────────────────────────────────────────────

export interface RoomConfig {
  bestOf: 3 | 5 | 7 | 9
  enabledCategories: MinigameCategory[]
  banCount: 0 | 1 | 2 | 3
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  bestOf: 5,
  enabledCategories: ['reflex', 'math', 'luck', 'strategy', 'skill'],
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
  | 'PING'

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
