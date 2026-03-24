/**
 * MINIGAME SERVER MODULE TEMPLATE
 * ────────────────────────────────
 * Copy this file to a new name (e.g. `wordrace.ts`) and fill in the TODOs.
 * Then register it in three places — TypeScript will tell you if you miss one:
 *
 *   1. shared/types.ts        → add key to MINIGAME_CONFIGS
 *   2. server/src/minigames/index.ts  → import and add to MODULES
 *   3. client/src/minigames/_Template.tsx → copy the client template
 *
 * See ADDING_A_GAME.md at the repo root for the full walkthrough.
 */

import type { MinigameModule, Room } from '../types'
import type { MinigameResult } from '@shared/types'
import { broadcast } from '../sync/broadcast'

// ── State ─────────────────────────────────────────────────────────────────────
// Define the shape of the live game state.
// This is the object stored in room.match.minigameState and broadcast to clients
// via GAME_UPDATE. Clients read it as `minigameState` in the Zustand store.

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface State {
  // TODO: add your game's live state fields
  // example: answers: Record<string, string>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function broadcastState(room: Room, state: State) {
  broadcast(room, 'GAME_UPDATE', { state })
}

// ── Module ────────────────────────────────────────────────────────────────────

const template: MinigameModule = {
  id: 'quickmaths', // TODO: replace with your MinigameId key

  // Called once when the round starts. Set up initial state, store it on
  // room.match.minigameState, and broadcast it so clients can render immediately.
  start(room) {
    const state: State = {
      // TODO: initialise state for all players
    }
    room.match!.minigameState = state
    broadcastState(room, state)

    // For self-resolving games (timeoutMs: 0), call room.match.onRoundDone()
    // yourself when you have a result. For timer-based games, implement
    // getResult() below — the match controller calls it when the timer expires.
  },

  // Called every time a player sends a GAME_INPUT message.
  // MinigameInput is an open interface — no changes to shared/types.ts needed.
  // Just check input.type and read the other properties (they are `unknown` here,
  // so validate/cast them before use; see other modules for examples).
  handleInput(room, playerId, input) {
    if (input.type !== 'YOUR_INPUT_TYPE') return

    const state = room.match!.minigameState as State
    // TODO: validate and apply input, then broadcast updated state

    broadcastState(room, state)

    // If your game ends early (e.g. first correct answer wins), resolve here:
    // if (gameIsOver) {
    //   room.match!.onRoundDone?.({ winnerId: playerId, reason: 'completed' })
    // }
  },

  // Called when the timer expires (only for timeoutMs > 0 games).
  // Return the final result. Tie-breaking is your responsibility.
  getResult(room): MinigameResult {
    const state = room.match!.minigameState as State
    const [p1, p2] = room.players

    // TODO: determine winner from state
    void state
    const winnerId = Math.random() < 0.5 ? p1.id : p2.id // replace with real logic

    return { winnerId, reason: 'timeout' }
  },
}

export default template
