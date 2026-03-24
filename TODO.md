# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md and DESIGN.md before starting any task.
> **Current focus: UX polish and pre-deploy hardening. No new games until the roster is decided.**

---

## 🔒 Pre-deploy

- [ ] **Staging smoke test** — run through the full Fly.io + Vercel deploy checklist in a staging environment before April. Verify env vars, CORS config, WebSocket proxy, Supabase connection, and a full match end-to-end. Manual checklist item, no code.

---

## 🚀 Deploy (not until April)

- [ ] Run `npm install` in `server/` to pull `@supabase/supabase-js`
- [ ] Create Supabase project → run `match_results` table migration
- [ ] Set Fly.io secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] Set Sentry DSN: `VITE_SENTRY_DSN=https://...@sentry.io/...` in Vercel env vars
- [ ] Deploy server: `fly deploy` from `server/`
- [ ] Deploy client: Vercel import; set `VITE_WS_URL=wss://your-app.fly.dev`
- [ ] Write production section in README.md
