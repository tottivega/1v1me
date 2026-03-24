# PROGRESS.md — 1v1 ME

> What has been built. Check TODO.md for what's next. Update this at the end of every task.

---

## ✅ Completed

### Infrastructure
- [x] Monorepo scaffold (`client/`, `server/`, `shared/`)
- [x] Shared TypeScript types (`shared/types.ts`)
- [x] `MINIGAME_CONFIGS` registry — `as const satisfies`, `category`, `description`, `difficulty`; 3-file change to add any game, TS enforces completeness everywhere else
- [x] Path aliases (`@shared/*`) working in both client (Vite) and server (tsx)
- [x] Category-balanced queue algorithm — no consecutive same-category; refills pool via Fisher-Yates when exhausted
- [x] Minigame templates — `_template.ts`, `_Template.tsx`, `ADDING_A_GAME.md` checklist
- [x] Round history tracking — `roundHistory: RoundRecord[]` in `MatchState`; sent in `MATCH_END`

### Server
- [x] WebSocket server (Node.js + `ws`, port 3001)
- [x] Room system — create/join, 2-player cap, 60s idle cleanup, human-readable room codes
- [x] Player management — UUID on connection, nickname validation, 18-char cap
- [x] Match controller — best-of-5, first-to-3, score tracking, 2.5s round transitions
- [x] Server-side timer — `TIMER_TICK` every 1s, pause/resume on disconnect
- [x] Disconnect/reconnect — 15s window, game paused, `FORFEIT` on expiry
- [x] Supabase wiring — `persistMatchResult` with graceful mock fallback
- [x] Server minigame registry — TS errors if a module is missing
- [x] Spectator support — `Room.spectators`, broadcast fans out automatically
- [x] Emote system — `EMOTE` → server broadcasts `EMOTE_RECEIVED` to room
- [x] Rematch vote — `rematchVotes: Set<string>` on `Room`; both players must click; first vote shows "Waiting…"

### Client
- [x] React + Vite + TypeScript, Newgrounds cartoony style (Fredoka One, black borders, cream background)
- [x] Global CSS design system — color vars, buttons, cards, badges, animations
- [x] Zustand store — full `handleServerMessage` dispatcher, all server message types
- [x] WebSocket client — reconnect logic, countdown, module-level interval ref
- [x] `HomePage` — create/join, persistent nickname (`localStorage`), game gallery from `MINIGAME_CONFIGS`
- [x] `RoomPage` — lobby, match, round transition banner, round-end overlay, match-end breakdown
- [x] `SpectatePage` — `/spectate/:roomId`, per-minigame live views, mid-match join via snapshot
- [x] `DevPanel` v2 — search, category filter tabs, difficulty stars, description per game
- [x] Error toast — `errorMessage` auto-clears after 4s
- [x] Sound effects — Web Audio API synth, zero files; 12 distinct sounds, all check `isMuted()`
- [x] Sound toggle — 🔊/🔇 fixed top-right, persisted in `localStorage`
- [x] Share result — canvas PNG card (winner title, score, per-round recap, accent stripe, 1v1.me footer); `navigator.share({ files })` on mobile, PNG download fallback on desktop, text clipboard last resort
- [x] Emote buttons — 4 quick reactions fixed bottom-right during match; floating incoming emote
- [x] Reconnect countdown UI — visible 15→0s countdown, turns red at ≤5s
- [x] Lobby game preview — "YOU MIGHT FACE…" grid while waiting
- [x] Match breakdown screen — round-by-round recap with minigame emoji + winner per row
- [x] Mobile layout — 600px breakpoint, `100dvh` fix, touch events on ClickSpeed
- [x] Client minigame registry — TS errors if a component is missing
- [x] QR code in lobby — `qrcode.react` renders a `<QRCodeSVG>` below the invite link; tap-to-enlarge modal; improves mobile-to-mobile sharing
- [x] Open Graph meta tags — `og:title`, `og:description`, `og:image` in `index.html`; makes shared links render previews in iMessage, WhatsApp, Discord
- [x] Spectator count display — "👁 N watching" badge in lobby and match scoreboard; `SPECTATOR_COUNT` message broadcast on join/leave
- [x] Copy button "Copied!" flash — 1.5s "✅ Copied!" then reverts
- [x] Room idle timeout warning — "Room expires in Xs" badge after 50s of lobby inactivity
- [x] Auto-reconnect from localStorage — saves `{ roomId, playerId }` on join; `reconnectSaved()` action skips nickname gate on return visit
- [x] Win streak tracker — `localStorage`-persisted counter (`1v1me_streak`); increments on win, resets on loss; `🔥 X win streak` badge on HomePage when streak ≥ 2
- [x] Match history on home page — last 5 results in `localStorage` (`1v1me_history`); compact Recent Matches section below game gallery

