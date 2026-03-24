import type { MinigameModule, Room, Player } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

const WORDS = [
  'planet',
  'bridge',
  'forest',
  'castle',
  'dragon',
  'silver',
  'bottle',
  'candle',
  'feather',
  'jungle',
  'marble',
  'pillow',
  'rocket',
  'saddle',
  'temple',
  'trophy',
  'turtle',
  'violin',
  'walrus',
  'zipper',
  'anchor',
  'blanket',
  'captain',
  'diamond',
  'eclipse',
  'flutter',
  'lantern',
  'penguin',
  'sparrow',
  'thunder',
  'whisper',
  'crystal',
]

interface State {
  answer: string // never sent to clients until resolved
  scrambled: string
  attempts: Record<string, number> // wrong guess count per player
  resolved: boolean
  winnerId: string | null
}

export function scramble(word: string): string {
  const letters = word.split('')
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[letters[i], letters[j]] = [letters[j]!, letters[i]!]
  }
  const result = letters.join('')
  // Re-scramble if we accidentally produced the original (rare but possible)
  return result === word ? scramble(word) : result
}

function broadcastState(room: Room, state: State, revealAnswer = false) {
  broadcast(room, 'GAME_UPDATE', {
    state: {
      scrambled: state.scrambled,
      attempts: state.attempts,
      resolved: state.resolved,
      winnerId: state.winnerId,
      ...(revealAnswer ? { answer: state.answer } : {}),
    },
  })
}

const wordscramble: MinigameModule = {
  id: 'wordscramble',

  start(room) {
    const answer = WORDS[Math.floor(Math.random() * WORDS.length)]!
    const state: State = {
      answer,
      scrambled: scramble(answer),
      attempts: {},
      resolved: false,
      winnerId: null,
    }
    for (const p of room.players) state.attempts[p.id] = 0
    room.match!.minigameState = state
    broadcastState(room, state)
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'GUESS_WORD') return

    const state = room.match!.minigameState as State
    if (state.resolved) return

    const raw = typeof input.word === 'string' ? input.word : ''
    if (raw.length > 50) return
    const guess = raw.toLowerCase().trim()

    if (guess !== state.answer) {
      state.attempts[playerId] = (state.attempts[playerId] ?? 0) + 1
      broadcastState(room, state) // opponent can see your attempt count climbing
      return
    }

    // Correct!
    state.resolved = true
    state.winnerId = playerId
    broadcastState(room, state, true) // reveal the answer
    setTimeout(() => room.match?.onRoundDone?.({ winnerId: playerId, reason: 'completed' }), 1500)
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    broadcastState(room, state, true) // reveal on timeout
    if (state.winnerId) return { winnerId: state.winnerId, reason: 'completed' }
    // Nobody guessed — random winner
    const [p1, p2] = room.players as [Player, Player]
    const winnerId = Math.random() < 0.5 ? p1.id : p2.id
    return { winnerId, reason: 'timeout' }
  },
}

export default wordscramble
