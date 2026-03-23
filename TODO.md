# TODO.md — 1v1 ME

> What's next. One task = one branch = one commit. Check PROGRESS.md for what's already done.
> Read ARCHITECTURE.md and DESIGN.md before starting any task.

---

## 💅 Visual Design

- [ ] **Player animal avatars** — server assigns a random animal emoji from a pool of 12 (🐺 🦊 🐻 🐯 🦁 🐸 🐨 🦝 🦄 🐙 🦖 🐝) on join. Stored in `PlayerInfo`, shown next to names everywhere. Gives identity without auth.

---

## ⚙️ Power Features

- [ ] **Keyboard shortcuts** — Space/Enter to ready up in lobby; Space to click in ClickSpeed; Escape to dismiss overlays. Implement per-component, no global handler.

---

## 🔒 Launch Hardening

These are required before the April deploy.

---

## 🚀 Deploy (not until April)

- [ ] Run `npm install` in `server/` to pull `@supabase/supabase-js`
- [ ] Create Supabase project → run `match_results` table migration
- [ ] Set Fly.io secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] Deploy server: `fly deploy` from `server/`
- [ ] Deploy client: Vercel import; set `VITE_WS_URL=wss://your-app.fly.dev`
- [ ] Write production section in README.md
