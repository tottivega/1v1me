# CLAUDE.md — 1v1 ME

> Read this before touching any code. It is the single source of truth for how this project is structured, how to extend it, and how to work with this codebase effectively.

---

## Project Summary

**1v1 ME** is a browser-based multiplayer minigame platform. Two players settle disputes by competing in a Best-of-N series of randomly selected minigames. No login required — invite-link rooms, server-authoritative results.

**Status:** Feature-complete for MVP. UX-polished. Deploy is planned for April. Current focus: improve the underlying systems and UX until we reach a state where we will solely focus on minigame creation, polish and art style.

---

## Repository Layout

```
1v1me/
├── client/          # React + Vite + TypeScript frontend
├── server/          # Node.js WebSocket backend
├── shared/          # types.ts — shared between client and server via @shared alias
├── ARCHITECTURE.md  # Technical reference (authoritative)
├── DESIGN.md        # Visual/UX philosophy
├── PROGRESS.md      # What has been built
├── TODO.md          # What's next
└── CLAUDE.md        # This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| State | Zustand (`client/src/store/gameStore.ts`) |
| Routing | React Router v6 |
| Backend | Node.js + `ws` WebSocket library |
| Database | Supabase (Postgres) — write-only from server |
| Frontend hosting | Vercel |
| Backend hosting | Fly.io |
| Tests | Vitest + React Testing Library (client), Vitest (server) |
| Linting | ESLint (typescript-eslint v8 flat config) |
| Formatting | Prettier |
| Pre-commit | Husky + lint-staged (blocks on errors) |

---

## Running the Project

```bash
# Server
cd server && npm run dev       # tsx watch mode, port 3001

# Client
cd client && npm run dev       # Vite dev server, port 5173

# Tests
cd server && npm test
cd client && npm test

# Lint / format
npm run lint                   # from server/ or client/
npm run format                 # Prettier write
npm run format:check           # Prettier check (CI)
```

**Environment variables:**

`client/.env.local`:
```
# VITE_WS_URL unset in dev — Vite proxies /ws → localhost:3001 automatically
VITE_APP_URL=https://1v1me.vercel.app   # used in share links
# VITE_SENTRY_DSN=...                   # optional — omit to disable Sentry
```

`server/.env`:
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
ALLOWED_ORIGIN=http://localhost:5173    # WS origin check (skipped in dev)
```

---

## Architecture in One Paragraph

The server owns all state. Players connect via WebSocket. The server assigns a UUID `playerId` on connection. Players join/create a room via `SET_NICKNAME`. When both players ready up (`SET_READY`), the server starts the match: it shuffles a category-balanced queue of minigame IDs, then runs each as a round. Every round the server starts the minigame module, broadcasts `ROUND_START`, ticks a countdown via `TIMER_TICK`, resolves the result (via player input or timeout), broadcasts `ROUND_END`, and advances. When one player hits `ceil(bestOf/2)` wins, the server broadcasts `MATCH_END`, persists to Supabase, and transitions to `match_end`. Clients display what the server tells them.

---

## WebSocket Protocol

### Client → Server

| Message | When | Key payload fields |
|---|---|---|
| `SET_NICKNAME` | On join/create | `nickname`, `roomId`, `isMobile`, `streak` |
| `SET_READY` | Ready button | — |
| `SET_ROOM_CONFIG` | Host only, pre-ready | `bestOf`, `enabledCategories` |
| `GAME_INPUT` | During a round | minigame-specific `{ type, ...fields }` |
| `RECONNECT` | On return after disconnect | `playerId`, `roomId` |
| `REMATCH` | Match end | — |
| `SPECTATE` | Spectator join | `roomId`, `nickname` |
| `EMOTE` | During match | `emote` (string ≤ 10 chars) |
| `ROUND_READY` | After round result shown | — |

### Server → Client

