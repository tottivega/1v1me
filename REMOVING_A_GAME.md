# Removing a Minigame

Removing a game is the mirror image of adding one. TypeScript enforces most deletions automatically — once you remove the `MINIGAME_CONFIGS` entry the compiler will flag every remaining stale reference.

Follow the steps in order: registry first, then files, then optional cleanup.

---

## 1. Remove from `shared/types.ts`

Delete the entry from `MINIGAME_CONFIGS`:

```diff
- wordrace: {
-   label: 'Word Race',
-   emoji: '📝',
-   ...
- },
```

`MinigameId` is derived from these keys, so the type `'wordrace'` ceases to exist. Running `tsc --noEmit` in `server/` and `client/` will now highlight every remaining reference.

---

## 2. Delete the server module

```
server/src/minigames/wordrace.ts
```

The module is auto-discovered via `readdirSync` — no import to clean up. The file itself is the only thing to delete.

---

## 3. Delete the client files

```
client/src/minigames/WordRace.tsx
client/src/minigames/WordRace.spectator.tsx
```

Both are auto-discovered via `import.meta.glob` — no registry to update. The files themselves are the only things to delete.

---

## 4. Delete the test file

```
server/src/__tests__/minigames/wordrace.test.ts
```

---

## 5. Remove the ambient sound entry

Open `client/src/utils/sounds.ts` and delete the entry from the `AMBIENT` map:

```diff
- wordrace: [
-   { type: 'noise', freq: 180, ... },
- ],
```

If you omit this step the dead entry is harmless (TypeScript won't complain — the key is a plain string), but leaving stale audio code around is confusing.

---

## 6. Remove the E2E bot strategy

Open `tests/e2e/helpers/gameInputs.ts` and delete the entry from the `STRATEGIES` map:

```diff
- async wordrace(bot: BotPlayer): Promise<void> {
-   ...
- },
```

Same as above — TypeScript won't enforce this, but the dead strategy will never run and is just noise.

---

## 7. Update CLAUDE.md

The **Minigame Pool** table in `CLAUDE.md` lists all games. Remove the row for the deleted game and update the count in the section header (currently "11 games").

---

## 8. Verify

```bash
cd server && npx tsc --noEmit   # zero type errors
cd client && npx tsc --noEmit   # zero type errors
cd server && npm test            # all tests pass
npm run test:e2e                 # E2E still passes (game removed from pool)
```

The E2E test plays whatever games the server selects at random. Removing a game shrinks the pool, but the test is pool-agnostic and will continue to pass.

---

## What you do NOT need to touch

| Location | Why |
|---|---|
| `server/migrations/001_initial_schema.sql` | `minigame_id` is stored as plain `text` — no enum to update |
| `server/src/minigames/index.ts` | Auto-discovers files via `readdirSync` |
| `client/src/minigames/registry.tsx` | Auto-discovers via `import.meta.glob` |
| `client/src/minigames/spectatorRegistry.ts` | Auto-discovers via `import.meta.glob` |
| `shared/types.ts` → `MinigameInput` | Open interface — no union to shrink |
| Historical Supabase rows | `game_rounds` rows keep the old `minigame_id` string; they're inert |
