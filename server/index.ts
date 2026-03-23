import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { onConnection } from './src/sync/router'

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
