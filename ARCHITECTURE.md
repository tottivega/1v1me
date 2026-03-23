# ARCHITECTURE.md — 1v1 ME (MVP)

> This document is the authoritative technical reference for Claude Code when building the 1v1 ME platform. Follow it strictly. When in doubt, prefer server authority, simplicity, and explicit state transitions over clever shortcuts.

---

## 1. Project Overview

**1v1 ME** is a browser-based multiplayer minigame platform where two players settle disputes by competing in a Best-of-5 series of randomly selected minigames. No login required. Invite-link-based rooms. Server-authoritative results.

---

## 2. Goals & Constraints

| Property | Value |
|---|---|
| Players per match | 2 |
| Rounds per match | Best of 5 (first to 3 wins) |
| Minigame selection | Random, no repeats within a match |
| Auth | None — nickname picked on join |
| Target platform | Desktop + mobile (600px breakpoint) |
| Backend authority | Server decides all outcomes |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Bun runtime |
| Realtime | WebSocket (`ws` library) |
| Database | Supabase (Postgres) |
| Frontend hosting | Vercel |
| Backend hosting | Fly.io |
| DB hosting | Supabase cloud |

---

## 4. Repository Structure

```
1v1-me/
├── client/                  # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Route-level pages (Lobby, Match, Result)
│   │   ├── minigames/       # One folder per minigame (client-side rendering)
│   │   ├── hooks/           # useWebSocket, useGameState, etc.
│   │   ├── store/           # Global client state (e.g. Zustand or Context)
│   │   └── types/           # Shared TypeScript interfaces (mirror server types)
│   └── vite.config.ts
│
├── server/                  # Node.js + Bun backend
│   ├── src/
│   │   ├── rooms/           # Room creation, join, cleanup logic
│   │   ├── match/           # Match controller, round flow, score tracking
│   │   ├── minigames/       # One module per minigame (server-side logic)
│   │   ├── timer/           # Server timer, broadcast ticks
│   │   ├── sync/            # WebSocket message router, input validation
│   │   └── db/              # Supabase client, result persistence
│   └── index.ts
│
├── shared/                  # Types and constants shared between client and server
│   └── types.ts
│
└── ARCHITECTURE.md
```

---

## 5. Core Systems

### 5.1 Room System

- A player visits the app and enters a nickname, then creates a room.
- The server generates a short unique `roomId` (e.g. `abc123`).
- The creator shares the URL: `https://1v1.me/room/abc123`.
- The second player opens the link, enters a nickname, and joins.
- Rooms support exactly **2 players**. A third connection attempt must be rejected.
- Each player has a `ready` boolean. The match starts only when both are `true`.
- **Room cleanup:** Any room with no WebSocket activity for **60 seconds** is destroyed and its in-memory state is purged. No Supabase write occurs for abandoned rooms.

**Room state shape (server-side, in-memory):**

```typescript
interface Room {
  roomId: string;
  players: Player[];           // max 2
  spectators: WebSocket[];     // read-only observers
  status: RoomStatus;          // see state machine
  match: MatchState | null;
  lastActivityAt: number;      // Unix timestamp ms
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  rematchVotes: Set<string>;   // playerIds who clicked Rematch; fires when both present
}

interface Player {
  id: string;           // UUID assigned by server on connection
  nickname: string;
  ws: WebSocket;
  ready: boolean;
  connected: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}
```

---

### 5.2 Match Controller

Owns the round-by-round flow of the match.

**Responsibilities:**
- Maintain score: `{ [playerId]: number }`
- Maintain a shuffled queue of 5 minigame IDs (no repeats) generated at match start
- Advance through rounds by pulling from the queue
- Detect match winner (first to 3 round wins)
- Emit state transitions to both clients

**Round flow:**
1. Server emits `ROUND_START` with minigame ID and round number
2. Server starts the minigame module and timer
3. Minigame resolves → server emits `ROUND_END` with winner
4. Score updates; server checks for match winner
5. If no match winner: go to next round (back to step 1)
6. If match winner: emit `MATCH_END`, persist result, transition to `MatchEnd`

---

### 5.3 Minigame Engine

Each minigame is an isolated module implementing a shared interface on both client and server.

**Server-side interface:**

```typescript
interface MinigameModule {
  id: MinigameId;
  timeoutMs: number;            // Per-minigame timer duration
  start(room: Room): void;      // Initialize game state, start timer
  handleInput(room: Room, playerId: string, input: unknown): void;
  getResult(room: Room): MinigameResult; // Called on finish or timeout
}

interface MinigameResult {
  winnerId: string | null;      // null = draw (handle per-game)
  reason: 'completed' | 'timeout' | 'forfeit';
}
```

**Client-side:** Each minigame has its own React component in `client/src/minigames/<name>/`. It receives game state via WebSocket messages and sends player input via the sync system.

---

### 5.4 Sync System (WebSocket Protocol)

