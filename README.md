# 1v1 ME

> Browser-based 2-player minigame platform. No login. Share a link. Settle it.

---

## SETUP

### Prerequisites

- Node.js 18+
- npm

### 1. Install root dependencies

```bash
npm install
```

### 2. Install client dependencies

```bash
cd client && npm install
```

### 3. Install server dependencies

```bash
cd server && npm install
```

### 4. Run both together (from root)

```bash
npm run dev
```

This starts:
- **Client** at `http://localhost:5173` (Vite dev server)
- **Server** at `ws://localhost:3001` (Node.js WebSocket server)

### 5. Run individually

```bash
# Client only
cd client && npm run dev

# Server only
cd server && npm run dev
```

### Environment variables (server)

Copy `.env.example` and fill in Supabase credentials if you want match result persistence. Without them the server runs fine — results just won't be saved.

```bash
cp server/.env.example server/.env
```

---

## PRODUCTION DEPLOY

**Live:** https://1v1me-eta.vercel.app

### Deploying a new version

**Client (Vercel)** — auto-deploys on every push to `master`. Nothing extra needed.

```bash
git push
```

**Server (Fly.io)** — does NOT auto-deploy. Trigger it manually after pushing.

```bash
git push
fly deploy --config server/fly.toml
```

The deploy takes ~30 seconds. Connected players receive a `SERVER_RESTARTING` notice and see a reconnect banner.

**Rule of thumb:** if you only changed `client/`, pushing to GitHub is enough. If you touched anything under `server/` or `shared/`, run `fly deploy` too.

### Updating secrets

```bash
fly secrets set KEY="value" --config server/fly.toml
fly deploy --config server/fly.toml
```

### Checking server health / logs

```bash
curl https://1v1me-server.fly.dev/health
fly logs --config server/fly.toml
```

---

## Adding a new minigame

See [ADDING_A_GAME.md](ADDING_A_GAME.md) for the step-by-step checklist.
