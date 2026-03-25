import { create } from 'zustand'
import {
  MINIGAME_CONFIGS,
  DEFAULT_ROOM_CONFIG,
  type MinigameInput,
  type RoomStatus,
  type MinigameId,
  type PlayerInfo,
  type ServerMessage,
  type ClientMessageType,
  type RoomJoinedPayload,
  type PlayerReadyPayload,
  type MatchStartPayload,
  type RoundStartPayload,
  type TimerTickPayload,
  type GameUpdatePayload,
  type RoundEndPayload,
  type MatchEndPayload,
  type PlayerDisconnectedPayload,
  type ForfeitPayload,
  type SpectateJoinedPayload,
  type SpectatorCountPayload,
  type RoundRecord,
  type EmotePayload,
  type RoomConfig,
  type RoomConfigPayload,
  type BanPhaseStartPayload,
  type MinigamePlatform,
} from '@shared/types'

// Returns games that are playable on the current device and within the enabled categories
function buildMockPool(enabledCategories: string[]): MinigameId[] {
  const mobile = window.matchMedia('(pointer: coarse)').matches
  return (Object.keys(MINIGAME_CONFIGS) as MinigameId[]).filter((id) => {
    const cfg = MINIGAME_CONFIGS[id]
    const platforms = cfg.platforms as MinigamePlatform
    if (platforms === 'desktop-only' && mobile) return false
    if (platforms === 'mobile-only' && !mobile) return false
    return enabledCategories.length === 0 || enabledCategories.includes(cfg.category)
  })
}

// Module-level interval handle for the reconnect countdown (not reactive state)
let _reconnectInterval: ReturnType<typeof setInterval> | null = null
function clearReconnectInterval() {
  if (_reconnectInterval) {
    clearInterval(_reconnectInterval)
    _reconnectInterval = null
  }
}

// Module-level interval handle for the mock round timer
let _mockTimerInterval: ReturnType<typeof setInterval> | null = null
function clearMockTimer() {
  if (_mockTimerInterval) {
    clearInterval(_mockTimerInterval)
    _mockTimerInterval = null
  }
}
function startMockTimer(get: () => GameState, set: (s: Partial<GameState>) => void) {
  clearMockTimer()
  _mockTimerInterval = setInterval(() => {
    const { remainingMs, roomStatus } = get()
    if (roomStatus !== 'playing') {
      clearMockTimer()
      return
    }
    const next = remainingMs - 1000
    if (next <= 0) {
      clearMockTimer()
      set({ remainingMs: 0, roomStatus: 'round_end' })
    } else {
      set({ remainingMs: next })
    }
  }, 1000)
}

// ── Anonymous user ID (localStorage) ─────────────────────────────────────────
const USER_ID_KEY = '1v1me_userId'

function getUserId(): string {
  try {
    const existing = localStorage.getItem(USER_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

// ── Avatar (localStorage) ─────────────────────────────────────────────────────
const AVATAR_KEY = '1v1me_avatar'

export function getAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY)
  } catch {
    return null
  }
}

export function saveAvatar(emoji: string): void {
  try {
    localStorage.setItem(AVATAR_KEY, emoji)
  } catch {}
}

// ── Win streak + match history (localStorage) ─────────────────────────────────
const STREAK_KEY = '1v1me_streak'
const HISTORY_KEY = '1v1me_history'
const HISTORY_MAX = 5

export interface MatchHistoryEntry {
  opponentNickname: string
  myScore: number
  oppScore: number
  iWon: boolean
  date: string // ISO string
  topGames?: string[] // top-3 game emojis played this match
}

export function getStreak(): number {
  try {
    return parseInt(localStorage.getItem(STREAK_KEY) ?? '0', 10) || 0
  } catch {
    return 0
  }
}
export function getMatchHistory(): MatchHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}
function recordMatchResult(
  iWon: boolean,
  opponentNickname: string,
  myScore: number,
  oppScore: number,
  roundHistory: RoundRecord[]
) {
  try {
    const streak = iWon ? getStreak() + 1 : 0
    localStorage.setItem(STREAK_KEY, String(streak))
    // Extract top-3 most-played game emojis from round history
    const counts: Record<string, number> = {}
    for (const r of roundHistory) {
      counts[r.minigameId] = (counts[r.minigameId] ?? 0) + 1
    }
    const topGames = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => MINIGAME_CONFIGS[id as MinigameId]?.emoji ?? '🎮')
    const entry: MatchHistoryEntry = {
      opponentNickname,
      myScore,
      oppScore,
      iWon,
      date: new Date().toISOString(),
      topGames,
    }
    const prev = getMatchHistory()
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...prev].slice(0, HISTORY_MAX)))
  } catch {}
}

