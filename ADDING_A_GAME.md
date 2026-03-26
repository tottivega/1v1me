# Adding a New Minigame

Four files to create, zero manual registrations. The server module and client components are auto-discovered at startup — no import lists to update. TypeScript enforces the `shared/types.ts` entries; if you miss the `MINIGAME_CONFIGS` entry or `MinigameState` union addition, `tsc` will error.

---

## 1. Register in `shared/types.ts`

Add an entry to `MINIGAME_CONFIGS`. Every field is required:

```ts
wordrace: {
  label: 'Word Race',       // shown in UI banners and DevPanel
  emoji: '📝',              // shown everywhere
  timeoutMs: 20000,         // set to 0 if your module calls onRoundDone() itself
  category: 'strategy',    // 'reflex' | 'math' | 'luck' | 'strategy' | 'skill'
  description: 'Type a word faster than your opponent.', // shown in game gallery
  platforms: 'all',         // 'all' | 'desktop-only' | 'mobile-only'
},
```

Set `platforms` to `'desktop-only'` if the game requires a physical keyboard (like Fastest Typer). Set it to `'mobile-only'` for games that only make sense with touch. Leave as `'all'` for everything else.

`MinigameId` is derived automatically from these keys.

**Also in `shared/types.ts`**: add a state interface for your game and add it to the `MinigameState` union. The `kind` discriminant is what enables safe narrowing in the client component (`if (state.kind === 'wordrace') { ... }`).

```ts
// State interface — mirror the fields your server module broadcasts
export interface WordRaceState {
  kind: 'wordrace'
  progress: Record<string, number>
  winnerId: string | null
}

// Add to the MinigameState union at the bottom of the union block
export type MinigameState =
  | ClickSpeedState
  | CoinFlipState
  | ...
  | WordRaceState  // ← add here
```

`MinigameInput` is an open interface — no changes needed there.

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

## 5. Add an ambient sound loop

Open `client/src/utils/sounds.ts` and add an entry to the `AMBIENT` map (around line 264):

```ts
wordrace: [
  { type: 'noise', freq: 180, gain: 0.04, duration: 0.8, interval: 1.0 },
  // add as many oscillator/noise layers as you need for the game's mood
],
```

Each layer is played on a loop while the round is active. Volume is automatically scaled by the global volume setting. If no entry exists for your `minigameId`, `startAmbient()` silently does nothing — silence is fine for low-energy games.

Refer to the existing entries (clickspeed, memorymatch, etc.) as templates for the layer shape.

---

## 6. Add a client smoke test

Open `client/src/__tests__/minigames/minigames.test.tsx` and add a `describe` block for your game following the existing pattern:

```ts
describe('WordRace', () => {
  it('renders the typing area', async () => {
    await renderGame('WordRace')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('typing does not throw', async () => {
    await renderGame('WordRace')
    expect(() =>
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    ).not.toThrow()
  })
})
```

Also add a **live-state test** that sets `minigameState` with the `kind` discriminant and verifies the UI reflects server state:

```ts
describe('WordRace', () => {
  it('renders the typing area', async () => {
    await renderGame('WordRace')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('typing does not throw', async () => {
    await renderGame('WordRace')
    expect(() =>
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    ).not.toThrow()
  })

  it('shows live progress from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: { kind: 'wordrace', progress: { [ME]: 5 }, winnerId: null },
    })
    await renderGame('WordRace')
    expect(screen.getByText('5')).toBeInTheDocument() // adapt to your game's UI
  })
})
```

Rules:
- Mock-mode tests use `BASE_STATE` (`wsStatus: 'disconnected'`, `isMockMatch: true`)
- Live-state tests set `wsStatus: 'connected'`, `isMockMatch: false`, and `minigameState` with the `kind` discriminant
- Test that the game renders something meaningful in mock mode
- Test that the primary interaction (click, type, pick) does not throw
- Do **not** test server-driven behaviour in client tests (that's what server integration tests are for)

---

## 7. Add server integration tests

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

## 8. Add a bot strategy for the E2E test

Open `tests/e2e/helpers/gameInputs.ts` and add a strategy to the `STRATEGIES` map:

```ts
async wordrace(bot: BotPlayer): Promise<void> {
  // Wait for the server to broadcast the word, then submit it
  const state = await bot.waitForGameUpdate((s) => typeof s.word === 'string', 3_000)
  bot.send('GAME_INPUT', { type: 'FINISH', word: state.word as string })
},
```

Rules:
- Only use `bot.waitForGameUpdate()` (matches `GAME_UPDATE` only — never consumes `ROUND_END`)
- Wrap any timing-sensitive logic in `try/catch` — or just let the outer `playRound` catch handle it
- If the game answer is not broadcast to clients (like `wordscramble`), do nothing and let the server timer resolve it

---

## Checklist

- [ ] Entry in `MINIGAME_CONFIGS` (`shared/types.ts`)
- [ ] State interface + `MinigameState` union entry in `shared/types.ts`
- [ ] Server module at `server/src/minigames/wordrace.ts` (auto-registered by id)
- [ ] Client component at `client/src/minigames/WordRace.tsx` (auto-registered by glob)
- [ ] Spectator view at `client/src/minigames/WordRace.spectator.tsx` (auto-registered by glob)
- [ ] Ambient sound layers in `client/src/utils/sounds.ts` → `AMBIENT` map
- [ ] Bot strategy in `tests/e2e/helpers/gameInputs.ts` → `STRATEGIES` map
- [ ] Client smoke test + live-state test in `client/src/__tests__/minigames/minigames.test.tsx`
- [ ] Integration tests in `server/src/__tests__/minigames/wordrace.test.ts`
- [ ] `tsc --noEmit` passes in both `client/` and `server/`
- [ ] Tested in DevPanel (mock mode) — no server needed
- [ ] Tested end-to-end in a real match (`npm run test:e2e`)
