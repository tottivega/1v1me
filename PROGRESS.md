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
- [x] **`document.title` updates** — reflects room state: `Lobby · ROOM-CODE · 1v1 ME`, `Round N · Game Name · 1v1 ME`, `You won! 🏆 · 1v1 ME`; resets to `1v1 ME` on unmount
- [x] **Suspense fallback** — lazy minigame chunk shows game emoji + label while loading instead of blank; uses `cfg.emoji` + `cfg.label` from `MINIGAME_CONFIGS`
- [x] **LobbyGamePreview category filter** — "YOU MIGHT FACE…" grid reads `roomConfig.enabledCategories` and hides games outside the configured category set
- [x] **Rematch cancel button** — while waiting for opponent's rematch vote, a "✕ Cancel" button appears; disconnects + navigates home
- [x] **Emote keyboard shortcuts** — `1`/`2`/`3`/`4` keys fire the corresponding emote during a match; guarded against INPUT focus
- [x] **Match history top-3 games** — `MatchHistoryEntry.topGames?: string[]` stores up to 3 most-played game emojis; tallied from `roundHistory` in `recordMatchResult`; rendered inline in `HistoryRow`
- [x] **Confetti `prefers-reduced-motion`** — `@media (prefers-reduced-motion: reduce)` guard in `index.css` hides all confetti pieces for users who opt out of motion
- [x] **OG image** — `og-image.svg` (1200×630) in `client/public/`; dark card with brand colors, category pills, game emoji accents; `og:url` + `og:image` wired in `index.html`
- [x] **Animated score counter** — match-end screen counts up from 0 to final score via `requestAnimationFrame` with cubic ease-out over 600ms
- [x] **Win streak badge in lobby** — `🔥 N` badge next to nickname when streak ≥ 2; `PlayerInfo.streak?` threaded from localStorage → SET_NICKNAME → server `Player` → `toPlayerInfos` → `PlayerSlot`
- [x] **Native share + platform deep links** — three-tier share flow: `navigator.share` with PNG (mobile) → text-only share → clipboard copy with ✓ flash; Twitter/X, WhatsApp, Reddit, Discord (clipboard markdown) deep links below
- [x] **Result card generator** — Canvas PNG: dark `#18181b` card, accent bar (yellow win/red loss), large score, nicknames, 🔥 streak badge, top-3 game emojis, per-round breakdown rows, "1v1 ME" footer watermark; included in `navigator.share files` on mobile
- [x] **Spectator emotes** — emote buttons in `SpectateMatchView`; spectator nickname from localStorage sent in SPECTATE payload; impostor detection (case-insensitive match against player nicknames appends " (Impostor)"); `EmotePayload.fromName?` in shared types; `EMOTE_RECEIVED` broadcasts `fromName` for spectators; RoomPage emote name tag falls back to `fromName`

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
- [x] **Server unit + integration tests (86, 12 files)** — numberguess (8), quickmaths (6), memorymatch (6), fastesttyper (7), wordscramble (5), rockpaperscissors (4), matchController (6), roomManager (13), roomStore (4), colorword (6), higherorlower (7), router integration (10); `clearAllRooms()` for test isolation
- [x] **Client unit tests (45, 5 files)** — gameStore (11), ScoreBoard (6), TimerBar (4), HomePage (6), RoomPage (18); sounds + WebSocket actions mocked in RoomPage tests
- [x] **`noUncheckedIndexedAccess`** — enabled in both `client/tsconfig.json` and `server/tsconfig.json`; all `[p1, p2] = arr` destructures cast as `[T, T]`, array random-index access guarded with `!`, `Record<K,V>` access uses `?? fallback` where appropriate; zero TS errors in both packages
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

### Systems & UX Polish (post-MVP batch)

**Game Feel**
- [x] **"You've played X times" on round transition** — below game title on count-in overlay; pure client-side, counts occurrences in `roundHistory`
- [x] **Per-minigame ambient sounds** — each game plays a distinct synth loop while active (ticking for reflex, beeps for math, drone pads for luck, etc.); zero audio files; low volume (`getVolume() * 0.25`), fades in/out, stops on round end; `AMBIENT` map in `sounds.ts` keyed by minigame ID
- [x] **Custom avatar selection** — clicking your avatar in lobby opens a 12-emoji picker; selection saved to `1v1me_avatar` in localStorage; sent in `SET_NICKNAME` as `avatar?`; server validates + live-updates opponent via `SET_AVATAR` → re-broadcast `ROOM_JOINED`

**Room & Match Flow**
- [x] **Game ban/veto system** — P1 configures 0–3 bans per player in `RoomSettings`; match enters `banning` phase when bans > 0; server sends `BAN_PHASE_START` with eligible pool; simultaneous hidden picks; union of bans removed before queue shuffle; types: `banCount` on `RoomConfig`, `BAN_PHASE_START`, `SUBMIT_BANS`
- [x] **Rematch with config change** — `RoomSettings` panel embedded on match-end screen; P1 can adjust Best-of / categories / ban count before voting; P2 sees it read-only; locked while `rematchVoting` in progress