### Minigames (11 total)
- [x] **Click Speed** — 5s, 20 CPS cap, optimistic clicks, simulated opponent in mock mode
- [x] **Coin Flip** — instant server RNG, 2s spin animation, mock simulation
- [x] **Reaction Test** — random delay 1.5–4s, early-click penalty, server-driven phases, full mock mode
- [x] **Number Guess** — 20s, closest wins, server-revealed result, full mock mode
- [x] **Quick Maths** — 15s, independent equation streams, correct/wrong flash, full mock mode
- [x] **Memory Match** — server generates 5-symbol sequence; 4s memorize → recall → score; mock opponent submits after delay
- [x] **Fastest Typer** — server picks phrase from pool of 15; per-keystroke server tracking; mock opponent advances via interval
- [x] **Rock Paper Scissors** — best-of-3 throws; simultaneous picks; server hides picks until both submit; per-throw 8s timeout; throw history dots; full mock mode with staged opponent pick
- [x] **Word Scramble** — server picks from pool of 32 words, shuffles letters; first correct guess wins; wrong-guess counter broadcast to both; answer revealed on resolve; mock opponent solves at 30–75% of timer
- [x] **Color Word** — server picks word + different ink color (6 colors); click the ink color button, not the spelled word; first correct click wins; 10s timeout; full mock mode
- [x] **Higher or Lower** — server picks target + clue offset by 1–20; both players pick Higher/Lower simultaneously; correct picker wins; 10s timeout; full mock mode

### Game Feel
- [x] Animated score pop — `anim-score-pop` keyframe; `key` trick replays on each point; uses `myColor`/`oppColor`
- [x] **Player animal avatars** — server assigns random emoji from pool of 12 on join; stored on `Player` + `PlayerInfo`; shown in lobby `PlayerSlot` (replaces hardcoded 😤/😈), ScoreBoard next to nicknames; mock players use 😤/😈
- [x] **Connected player pulse dot** — pulsing green dot next to nickname in `PlayerSlot`; turns grey when `connected: false`
- [x] **404 / room-not-found screen** — `ROOM_NOT_FOUND` error code sets `roomNotFound` state; `RoomPage` renders friendly 🚪 screen with back button; resets on next `connect()` call
- [x] Match win confetti burst — 60 pieces, `useMemo`-stable random values, varying sizes (6–16px), four shapes (circle/square/wide strip/tall strip), per-piece `--drift` CSS var gives horizontal arc (±120px); auto-cleans after animation
- [x] Player color assignment — `myColor`/`oppColor` set at `MATCH_START` based on join order; stored in Zustand
- [x] Round transition count-in — 2.3s overlay: emoji + name pops in, then 3→2→1→GO! with `playTick()`; "1" distinct tone; GO! in green; blocks interaction throughout
- [x] Timer bar color shift — green >33%, yellow 15–33%, red <15%
- [x] "How to play" tooltip — `?` button on game banner; shows `cfg.description`; auto-dismisses after 4s
- [x] Click Speed ripple — spawns at exact click coordinates, expands via `@keyframes ripple`, cleans up after 550ms
- [x] Coin flip 3D rotation — `perspective(220px) rotateY(360deg)` keyframe

### Codebase Quality
- [x] `CoinFlip.tsx` — fixed `opponent` object in `useEffect` deps (overlapping timeouts bug)
- [x] `memorymatch.ts` + `fastesttyper.ts` — `room.match?.onRoundDone` in delayed callbacks (crash-on-rematch bug)
- [x] `quickmaths.ts` — `broadcast_state` → `broadcastState` (naming consistency)

