# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md and DESIGN.md before starting any task.
> **Current focus: UX polish and skeleton quality. No new games until the roster is decided.**

---

## 📱 Mobile Polish

- [ ] **Device-aware game filtering** — tag each game in `MINIGAME_CONFIGS` with a `platforms` field (`'all' | 'desktop-only' | 'mobile-only'`). Client detects mobile via `window.matchMedia('(pointer: coarse)')` and sends `isMobile: boolean` in the `JOIN` message. Server stores it on `Player`, and `shuffleQueue` excludes `desktop-only` and `mobile-only` games when appropiate. Fastest Typer is the primary candidate for `desktop-only`; others can be evaluated as the roster grows. This avoids gutting the game on mobile while keeping it great on desktop.

- [ ] **Touch target audit** — walk every minigame and check that all interactive elements are ≥ 44×44px on mobile. ClickSpeed ripple, RPS throw buttons, and Memory Match symbol taps are the most likely offenders. Fix any that fail.

- [ ] **Landscape lock warning** — on screens narrower than 380px in landscape, show a soft banner: "Rotate your phone for a better experience 📱". Dismiss on rotate. CSS media query + small React component, no libraries.

---

## 🎨 Visual Polish

- [x] **Player animal avatars** — server assigns a random animal emoji from a pool of 12 (🐺 🦊 🐻 🐯 🦁 🐸 🐨 🦝 🦄 🐙 🦖 🐝) on join. Stored in `PlayerInfo`, shown next to names everywhere. Gives identity without auth.

- [x] **Connected player pulse dot** — a small pulsing green dot next to each player's name in the lobby to show they're live. Turns grey when `connected: false`. Replaces the implicit "they're here" assumption with a visible signal.

- [x] **404 / room-not-found page** — navigating to `/room/FAKE-99` currently drops you into a broken lobby. Catch the `ROOM_NOT_FOUND` server error (already sent) and render a friendly "Room not found" screen with a back button. Same for `/spectate/:id`.

---

## 🔗 Sharing & Discovery

- [x] **QR code in lobby** — below the "Copy Invite Link" button, render a small QR code pointing to the room URL using a zero-dependency QR library (`qrcode` or `qr-creator`). Tap to enlarge. Dramatically improves mobile-to-mobile invites where copy-paste is painful.

- [x] **Open Graph meta tags** — add `<meta property="og:title">`, `og:description`, and `og:image` to `index.html` (or generated per-room via a simple `/og` endpoint). Makes shared links look good in iMessage, WhatsApp, and Discord previews.

---

## ⚡ Game Feel

- [x] **Round result lingers until both confirm** — currently the round-end overlay auto-dismisses on a server timer. Add a "Next Round →" button that each player must tap. Server waits for both `ROUND_READY` messages (with a 5s auto-advance fallback). Reduces the feeling of being rushed.

- [ ] **Spectator late-join game state** — spectators who join mid-round see a blank screen until `GAME_UPDATE` fires. Send a snapshot of `minigameState` in `SPECTATE_JOINED` (already there structurally) and make each minigame component render from it immediately on mount.

- [ ] **Disconnected opponent overlay** — when `PLAYER_DISCONNECTED` fires mid-match, show a full-screen pause overlay with the countdown timer (already tracked in store). Currently the timer ticks but nothing communicates the pause to the non-disconnected player.

---

## 🔧 Code Quality

- [ ] **Typed GAME_INPUT per minigame** — `handleInput` currently receives `input: unknown` and casts. Create a `MinigameInput` discriminated union in `shared/types.ts` (one variant per game), use it server-side for `handleInput` signatures and client-side for `sendInput` call sites. Eliminates all the `as { type: string; ... }` casts.

- [ ] **Integration tests for Color Word and Higher or Lower** — the 10-game roster now has 2 games with no integration-level coverage (only unit tests). Add a test file in `server/src/__tests__/minigames/` for each: start the game, send valid input, assert `onRoundDone` fires with the correct winner. Use `makeRoom` + `makeMatch` helpers.

- [ ] **roomStore isolation between tests** — `roomStore.test.ts` currently deletes rooms by known IDs in `beforeEach`. If a future test uses the same IDs it will silently leak. Refactor `roomStore` to accept an optional injected `Map` (or expose a `clearAll()` for test-only use via `import.meta.env.TEST`) so tests always start clean.

---

## 🔒 Launch Hardening

These are required before the April deploy.

- [ ] **Input length caps on all server handlers** — currently only nickname is capped (18 chars). Audit every `handleInput` path: WordScramble guess, FastestTyper text, and any future string inputs. Reject anything over a reasonable limit (e.g. 200 chars) before processing.

- [ ] **Rate-limit HTTP endpoints** — `GET /rooms` and `GET /health` have no rate limiting. Add a simple per-IP counter (sliding 10s window, max 30 requests) in the `createServer` callback before delegating to the route handlers. Prevents trivial scraping abuse.

---

## 🚀 Deploy (not until April)

- [ ] Run `npm install` in `server/` to pull `@supabase/supabase-js`
- [ ] Create Supabase project → run `match_results` table migration
- [ ] Set Fly.io secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] Deploy server: `fly deploy` from `server/`
- [ ] Deploy client: Vercel import; set `VITE_WS_URL=wss://your-app.fly.dev`
- [ ] Write production section in README.md
