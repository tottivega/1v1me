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

## 4. Add a spectator view

Spectators watch live at `/spectate/:roomId`. The `SpectateGameState` component in
`client/src/pages/SpectatePage.tsx` renders a read-only view of each game from
`minigameState`.

Add a branch for your game:

```tsx
if (minigameId === 'wordrace') {
  const s = state as { phrase?: string; progress?: Record<string, number> } | null
  return (
    <TwoColState
      p1={{ label: p1?.nickname ?? '…', value: s?.progress[p1?.id] ?? 0, unit: 'chars' }}
      p2={{ label: p2?.nickname ?? '…', value: s?.progress[p2?.id] ?? 0, unit: 'chars' }}
      color1="var(--blue)"
      color2="var(--orange)"
    />
  )
}
```

Rules:
- `state` is whatever the server stores in `room.match.minigameState` (the raw server
  object, not the broadcast-filtered shape). Cast it carefully — it may be `null` if a
  spectator joins before the first `GAME_UPDATE`.
- **Never** show information that is private to one player (e.g. hide picks in RPS
  until the reveal phase).
- Keep it read-only — no `sendInput`, no buttons.
- Reuse `TwoColState`, `StatPill`, or `MathsPanel` helper components when they fit.

---

## 5. Add server integration tests

Create `server/src/__tests__/minigames/wordrace.test.ts`. At minimum:

1. **Unit tests** for any exported helper functions (puzzle generators, scorers, etc.)
2. **Integration tests** using `makeRoom` + `makeMatch` helpers:
   - Call `module.start(room)` with a `vi.fn()` as `onRoundDone`
   - Send winning input via `module.handleInput(room, playerId, input)`
   - Assert `onRoundDone` was called with the correct `{ winnerId, reason }`
   - Assert invalid or duplicate inputs are ignored

```ts
it('resolves with the first finisher as winner', () => {
  const room = makeRoom()
  const onRoundDone = vi.fn()
  room.match = makeMatch('p1', 'p2', { onRoundDone })

  wordrace.start(room)
  wordrace.handleInput(room, 'p1', { type: 'FINISH' })

  expect(onRoundDone).toHaveBeenCalledWith({ winnerId: 'p1', reason: 'completed' })
})
```

---

## Checklist

- [ ] Entry in `MINIGAME_CONFIGS` (shared/types.ts)
- [ ] Server module created and added to `MODULES` (server/src/minigames/index.ts)
- [ ] Client component created and added to `MINIGAME_COMPONENTS` (client/src/minigames/registry.tsx)
- [ ] Spectator view added to `SpectateGameState` (client/src/pages/SpectatePage.tsx)
- [ ] Integration tests in `server/src/__tests__/minigames/wordrace.test.ts`
- [ ] `tsc --noEmit` passes in both `client/` and `server/`
- [ ] Tested in DevPanel (mock mode) — no server needed
- [ ] Tested end-to-end in a real match