### Project Setup
- [x] `client/vercel.json`, `server/Dockerfile`, `server/fly.toml`, `server/.env.example`
- [x] `.gitignore`, initial git commit
- [x] `ARCHITECTURE.md`, `DESIGN.md`, `README.md`, `TODO.md`, `RULES.md`

### Mobile
- [x] **Device-aware game filtering** — `platforms: 'all' | 'desktop-only' | 'mobile-only'` on every `MINIGAME_CONFIGS` entry; Fastest Typer is `desktop-only`; client detects mobile via `window.matchMedia('(pointer: coarse)')`, sends `isMobile` in `SET_NICKNAME`; `shuffleQueue` accepts `excludePlatforms` and filters accordingly
- [x] **Landscape lock warning** — yellow banner when `innerHeight < 380 && width > height`; dismisses on rotate; `resize` + `orientationchange` listeners; `LandscapeWarning` component mounted in `App`
- [x] **Touch target audit** — all interactive elements ≥ 44×44px; ColorWord buttons bumped to 52px height; MemoryMatch "Undo last" btn-sm got `minHeight: 44`

### Game Feel
- [x] **Round result lingers until both confirm** — `ROUND_READY` client message; `roundReadyVotes: Set<string>` + `roundReadyTimer` on `MatchState`; server waits for both votes before advancing; 5s auto-advance fallback; match-ending rounds still use 2.5s auto-advance
- [x] **Volume slider** — mute toggle upgraded to 🔇/🔉/🔊 icon + 0–100 range slider; `getVolume()`/`setVolume()` replace binary `isMuted`; all synth nodes multiply gain by current volume; persisted in `localStorage` key `soundVolume`
- [x] **Space / Enter to ready up** — `keydown` listener in `LobbyView`; fires `setReady()` on Space/Enter when opponent present and not yet ready; guards against INPUT focus
- [x] **Match duration on end screen** — `matchStartedAt: number | null` in Zustand store; set at `MATCH_START`, cleared on `ROOM_JOINED`; elapsed computed at render time; "⏱ Xm Ys" shown between the score numbers on the match-end screen
- [x] **Rematch flash banner** — detects `match_end → lobby` status transition in `RoomPage` via `useRef`; shows full-screen "🔥 REMATCH!" overlay (anim-bounce, ~900ms) with semi-transparent backdrop before lobby renders
- [x] **Client-side Sentry** — `@sentry/react` installed; `Sentry.init()` runs in `main.tsx` only when `VITE_SENTRY_DSN` is set; `ErrorBoundary.componentDidCatch` calls `Sentry.captureException`; `client/.env.example` documents the var
- [x] **Spectator late-join game state** — `SPECTATE_JOINED` payload includes `match.minigameState` snapshot; `SpectateGameState` in `SpectatePage` renders read-only views for all 11 games using the raw server state
- [x] **Disconnected opponent overlay** — full-screen pause overlay when `roomStatus === 'reconnecting'`; shows opponent name + countdown timer; pointer-events blocked

### Launch Hardening
- [x] **Input length caps** — WordScramble guess capped at 50 chars; FastestTyper text sliced to 200 chars; Emote string capped at 10 chars
- [x] **HTTP rate limiting** — per-IP sliding 10s window, max 30 requests; 429 returned before routing; `GET /rooms` and `GET /health` both protected

