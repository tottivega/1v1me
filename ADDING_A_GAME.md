# Adding a New Minigame

Three files to create, three registrations to make. TypeScript enforces all three — if you miss one, `tsc` will error before the server or client even starts.

---

## 1. Register in `shared/types.ts`

Add an entry to `MINIGAME_CONFIGS`. Every field is required:

```ts
wordrace: {
  label: 'Word Race',       // shown in UI banners and DevPanel
  emoji: '📝',              // shown everywhere
  timeoutMs: 20000,         // set to 0 if your module calls onRoundDone() itself
  category: 'strategy',    // 'reflex' | 'math' | 'luck' | 'strategy' | 'trivia'
  description: 'Type a word faster than your opponent.', // shown in game gallery
  difficulty: 2,            // 1 easy / 2 medium / 3 hard
},
```

`MinigameId` is derived automatically from these keys — no other type changes needed.

---

## 2. Create the server module

Copy `server/src/minigames/_template.ts` → `server/src/minigames/wordrace.ts`.

Fill in:
- `id` — must match your key in `MINIGAME_CONFIGS`
- `start(room)` — initialise state, store on `room.match.minigameState`, broadcast
- `handleInput(room, playerId, input)` — react to player actions, broadcast updates
- `getResult(room)` — return `{ winnerId, reason }` (only called for timer-based games)

**Self-resolving games** (timeoutMs: 0): call `room.match!.onRoundDone?.({ winnerId, reason: 'completed' })` from inside `start()` or `handleInput()` when you have a winner. The match controller skips the countdown timer entirely.

**Timer-based games** (timeoutMs > 0): just implement `getResult()`. The match controller calls it when the clock hits zero.

Then register it:

```ts
// server/src/minigames/index.ts
import wordrace from './wordrace'

const MODULES: Record<MinigameId, MinigameModule> = {
  // ...existing games...
  wordrace,
}
```

---

## 3. Create the client component

Copy `client/src/minigames/_Template.tsx` → `client/src/minigames/WordRace.tsx`.

Key rules:
- Check `wsStatus === 'connected'` to switch between live and mock mode
- In live mode: read `minigameState` (cast to your `ServerState` shape), send actions via `sendInput()`
- In mock mode: simulate the game locally so it works in DevPanel without a server
- Reset local state in a `useEffect` that watches `minigameState === null` (set on `ROUND_START`)
- Wire sounds from `utils/sounds.ts` for feedback moments

Then register it:

```tsx
// client/src/minigames/registry.tsx
import WordRace from './WordRace'

export const MINIGAME_COMPONENTS: Record<MinigameId, ComponentType> = {
  // ...existing games...
  wordrace: WordRace,
}
```

---

## Checklist

- [ ] Entry in `MINIGAME_CONFIGS` (shared/types.ts)
- [ ] Server module created and added to `MODULES` (server/src/minigames/index.ts)
- [ ] Client component created and added to `MINIGAME_COMPONENTS` (client/src/minigames/registry.tsx)
- [ ] `tsc --noEmit` passes in both `client/` and `server/`
- [ ] Tested in DevPanel (mock mode) — no server needed
- [ ] Tested end-to-end in a real match
