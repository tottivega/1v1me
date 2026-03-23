import { WebSocket } from 'ws'
import type { ServerMessageType } from '@shared/types'
import type { Room, Player } from '../types'

export function send(ws: WebSocket, type: ServerMessageType, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }))
  }
}

export function sendToPlayer(player: Player, type: ServerMessageType, payload: unknown): void {
  send(player.ws, type, payload)
}

export function broadcast(room: Room, type: ServerMessageType, payload: unknown): void {
  for (const player of room.players) {
    if (player.connected) send(player.ws, type, payload)
  }
  for (const ws of room.spectators) {
    send(ws, type, payload)
  }
}

export function broadcastAll(room: Room, type: ServerMessageType, payload: unknown): void {
  for (const player of room.players) {
    send(player.ws, type, payload)
  }
  for (const ws of room.spectators) {
    send(ws, type, payload)
  }
}

export function toPlayerInfos(players: Player[]) {
  return players.map(p => ({
    id: p.id,
    nickname: p.nickname,
    ready: p.ready,
    connected: p.connected,
  }))
}
