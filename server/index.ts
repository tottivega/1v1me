import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { onConnection } from './src/sync/router'
import { getRoomCount, getOpenRooms } from './src/rooms/roomStore'

// ── Env validation ────────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production'
const missingEnv: string[] = []
if (!process.env.SUPABASE_URL) missingEnv.push('SUPABASE_URL')
if (!process.env.SUPABASE_SERVICE_KEY) missingEnv.push('SUPABASE_SERVICE_KEY')
if (missingEnv.length > 0) {
  const msg = `[Server] Missing env vars: ${missingEnv.join(', ')} — match results will not be persisted`
  if (isProd) {
    console.error(msg)
    process.exit(1)
  } else {
    console.warn(msg)
  }
}

const PORT = Number(process.env.PORT) || 3001

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN // e.g. https://1v1me.vercel.app

// ── HTTP rate limiter (per-IP, sliding window) ─────────────────────────────
const HTTP_RATE_LIMIT = 30
const HTTP_RATE_WINDOW_MS = 10_000
const httpRateMap = new Map<string, { count: number; windowStart: number }>()

function isHttpRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = httpRateMap.get(ip)
  if (!entry || now - entry.windowStart >= HTTP_RATE_WINDOW_MS) {
    httpRateMap.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > HTTP_RATE_LIMIT
}

const server = createServer((req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown'
  if (isHttpRateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Too many requests' }))
    return
  }

  const url = req.url?.split('?')[0]

  if (url === '/health') {
    const body = JSON.stringify({ status: 'ok', rooms: getRoomCount(), uptime: process.uptime() })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
    return
  }

  if (url === '/rooms') {
    const cors = isProd && ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '*'
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': cors,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }
    const qs = new URLSearchParams(req.url?.split('?')[1] ?? '')
    const limit = Math.min(50, Math.max(1, parseInt(qs.get('limit') ?? '20', 10) || 20))
    const offset = Math.max(0, parseInt(qs.get('offset') ?? '0', 10) || 0)
    const body = JSON.stringify(getOpenRooms(limit, offset))
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': cors })
    res.end(body)
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('1v1 ME server running\n')
})

const wss = new WebSocketServer({ noServer: true })

// In production, enforce that upgrades come from the allowed origin.
server.on('upgrade', (req, socket, head) => {
  if (isProd && ALLOWED_ORIGIN) {
    const origin = req.headers['origin']
    if (origin !== ALLOWED_ORIGIN) {
      console.warn(`[WS] Rejected upgrade from origin: ${origin}`)
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
      socket.destroy()
      return
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

wss.on('connection', onConnection)

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`)
  console.log(`[Server] WebSocket ready at ws://localhost:${PORT}`)
})

server.on('error', (err) => {
  console.error('[Server] Error:', err)
})

// ── Graceful shutdown (SIGTERM from Fly.io on deploy/scale) ──────────────────
// Notify all connected clients, wait 3s for them to show a banner, then exit.
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully')
  const notice = JSON.stringify({ type: 'SERVER_RESTARTING', payload: {} })
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(notice)
  })
  // Stop accepting new connections
  server.close()
  wss.close()
  // Give clients 3s to show a reconnect banner before the process exits
  setTimeout(() => {
    console.log('[Server] Exiting after graceful drain')
    process.exit(0)
  }, 3000)
})
