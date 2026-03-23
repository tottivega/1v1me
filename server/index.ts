import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { onConnection } from './src/sync/router'

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

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('1v1 ME server running\n')
})

const wss = new WebSocketServer({ server })

wss.on('connection', onConnection)

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`)
  console.log(`[Server] WebSocket ready at ws://localhost:${PORT}`)
})

server.on('error', (err) => {
  console.error('[Server] Error:', err)
})