// ── Mock players (dev / disconnected mode) ────────────────────────────────────
const MOCK_ME: PlayerInfo = {
  id: 'player-1',
  nickname: 'You',
  avatar: '😤',
  ready: false,
  connected: true,
}
const MOCK_OPP: PlayerInfo = {
  id: 'player-2',
  nickname: 'Opponent',
  avatar: '😈',
  ready: false,
  connected: true,
}

// ── Types ─────────────────────────────────────────────────────────────────────
type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface Toast {
  id: string
  message: string
  type: 'error' | 'info' | 'success'
}

interface GameState {
  // Connection
  ws: WebSocket | null
  wsStatus: WsStatus

  // Identity
  myPlayerId: string
  myNickname: string
  roomId: string | null

  // Room
  roomStatus: RoomStatus
  players: PlayerInfo[]

  // Match
  currentRound: number
  scores: Record<string, number>
  currentMinigame: MinigameId | null
  remainingMs: number
  timeoutMs: number

  // Results
  lastRoundWinnerId: string | null
  matchWinnerId: string | null
  roundHistory: RoundRecord[]

  // Opaque minigame state (from GAME_UPDATE)
  minigameState: unknown

  // Reconnect countdown (seconds remaining, null when no one is disconnected)
  reconnectCountdown: number | null

  // Toast notifications queue (max 3 visible, FIFO, each auto-dismisses after 4s)
  toasts: Toast[]
  pushToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void

  // Room not found (server returned ROOM_NOT_FOUND error)
  roomNotFound: boolean

  // Spectator
  isSpectator: boolean
  spectatorCount: number

  // Incoming emote (from opponent), clears after 1.5s
  incomingEmote: { fromPlayerId: string; fromName?: string; emote: string } | null

  // Rematch vote — true while waiting for opponent to also click Rematch
  rematchVoting: boolean

  // Timestamp (Date.now()) when the current match started — used for duration display
  matchStartedAt: number | null

  // Player color assignment — set at MATCH_START based on join order
  myColor: string // 'var(--blue)' or 'var(--orange)'
  oppColor: string // opposite of myColor

  // Room configuration (best-of, enabled categories, ban count)
  roomConfig: RoomConfig

  // Ban phase state
  banPhasePool: MinigameId[] | null
  banPhaseCount: number

  // True when the current match was started via DevPanel mock flow (not a real server match)
  isMockMatch: boolean

  // ── Real actions ─────────────────────────────────────────────────────────
  connect: (roomId: string, nickname: string) => void
  disconnect: () => void
  send: (type: ClientMessageType, payload?: unknown) => void
  handleServerMessage: (msg: ServerMessage) => void
  sendInput: (input: MinigameInput) => void
  setReady: () => void
  setNickname: (nickname: string) => void
  spectate: (roomId: string) => void
  reconnectSaved: (roomId: string, playerId: string) => void
  sendRoomConfig: (config: RoomConfig) => void
  sendSetAvatar: (avatar: string) => void

