/**
 * Router integration tests — spin up a real WS server, connect real clients,
 * and verify full message sequences round-trip through the router.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServer, type Server } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { onConnection } from '../sync/router'
import { DEFAULT_ROOM_CONFIG } from '@shared/types'

// ── Mock external IO only ─────────────────────────────────────────────────────
vi.mock('../db/index', () => ({ persistMatchResult: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../timer/timerController', () => ({
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPort(server: Server): number {
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('No port')
  return addr.port
}

/** Connect a WS client and collect all received messages into an array. */
function connectClient(port: number): Promise<{ ws: WebSocket; msgs: object[] }> {
  return new Promise((resolve, reject) => {
    const msgs: object[] = []
    const ws = new WebSocket(`ws://localhost:${port}`)
    ws.on('message', (raw) => msgs.push(JSON.parse(raw.toString())))
    ws.on('open', () => resolve({ ws, msgs }))
    ws.on('error', reject)
  })
}

type Msg = { type: string; payload: unknown }

/** Wait until msgs array contains a message matching type (and optional predicate). */
function waitForMsg(
  msgs: object[],
  type: string,
  predicate?: (m: Msg) => boolean,
  timeoutMs = 500
): Promise<Msg> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const check = () => {
      const found = (msgs as Msg[]).find((m) => m.type === type && (!predicate || predicate(m)))
      if (found) return resolve(found)
      if (Date.now() > deadline) return reject(new Error(`Timeout waiting for ${type}`))
      setTimeout(check, 10)
    }
    check()
  })
}

function send(ws: WebSocket, type: string, payload: object = {}, roomId = '', playerId = '') {
  ws.send(JSON.stringify({ type, roomId, playerId, payload }))
}

// ── Server lifecycle ──────────────────────────────────────────────────────────

let httpServer: Server
let wss: WebSocketServer

beforeEach(() => {
  // Fresh server per test — port 0 picks a random available port
  httpServer = createServer()
  wss = new WebSocketServer({ server: httpServer })
  wss.on('connection', onConnection)
  return new Promise<void>((resolve) => httpServer.listen(0, resolve))
})

