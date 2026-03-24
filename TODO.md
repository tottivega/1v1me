# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md, DESIGN.md, and CLAUDE.md before starting any task.
> **Current focus: improve underlying systems and UX until we reach a state where we solely focus on minigame creation, polish and art style.**

---

## 🎮 UX & Systems

### Game Feel
- [x] **"You've played X times" on round transition** — below the game title on the count-in overlay, shows how many times this specific minigame has already appeared in the current match. Pure client-side: counts occurrences in `roundHistory`.
- [x] **Per-minigame ambient sounds** — each game plays a soft background loop/drone while active; distinct character per game (ticking for reflex, beep rhythm for math, drone pads for luck, etc.). Synth-only via Web Audio API, zero files. Low volume (`getVolume() * 0.25`), fades in/out, stops the moment the round ends.
- [ ] **Opponent activity indicator** — a subtle pulsing dot on the opponent's score panel when they're actively interacting (sending `GAME_INPUT`). Requires a new `OPPONENT_ACTIVE` server→client broadcast triggered by any `GAME_INPUT` from the other player. Auto-clears after 1.5s. Adds tension without leaking answers.
- [ ] **Custom avatar selection** — in the lobby `PlayerSlot`, clicking your own avatar opens a small picker of the 12 emoji options. Selection saved to `localStorage` (`1v1me_avatar`), sent in `SET_NICKNAME` payload as `avatar?`. Server uses it (with validation) instead of random assignment when provided.

### Room & Match Flow
- [x] **Game ban/veto system** — P1 configures 0–3 bans per player (default 0) in `RoomSettings`. When bans > 0 and both players ready, match enters a `banning` phase: server sends `BAN_PHASE_START` with the eligible pool; each player picks up to N games to ban (simultaneous, hidden); server removes the union of bans before shuffling the queue. Types: `banCount` on `RoomConfig`, `BAN_PHASE_START`, `SUBMIT_BANS`.
- [ ] **Rematch with config change** — on the match-end screen, show current Best-of + enabled categories inline (read-only for P2, editable for P1 before voting). Config changes broadcast via existing `SET_ROOM_CONFIG` flow. The "Rematch" button only sends `REMATCH` after optionally updating config.

### Notifications
- [x] **Toast notification queue** — replaced single `errorMessage` with `toasts: Toast[]` (`{ id, message, type: 'error' | 'info' | 'success' }`). Max 3 visible (FIFO), clickable to dismiss. Handles `SERVER_RESTARTING` as an info toast.

### Server Systems
- [x] **Graceful server shutdown** — `SIGTERM` handler broadcasts `SERVER_RESTARTING` to all open WebSocket clients, waits 3s for clients to show a reconnect banner, then exits. Client shows this as an info toast.
- [x] **Per-room WebSocket rate limit** — 120 msg/s limit across all players in a room (in addition to per-connection 60 msg/s). Tracked on `Room.roomMsgCount + Room.roomWindowStart`.
- [x] **`GET /rooms` pagination** — `?limit=N&offset=M` query params (default 20, max 50). Returns `{ rooms, total }`. `RoomsPage` shows Prev/Next controls when `total > 20`.
- [x] **Anonymous user ID persistence** — `1v1me_userId` UUID generated on first visit, stored in `localStorage`, sent in `SET_NICKNAME`. Server stores it on `Player` and writes `winner_user_id` / `loser_user_id` to Supabase. Enables lifetime stats without auth. See `server/migrations/`.

### Codebase Quality
- [ ] **Stale room cleanup audit** — add a server test that verifies a room is cleaned up when: (a) both players disconnect within the 15s reconnect window without reconnecting, AND (b) the host leaves before anyone joins. Currently only tested separately.
- [ ] **Playwright E2E tests** — add a `tests/` package with a single full-match E2E test: create room → join → play 3 rounds (bot inputs) → verify match-end screen. Run against a locally-started server. Add `npm run test:e2e` script.
- [ ] **Server-side game analytics** — add a `game_rounds` Supabase table (`match_id`, `minigame_id`, `winner_id`, `round_number`); populate it in `persistMatchResult`. Zero client change. Enables future balancing insights.

---

## 🔒 Pre-deploy

- [ ] **Staging smoke test** — deploy to staging (separate Fly app + Vercel preview), run through the full checklist below, and verify a complete match end-to-end before touching production.

---

## 🚀 Deploy  (NOT UNTIL APRIL)

### 1. Supabase

- [ ] Create a new Supabase project at supabase.com
- [ ] Run the migration in the SQL editor — see `server/migrations/001_initial_schema.sql`

- [ ] Copy **Project URL** and **service_role key** from Settings → API (not the anon key — the service key)

---

### 2. Server — Fly.io

- [ ] Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
- [ ] `fly auth login`
- [ ] From the repo root: `fly launch --config server/fly.toml` (first time only; skips on redeploy)
- [ ] Set secrets (replaces `.env` in production):

```bash
fly secrets set \
  SUPABASE_URL="https://your-project-id.supabase.co" \
  SUPABASE_SERVICE_KEY="your-service-role-key" \
  ALLOWED_ORIGIN="https://your-app.vercel.app" \
  --config server/fly.toml
```

> `ALLOWED_ORIGIN` must match your Vercel deployment URL exactly (no trailing slash).
> The server rejects WebSocket upgrades and CORS requests from any other origin in production.

- [ ] Deploy: `fly deploy --config server/fly.toml` (runs the esbuild Dockerfile — ~30s)
- [ ] Confirm it's up: `curl https://your-app.fly.dev/health`
  - Expected: `{"status":"ok","rooms":0,"uptime":...}`
- [ ] Note your server URL: `wss://your-app.fly.dev`

---

### 3. Client — Vercel

- [ ] Push to GitHub (if not already)
- [ ] Import project at vercel.com → select the repo → set **Root Directory** to `client/`
- [ ] Set environment variables in Vercel dashboard (or via `vercel env add`):

| Variable | Value |
|---|---|
| `VITE_WS_URL` | `wss://your-app.fly.dev` |
| `VITE_SENTRY_DSN` | `https://...@sentry.io/...` (optional — skip to disable Sentry) |

- [ ] Deploy. Vercel auto-detects Vite; no build command override needed.
- [ ] Note your client URL (e.g. `https://1v1me.vercel.app`) — use it as `ALLOWED_ORIGIN` above

---

### 4. Post-deploy smoke test

- [ ] Open `https://your-app.vercel.app` in two browser tabs
- [ ] Create a room in tab 1, join in tab 2
- [ ] Play a full match to completion — verify score persists (check Supabase `match_results` table)
- [ ] Open `/spectate/<roomCode>` in a third tab — verify live spectator view works
- [ ] Disconnect one player mid-match — verify reconnect countdown appears
- [ ] Check Fly logs: `fly logs --config server/fly.toml`
- [ ] Check Sentry dashboard for any captured errors (if DSN set)

---

### 5. After launch

- [ ] Write production section in `README.md` (live URL, how to report bugs)
- [ ] Set up Fly.io uptime monitoring (free tier: `fly checks list`)