  // ── Mock actions (DevPanel / dev mode only) ──────────────────────────────
  mockJoinRoom: (roomId: string, nickname: string) => void
  mockSetStatus: (status: RoomStatus) => void
  mockSetMinigame: (id: MinigameId) => void
  mockAddOpponent: () => void
  mockRemoveOpponent: () => void
  mockToggleReady: (playerId: string) => void
  mockSetScore: (playerId: string, score: number) => void
  mockSetRound: (round: number) => void
  mockSetWinner: (playerId: string | null) => void
  mockSetRemainingMs: (ms: number) => void
  mockSubmitBans: (bannedIds: string[]) => void
  mockNextRound: () => void
  mockRematch: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useGameStore = create<GameState>((set, get) => ({
  ws: null,
  wsStatus: 'disconnected',

  myPlayerId: 'player-1',
  myNickname: '',
  roomId: null,
  roomStatus: 'lobby',
  players: [MOCK_ME],

  currentRound: 1,
  scores: { 'player-1': 0, 'player-2': 0 },
  currentMinigame: null,
  remainingMs: 5000,
  timeoutMs: 5000,

  lastRoundWinnerId: null,
  matchWinnerId: null,
  roundHistory: [],
  minigameState: null,
  reconnectCountdown: null,
  toasts: [],
  roomNotFound: false,
  isSpectator: false,
  spectatorCount: 0,
  incomingEmote: null,
  rematchVoting: false,
  matchStartedAt: null,
  myColor: 'var(--blue)',
  oppColor: 'var(--orange)',
  roomConfig: { ...DEFAULT_ROOM_CONFIG },
  banPhasePool: null,
  banPhaseCount: 0,
  isMockMatch: false,

  // ── Real: WebSocket connection ───────────────────────────────────────────

  connect: (roomId, nickname) => {
    // Close any existing connection
    get().ws?.close()

    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
    const ws = new WebSocket(wsUrl)
    set({ ws, wsStatus: 'connecting', myNickname: nickname, roomId, roomNotFound: false })

    ws.onopen = () => {
      set({ wsStatus: 'connected' })
      const isMobile = window.matchMedia('(pointer: coarse)').matches
      ws.send(
        JSON.stringify({
          type: 'SET_NICKNAME',
          roomId,
          playerId: '',
          payload: {
            nickname,
            isMobile,
            streak: getStreak(),
            userId: getUserId(),
            avatar: getAvatar() ?? undefined,
          },
        })
      )
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage
        get().handleServerMessage(msg)
      } catch {
        console.error('[WS] Bad message:', event.data)
      }
    }

    ws.onerror = () => set({ wsStatus: 'error' })

    ws.onclose = () => {
      set({ wsStatus: 'disconnected' })
      console.log('[WS] Connection closed')
    }
  },

  disconnect: () => {
    get().ws?.close()
    clearMockTimer()
    try {
      localStorage.removeItem('1v1me_session')
    } catch {}
    set({ ws: null, wsStatus: 'disconnected', isMockMatch: false })
  },

  send: (type, payload = {}) => {
    const { ws, roomId, myPlayerId } = get()
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type, roomId: roomId ?? '', playerId: myPlayerId, payload }))
  },

  sendInput: (input) => {
    get().send('GAME_INPUT', input)
  },

  setReady: () => {
    const { wsStatus } = get()
    if (wsStatus === 'connected') {
      get().send('SET_READY')
    } else {
      // Mock fallback for DevPanel
      get().mockToggleReady(get().myPlayerId)
    }
  },

  setNickname: (nickname) => set({ myNickname: nickname }),

  spectate: (roomId) => {
    get().ws?.close()
    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
    const ws = new WebSocket(wsUrl)
    set({ ws, wsStatus: 'connecting', roomId, isSpectator: true })

    ws.onopen = () => {
      set({ wsStatus: 'connected' })
      const spectatorNickname = (() => {
        try {
          return localStorage.getItem('nickname') ?? ''
        } catch {
          return ''
        }
      })()
      ws.send(
        JSON.stringify({
          type: 'SPECTATE',
          roomId,
          playerId: '',
          payload: { roomId, nickname: spectatorNickname },
        })
      )
    }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage
        get().handleServerMessage(msg)
      } catch {
        console.error('[WS] Bad message:', event.data)
      }
    }
    ws.onerror = () => set({ wsStatus: 'error' })
    ws.onclose = () => set({ wsStatus: 'disconnected' })
  },

  reconnectSaved: (roomId, playerId) => {
    get().ws?.close()
    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
    const ws = new WebSocket(wsUrl)
    set({ ws, wsStatus: 'connecting', roomId, isSpectator: false })
    ws.onopen = () => {
      set({ wsStatus: 'connected' })
      ws.send(
        JSON.stringify({ type: 'RECONNECT', roomId, playerId: '', payload: { playerId, roomId } })
      )
    }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage
        get().handleServerMessage(msg)
      } catch {
        console.error('[WS] Bad message:', event.data)
      }
    }
    ws.onerror = () => set({ wsStatus: 'error' })
    ws.onclose = () => {
      set({ wsStatus: 'disconnected' })
      console.log('[WS] Connection closed')
    }
  },

  // ── Real: Server message dispatcher ─────────────────────────────────────

  handleServerMessage: (msg) => {
    switch (msg.type) {
      case 'ROOM_JOINED': {
        const p = msg.payload as RoomJoinedPayload
        set({
          myPlayerId: p.playerId,
          roomId: p.roomId,
          players: p.players,
          roomStatus: 'lobby',
          scores: {},
          currentRound: 1,
          currentMinigame: null,
          matchWinnerId: null,
          lastRoundWinnerId: null,
          roundHistory: [],
          minigameState: null,
          spectatorCount: p.spectatorCount ?? 0,
          rematchVoting: false,
          matchStartedAt: null,
          roomConfig: p.config ?? { ...DEFAULT_ROOM_CONFIG },
        })
        // Persist session for auto-reconnect
        try {
          localStorage.setItem(
            '1v1me_session',
            JSON.stringify({ roomId: p.roomId, playerId: p.playerId })
          )
        } catch {}
        break
      }

      case 'PLAYER_READY': {
        const p = msg.payload as PlayerReadyPayload
        set((s) => ({
          players: s.players.map((pl) => (pl.id === p.playerId ? { ...pl, ready: true } : pl)),
          roomStatus: p.bothReady ? 'ready' : s.roomStatus,
        }))
        break
      }

      case 'BAN_PHASE_START': {
        const p = msg.payload as BanPhaseStartPayload
        set({ roomStatus: 'banning', banPhasePool: p.pool, banPhaseCount: p.banCount })
        break
      }

      case 'MATCH_START': {
        const p = msg.payload as MatchStartPayload
        const scores: Record<string, number> = {}
        for (const pl of p.players) scores[pl.id] = 0
        // First player to join (index 0) gets blue; second gets orange
        const myColor = p.players[0]?.id === get().myPlayerId ? 'var(--blue)' : 'var(--orange)'
        const oppColor = myColor === 'var(--blue)' ? 'var(--orange)' : 'var(--blue)'
        set({
          scores,
          roomStatus: 'round_start',
          players: p.players,
          myColor,
          oppColor,
          matchStartedAt: Date.now(),
          banPhasePool: null,
          banPhaseCount: 0,
          isMockMatch: false,
        })
        break
      }

      case 'ROUND_START': {
        const p = msg.payload as RoundStartPayload
        set({
          currentRound: p.round,
          currentMinigame: p.minigameId,
          timeoutMs: p.timeoutMs,
          remainingMs: p.timeoutMs,
          roomStatus: 'playing',
          minigameState: null,
          lastRoundWinnerId: null,
        })
        break
      }

      case 'TIMER_TICK': {
        const p = msg.payload as TimerTickPayload
        set({ remainingMs: p.remainingMs })
        break
      }

      case 'GAME_UPDATE': {
        const p = msg.payload as GameUpdatePayload
        set({ minigameState: p.state })
        break
      }

      case 'ROUND_END': {
        const p = msg.payload as RoundEndPayload
        set({
          scores: p.scores,
          lastRoundWinnerId: p.winnerId,
          roomStatus: 'round_end',
        })
        break
      }

      case 'MATCH_END': {
        const p = msg.payload as MatchEndPayload
        const s = get()
        const opponent = s.players.find((pl) => pl.id !== s.myPlayerId)
        const iWon = p.winnerId === s.myPlayerId
        recordMatchResult(
          iWon,
          opponent?.nickname ?? '???',
          p.scores[s.myPlayerId] ?? 0,
          opponent ? (p.scores[opponent.id] ?? 0) : 0,
          p.roundHistory ?? []
        )
        set({
          matchWinnerId: p.winnerId,
          scores: p.scores,
          roundHistory: p.roundHistory ?? [],
          roomStatus: 'match_end',
        })
        break
      }

      case 'PLAYER_DISCONNECTED': {
        const p = msg.payload as PlayerDisconnectedPayload
        set((s) => ({
          players: s.players.map((pl) => (pl.id === p.playerId ? { ...pl, connected: false } : pl)),
          roomStatus: 'reconnecting',
          reconnectCountdown:
            p.reconnectWindowMs > 0 ? Math.ceil(p.reconnectWindowMs / 1000) : null,
        }))
        if (p.reconnectWindowMs > 0) {
          clearReconnectInterval()
          _reconnectInterval = setInterval(() => {
            const curr = get().reconnectCountdown
            if (curr === null || curr <= 1) {
              clearReconnectInterval()
              set({ reconnectCountdown: null })
            } else {
              set({ reconnectCountdown: curr - 1 })
            }
          }, 1000)
        }
        break
      }

      case 'PLAYER_RECONNECTED': {
        const { playerId } = msg.payload as { playerId: string }
        clearReconnectInterval()
        set((s) => ({
          players: s.players.map((pl) => (pl.id === playerId ? { ...pl, connected: true } : pl)),
          roomStatus: 'playing',
          reconnectCountdown: null,
        }))
        break
      }

      case 'FORFEIT': {
        const p = msg.payload as ForfeitPayload
        set({ matchWinnerId: p.winnerId, roomStatus: 'match_end' })
        break
      }

      case 'SPECTATOR_COUNT': {
        const p = msg.payload as SpectatorCountPayload
        set({ spectatorCount: p.count })
        break
      }

      case 'REMATCH_VOTE': {
        set({ rematchVoting: true })
        break
      }

      case 'SPECTATE_JOINED': {
        const p = msg.payload as SpectateJoinedPayload
        const updates: Partial<GameState> = {
          roomId: p.roomId,
          players: p.players,
          roomStatus: p.status,
          spectatorCount: p.spectatorCount ?? 0,
        }
        if (p.match) {
          updates.scores = p.match.scores
          updates.currentRound = p.match.currentRound
          updates.currentMinigame = p.match.currentMinigame as MinigameId | null
          updates.remainingMs = p.match.remainingMs
          updates.timeoutMs = p.match.timeoutMs
          updates.minigameState = p.match.minigameState
        }
        set(updates)
        break
      }

      case 'ROOM_CONFIG': {
        const p = msg.payload as RoomConfigPayload
        set({ roomConfig: p.config })
        break
      }

      case 'EMOTE_RECEIVED': {
        const p = msg.payload as EmotePayload
        set({
          incomingEmote: { fromPlayerId: p.fromPlayerId, fromName: p.fromName, emote: p.emote },
        })
        setTimeout(() => set({ incomingEmote: null }), 1500)
        break
      }

      case 'SERVER_RESTARTING': {
        get().pushToast('Server is restarting — please refresh in a moment', 'info')
        break
      }

      case 'ERROR': {
        const { code, message } = msg.payload as { code: string; message: string }
        console.error(`[Server error] ${code}: ${message}`)
        if (code === 'ROOM_NOT_FOUND') {
          set({ roomNotFound: true })
        } else {
          get().pushToast(message, 'error')
        }
        break
      }
    }
  },

  sendRoomConfig: (config) => {
    set({ roomConfig: config })
    get().send('SET_ROOM_CONFIG', config)
  },

  sendSetAvatar: (avatar) => {
    saveAvatar(avatar)
    get().send('SET_AVATAR', { avatar })
  },

  pushToast: (message, type = 'error') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }].slice(-3) }))
    setTimeout(() => get().dismissToast(id), 4000)
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  // ── Mock actions ─────────────────────────────────────────────────────────

  mockJoinRoom: (roomId, nickname) => {
    const me: PlayerInfo = { ...MOCK_ME, nickname }
    set({
      roomId,
      myNickname: nickname,
      myPlayerId: 'player-1',
      roomStatus: 'lobby',
      players: [me],
      scores: { 'player-1': 0, 'player-2': 0 },
      currentRound: 1,
      currentMinigame: null,
      matchWinnerId: null,
      lastRoundWinnerId: null,
    })
  },

  mockSetStatus: (status) => {
    const updates: Partial<GameState> = { roomStatus: status }
    if (status === 'playing' && get().currentMinigame === null) {
      updates.currentMinigame = 'clickspeed'
    }
    if (status === 'match_end') updates.matchWinnerId = 'player-1'
    if (['round_start', 'playing', 'round_end', 'match_end', 'banning'].includes(status)) {
      if (get().players.length < 2) updates.players = [get().players[0]!, MOCK_OPP]
    }
    if (status === 'banning') {
      const { roomConfig } = get()
      updates.isMockMatch = true
      updates.banPhasePool = buildMockPool(roomConfig.enabledCategories)
      updates.banPhaseCount = roomConfig.banCount > 0 ? roomConfig.banCount : 1
    }
    set(updates)
  },

  mockSetMinigame: (id) => {
    const { timeoutMs } = MINIGAME_CONFIGS[id]
    set({
      currentMinigame: id,
      timeoutMs,
      remainingMs: timeoutMs,
      roomStatus: 'playing',
      minigameState: null,
      isMockMatch: true,
    })
    if (timeoutMs > 0) startMockTimer(get, set)
    else clearMockTimer()
  },

  mockAddOpponent: () => {
    if (!get().players.find((p) => p.id === 'player-2'))
      set({ players: [...get().players, MOCK_OPP] })
  },

  mockRemoveOpponent: () => set({ players: get().players.filter((p) => p.id !== 'player-2') }),

  mockToggleReady: (playerId) => {
    const newPlayers = get().players.map((p) => (p.id === playerId ? { ...p, ready: !p.ready } : p))
    set({ players: newPlayers })
    if (newPlayers.length === 2 && newPlayers.every((p) => p.ready)) {
      set({ roomStatus: 'ready', isMockMatch: true })
      setTimeout(() => {
        const { roomConfig } = get()
        if (roomConfig.banCount > 0) {
          set({
            roomStatus: 'banning',
            banPhasePool: buildMockPool(roomConfig.enabledCategories),
            banPhaseCount: roomConfig.banCount,
          })
        } else {
          const ids = Object.keys(MINIGAME_CONFIGS) as MinigameId[]
          const id = ids[Math.floor(Math.random() * ids.length)]!
          get().mockSetMinigame(id)
        }
      }, 1500)
    }
  },

  mockSubmitBans: (bannedIds) => {
    const pool = get().banPhasePool ?? (Object.keys(MINIGAME_CONFIGS) as MinigameId[])
    const remaining = pool.filter((id) => !bannedIds.includes(id)) as MinigameId[]
    const eligible =
      remaining.length > 0 ? remaining : (Object.keys(MINIGAME_CONFIGS) as MinigameId[])
    const id = eligible[Math.floor(Math.random() * eligible.length)]!
    get().mockSetMinigame(id)
  },

  mockSetScore: (playerId, score) => set({ scores: { ...get().scores, [playerId]: score } }),
  mockSetRound: (round) => set({ currentRound: round }),
  mockSetWinner: (playerId) => set({ matchWinnerId: playerId, roomStatus: 'match_end' }),
  mockSetRemainingMs: (ms) => set({ remainingMs: ms }),

  mockNextRound: () => {
    const { players, myPlayerId, scores, currentRound, roomConfig, currentMinigame, roundHistory } =
      get()
    const opponent = players.find((p) => p.id !== myPlayerId)
    // Randomly assign round winner and update scores
    const winnerId = Math.random() < 0.5 ? myPlayerId : (opponent?.id ?? myPlayerId)
    const newScores = { ...scores, [winnerId]: (scores[winnerId] ?? 0) + 1 }
    const newHistory: RoundRecord[] = [
      ...roundHistory,
      { round: currentRound, minigameId: currentMinigame ?? 'clickspeed', winnerId },
    ]
    const winsNeeded = Math.ceil(roomConfig.bestOf / 2)
    if (Object.values(newScores).some((s) => s >= winsNeeded)) {
      set({
        scores: newScores,
        lastRoundWinnerId: winnerId,
        matchWinnerId: winnerId,
        roomStatus: 'match_end',
        roundHistory: newHistory,
      })
      return
    }
    const nextRound = currentRound + 1
    set({
      scores: newScores,
      lastRoundWinnerId: winnerId,
      currentRound: nextRound,
      roundHistory: newHistory,
    })
    const ids = Object.keys(MINIGAME_CONFIGS) as MinigameId[]
    get().mockSetMinigame(ids[Math.floor(Math.random() * ids.length)]!)
  },

  mockRematch: () => {
    clearMockTimer()
    const { players } = get()
    set({
      roomStatus: 'lobby',
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      currentRound: 1,
      currentMinigame: null,
      matchWinnerId: null,
      lastRoundWinnerId: null,
      roundHistory: [],
      minigameState: null,
      banPhasePool: null,
      banPhaseCount: 0,
      players: players.map((p) => ({ ...p, ready: false })),
    })
  },
}))
