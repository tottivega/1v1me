/**
 * MINIGAME SERVER MODULE TEMPLATE
 * ────────────────────────────────
 * Copy this file to a new name (e.g. `wordrace.ts`) and fill in the TODOs.
 * Two files to create, one registration to make:
 *
 *   1. shared/types.ts  → add entry to MINIGAME_CONFIGS
 *   2. server/src/minigames/wordrace.ts  → this file (auto-discovered by id)
 *   3. client/src/minigames/WordRace.tsx  → copy the client template (auto-discovered)
 *   4. client/src/minigames/WordRace.spectator.tsx  → spectator view (auto-discovered)
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

// ⚠️  SECURITY: broadcast() sends to ALL players in the room.
// Never broadcast private fields (secrets, opponent answers, unrevealed picks).
// Build a "client view" that omits or redacts private data, then broadcast that.
//
// Pattern A — always-safe state (no secrets): broadcast the full state
//   function broadcastState(room: Room, state: State) {
//     broadcast(room, 'GAME_UPDATE', { state })
//   }
//
// Pattern B — secret exists until reveal: broadcast a public projection
//   function broadcastPublic(room: Room, state: State) {
//     // omit `state.secret`; include only what players should see mid-round
//     broadcast(room, 'GAME_UPDATE', {
//       state: { submitted: Object.keys(state.answers), scores: state.scores },
//     })
//   }
//   function broadcastReveal(room: Room, state: State) {
//     broadcast(room, 'GAME_UPDATE', { state }) // full state OK after reveal
//   }

function broadcastState(room: Room, state: State) {
  // TODO: if State contains secrets or opponent answers, replace this with
  // a public projection (see Pattern B above) to avoid leaking information.
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
