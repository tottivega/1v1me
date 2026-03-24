# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md and DESIGN.md before starting any task.
> **Current focus: UX polish and pre-deploy hardening. No new games until the roster is decided.**

---

## ✨ Polish — "wow, this is well made"

### Match End & Results

- [x] **Round-by-round breakdown** — panel on the match-end screen listing each round: game emoji, winner. Already built.
- [x] **Animated score counter** — final scores ease-out count up from 0 on mount via `requestAnimationFrame`.
- [x] **Confetti burst on win** — custom CSS `confetti-fall` animation, 60 pieces, 4 shapes, brand colors, drift physics. `prefers-reduced-motion` guard added to `index.css`.
- [x] **Win streak badge in lobby** — `🔥 N` badge shown next to nickname when streak ≥ 2; client sends streak in `SET_NICKNAME`, server stores it on `Player`, `toPlayerInfos` includes it in `PlayerInfo`, rendered in `PlayerSlot`.

### Lobby & Room

- [x] **Copy link button with ✓ flash** — `📋 Copy Invite Link` button already present; shows `✅ Copied!` for 1.5s.
- [x] **Room link as shareable URL** — direct URL visits land on `NicknameGate`; invite URL visible and copyable.
- [x] **"Waiting for opponent" animation** — pulsing text + `📋 Share this link to invite a friend` copy button shown when no opponent present.
- [x] **Game count badge** — `{N} games in pool · best of {X}` summary line at the bottom of `RoomSettings`; reacts to category filter changes.

### In-Match Feel

- [x] **Game transition countdown** — 3-2-1 → GO! overlay already built with `anim-count-in` and tick sounds.
- [x] **"How to play" inline tooltip per game** — `?` button in orange game-label banner, shows `cfg.description`, auto-dismisses after 4s. Already solid.
- [x] **Opponent emote name tag** — sender nickname shown above emote bubble; looks up `fromPlayerId` in `players[]`.
- [x] **Spectator emotes** — emote buttons added to `SpectateMatchView`; spectator nickname sent in SPECTATE payload (from localStorage); if nickname matches a player's (case-insensitive) it gets " (Impostor)" appended; server broadcasts `fromName` for spectators; RoomPage emote nametag falls back to `fromName`.

---

## 📤 Social Sharing

### Core share flow (do this first)

- [x] **Native share sheet + copy fallback** — on match-end screen, a `🔗 Share Result` button calls `navigator.share({ title, text, url })` on mobile; falls back to `clipboard.writeText` with ✓ flash on desktop. Three-tier: image share (mobile) → text-only share → clipboard copy. `VITE_APP_URL` env var controls the shared URL.

### Platform deep links (add alongside native share)

- [x] **Twitter / X** — `https://twitter.com/intent/tweet?text=...` pre-filled with result + URL; opens in new tab.
- [x] **WhatsApp** — `https://wa.me/?text=...` with the same message; most effective on mobile.
- [x] **Reddit** — `https://www.reddit.com/submit?url=...&title=...`; useful for posting in gaming subreddits.
- [x] **Copy for Discord** — "Discord" button copies markdown-bold block to clipboard; shows ✓ on success.

### Result card image (do last — most impactful for Instagram/Stories)

- [x] **Result card generator** — Canvas-drawn PNG: dark card (#18181b), accent bar (yellow/red), big score, nicknames, 🔥 streak badge, top-3 game emojis, per-round breakdown rows, "1v1 ME" watermark. Included in `navigator.share` files on mobile; clipboard-copy fallback on desktop.

### Open Graph / link preview

- [x] **OG meta tags on home** — `og:title`, `og:description`, `og:type`, `og:image`, `og:url`, `twitter:card` all in `index.html`. `og-image.svg` created at 1200×630 with brand design (dark card, pill tags, game emojis).

---

## 🔒 Pre-deploy

- [ ] **Staging smoke test** — deploy to staging (separate Fly app + Vercel preview), run through the full checklist below, and verify a complete match end-to-end before touching production.

---

## 🚀 Deploy  (NOT UNTIL APRIL)

### 1. Supabase

- [ ] Create a new Supabase project at supabase.com
- [ ] Run the following migration in the SQL editor:

```sql
create table match_results (
  id              bigint generated always as identity primary key,
  created_at      timestamptz default now(),
  room_id         text        not null,
  winner_nickname text        not null,
  loser_nickname  text        not null,
  winner_score    int         not null,
  loser_score     int         not null,
  ended_reason    text        not null  -- 'completed' | 'forfeit'
);
```

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
