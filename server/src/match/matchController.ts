import { v4 as uuidv4 } from 'uuid'
import type { Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { MINIGAME_CONFIGS } from '@shared/types'
import { broadcast, toPlayerInfos } from '../sync/broadcast'
import { startTimer, stopTimer } from '../timer/timerController'
import { getMinigame, shuffleQueue } from '../minigames/index'
import { persistMatchResult } from '../db/index'

const ROUND_TRANSITION_MS = 2500 // delay between rounds

export function startMatch(room: Room): void {
  const [p1, p2] = room.players
  const matchId = uuidv4()

  const { bestOf, enabledCategories } = room.config
  room.match = {
    matchId,
    scores: { [p1.id]: 0, [p2.id]: 0 },
    minigameQueue: shuffleQueue(bestOf, enabledCategories),
    currentRound: 0,
    currentMinigame: null,
    minigameState: null,
    roundHistory: [],
    tickInterval: null,
    remainingMs: 0,
    timeoutMs: 0,
    paused: false,
    roundResolved: false,
    onRoundDone: null,
  }

  room.status = 'round_start'
  broadcast(room, 'MATCH_START', { matchId, players: toPlayerInfos(room.players) })

  setTimeout(() => startRound(room), 1500)
}

function startRound(room: Room): void {
  if (!room.match) return

  room.match.currentRound++
  room.match.roundResolved = false

  const minigameId = room.match.minigameQueue[room.match.currentRound - 1]
  room.match.currentMinigame = minigameId

  const module = getMinigame(minigameId)
  const { timeoutMs } = MINIGAME_CONFIGS[minigameId]
  room.match.timeoutMs = timeoutMs
  room.match.remainingMs = timeoutMs
  room.match.minigameState = null

  room.status = 'playing'
  broadcast(room, 'ROUND_START', {
    round: room.match.currentRound,
    minigameId,
    timeoutMs,
  })

  // Give each module the callback to call when the round is done
  room.match.onRoundDone = (result) => resolveRound(room, result)

  module.start(room)

  // Start the main countdown timer only for modules that don't self-resolve
  if (timeoutMs > 0) {
    startTimer(room, () => {
      if (room.match && !room.match.roundResolved) {
        resolveRound(room, module.getResult(room))
      }
    })
  }
}

export function resolveRound(room: Room, result: MinigameResult): void {
  if (!room.match || room.match.roundResolved) return
  room.match.roundResolved = true

  stopTimer(room)

  // Update scores
  if (result.winnerId) {
    room.match.scores[result.winnerId] = (room.match.scores[result.winnerId] ?? 0) + 1
  }

  // Record this round in history
  room.match.roundHistory.push({
    round: room.match.currentRound,
    minigameId: room.match.currentMinigame!,
    winnerId: result.winnerId,
  })

  room.status = 'round_end'
  broadcast(room, 'ROUND_END', {
    winnerId: result.winnerId,
    scores: room.match.scores,
    reason: result.reason,
  })

  const { bestOf } = room.config
  const winsNeeded = Math.ceil(bestOf / 2)

  // First to winsNeeded wins the match
  const matchWinner = room.players.find((p) => (room.match!.scores[p.id] ?? 0) >= winsNeeded)

  if (matchWinner) {
    setTimeout(() => endMatch(room, matchWinner.id, 'completed'), ROUND_TRANSITION_MS)
  } else if (room.match.currentRound >= bestOf) {
    // All rounds played — whoever has more points wins
    const [p1, p2] = room.players
    const s1 = room.match.scores[p1.id] ?? 0
    const s2 = room.match.scores[p2.id] ?? 0
    const winnerId = s1 >= s2 ? p1.id : p2.id
    setTimeout(() => endMatch(room, winnerId, 'completed'), ROUND_TRANSITION_MS)
  } else {
    setTimeout(() => startRound(room), ROUND_TRANSITION_MS)
  }
}

function endMatch(room: Room, winnerId: string, reason: 'completed' | 'forfeit'): void {
  if (!room.match) return

  room.status = 'match_end'
  broadcast(room, 'MATCH_END', {
    winnerId,
    scores: room.match.scores,
    roundHistory: room.match.roundHistory,
  })

  const winner = room.players.find((p) => p.id === winnerId)
  const loser = room.players.find((p) => p.id !== winnerId)

  if (winner && loser) {
    persistMatchResult({
      roomId: room.roomId,
      winnerNickname: winner.nickname,
      loserNickname: loser.nickname,
      winnerScore: room.match.scores[winner.id] ?? 0,
      loserScore: room.match.scores[loser.id] ?? 0,
      endedReason: reason,
    }).catch((err) => console.error('[DB] Persist error:', err))
  }
}

export function forfeitMatch(room: Room, forfeitedPlayerId: string): void {
  if (!room.match) return

  stopTimer(room)

  const winnerId = room.players.find((p) => p.id !== forfeitedPlayerId)?.id
  if (!winnerId) return

  broadcast(room, 'FORFEIT', { forfeitedPlayerId, winnerId })
  endMatch(room, winnerId, 'forfeit')
}

export function handleGameInput(room: Room, playerId: string, input: unknown): void {
  if (!room.match || room.match.roundResolved || !room.match.currentMinigame) return

  const module = getMinigame(room.match.currentMinigame)
  module.handleInput(room, playerId, input)
}
