# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md, DESIGN.md, and CLAUDE.md before starting any task.
> **Current focus: minigame creation, polish and art style.**

---

## 🎮 UX / Polish

- [ ] **About modal** — Add a `?` icon button next to the volume slider that opens a modal titled "About 1v1 ME". Body: `TODO: ADD` for now. Style it consistently with the rest of the UI (`.card`, border, shadow). The modal should be dismissible via backdrop click or a close button.

- [ ] **Streamer / spectator safety** — Design and implement limits for the streamer use case (streamers playing 1v1 ME live with chat watching). Current state: spectator count is unbounded (`room.spectators.push(ws)` with no cap), and spectator emotes are forwarded directly to players with no rate limit. Required changes:
  - **Hard cap**: reject `SPECTATE` joins above a per-room maximum (suggested: 50). Send `ERROR: SPECTATOR_LIMIT_REACHED` to the rejected connection and close it.
  - **Emote rate limit**: allow at most 1 emote per spectator per 5 seconds server-side. Silently drop excess.
  - **Verify game update frequency**: `GAME_UPDATE` is already event-driven (not polled), but confirm no game broadcasts more than ~5 updates/second — each update fans out to all spectators.
  - **Document the scale ceiling**: a single Fly.io VM can comfortably handle ~50 spectators per room across multiple concurrent rooms. Beyond that, a fan-out proxy layer (Cloudflare DO, Redis pub-sub) would be needed. Note this in `ARCHITECTURE.md`.

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
