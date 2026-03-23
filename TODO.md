# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md and DESIGN.md before starting any task.

---

## 💅 Visual Design

- [ ] **Player animal avatars** — server assigns a random animal emoji from a pool of 12 (🐺 🦊 🐻 🐯 🦁 🐸 🐨 🦝 🦄 🐙 🦖 🐝) on join. Stored in `PlayerInfo`, shown next to names everywhere. Gives identity without auth.

- [ ] **Minigame category color on round banner** — tint the "ROUND N" transition overlay background to the category color (reflex = orange, math = blue, luck = yellow, strategy = green, trivia = purple). One-line change using `CATEGORY_COLORS` already in RoomPage.

- [ ] **Confetti on match win** — canvas confetti burst when `MATCH_END` arrives and you won. `<Confetti />` component already exists in `RoomPage.tsx` — verify it actually renders and the `confetti-fall` keyframe is defined in `index.css`.

---

## ⚙️ Power Features

- [ ] **Room settings** — before readying up, creator can configure match length (Best of 3 / 5 / 7 / 9) and which game categories are enabled. New `SET_ROOM_CONFIG` client message; server stores config on `Room`; `ROOM_CONFIG` broadcast to both. Queue algorithm respects enabled categories.

- [ ] **Win streak tracker** — `localStorage`-persisted counter. Increments on match win, resets on loss. Show "🔥 X win streak" on home page above the create/join card when streak ≥ 2. Zero server changes needed.

- [ ] **Match history on home page** — last 5 results in `localStorage` as `{ opponentNickname, myScore, oppScore, date }`. Show as compact table below the game gallery. Written on `MATCH_END`.

- [ ] **Keyboard shortcuts** — Space/Enter to ready up in lobby; Space to click in ClickSpeed; Escape to dismiss overlays. Implement per-component, no global handler.

---

## 🔒 Launch Hardening

These are required before the April deploy.

- [ ] **Server health endpoint** — `GET /health` returns `{ status: 'ok', rooms: activeRoomCount, uptime: process.uptime() }`. Needed for Fly.io health checks.

- [ ] **WS rate limiting** — sliding 1s window per connection; drop messages exceeding 60/s and send `ERROR { code: 'RATE_LIMITED' }`. Prevents click-spam and DoS.

- [ ] **Startup env validation** — warn clearly if `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` are missing on startup. Hard-fail in production (`NODE_ENV === 'production'`).

- [ ] **React error boundary** — wrap `<App />` in `<ErrorBoundary>` that catches render crashes and shows a styled recovery screen. Log errors to console in dev; leave a comment for prod log persistence.

- [ ] **Nickname sanitization** — strip leading/trailing whitespace and collapse internal whitespace before storing. Server-side fix in `server/src/sync/router.ts` `SET_NICKNAME` handler.

- [ ] **Origin check on WS upgrade** — in production, reject WebSocket connections from origins other than the Vercel domain. One `upgrade` handler check in `server/index.ts`.

---

## 🧪 Tests

### Remaining

- [ ] **router integration tests** — simulate message sequences (join → ready → game input) on a real WS server instance
- [ ] **RoomPage smoke tests** — lobby renders with correct copy button, spectator count badge visible when count > 0

### Linters

- [ ] **ESLint** — add `eslint` + `@typescript-eslint/eslint-plugin` to both `client/` and `server/`; enable `no-unused-vars`, `no-explicit-any`, strict null checks config
- [ ] **Prettier** — single `.prettierrc` at root shared by both packages; add `format` script
- [ ] **lint-staged + husky** — run ESLint + Prettier on staged files before commit (hooks match RULES.md "block commit if failing")

---

## 🚀 Deploy (not until April)

- [ ] Run `npm install` in `server/` to pull `@supabase/supabase-js`
- [ ] Create Supabase project → run `match_results` table migration
- [ ] Set Fly.io secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] Deploy server: `fly deploy` from `server/`
- [ ] Deploy client: Vercel import; set `VITE_WS_URL=wss://your-app.fly.dev`
- [ ] Write production section in README.md