### Code Quality (Scale prep)
- [x] **`MinigameInput` open interface** — replaced 10-variant discriminated union with `{ type: string; [key: string]: unknown }`; no more `shared/types.ts` touch per game; runtime type guard in `handleGameInput`; per-module casts narrowed at point of use
- [x] **Dynamic server module discovery** — `readdirSync` + lazy `require('./' + file)` in `loadModules()` singleton; startup assertion fails fast if any `MINIGAME_CONFIGS` key is missing a module; no manual import/export in `index.ts`
- [x] **Global timer cleanup in tests** — `afterEach(() => vi.clearAllTimers())` in `server/src/__tests__/setup.ts`; fixes timer-leak cross-contamination between tests
- [x] **Spectator renderer co-location** — 11 `*.spectator.tsx` files alongside game components; `spectatorRegistry.ts` auto-discovers via `import.meta.glob`; `SpectateGameState` replaced 11 if-branches with single registry lookup; shared helpers in `spectatorHelpers.tsx`
- [x] **Category filter on HomePage** — pill buttons (ALL + 5 categories) above game gallery; active pill fills with category color; filters grid reactively
- [x] **Broadcast security pattern in `_template.ts`** — `⚠️ SECURITY` comment with Pattern A/B examples; prevents accidental answer/secret leaks in new games
- [x] **`clearAllRooms()`** — exported from `roomStore.ts` for test isolation; `roomStore.test.ts` uses `beforeEach(() => clearAllRooms())` instead of deleting by known ID
- [x] **`ADDING_A_GAME.md` updated** — server module and spectator view documented as auto-discovered; checklist reflects 4-file workflow with no manual registration steps

### Tests
- [x] **Vitest setup** — server (node env) and client (happy-dom + React Testing Library); `npm test` works in both packages
- [x] **Server unit + integration tests (77, 11 files)** — quickmaths (6), memorymatch (6), fastesttyper (7), wordscramble (5), rockpaperscissors (4), matchController (6), roomManager (13), roomStore (4), colorword (6), higherorlower (7), router integration (10); `clearAllRooms()` for test isolation
- [x] **Client unit tests (20)** — gameStore (11), ScoreBoard (5), TimerBar (4)
- [x] Test factories in `server/src/__tests__/helpers.ts` — `makeWs()`, `makePlayer()`, `makeRoom()`, `makeMatch()`
- [x] **ESLint** — `typescript-eslint` v8 + flat config in both packages; `no-unused-vars` (error), `no-explicit-any` (warn), `react-hooks/rules-of-hooks` (error); server passes at 0 warnings
- [x] **Prettier** — `.prettierrc` at root; `format` / `format:check` scripts in root and both packages
- [x] **lint-staged + husky** — pre-commit hook runs Prettier + ESLint on staged files; blocks commit on errors
- [x] **React error boundary** — class component wraps `<App />`; styled 💥 recovery screen with reload button; logs in dev, comment for prod log service
- [x] **WS rate limiting** — 60 msg/s sliding 1s window per connection; `RATE_LIMITED` error sent on breach
- [x] **WS origin check** — production-only; rejects upgrades from origins other than `ALLOWED_ORIGIN` env var with HTTP 403
- [x] **Room settings** — creator sets Best of 3/5/7/9 + enabled categories before readying; `SET_ROOM_CONFIG`/`ROOM_CONFIG` message pair; queue and win condition respect config
- [x] **Router integration tests (10)** — real WS server per test; covers join, ROOM_FULL, empty nickname, config change, ready flow, rate limiting, unknown type
- [x] **RoomPage smoke tests (12)** — lobby render, copy button, Copied! flash, spectator badge, MATCH SETTINGS panel, bestOf selector, category chips, creator/non-creator disabled state
- [x] **ScoreBoard bestOf fix** — `roomConfig.bestOf` from store replaces hardcoded 5 and 3; `winsNeeded` derived dynamically; ScoreBoard tests updated with bestOf=7 case
- [x] **Match point + Final Round banner** — round transition overlay shows 🏆 MATCH POINT / ⚠️ THEIR MATCH POINT / ⚡ FINAL ROUND badge with correct color; `transitionData` snapshot captures `matchPointFor` and `isFinalRound` at round-start
- [x] **Server health endpoint** — `GET /health` returns `{ status: 'ok', rooms: N, uptime: N }`; URL routing added to `createServer` callback
- [x] **Public room browser** — `GET /rooms` returns open rooms (1 player, lobby status); `createdAt` on `Room`; `getOpenRooms()` in roomStore; `/rooms` React page with 5s auto-refresh; "Browse open rooms" button on HomePage
- [x] **PWA manifest** — `client/public/manifest.json` with `standalone` display, cream background, orange theme; `<link rel="manifest">` + `<meta name="theme-color">` in `index.html`

---

## 🗑️ Removed
- **TicTacToe** — removed from game pool