| Message | Trigger |
|---|---|
| `ROOM_JOINED` | Join, rematch reset |
| `PLAYER_READY` | Any player readies up |
| `ROOM_CONFIG` | Host changes config |
| `MATCH_START` | Both ready |
| `ROUND_START` | New round |
| `TIMER_TICK` | Every 1s |
| `GAME_UPDATE` | Minigame state change |
| `ROUND_END` | Round resolves |
| `MATCH_END` | Match resolves |
| `PLAYER_DISCONNECTED` | WS closes |
| `PLAYER_RECONNECTED` | Reconnect succeeds |
| `FORFEIT` | 15s window expires |
| `SPECTATE_JOINED` | Spectator connects |
| `SPECTATOR_COUNT` | Spectator joins/leaves |
| `EMOTE_RECEIVED` | Any emote sent |
| `REMATCH_VOTE` | First player votes rematch |
| `ERROR` | Bad input / state |

All types are defined in `shared/types.ts`. Do not add message types elsewhere.

---

## Room Status State Machine

```
lobby → ready → playing → round_end → playing (loop)
                                    → match_end
playing → reconnecting → playing (on reconnect)
                       → match_end (on forfeit)
```

`roomStatus` in the Zustand store mirrors this exactly.

---

## Adding a Minigame (4-file change)

1. **`shared/types.ts`** — add entry to `MINIGAME_CONFIGS` (id, label, emoji, category, timeoutMs, description, platforms)
2. **`server/src/minigames/<name>.ts`** — implement `MinigameModule` interface: `start()`, `handleInput()`, auto-discovered via `readdirSync` in `index.ts`
3. **`client/src/minigames/<Name>.tsx`** — React component, receives game state from store `minigameState`, sends input via `send('GAME_INPUT', { type, ... })`
4. **`client/src/minigames/<Name>.spectator.tsx`** — read-only spectator view, auto-discovered via `import.meta.glob` in `spectatorRegistry.ts`

See `ADDING_A_GAME.md` and `_template.ts` / `_Template.tsx` for the full checklist and boilerplate.

**Security rule:** Never broadcast secret/answer state to all players. Use Pattern A (separate sends per player) or Pattern B (omit field for non-owner). The `⚠️ SECURITY` comment in `_template.ts` shows both patterns.

---

## Key Files

| File | Purpose |
|---|---|
| `shared/types.ts` | All shared types: `MinigameId`, `MINIGAME_CONFIGS`, all message payload types |
| `server/src/sync/router.ts` | WebSocket message router — the main server entry point for all client messages |
| `server/src/rooms/roomManager.ts` | Room lifecycle: create, join, disconnect, reconnect, rematch, spectator |
| `server/src/match/matchController.ts` | Round flow, score tracking, `onRoundDone` callback |
| `server/src/sync/broadcast.ts` | `send()`, `broadcast()`, `toPlayerInfos()` helpers |
| `client/src/store/gameStore.ts` | Zustand store — all client state, WS connection, `handleServerMessage` dispatcher |
| `client/src/pages/RoomPage/` | Main game page — split into `LobbyView`, `BanPhaseView`, `MatchView`, `MatchEndView`, `RoomSettings` |
| `client/src/pages/SpectatePage.tsx` | Spectator view — live scoreboard, per-game state, emote buttons |
| `client/src/pages/HomePage.tsx` | Create/join, game gallery, match history, win streak |
| `client/src/pages/RoomsPage.tsx` | Public room browser (`/rooms`), 5s auto-refresh |
| `client/src/minigames/registry.tsx` | Lazy `import.meta.glob` registry → renders active minigame component |
| `client/src/minigames/spectatorRegistry.ts` | Same for spectator components |
| `client/src/utils/sounds.ts` | Web Audio API synth — zero audio files, `getVolume()`/`setVolume()` |
| `server/src/__tests__/helpers.ts` | `makeWs()`, `makePlayer()`, `makeRoom()`, `makeMatch()` test factories |

---

## State in Zustand (`gameStore.ts`)

Key fields you will use most often:

