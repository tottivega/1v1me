import { v4 as uuidv4 } from 'uuid'
import type { Room } from '../types'
import type { MinigameInput, MinigameResult, MinigameId } from '@shared/types'
import { MINIGAME_CONFIGS } from '@shared/types'
import { broadcast, toPlayerInfos } from '../sync/broadcast'
import { startTimer, stopTimer } from '../timer/timerController'
import { getMinigame, shuffleQueue } from '../minigames/index'
import { twoPlayers, randomWinner } from '../utils/gameUtils'
import { persistMatchResult, persistRoundResult } from '../db/index'
import { deleteRoom } from '../rooms/roomStore'

const ROUND_READY_TIMEOUT_MS = 5000 // auto-advance if a player doesn't confirm
const DRAFT_PHASE_TIMEOUT_MS = 30_000 // auto-submit if a player goes idle during draft
const POST_MATCH_IDLE_MS = 2 * 60_000 // clean up a finished room after 2 min of inactivity
const COUNT_IN_MS = 2500 // must be >= client count-in overlay duration (2300ms)

function platformExcludes(room: Room) {
  const anyMobile = room.players.some((p) => p.isMobile)
  const anyDesktop = room.players.some((p) => !p.isMobile)
  return [
    ...(anyMobile ? (['desktop-only'] as const) : []),
    ...(anyDesktop ? (['mobile-only'] as const) : []),
  ]
}

/** Build the eligible pool of game ids (same filtering as shuffleQueue uses). */
function buildPool(room: Room): MinigameId[] {
  const { enabledCategories } = room.config
  const excludePlatforms = platformExcludes(room)
  let ids = Object.keys(MINIGAME_CONFIGS) as MinigameId[]
  if (enabledCategories.length > 0) {
    const f = ids.filter((id) => enabledCategories.includes(MINIGAME_CONFIGS[id].category))
    if (f.length > 0) ids = f
  }
  if (excludePlatforms.length > 0) {
    const f = ids.filter(
      (id) => !(excludePlatforms as string[]).includes(MINIGAME_CONFIGS[id].platforms)
    )
    if (f.length > 0) ids = f
  }
  return ids
}

export function startMatch(room: Room): void {
  const [p1, p2] = twoPlayers(room)
  const matchId = uuidv4()

  // Initialise match state — queue is filled after ban phase (or immediately)
  room.match = {
    matchId,
    scores: { [p1.id]: 0, [p2.id]: 0 },
    minigameQueue: [],
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
    roundReadyVotes: new Set(),
    roundReadyTimer: null,
    getSafeState: null,
  }

  const { draftMode, draftCount } = room.config
  if (draftCount > 0) {
    room.status = draftMode === 'pick' ? 'picking' : 'banning'
    room.draftVotes = {}
    const pool = buildPool(room)
    broadcast(room, 'DRAFT_PHASE_START', { pool, draftCount })

    room.draftPhaseTimer = setTimeout(() => {
      room.draftPhaseTimer = null
      if (room.status !== 'banning' && room.status !== 'picking') return
      if (!room.match || room.players.length < 2) return
      for (const p of room.players) {
        if (!(p.id in room.draftVotes)) room.draftVotes[p.id] = []
      }
      launchMatch(room, resolveDraft(room))
    }, DRAFT_PHASE_TIMEOUT_MS)
  } else {
    launchMatch(room, [])
  }
}

/** Converts draftVotes into a bannedIds list, respecting the current draftMode. */
function resolveDraft(room: Room): MinigameId[] {
  const votes = Object.values(room.draftVotes).flat()
  const unique = Array.from(new Set(votes)) as MinigameId[]
  if (room.config.draftMode === 'pick') {
    // Pick mode: banned = everything nobody picked
    const pool = buildPool(room)
    return unique.length > 0 ? pool.filter((id) => !unique.includes(id)) : []
  }
  // Ban mode: banned = union of all bans
  return unique
}

function launchMatch(room: Room, bannedIds: MinigameId[]): void {
  if (!room.match) return
  if (room.draftPhaseTimer) {
    clearTimeout(room.draftPhaseTimer)
    room.draftPhaseTimer = null
  }
  const { bestOf, enabledCategories } = room.config
  const excludePlatforms = platformExcludes(room)
  room.match.minigameQueue = shuffleQueue(bestOf, enabledCategories, excludePlatforms, bannedIds)

  room.status = 'round_start'
  broadcast(room, 'MATCH_START', {
    matchId: room.match.matchId,
    players: toPlayerInfos(room.players),
  })
  setTimeout(() => startRound(room), 1500)
}

export function handleDraftSubmit(room: Room, playerId: string, gameIds: MinigameId[]): void {
  if (room.status !== 'banning' && room.status !== 'picking') return
  if (!room.match) return

  const validIds = (Object.keys(MINIGAME_CONFIGS) as MinigameId[]).filter((id) =>
    gameIds.includes(id)
  )
  room.draftVotes[playerId] = validIds.slice(0, room.config.draftCount)

  const allSubmitted = room.players.every((p) => p.id in room.draftVotes)
  if (!allSubmitted || room.players.length < 2) return

  launchMatch(room, resolveDraft(room))
}

