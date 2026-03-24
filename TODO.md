# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md and DESIGN.md before starting any task.
> **Current focus: UX polish and pre-deploy hardening. No new games until the roster is decided.**

---

## ✨ Polish — "wow, this is well made"

### Match End & Results

- [ ] **Round-by-round breakdown** — collapsible panel on the match-end screen listing each round: game emoji, winner, score delta. Makes the result feel earned instead of just a number.
- [ ] **Animated score counter** — final scores count up from 0 on the match-end screen (CSS counter or requestAnimationFrame). Simple but satisfying.
- [x] **Confetti burst on win** — custom CSS `confetti-fall` animation, 60 pieces, 4 shapes, brand colors, drift physics. `prefers-reduced-motion` guard added to `index.css`.
- [ ] **Win streak badge in lobby** — if a player has a streak ≥ 2, show `🔥 N` next to their name in the lobby player card. Server reads it from the `ROOM_JOINED` payload (client sends it as part of `SET_NICKNAME`).

### Lobby & Room

- [ ] **Copy link button with ✓ flash** — replace the current QR-only share with a `📋 Copy Link` button next to the QR code; shows `✓ Copied!` for 1.5s using `navigator.clipboard`. First thing friends need to join.
- [ ] **Room link as shareable URL** — `window.location.href` already contains the room code; make sure clicking the link in a browser takes you directly to `NicknameGate`. Currently it does — just needs a test + visible "share this URL" affordance.
- [ ] **"Waiting for opponent" animation** — replace static "Waiting for opponent…" text in lobby with a pulsing avatar placeholder + "Share this link to invite a friend". Reduces the blank-screen moment.
- [ ] **Game count badge** — show how many games are in the current rotation on the lobby config panel (e.g. "8 games · 3 rounds"). Helps players know what they're signing up for. Make sure games are removed from the pool after every round and the game count badge reacts accordingly.

### In-Match Feel

- [ ] **Game transition countdown** — brief 3-2-1 overlay between rounds (before the next game starts) so players know something is about to happen instead of a cold cut.
- [x] **"How to play" inline tooltip per game** — `?` button in orange game-label banner, shows `cfg.description`, auto-dismisses after 4s. Already solid.
- [ ] **Opponent emote name tag** — show the opponent's nickname above their emote bubble so it's clear who sent it. Allow spectators to send emotes as well, try to find spectator nickname from their localStorage data and if it's not available just name then "Spectator N" where N is their number.

---

## 📤 Social Sharing

### Core share flow (do this first)

- [ ] **Native share sheet + copy fallback** — on match-end screen, a `🔗 Share Result` button calls `navigator.share({ title, text, url })` on mobile; falls back to `clipboard.writeText` with ✓ flash on desktop.
  - Share text: `"I beat {opponent} {myScore}–{oppScore} in 1v1 ME 🏆 {url}"`  /  `"Close one — {opponent} beat me {oppScore}–{myScore} in 1v1 ME 😤 {url}"`
  - URL: `https://1v1me.vercel.app` (home, not the dead room)

### Platform deep links (add alongside native share)

- [ ] **Twitter / X** — `https://twitter.com/intent/tweet?text=...` pre-filled with result + URL; opens in new tab.
- [ ] **WhatsApp** — `https://wa.me/?text=...` with the same message; most effective on mobile.
- [ ] **Reddit** — `https://www.reddit.com/submit?url=...&title=...`; useful for posting in gaming subreddits.
- [ ] **Copy for Discord** — plain "copy message" button with a Discord-flavoured block:
  ```
  🎮 **1v1 ME** — I beat {opponent} {myScore}–{oppScore}
  👉 {url}
  ```
  Discord doesn't support deep links so copy is the right move.

### Result card image (do last — most impactful for Instagram/Stories)

- [ ] **Result card generator** — render an off-screen `<div>` with the match result (winner, score, top-3 games, streak) and capture it with `html2canvas` or `dom-to-image-more`; offer as a PNG download + include in `navigator.share` files array on supported browsers. This is what gets shared to Instagram Stories, Snapchat, etc.
  - Design: dark card, big score, player nicknames, game emojis, "1v1 ME" watermark.

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
