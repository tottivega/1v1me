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
  platforms: 'all',         // 'all' | 'desktop-only' | 'mobile-only'
},
```

Set `platforms` to `'desktop-only'` if the game requires a physical keyboard (like Fastest Typer). Set it to `'mobile-only'` for games that only make sense with touch. Leave as `'all'` for everything else.

`MinigameId` is derived automatically from these keys.

That's all you need to touch in `shared/types.ts`. `MinigameInput` is an open interface — no union to extend.

---

## 2. Create the server module

Copy `server/src/minigames/_template.ts` → `server/src/minigames/wordrace.ts`.

Fill in:
- `id` — must match your key in `MINIGAME_CONFIGS`
- `start(room)` — initialise state, store on `room.match.minigameState`, broadcast
- `handleInput(room, playerId, input)` — react to player actions; narrow with `if (input.type !== 'YOUR_TYPE') return`, then cast extra properties as needed (e.g. `const word = input.word as string`)
- `getResult(room)` — return `{ winnerId, reason }` (only called for timer-based games)

**Self-resolving games** (timeoutMs: 0): call `room.match!.onRoundDone?.({ winnerId, reason: 'completed' })` from inside `start()` or `handleInput()` when you have a winner. The match controller skips the countdown timer entirely.

**Timer-based games** (timeoutMs > 0): just implement `getResult()`. The match controller calls it when the clock hits zero.

The server module is **auto-discovered** at startup via `readdirSync` — no manual import or registration needed. The only rule: the file must export a default object whose `id` field matches your `MINIGAME_CONFIGS` key.

---

## 3. Create the client component

Copy `client/src/minigames/_Template.tsx` → `client/src/minigames/WordRace.tsx`.

Key rules:
- Check `wsStatus === 'connected'` to switch between live and mock mode
- In live mode: read `minigameState` (cast to your `ServerState` shape), send actions via `sendInput()`
- In mock mode: simulate the game locally so it works in DevPanel without a server
- Reset local state in a `useEffect` that watches `minigameState === null` (set on `ROUND_START`)
- Wire sounds from `utils/sounds.ts` for feedback moments

The registry auto-discovers component files via `import.meta.glob` — no manual registration needed. The only rule: **filename must match the MinigameId** (case-insensitive). `WordRace.tsx` → `wordrace`.

---

## 4. Add a spectator view

Spectators watch live at `/spectate/:roomId`. Create a co-located file:

```
client/src/minigames/WordRace.spectator.tsx
```

It is **auto-discovered** via glob — no registration needed. Export a default component
that accepts `SpectatorProps`:

```tsx
import type { SpectatorProps } from './spectatorHelpers'
import { TwoColState } from './spectatorHelpers'

export default function WordRaceSpectator({ state, players }: SpectatorProps) {
  const s = state as { progress?: Record<string, number> } | null
  const [p1, p2] = players
  return (
    <TwoColState
      p1={{ label: p1?.nickname ?? '…', value: s?.progress?.[p1?.id] ?? 0, unit: 'chars' }}
      p2={{ label: p2?.nickname ?? '…', value: s?.progress?.[p2?.id] ?? 0, unit: 'chars' }}
      color1="var(--blue)"
      color2="var(--orange)"
    />
  )
}
```

Rules:
- `state` comes from `GAME_UPDATE` broadcasts — the **client-visible** projection, not
  the full server state. It may be `null` before the first update; guard accordingly.
- **Never** show information private to one player (e.g. hide picks in RPS until reveal).
- Keep it read-only — no `sendInput`, no buttons.
- Reuse `TwoColState`, `StatPill`, or `MathsPanel` from `spectatorHelpers.tsx` when they fit.

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

- [ ] Entry in `MINIGAME_CONFIGS` (shared/types.ts) — no MinigameInput changes needed
- [ ] Server module created at `server/src/minigames/wordrace.ts` (auto-registered by id)
- [ ] Client component created at `client/src/minigames/WordRace.tsx` (auto-registered by glob)
- [ ] Spectator view created at `client/src/minigames/WordRace.spectator.tsx` (auto-registered by glob)
- [ ] Integration tests in `server/src/__tests__/minigames/wordrace.test.ts`
- [ ] `tsc --noEmit` passes in both `client/` and `server/`
- [ ] Tested in DevPanel (mock mode) — no server needed
- [ ] Tested end-to-end in a real match