The server is the single source of truth. Clients send input; the server validates and broadcasts state.

**Message envelope:**

```typescript
// Client → Server
interface ClientMessage {
  type: ClientMessageType;
  roomId: string;
  playerId: string;
  payload: unknown;
}

// Server → Client(s)
interface ServerMessage {
  type: ServerMessageType;
  payload: unknown;
}
```

**Server message types:**

| Type | Trigger | Payload |
|---|---|---|
| `ROOM_JOINED` | Player joins or rematch resets | `{ roomId, playerId, players, spectatorCount }` |
| `PLAYER_READY` | A player sets ready | `{ playerId, bothReady }` |
| `MATCH_START` | Both players ready | `{ matchId, players }` |
| `ROUND_START` | New round begins | `{ round, minigameId, timeoutMs }` |
| `TIMER_TICK` | Every second | `{ remainingMs }` |
| `GAME_UPDATE` | Minigame state change | `{ state }` (minigame-specific) |
| `ROUND_END` | Round resolves | `{ winnerId, scores, reason }` |
| `MATCH_END` | Match resolves | `{ winnerId, scores, roundHistory }` |
| `PLAYER_DISCONNECTED` | Player drops | `{ playerId, reconnectWindowMs }` |
| `PLAYER_RECONNECTED` | Player returns | `{ playerId }` |
| `FORFEIT` | Reconnect window expires | `{ forfeitedPlayerId, winnerId }` |
| `SPECTATE_JOINED` | Spectator connects | `{ roomId, players, status, spectatorCount, match }` |
| `SPECTATOR_COUNT` | Spectator joins or leaves | `{ count }` |
| `EMOTE_RECEIVED` | Player sends emote | `{ fromPlayerId, emote }` |
| `REMATCH_VOTE` | First player clicks Rematch | `{ waiting: true }` |
| `ERROR` | Bad input or state | `{ code, message }` |

**Client message types:**

| Type | Payload |
|---|---|
| `SET_NICKNAME` | `{ nickname }` |
| `SET_READY` | `{}` |
| `GAME_INPUT` | minigame-specific input object |
| `RECONNECT` | `{ playerId, roomId }` |
| `REMATCH` | `{}` |
| `SPECTATE` | `{ roomId }` |
| `EMOTE` | `{ emote }` |

---

### 5.5 Timer System

- All timers run **server-side only**.
- Server broadcasts `TIMER_TICK` every 1000ms to both clients.
- Each minigame defines its own `timeoutMs` (see minigame specs below).
- On timeout, the server calls `getResult()` on the active minigame module and resolves the round.
- Client-side countdown is display-only and must not be trusted for game logic.

---

### 5.6 Disconnect & Reconnect System

- On WebSocket close, server marks player as `connected: false` and starts a **15-second** reconnect countdown.
- Server broadcasts `PLAYER_DISCONNECTED` immediately with `reconnectWindowMs: 15000`.
- Active minigame is paused (no timer ticks) while waiting.
- If the player reconnects within 15s (sending `RECONNECT` with matching `playerId`), the server resumes the game and broadcasts `PLAYER_RECONNECTED`.
- If the window expires, server broadcasts `FORFEIT`, awards the match to the opponent, persists the result, and closes the room.

---

### 5.7 Result Persistence

Only the **final match result** is written to Supabase. Round-by-round data is ephemeral (in-memory only).

**Supabase schema:**

```sql
CREATE TABLE match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  winner_nickname TEXT NOT NULL,
  loser_nickname TEXT NOT NULL,
  winner_score INT NOT NULL,
  loser_score INT NOT NULL,
  ended_reason TEXT NOT NULL, -- 'completed' | 'forfeit'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Write occurs once, immediately after `MATCH_END` is emitted.

---

## 6. State Machine

```
Lobby
  └─► [both players joined + nicknames set]
        └─► Ready
              └─► [both players SET_READY]
                    └─► RoundStart
                          └─► Playing
                                ├─► [round resolves] ──► RoundEnd
                                │                           └─► [match winner?]
                                │                                 ├─► No ──► RoundStart
                                │                                 └─► Yes ─► MatchEnd
                                └─► [disconnect] ──► Reconnecting
                                                        ├─► [reconnected] ──► Playing (resume)
                                                        └─► [timeout] ──► MatchEnd (forfeit)
