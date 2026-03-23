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

> TODO — see `server/fly.toml` (Fly.io) and `client/vercel.json` (Vercel) for deploy config. Full deploy instructions to be written once infrastructure is finalized.

---

## Adding a new minigame

See [ADDING_A_GAME.md](ADDING_A_GAME.md) for the step-by-step checklist.