function startRound(room: Room): void {
  if (!room.match) return

  room.match.currentRound++
  room.match.roundResolved = false

  const minigameId = room.match.minigameQueue[room.match.currentRound - 1]!
  room.match.currentMinigame = minigameId

  const module = getMinigame(minigameId)
  const { timeoutMs } = MINIGAME_CONFIGS[minigameId]
  room.match.timeoutMs = timeoutMs
  room.match.remainingMs = timeoutMs
  room.match.minigameState = null
  room.match.getSafeState = module.getSafeState ? (r) => module.getSafeState!(r) : null

  room.status = 'playing'
  broadcast(room, 'ROUND_START', {
    round: room.match.currentRound,
    minigameId,
    timeoutMs,
  })

  // Delay game start until the client count-in overlay has finished (2300ms).
  // Without this, self-resolving games (coin flip, reaction test) can resolve
  // while the overlay is still blocking the player.
  setTimeout(() => {
    if (!room.match || room.match.roundResolved) return

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
  }, COUNT_IN_MS)
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
  const roundRecord = {
    round: room.match.currentRound,
    minigameId: room.match.currentMinigame!,
    winnerId: result.winnerId,
  }
  room.match.roundHistory.push(roundRecord)

  persistRoundResult({
    matchId: room.match.matchId,
    roundNumber: roundRecord.round,
    minigameId: roundRecord.minigameId,
    winnerId: roundRecord.winnerId,
  }).catch((err) => console.error('[DB] Round persist error:', err))

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
    // Match over — no confirm needed, just a short visual pause
    setTimeout(() => endMatch(room, matchWinner.id, 'completed'), 2500)
  } else if (room.match.currentRound >= bestOf) {
    const [p1, p2] = twoPlayers(room)
    const s1 = room.match.scores[p1.id] ?? 0
    const s2 = room.match.scores[p2.id] ?? 0
    const winnerId = s1 > s2 ? p1.id : s2 > s1 ? p2.id : randomWinner(p1, p2)
    setTimeout(() => endMatch(room, winnerId, 'completed'), 2500)
  } else {
    // Wait for both players to confirm before starting next round
    room.match.roundReadyVotes = new Set()
    room.match.roundReadyTimer = setTimeout(() => {
      if (!room.match || room.status !== 'round_end') return
      // Don't auto-advance while a player is in the reconnect window — their
      // pauseTimer call would be undone by startTimer and the game would tick
      // against an absent player. The forfeit timer handles the no-show case.
      if (room.players.some((p) => !p.connected)) return
      startRound(room)
    }, ROUND_READY_TIMEOUT_MS)
  }
}

export function handleRoundReady(room: Room, playerId: string): void {
  if (!room.match || room.status !== 'round_end') return

  // Guard: if the match is already decided (endMatch scheduled), ignore late votes.
  // Without this, stale votes from the previous round can trigger a phantom round.
  const winsNeeded = Math.ceil(room.config.bestOf / 2)
  const matchAlreadyWon =
    room.players.some((p) => (room.match!.scores[p.id] ?? 0) >= winsNeeded) ||
    room.match.currentRound >= room.config.bestOf
  if (matchAlreadyWon) return

  room.match.roundReadyVotes.add(playerId)
  if (room.players.every((p) => room.match!.roundReadyVotes.has(p.id))) {
    // Don't start the round while a player is still in their reconnect window — the
    // timer would tick against an absent player. The forfeit timer handles the no-show.
    if (room.players.some((p) => !p.connected)) return
    if (room.match.roundReadyTimer) clearTimeout(room.match.roundReadyTimer)
    room.match.roundReadyTimer = null
    startRound(room)
  }
}

/** Cancel any pending module-level timers for the active minigame. */
function cleanupCurrentMinigame(room: Room): void {
  if (!room.match?.currentMinigame) return
  getMinigame(room.match.currentMinigame).cleanup?.(room)
}

function endMatch(room: Room, winnerId: string, reason: 'completed' | 'forfeit'): void {
  if (!room.match) return

  // Guard against stale minigame timers firing resolveRound after the match is over:
  // null out the callback and mark the round as resolved so both paths are blocked.
  room.match.onRoundDone = null
  room.match.roundResolved = true
  cleanupCurrentMinigame(room)

  room.status = 'match_end'

  // Arm a post-match idle cleanup so rooms don't linger if players close the browser
  // without rematching. doRematch cancels this via touch() if they vote to replay.
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => {
    console.log(`[Room] Post-match cleanup for room ${room.roomId}`)
    deleteRoom(room.roomId)
  }, POST_MATCH_IDLE_MS)

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
      winnerUserId: winner.userId,
      loserUserId: loser.userId,
    }).catch((err) => console.error('[DB] Persist error:', err))
  }
}

export function forfeitMatch(room: Room, forfeitedPlayerId: string): void {
  if (!room.match || room.status === 'match_end') return

  stopTimer(room)

  const winnerId = room.players.find((p) => p.id !== forfeitedPlayerId)?.id
  if (!winnerId) return

  broadcast(room, 'FORFEIT', { forfeitedPlayerId, winnerId })
  endMatch(room, winnerId, 'forfeit')
}

export function handleGameInput(room: Room, playerId: string, input: unknown): void {
  if (!room.match || room.match.roundResolved || !room.match.currentMinigame) return
  if (
    typeof input !== 'object' ||
    input === null ||
    typeof (input as Record<string, unknown>).type !== 'string'
  )
    return

  const module = getMinigame(room.match.currentMinigame)
  module.handleInput(room, playerId, input as MinigameInput)
}
