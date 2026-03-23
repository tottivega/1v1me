# 1v1 ME — Progress

> Updated after every step. Check this before starting any new work.

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

### Client
- [x] React + Vite + TypeScript, Newgrounds cartoony style (Fredoka One, black borders, cream background)
- [x] Global CSS design system — color vars, buttons, cards, badges, animations
- [x] Zustand store — full `handleServerMessage` dispatcher, all 14 server message types
- [x] WebSocket client — reconnect logic, countdown, module-level interval ref
- [x] `HomePage` — create/join, persistent nickname (`localStorage`), game gallery from `MINIGAME_CONFIGS`
- [x] `RoomPage` — lobby, match, round transition banner, round-end overlay, match-end breakdown
- [x] `SpectatePage` — `/spectate/:roomId`, per-minigame live views, mid-match join via snapshot
- [x] `DevPanel` v2 — search, category filter tabs, difficulty stars, description per game
- [x] Error toast — `errorMessage` auto-clears after 4s
- [x] Sound effects — Web Audio API synth, zero files; 12 distinct sounds, all check `isMuted()`
- [x] Sound toggle — 🔊/🔇 fixed top-right, persisted in `localStorage`
- [x] Share result — Web Share API on mobile, clipboard fallback on desktop
- [x] Emote buttons — 4 quick reactions fixed bottom-right during match; floating incoming emote
- [x] Reconnect countdown UI — visible 15→0s countdown, turns red at ≤5s
- [x] Lobby game preview — "YOU MIGHT FACE…" grid while waiting
- [x] Match breakdown screen — round-by-round recap with minigame emoji + winner per row
- [x] Mobile layout — 600px breakpoint, `100dvh` fix, touch events on ClickSpeed
- [x] Client minigame registry — TS errors if a component is missing

### Minigames (9 total)
- [x] **Click Speed** — 5s, 20 CPS cap, optimistic clicks, simulated opponent in mock mode
- [x] **Coin Flip** — instant server RNG, 2s spin animation, mock simulation
- [x] **Reaction Test** — random delay 1.5–4s, early-click penalty, server-driven phases, full mock mode
- [x] **Number Guess** — 20s, closest wins, server-revealed result, full mock mode
- [x] **Quick Maths** — 15s, independent equation streams, correct/wrong flash, full mock mode
- [x] **Memory Match** — server generates 5-symbol sequence; 4s memorize → recall → score; mock opponent submits after delay
- [x] **Fastest Typer** — server picks phrase from pool of 15; per-keystroke server tracking; mock opponent advances via interval
- [x] **Rock Paper Scissors** — best-of-3 throws; simultaneous picks; server hides picks until both submit; per-throw 8s timeout; throw history dots; full mock mode with staged opponent pick
- [x] **Word Scramble** — server picks from pool of 32 words, shuffles letters; first correct guess wins; wrong-guess counter broadcast to both; answer revealed on resolve; mock opponent solves at 30–75% of timer

### Codebase Quality
- [x] `CoinFlip.tsx` — fixed `opponent` object in `useEffect` deps (overlapping timeouts bug)
- [x] `memorymatch.ts` + `fastesttyper.ts` — `room.match?.onRoundDone` in delayed callbacks (crash-on-rematch bug)
- [x] `quickmaths.ts` — `broadcast_state` → `broadcastState` (naming consistency)

### Deploy configs (ready, not yet run)
- [x] `client/vercel.json`, `server/Dockerfile`, `server/fly.toml`, `server/.env.example`

---

## 📋 Upcoming — Week of March 23–30

> One week until April and deploy. Priority: game feel → new content → power features → launch hardening.

---

### 🎮 New Minigames

Each is a self-contained 3-file change (config entry + server module + client component).

- [x] **Rock Paper Scissors** — best-of-3 throws, simultaneous picks, server-hidden until both submit. ✅
- [x] **Word Scramble** — scrambled letter tiles, type the answer, wrong-guess counter shown to both. ✅

---

### ✨ Game Feel

These make individual moments feel punchy and satisfying.

- [x] **Animated score pop** — `anim-score-pop` keyframe; ScoreBoard uses `key` trick to replay on each point scored; uses `myColor`/`oppColor` from store.
- [x] **Player color assignment** — `myColor`/`oppColor` set at `MATCH_START` based on join order (first = blue, second = orange); stored in Zustand; used in ScoreBoard.
- [x] **Round transition count-in** — 1.9s overlay: emoji + name pops in, then 3→2→1 each with `anim-count-in` + `playTick()` sound; "1" plays a distinct higher tone; overlay blocks interaction.
- [x] **Timer bar color shift** — thresholds corrected to spec: green >33%, yellow 15–33%, red <15%.
- [x] **"How to play" tooltip** — `?` button fixed to right side of game banner; shows `cfg.description` in a dark popover; auto-dismisses after 4s; resets on game change.
- [x] **Click Speed ripple** — ripple spawns at exact click coordinates, expands via `@keyframes ripple`, cleans up after 550ms. Button receives `(clientX, clientY)` from both mouse and touch events.
- [x] **Coin flip 3D rotation** — replaced flat `scaleX` with `coin-flip-3d` keyframe using `perspective(220px) rotateY(360deg)`; removed stale inline `<style>` block.