**Notifications**
- [x] **Toast notification queue** — replaced single `errorMessage` with `toasts: Toast[]` (`{ id, message, type: 'error' | 'info' | 'success' }`); max 3 visible (FIFO), clickable to dismiss; `SERVER_RESTARTING` delivered as info toast

**Server Systems**
- [x] **Graceful server shutdown** — `SIGTERM` handler broadcasts `SERVER_RESTARTING` to all connected clients, waits 3s, then exits; client shows info toast and reconnect banner
- [x] **Per-room WebSocket rate limit** — 120 msg/s aggregate across all players in a room (in addition to per-connection 60 msg/s); tracked on `Room.roomMsgCount + Room.roomWindowStart`
- [x] **`GET /rooms` pagination** — `?limit=N&offset=M` query params (default 20, max 50); returns `{ rooms, total }`; `RoomsPage` shows Prev/Next controls when `total > 20`
- [x] **Anonymous user ID persistence** — `1v1me_userId` UUID generated on first visit, stored in localStorage, sent in `SET_NICKNAME`; server stores on `Player`, writes `winner_user_id` / `loser_user_id` to Supabase; lifetime stats without auth; schema in `server/migrations/001_initial_schema.sql`
- [x] **Server-side game analytics** — `game_rounds` Supabase table (`match_id`, `minigame_id`, `winner_id`, `round_number`); `persistRoundResult` called from `matchController` after every round; zero client change
- [x] **Phantom-round bug fix** — `handleRoundReady` now guards against stale `roundReadyVotes` from a previous round triggering `startRound` during the 2.5s `endMatch` window after a match winner is determined

**Codebase Quality**
- [x] **Stale room cleanup audit** — server tests verify: (a) host disconnects before anyone joins → room deleted after 60s idle timer, (b) both players disconnect mid-match without reconnecting → room deleted after 15s forfeit window
- [x] **Playwright E2E tests** — `tests/` package; browser P1 + WS bot P2; per-game input strategies for all 11 minigames; full create-room → lobby → match → match-end flow in ~30s; `npm run test:e2e` from root; `webServer` auto-starts server + client; 94 server + 54 client unit tests
- [x] **`ADDING_A_GAME.md` + `REMOVING_A_GAME.md`** — checklist updated with ambient sound and E2E bot strategy steps; new removal doc covers all 8 touch-points with a "what NOT to touch" table for auto-discovered parts

### Systems hardening & codebase prep (pre-minigame-week batch)

**Bug fixes**
- [x] **Room expiration mid-match** — idle cleanup timer was firing after 60s even during active matches; fix: cancel timer at match start (`setPlayerReady`), arm a fresh 5-min post-match timer in `endMatch`; `handleDisconnect` now treats `match_end` disconnects as pre-match (no spurious forfeit on a finished game)
- [x] **Stale game timers after match end / forfeit** — `endMatch` now nulls `onRoundDone`, sets `roundResolved = true`, and calls `cleanup()` on the active minigame before broadcasting `MATCH_END`; prevents RPS throw-timeout and ReactionTest signal/window timers from firing `resolveRound` after the match is over
- [x] **Ban phase hangs if a player goes idle** — 30s `BAN_PHASE_TIMEOUT_MS` auto-submits empty bans for any player who hasn't submitted, so the match always launches

**Minigame engine**
- [x] **`cleanup()` on `MinigameModule`** — optional method added to interface; implemented on coinflip (flip-delay timer), reactiontest (signal + window timers), and rockpaperscissors (`throwTimers` Map); called from `endMatch` and `forfeitMatch` via `cleanupCurrentMinigame()`
- [x] **ReactionTest timers off state** — `signalTimer`/`windowTimer` moved from the state object to a module-level Map (same pattern as RPS); spectator `minigameState` snapshots no longer contain unserializable timer refs
- [x] **`twoPlayers(room)` + `randomWinner(p1, p2)` helpers** — `server/src/utils/gameUtils.ts`; `[Player, Player]` cast and inline `Math.random()` tie-break removed from all 9 minigame modules
- [x] **`CLICKSPEED_CPS_CAP` to shared** — constant moved from duplicate server + client definitions into `shared/types.ts`; both sides import it

**Tests**
- [x] **Ban phase + forfeit test suite** — `banPhaseAndForfeit.test.ts` (11 tests): ban status entry, skip-if-zero, single-submit hold, both-submit merge, ban clamping, 30s auto-launch timeout, double-launch prevention, forfeit winner, `onRoundDone` null guard, no phantom `ROUND_END` after forfeit
- [x] **`matchController.test.ts` mock coverage** — added `vi.mock('../minigames/index')` so timer-driven `endMatch` tests no longer trigger `require()` on ES minigame modules

---

## 🗑️ Removed
- **TicTacToe** — removed from game pool
