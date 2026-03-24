import type { MinigameModule, Player } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

const PHRASES = [
  'the quick brown fox',
  'pack my box with five dozen liquor jugs',
  'how vexingly quick daft zebras jump',
  'sphinx of black quartz judge my vow',
  'bright vixens jump dozy fowl quack',
  'five boxing wizards jump quickly',
  'jackdaws love my big sphinx of quartz',
  'the early bird catches the worm',
  'practice makes perfect every single time',
  'stay hungry stay foolish keep going',
  'winners never quit and quitters never win',
  'just do it no excuses whatsoever',
  'may the best typist win this round',
  'speed is key but accuracy matters',
  'fingers flying fast across the keys',
]

interface State {
  phrase: string
  progress: Record<string, number> // chars correct from start
  resolved: boolean
  winnerId: string | null
}

const fastesttyper: MinigameModule = {
  id: 'fastesttyper',

  start(room) {
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]!
    const state: State = {
      phrase,
      progress: {},
      resolved: false,
      winnerId: null,
    }
    for (const p of room.players) state.progress[p.id] = 0
    room.match!.minigameState = state

    broadcast(room, 'GAME_UPDATE', {
      state: { phrase, progress: state.progress, resolved: false, winnerId: null },
    })
  },

  handleInput(room, playerId, input) {
    if (input.type !== 'TYPE') return

    const state = room.match!.minigameState as State
    if (state.resolved) return

    const typed = typeof input.text === 'string' ? input.text.slice(0, 200) : ''
    const phrase = state.phrase

    // Count correct characters from the start
    let correct = 0
    for (let i = 0; i < Math.min(typed.length, phrase.length); i++) {
      if (typed[i] === phrase[i]) correct++
      else break
    }
    state.progress[playerId] = correct

    const finished = correct === phrase.length

    broadcast(room, 'GAME_UPDATE', {
      state: {
        phrase,
        progress: state.progress,
        resolved: finished,
        winnerId: finished ? playerId : null,
      },
    })

    if (finished) {
      state.resolved = true
      state.winnerId = playerId
      setTimeout(() => {
        room.match?.onRoundDone?.({ winnerId: playerId, reason: 'completed' })
      }, 1200)
    }
  },

  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    if (state.winnerId) return { winnerId: state.winnerId, reason: 'completed' }

    const [p1, p2] = room.players as [Player, Player]
    const prog1 = state.progress[p1.id] ?? 0
    const prog2 = state.progress[p2.id] ?? 0

    if (prog1 > prog2) return { winnerId: p1.id, reason: 'timeout' }
    if (prog2 > prog1) return { winnerId: p2.id, reason: 'timeout' }
    return { winnerId: Math.random() < 0.5 ? p1.id : p2.id, reason: 'timeout' }
  },
}

export default fastesttyper