---

### 🏠 Lobby & Room UX

- [ ] **Spectator count display** — show "👁 N watching" in both the lobby player slots area and in the match scoreboard. Server already tracks `room.spectators.length`; add it to `ROOM_JOINED` and `SPECTATE_JOINED` payloads and broadcast on spectator join/leave.

- [ ] **Rematch vote** — currently one player clicking Rematch resets the whole room. Change to a mutual vote: first click shows "Waiting for opponent…"; when both have clicked, the rematch fires. Prevents accidental rematches. Server holds two `rematchVotes: Set<string>`, resets on start.

- [ ] **Auto-reconnect from localStorage** — if a player closes and reopens the tab, check `localStorage` for a saved `{ roomId, playerId }` and auto-send `RECONNECT` without showing the nickname gate. Today you have to manually re-navigate.

- [ ] **Copy button "Copied!" flash** — the invite link copy button currently has no visual feedback. Show "✅ Copied!" for 1.5s then revert to the original label.

- [ ] **Room idle timeout warning** — if both players are in the lobby but neither has readied up for 50+ seconds, show a dismissible "Room expires in Xs" countdown. Room is destroyed at 60s server-side; this just makes it visible.

---

### 💅 Visual Design

- [ ] **Player animal avatars** — at room join, server assigns each player a random animal emoji from a pool of 12 (🐺 🦊 🐻 🐯 🦁 🐸 🐨 🦝 🦄 🐙 🦖 🐝). Shown next to names everywhere. Stored in `PlayerInfo`. Gives identity without auth.

- [ ] **Minigame category color on round banner** — the "ROUND N" banner background tints to the category color (reflex = orange, math = blue, luck = yellow, strategy = green, trivia = purple). One-line change using `CATEGORY_COLORS` from DevPanel.

- [ ] **Confetti on match win** — lightweight canvas confetti burst (no library — ~50 colored squares falling) when `MATCH_END` arrives and you won. Match-loss gets no confetti. Already mentioned in early design; confirm it's actually implemented and working.

---

### ⚙️ Power Features

- [ ] **Room settings** — before readying up, the room creator can configure: match length (Best of 3 / 5 / 7 / 9) and which game categories are enabled. Settings sent to server in a `SET_ROOM_CONFIG` message; server validates and stores on `Room`; `ROOM_CONFIG` broadcast to both players. Queue algorithm respects enabled categories.

- [ ] **Win streak tracker** — `localStorage`-persisted. Increments on match win, resets on loss. Show "🔥 X win streak" on the home page above the create/join card when streak ≥ 2. Zero server changes.

- [ ] **Match history on home page** — last 5 match results stored in `localStorage` as `{ opponentNickname, myScore, oppScore, date }`. Show as a compact table below the game gallery. Written on `MATCH_END`.

- [ ] **Keyboard shortcuts** — Space/Enter to ready up in lobby; Space to click in ClickSpeed; T/F keys in True or False; number row for NumberGuess; Escape to dismiss overlays. Implemented per-component, no global handler needed.

---

### 🔒 Launch Hardening

These are required before the April deploy.

- [ ] **Server health endpoint** — `GET /health` on the HTTP server returns `{ status: 'ok', rooms: activeRoomCount, uptime: process.uptime() }`. Needed for Fly.io health checks.

- [ ] **WS rate limiting** — track incoming message count per connection with a sliding 1s window; drop messages exceeding 60/s and send `ERROR { code: 'RATE_LIMITED' }`. Prevents click-spam exploits and DoS.

- [ ] **Startup env validation** — on server start, log a clear warning if `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` are missing (currently silent). Hard-fail in production (`NODE_ENV === 'production'`).

- [ ] **React error boundary** — wrap `<App />` in an `<ErrorBoundary>` that catches rendering crashes and shows a styled "Something went wrong — refresh to reconnect" screen instead of a blank page. In dev, log these errors somewhere so we can start building bug tickets off of it. Leave a comment that for prod we might want to still persist these error logs somewhere for creating bug tickets.

- [ ] **Nickname sanitization** — strip leading/trailing whitespace and collapse internal whitespace before storing. Currently a nickname of `"  "` (spaces only) could pass the length check. Server-side fix in `router.ts`.

- [ ] **Origin check on WS upgrade** — in production, reject WebSocket connections from origins other than the Vercel domain. One `upgrade` handler check in `server/index.ts`.

---

### 🚀 Deploy (not until April)

- [ ] Run `npm install` in `server/` to pull `@supabase/supabase-js`
- [ ] Create Supabase project → run `match_results` table migration
- [ ] Set Fly.io secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] Deploy server: `fly deploy` from `server/`
- [ ] Deploy client: Vercel import; set `VITE_WS_URL=wss://your-app.fly.dev`

---

## 🗑️ Removed
- **TicTacToe** — removed from game pool
