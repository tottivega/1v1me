import type { Room, Player } from '../types'

/**
 * Extract both players from a room as a typed tuple.
 * Only call this after the room is confirmed to have 2 players (i.e. during a match).
 */
export function twoPlayers(room: Room): [Player, Player] {
  return room.players as [Player, Player]
}

/**
 * Pick a random winner between two players (coin-flip tie-break).
 */
export function randomWinner(p1: Player, p2: Player): string {
  return Math.random() < 0.5 ? p1.id : p2.id
}
