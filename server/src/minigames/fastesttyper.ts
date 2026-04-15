import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'
import { twoPlayers, randomWinner } from '../utils/gameUtils'

// ── Sentence pool (4–8 words, no punctuation) ─────────────────────────────────
const PHRASE_POOL = [
  // 4 words
  'cats sleep all day',
  'birds fly south fast',
  'big dogs love rain',
  'stars shine at night',
  'fish swim in rivers',
  'run like the wind',
  'time moves very fast',
  'jump over the fence',
  // 5 words
  'the sun sets every evening',
  'dogs bark at the moon',
  'never skip a rest day',
  'she reads books every morning',
  'slow and steady wins races',
  'the cold wind blows hard',
  'he scored the final point',
  'we drove all night long',
  'type fast and stay focused',
  'the fox ran very far',
  // 6 words
  'we played cards all night long',
  'the rain fell on the roof',
  'go left at the old bridge',
  'every day brings a new chance',
  'the team worked until very late',
  'hold your breath and jump in',
  'the big red barn burned down',
  'she found her keys right away',
  'the bus came just in time',
  'they ran across the open field',
  // 7 words
  'the quick brown fox jumps so high',
  'she typed faster than anyone else could',
  'the best things in life are free',
  'the small boat rocked in the waves',
  'we all laughed until our sides hurt',
  'the clock on the wall ticked loudly',
  // 8 words
  'the early bird always catches the fat worm',
  'she walked slowly across the old wooden bridge',
  'the bright stars filled the dark winter sky',
  'he ran as fast as his legs allowed',
  'the dog chased the ball across the yard',
  'every great journey begins with a single step',
]

const PHRASE_COUNT = 10
// Shortest phrase is ~18 chars; at 120 WPM (~10 chars/s) that's ~1.8s.
// We allow 0.8s minimum to be generous to fast typists while blocking
// instant-complete exploits (10 phrases would take at least 8s to cheat through).
const MIN_MS_PER_PHRASE = 800

function pickPhrases(): string[] {
  const pool = [...PHRASE_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, PHRASE_COUNT)
}

interface State {
  phrases: string[]
  completed: Record<string, number> // sentences fully completed per player
  charProgress: Record<string, number> // chars in current sentence per player
  lastCompleteTime: Record<string, number> // timestamp of each player's last sentence completion
  resolved: boolean
  winnerId: string | null
}

function broadcastState(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      phrases: state.phrases,
      completed: state.completed,
      charProgress: state.charProgress,
      resolved: state.resolved,
      winnerId: state.winnerId,
    },
  })
}

const fastesttyper: MinigameModule = {
  id: 'fastesttyper',

  start(room) {
    const phrases = pickPhrases()
    const state: State = {
      phrases,
      completed: Object.fromEntries(room.players.map((p) => [p.id, 0])),
      charProgress: Object.fromEntries(room.players.map((p) => [p.id, 0])),
      lastCompleteTime: {},
      resolved: false,
      winnerId: null,
    }
    room.match!.minigameState = state
    broadcastState(room, state)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'PROGRESS') return

    const state = room.match!.minigameState as State | null
    if (!state || state.resolved) return

    const newCompleted = Math.max(0, Math.min(PHRASE_COUNT, Math.floor(Number(input.completed))))
    // Cap chars at the length of the current sentence — prevents sending an
    // inflated value to win the charProgress tiebreak without actually typing.
    const phraseLen = state.phrases[newCompleted]?.length ?? 0
    const chars = Math.max(0, Math.min(phraseLen, Math.floor(Number(input.chars))))

    if (!Number.isFinite(newCompleted) || !Number.isFinite(chars)) return

    const prevCompleted = state.completed[playerId] ?? 0

    // Only allow forward progress — never let completed decrease
    if (newCompleted < prevCompleted) return
    // Only allow one phrase completion per message (blocks instant-win exploits)
    if (newCompleted > prevCompleted + 1) return
    // Enforce a minimum time between phrase completions
    if (newCompleted > prevCompleted) {
      const lastTime = state.lastCompleteTime[playerId] ?? 0
      if (Date.now() - lastTime < MIN_MS_PER_PHRASE) return
      state.lastCompleteTime[playerId] = Date.now()
    }

    state.completed[playerId] = newCompleted
    state.charProgress[playerId] = chars

    // Immediate win: all 10 sentences typed
    if (newCompleted >= PHRASE_COUNT) {
      state.resolved = true
      state.winnerId = playerId
      broadcastState(room, state)
      room.match!.onRoundDone?.({ winnerId: playerId, reason: 'completed' })
      return
    }

    broadcastState(room, state)
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    if (state.winnerId) return { winnerId: state.winnerId, reason: 'completed' }

    const [p1, p2] = twoPlayers(room)
    const c1 = state.completed[p1.id] ?? 0
    const c2 = state.completed[p2.id] ?? 0

    if (c1 !== c2) return { winnerId: c1 > c2 ? p1.id : p2.id, reason: 'timeout' }

    // Tiebreak 1: further into their next partial sentence
    const ch1 = state.charProgress[p1.id] ?? 0
    const ch2 = state.charProgress[p2.id] ?? 0
    if (ch1 !== ch2) return { winnerId: ch1 > ch2 ? p1.id : p2.id, reason: 'timeout' }

    // Tiebreak 2: who completed their last sentence first
    const t1 = state.lastCompleteTime[p1.id] ?? Infinity
    const t2 = state.lastCompleteTime[p2.id] ?? Infinity
    if (t1 !== t2) return { winnerId: t1 < t2 ? p1.id : p2.id, reason: 'timeout' }

    return { winnerId: randomWinner(p1, p2), reason: 'timeout' }
  },
}

export default fastesttyper