```ts
myPlayerId       // UUID assigned by server
myNickname       // from localStorage 'nickname'
roomId           // current room code
roomStatus       // RoomStatus (lobby | ready | playing | round_end | match_end | reconnecting)
players          // PlayerInfo[] — includes avatar, streak, ready, connected
scores           // Record<playerId, number>
currentRound     // 1-based
currentMinigame  // MinigameId | null
minigameState    // MinigameState | null — union of all 9 game state shapes (see shared/types.ts)
remainingMs      // ms left on current round timer
roomConfig       // { bestOf, enabledCategories }
matchWinnerId    // set at MATCH_END
myColor          // 'var(--blue)' | 'var(--orange)' based on join order
oppColor         // opposite of myColor
incomingEmote    // { fromPlayerId, fromName?, emote } | null — auto-clears after 2.5s
```

Key actions:

```ts
connect(roomId, nickname)   // opens WS, sends SET_NICKNAME
spectate(roomId)            // opens WS as spectator, sends nickname from localStorage
disconnect()                // closes WS, resets state
send(type, payload)         // sends ClientMessage
setReady()                  // sends SET_READY
reconnectSaved()            // tries reconnect from localStorage saved { roomId, playerId }
```

---

## LocalStorage Keys

| Key | Purpose |
|---|---|
| `nickname` | Persisted nickname (set when user types, not on game start) |
| `muted` | Sound mute state (`'true'` / `'false'`) |
| `soundVolume` | Volume 0–100 |
| `1v1me_streak` | Win streak counter |
| `1v1me_history` | Last 5 `MatchHistoryEntry[]` (JSON) |
| `1v1me_reconnect` | `{ roomId, playerId }` for auto-reconnect |

---

## CSS Design System

All variables in `client/src/index.css`. Key ones:

```css
--black, --white, --bg (cream #f5f0e8)
--orange (primary CTA), --yellow (highlights), --green (wins), --red (losses)
--blue (player 1), --orange (player 2), --purple (spectator/trivia)
--border: 3px solid var(--black)
--shadow: 4px 4px 0 var(--black)   /* no blur — sticker feel */
--font-title: 'Fredoka One'
```

Key utility classes: `.page`, `.card`, `.btn`, `.btn-orange`, `.btn-white`, `.btn-lg`, `.btn-sm`, `.label`, `.subtitle`, `.badge`, `.badge-green`, `.badge-orange`, `.badge-yellow`

Key animations: `anim-pop`, `anim-bounce`, `anim-pulse`, `anim-count-in`, `score-pop`, `confetti-fall`

**Rule:** Use `@keyframes` in `index.css`, not inline or JS-driven tweens. Use the `key` trick to restart animations on state change.

---

## Testing

```bash
cd server && npm test
cd client && npm test
```

Server test files: `quickmaths`, `memorymatch`, `fastesttyper`, `rockpaperscissors`, `colorword`, `higherorlower`, `matchController`, `roomManager`, `roomStore`, `router` (integration with real WS server).

Client test files: `gameStore`, `ScoreBoard`, `TimerBar`, `HomePage`, `RoomPage`, `BanPhaseView`, `RoundEndOverlay`, `minigames` (smoke tests for all 9 game components).

**Test helpers:** `server/src/__tests__/helpers.ts` — always use `makePlayer({ streak: 0, ...overrides })`. `clearAllRooms()` is called in `beforeEach` for isolation.

**Mocking sounds:** Every client test file mocks `../../utils/sounds` to silence Web Audio API (not available in happy-dom).

**Animated UI:** If testing a component with `requestAnimationFrame`-driven animation (e.g. score counter), use `waitFor()` not a synchronous assertion.

**Minigame smoke tests:** `client/src/__tests__/minigames/minigames.test.tsx` — one `describe` per game, runs in mock mode (`isMockMatch: true`, `wsStatus: 'disconnected'`). Add a block here when adding a new game; remove it when removing one.

---

## Minigame Pool (9 games)