```

---

## 7. Minigames

**Current pool (9 games):** ClickSpeed, CoinFlip, ReactionTest, NumberGuess, QuickMaths, MemoryMatch, FastestTyper, RockPaperScissors, WordScramble

### Shared Rules
- Minigame order is randomized at match start (Fisher-Yates shuffle, category-balanced: no two consecutive same-category).
- No minigame repeats within a single match.
- Server resolves all outcomes. Client input is validated server-side before any state change.
- Each minigame is a 3-file change: entry in `shared/types.ts` MINIGAME_CONFIGS + server module in `server/src/minigames/` + client component in `client/src/minigames/`. See `ADDING_A_GAME.md`.

---

### 7.1 ClickSpeed
**Type:** Simultaneous input  
**Timer:** 5 seconds  
**Rules:** Both players click as fast as possible. Player with the most clicks at timer expiry wins. Ties go to the player who reached their click count first.  
**Input:** `{ type: 'CLICK' }`  
**Server tracks:** Click count per player, timestamp of each click.  
**Anti-cheat:** Server caps maximum accepted clicks per second at a reasonable human limit (e.g. 20 CPS). Excess clicks are silently dropped.

---

### 7.2 CoinFlip
**Type:** Pure RNG (server decides)  
**Timer:** None (resolves instantly on round start)  
**Rules:** Server flips a coin (`Math.random() < 0.5`), assigns winner randomly. No player input required.  
**Client UX:** Show a coin flip animation, then reveal winner.

---

### 7.3 ReactionTest
**Type:** Simultaneous reaction  
**Timer:** Server waits a random delay (1500–4000ms) after `ROUND_START` before emitting `REACT_NOW`. Then a 3-second window for input.  
**Rules:** Server emits `REACT_NOW`. First player to send `{ type: 'REACT' }` after (not before) the signal wins. Input received before the signal is penalized (player is disqualified for that round, opponent wins). If neither reacts in 3s, both lose the round and it is treated as a draw — server randomly assigns winner.  
**Anti-cheat:** Server records exact timestamp of `REACT_NOW` emission and compares to input receipt time.

---

### 7.4 NumberGuess
**Type:** Independent simultaneous guess  
**Timer:** 20 seconds  
**Rules:** Server secretly generates a number 1–100. Both players independently submit one guess (`{ type: 'GUESS', value: number }`). Player closest to the secret number wins. Ties (equidistant) are broken randomly by the server. Players cannot see each other's guess until round end.  
**Server tracks:** Secret number, guesses per player (only first guess accepted).  
**Client UX:** Show a number input (1–100) and a submit button. Lock input after submission. Reveal both guesses and the secret number at round end.

---

## 8. Anti-Cheat

| Mechanism | Detail |
|---|---|
| Server authority | Server decides all outcomes; clients display results only |
| Input validation | All `GAME_INPUT` messages are validated for type, range, and turn order |
| CPS cap | ClickSpeed: max ~20 clicks/second accepted per player |
| Pre-signal rejection | ReactionTest: input before `REACT_NOW` = disqualification |
| Single submission | NumberGuess, ReactionTest: only first input accepted |
| Answer hiding | RockPaperScissors/WordScramble: server withholds opponent picks/answers until resolved |
| Timeout enforcement | All timers are server-side; client cannot extend or skip them |

---

## 9. Scalability Plan (Post-MVP)

- Backend is designed to be **stateless per process** — room state is in-memory per server instance.
- To scale horizontally: introduce **Redis** for shared room state across instances (rooms keyed by `roomId`, WebSocket sessions sticky-routed by load balancer).
- Frontend static assets served via **CDN** (Vercel handles this automatically).
- Supabase connection pooling via **PgBouncer** (built into Supabase).

---

## 10. Development Roadmap

| Week | Focus | Deliverables |
|---|---|---|
| 1 | Project setup + Room system | Monorepo scaffold, WebSocket server, room create/join, nickname flow, basic lobby UI |
| 2 | Match controller + Timer | State machine, round flow, score tracking, server timer + tick broadcast |
| 3 | Minigame engine + 3 games | Minigame interface, ClickSpeed, TicTacToe, ReactionTest |
| 4 | Remaining games + Polish + Deploy | CoinFlip, NumberGuess, UI polish, Vercel + Fly.io deploy, Supabase wiring |

---

## 11. Future Features (Post-MVP)

- Mega matches (Best of 3 / 7 / 9 — configurable room settings, partially planned)
- Poll voting on minigame selection
- Player rankings and stats (requires auth layer)
- Redis for horizontal scaling (see Section 9)

---

## 12. Key Implementation Notes for Claude Code

- **Never trust the client.** All game logic, timers, and result resolution live on the server.
- **Minigames are modules.** Adding a new minigame means implementing `MinigameModule` on the server and a React component on the client. No other files should need to change.
- **WebSocket messages are the API.** There is no REST API for game actions. Supabase is write-only from the server (result persistence).
- **Rooms are ephemeral.** Do not over-engineer persistence. Only `match_results` is written to Supabase.
- **Shared types live in `/shared/types.ts`.** Both client and server import from here. Keep them in sync.
- **One WebSocket connection per player.** Reconnect reuses the same `playerId` UUID; the server must re-attach the new socket to the existing player slot.
- **Draw handling is per-minigame.** TicTacToe and ReactionTest have explicit draw rules. Default draw resolution is server-side random assignment.