afterEach(() => {
  // Close all clients then the server
  for (const client of wss.clients) client.terminate()
  return new Promise<void>((resolve) => {
    wss.close(() => httpServer.close(() => resolve()))
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SET_NICKNAME (join / create room)', () => {
  it('sends ROOM_JOINED with playerId and default config on join', async () => {
    const port = getPort(httpServer)
    const { ws, msgs } = await connectClient(port)

    send(ws, 'SET_NICKNAME', { nickname: 'Alice' }, 'room-1')

    const msg = await waitForMsg(msgs, 'ROOM_JOINED')
    const p = msg.payload as Record<string, unknown>
    expect(p.roomId).toBe('room-1')
    expect(typeof p.playerId).toBe('string')
    expect(p.config).toMatchObject(DEFAULT_ROOM_CONFIG)
  })

  it('sends ROOM_JOINED to both players when second joins', async () => {
    const port = getPort(httpServer)
    const { ws: ws1, msgs: msgs1 } = await connectClient(port)
    const { ws: ws2, msgs: msgs2 } = await connectClient(port)

    send(ws1, 'SET_NICKNAME', { nickname: 'Alice' }, 'room-2')
    await waitForMsg(msgs1, 'ROOM_JOINED')

    send(ws2, 'SET_NICKNAME', { nickname: 'Bob' }, 'room-2')
    // Wait for the ROOM_JOINED that carries 2 players (sent when second player joins)
    const twoPlayers = (m: Msg) => ((m.payload as { players: unknown[] }).players?.length ?? 0) >= 2
    const [j1, j2] = await Promise.all([
      waitForMsg(msgs1, 'ROOM_JOINED', twoPlayers),
      waitForMsg(msgs2, 'ROOM_JOINED', twoPlayers),
    ])

    expect((j1.payload as { players: unknown[] }).players).toHaveLength(2)
    expect((j2.payload as { players: unknown[] }).players).toHaveLength(2)
  })

  it('sends ERROR ROOM_FULL when a third player tries to join', async () => {
    const port = getPort(httpServer)
    const { ws: ws1 } = await connectClient(port)
    const { ws: ws2 } = await connectClient(port)
    const { ws: ws3, msgs: msgs3 } = await connectClient(port)

    send(ws1, 'SET_NICKNAME', { nickname: 'Alice' }, 'room-3')
    send(ws2, 'SET_NICKNAME', { nickname: 'Bob' }, 'room-3')
    send(ws3, 'SET_NICKNAME', { nickname: 'Charlie' }, 'room-3')

    const err = await waitForMsg(msgs3, 'ERROR')
    expect((err.payload as { code: string }).code).toBe('ROOM_FULL')
  })

  it('sends ERROR MISSING_FIELDS when nickname is empty', async () => {
    const port = getPort(httpServer)
    const { ws, msgs } = await connectClient(port)

    send(ws, 'SET_NICKNAME', { nickname: '   ' }, 'room-4')

    const err = await waitForMsg(msgs, 'ERROR')
    expect((err.payload as { code: string }).code).toBe('MISSING_FIELDS')
  })
})

describe('SET_ROOM_CONFIG', () => {
  it('broadcasts ROOM_CONFIG to both players when creator updates config', async () => {
    const port = getPort(httpServer)
    const { ws: ws1, msgs: msgs1 } = await connectClient(port)
    const { ws: ws2, msgs: msgs2 } = await connectClient(port)

    send(ws1, 'SET_NICKNAME', { nickname: 'Alice' }, 'cfg-room')
    await waitForMsg(msgs1, 'ROOM_JOINED')
    send(ws2, 'SET_NICKNAME', { nickname: 'Bob' }, 'cfg-room')
    await waitForMsg(msgs2, 'ROOM_JOINED')

    // Creator (ws1) changes bestOf to 3
    send(ws1, 'SET_ROOM_CONFIG', { bestOf: 3, enabledCategories: ['reflex', 'math'] }, 'cfg-room')

    const [c1, c2] = await Promise.all([
      waitForMsg(msgs1, 'ROOM_CONFIG'),
      waitForMsg(msgs2, 'ROOM_CONFIG'),
    ])
    expect((c1.payload as { config: unknown }).config).toMatchObject({
      bestOf: 3,
      enabledCategories: ['reflex', 'math'],
    })
    expect(c2.payload).toEqual(c1.payload)
  })

  it('silently ignores SET_ROOM_CONFIG from non-creator', async () => {
    const port = getPort(httpServer)
    const { ws: ws1, msgs: msgs1 } = await connectClient(port)
    const { ws: ws2, msgs: msgs2 } = await connectClient(port)

    send(ws1, 'SET_NICKNAME', { nickname: 'Alice' }, 'cfg-room-2')
    await waitForMsg(msgs1, 'ROOM_JOINED')
    send(ws2, 'SET_NICKNAME', { nickname: 'Bob' }, 'cfg-room-2')
    await waitForMsg(msgs2, 'ROOM_JOINED')

    // Non-creator (ws2) tries to change config
    send(ws2, 'SET_ROOM_CONFIG', { bestOf: 3, enabledCategories: ['luck'] }, 'cfg-room-2')

    // No ROOM_CONFIG should arrive for either player
    await new Promise((r) => setTimeout(r, 80))
    expect(msgs2.filter((m) => (m as { type: string }).type === 'ROOM_CONFIG')).toHaveLength(0)
  })
})

describe('SET_READY', () => {
  it('broadcasts PLAYER_READY with bothReady=false when only one player readies', async () => {
    const port = getPort(httpServer)
    const { ws: ws1, msgs: msgs1 } = await connectClient(port)
    const { ws: ws2 } = await connectClient(port)

    send(ws1, 'SET_NICKNAME', { nickname: 'Alice' }, 'ready-room')
    await waitForMsg(msgs1, 'ROOM_JOINED')
    send(ws2, 'SET_NICKNAME', { nickname: 'Bob' }, 'ready-room')
    await waitForMsg(msgs1, 'ROOM_JOINED')

    send(ws1, 'SET_READY', {}, 'ready-room')

    const pr = await waitForMsg(msgs1, 'PLAYER_READY')
    expect((pr.payload as { bothReady: boolean }).bothReady).toBe(false)
  })

  it('broadcasts PLAYER_READY with bothReady=true when both ready', async () => {
    const port = getPort(httpServer)
    const { ws: ws1, msgs: msgs1 } = await connectClient(port)
    const { ws: ws2, msgs: msgs2 } = await connectClient(port)

    send(ws1, 'SET_NICKNAME', { nickname: 'Alice' }, 'ready-room-2')
    await waitForMsg(msgs1, 'ROOM_JOINED')
    send(ws2, 'SET_NICKNAME', { nickname: 'Bob' }, 'ready-room-2')
    await waitForMsg(msgs2, 'ROOM_JOINED')

    send(ws1, 'SET_READY', {}, 'ready-room-2')
    send(ws2, 'SET_READY', {}, 'ready-room-2')

    // When both are ready, PLAYER_READY { bothReady: true } goes to both
    const bothReady = (m: Msg) => !!(m.payload as { bothReady: boolean }).bothReady
    const [pr1, pr2] = await Promise.all([
      waitForMsg(msgs1, 'PLAYER_READY', bothReady),
      waitForMsg(msgs2, 'PLAYER_READY', bothReady),
    ])
    expect((pr1.payload as { bothReady: boolean }).bothReady).toBe(true)
    expect((pr2.payload as { bothReady: boolean }).bothReady).toBe(true)
  })
})

describe('Unknown message type', () => {
  it('sends ERROR UNKNOWN_TYPE for unrecognised messages', async () => {
    const port = getPort(httpServer)
    const { ws, msgs } = await connectClient(port)

    send(ws, 'SET_NICKNAME', { nickname: 'Alice' }, 'err-room')
    await waitForMsg(msgs, 'ROOM_JOINED')

    send(ws, 'TOTALLY_BOGUS' as never, {}, 'err-room')

    const err = await waitForMsg(msgs, 'ERROR')
    expect((err.payload as { code: string }).code).toBe('UNKNOWN_TYPE')
  })
})

describe('Rate limiting', () => {
  it('sends ERROR RATE_LIMITED after exceeding 60 messages per second', async () => {
    const port = getPort(httpServer)
    const { ws, msgs } = await connectClient(port)

    // Flood immediately after open — all 65 land in the same 1s window.
    // First 60 pass, 61st triggers RATE_LIMITED.
    for (let i = 0; i < 65; i++) {
      ws.send(
        JSON.stringify({
          type: 'SET_NICKNAME',
          roomId: `flood-${i}`,
          playerId: '',
          payload: { nickname: 'X' },
        })
      )
    }

    const err = await waitForMsg(msgs, 'ERROR', undefined, 1000)
    expect((err.payload as { code: string }).code).toBe('RATE_LIMITED')
  })
})
