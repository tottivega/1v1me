# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md, DESIGN.md, and CLAUDE.md before starting any task.
> **Current focus: minigame creation, polish and art style.**

---

## 🎮 UX / Polish

- [ ] **Fill in About modal** — The modal shell exists (`AboutModal.tsx`) with a `TODO: ADD` placeholder. Write the actual copy and design the layout when ready.

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