| ID | Category | Timer | Notes |
|---|---|---|---|
| `clickspeed` | skill | 5s | 20 CPS cap server-side |
| `coinflip` | luck | instant | Pure RNG |
| `reactiontest` | reflex | 3s window | Early click = disqualified |
| `quickmaths` | math | 15s | Independent equation streams |
| `memorymatch` | strategy | 25s | Server generates 5-symbol sequence |
| `fastesttyper` | skill | per-phrase | Desktop-only (`platforms: 'desktop-only'`) |
| `rockpaperscissors` | strategy | 8s/throw | Best-of-3 throws |
| `colorword` | reflex | 10s | Click ink color, not spelled word |
| `higherorlower` | luck | 10s | Simultaneous Higher/Lower pick |

---

## Spectator System

- Route: `/spectate/:roomId`
- Spectators join via `SPECTATE` message with optional `nickname` from localStorage
- Server sends full `SPECTATE_JOINED` snapshot (including current `minigameState`) for mid-match joins
- **Impostor detection:** if spectator nickname matches any player nickname (case-insensitive), server appends `" (Impostor)"` to their display name
- Emotes from spectators use `fromName` (not `fromPlayerId`) in `EMOTE_RECEIVED`
- Each minigame has a `<Name>.spectator.tsx` for the read-only state view

---

## Share & Social

- **Three-tier share flow** (match end screen): `navigator.share` with PNG file (mobile) → `navigator.share` text-only → `navigator.clipboard.writeText` with ✓ flash
- **Platform links:** Twitter/X, WhatsApp, Reddit, Discord (clipboard markdown)
- **Canvas result card:** `buildCard()` in `RoomPage.tsx` — dark `#18181b`, accent bar (yellow win/red loss), large score, nicknames, streak badge, top-3 game emojis, per-round rows, watermark
- **OG tags:** `index.html` has `og:title`, `og:description`, `og:image` (`og-image.svg` in `client/public/`)
- **`VITE_APP_URL`** controls the URL in share text (defaults to `https://1v1me.vercel.app`)

---

## Deploy Checklist (April)

1. **Supabase** — create project, run migration (see `TODO.md`), copy URL + service_role key
2. **Fly.io** — `fly launch --config server/fly.toml`, set secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGIN`)
3. **Vercel** — import repo, set root to `client/`, set `VITE_WS_URL` + optional `VITE_SENTRY_DSN`
4. **Staging smoke test first** — dedicated staging Fly app + Vercel preview before touching production
5. See `TODO.md` → Deploy section for the full step-by-step runbook

---

## Working on Windows

- Shell: use bash/Unix syntax (forward slashes, `/dev/null`)
- TypeScript LSP tool: requires a `typescript-language-server.exe` shim (Node.js SEA) at `C:/Users/totti/AppData/Roaming/npm/typescript-language-server.exe` because Windows `CreateProcess` cannot execute `.cmd` files directly. If LSP stops working, re-create the shim from `shim.cjs` + `sea-config.json` using `node --experimental-sea-config` + `postject`.
- Next project: use WSL (Ubuntu) to avoid these Windows tooling issues

---

## Conventions & Rules

- **Server is truth.** Never trust client input. All outcomes resolved server-side.
- **Shared types first.** Add to `shared/types.ts` before implementing anywhere else.
- **No new games until roster is decided.** Current focus is deploy + any UX gaps.
- **No REST API for game actions.** WebSocket only. Supabase is write-only from the server.
- **No animation libraries.** All effects (confetti, ripples, sounds) are hand-coded.
- **Mock mode for every game.** Each minigame must work standalone in dev without a server (simulated opponent via `setTimeout`/interval).
- **`prefers-reduced-motion` respect.** Any CSS animation that is purely decorative must be guarded with `@media (prefers-reduced-motion: reduce)`.
- **Don't over-engineer.** Rooms are ephemeral. Only `match_results` is persisted. No session state.
- **Commit style:** one task = one branch = one commit. Conventional-ish: verb + what + why if non-obvious.
