import WebSocket from 'ws'

type Msg = { type: string; payload: Record<string, unknown> }

/**
 * A raw WebSocket bot that acts as the second player in E2E tests.
 * Mirrors the message format used in router.integration.test.ts.
 */
export class BotPlayer {
  private ws: WebSocket
  private msgs: Msg[] = []
  public playerId = ''
  private roomId: string

  constructor(serverUrl: string, roomId: string) {
    this.roomId = roomId
    this.ws = new WebSocket(serverUrl)
    this.ws.on('message', (raw: { toString(): string }) => {
      this.msgs.push(JSON.parse(raw.toString()) as Msg)
    })
  }

  /** Connect to the server, join the given room, and store the assigned playerId. */
  async join(nickname: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.ws.on('open', resolve)
      this.ws.on('error', reject)
    })
    // roomId goes in the top-level field, not inside payload
    this._rawSend('SET_NICKNAME', { nickname, isMobile: false, streak: 0 }, this.roomId, '')
    const msg = await this.waitFor('ROOM_JOINED')
    this.playerId = msg.payload.playerId as string
  }

  private _rawSend(type: string, payload: object, roomId: string, playerId: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ type, roomId, playerId, payload }))
  }

  /** Send a message as this player. */
  send(type: string, payload: object = {}): void {
    this._rawSend(type, payload, this.roomId, this.playerId)
  }

  /**
   * Wait until a message of the given type appears in the receive buffer.
   * Consumes (removes) the matched message so it isn't seen by later calls.
   */
  waitFor(type: string, timeoutMs = 10_000): Promise<Msg> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs
      const check = () => {
        const idx = this.msgs.findIndex((m) => m.type === type)
        if (idx !== -1) {
          const [msg] = this.msgs.splice(idx, 1)
          return resolve(msg!)
        }
        if (Date.now() > deadline) return reject(new Error(`Timeout waiting for ${type}`))
        setTimeout(check, 20)
      }
      check()
    })
  }

  /**
   * Wait for the first message matching any of the given types.
   * Used to handle "ROUND_START or MATCH_END" ambiguity.
   */
  waitForEither(types: string[], timeoutMs = 40_000): Promise<Msg> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs
      const check = () => {
        const idx = this.msgs.findIndex((m) => types.includes(m.type))
        if (idx !== -1) {
          const [msg] = this.msgs.splice(idx, 1)
          return resolve(msg!)
        }
        if (Date.now() > deadline)
          return reject(new Error(`Timeout waiting for ${types.join(' | ')}`))
        setTimeout(check, 20)
      }
      check()
    })
  }

  /**
   * Wait for a GAME_UPDATE whose `state` satisfies the predicate.
   * Consumes the matched message.
   */
  waitForGameUpdate(
    predicate: (state: Record<string, unknown>) => boolean,
    timeoutMs = 10_000
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs
      const check = () => {
        const idx = this.msgs.findIndex((m) => {
          if (m.type !== 'GAME_UPDATE') return false
          const state = (m.payload as { state: Record<string, unknown> }).state
          return predicate(state)
        })
        if (idx !== -1) {
          const msg = this.msgs.splice(idx, 1)[0]!
          return resolve((msg.payload as { state: Record<string, unknown> }).state)
        }
        if (Date.now() > deadline) return reject(new Error('Timeout waiting for GAME_UPDATE'))
        setTimeout(check, 20)
      }
      check()
    })
  }

  disconnect(): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.close()
  }
}
