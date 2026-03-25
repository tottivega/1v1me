import { BotPlayer } from './BotPlayer'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Per-minigame input strategies for the bot player.
 *
 * Each strategy receives the bot and fires the appropriate GAME_INPUT messages.
 * Strategies are best-effort — if a round resolves before the strategy can act
 * (e.g. reactiontest window closes), the outer playRound() swallows the error
 * and the server resolves the round via its own timeout.
 *
 * wordscramble intentionally does nothing: the answer is never broadcast to
 * clients, so we let the 25s server timeout resolve it.
 */

async function clickspeed(bot: BotPlayer): Promise<void> {
  // Send 15 clicks spaced 260ms apart — enough to win against a passive browser
  for (let i = 0; i < 15; i++) {
    bot.send('GAME_INPUT', { type: 'CLICK' })
    await sleep(260)
  }
}

async function coinflip(_bot: BotPlayer): Promise<void> {
  // Pure RNG — self-resolving after ~2s, no input needed
}

async function reactiontest(bot: BotPlayer): Promise<void> {
  // Wait for green-light (phase: 'ready'), then react immediately.
  // The signal fires 1.5–4s after round start; window is 3s.
  await bot.waitForGameUpdate((s) => s.phase === 'ready', 6_000)
  bot.send('GAME_INPUT', { type: 'REACT' })
}

async function numberguess(bot: BotPlayer): Promise<void> {
  // Midpoint guess — doesn't need to win, just needs to resolve
  bot.send('GAME_INPUT', { type: 'GUESS', value: 50 })
}

async function quickmaths(bot: BotPlayer): Promise<void> {
  // Answer equations as fast as possible until the 15s round timer expires.
  // The server broadcasts each new equation after each correct answer.
  // 2s wait timeout = no new GAME_UPDATE = round ended.
  const roundDeadline = Date.now() + 14_000
  while (Date.now() < roundDeadline) {
    let state: Record<string, unknown>
    try {
      state = await bot.waitForGameUpdate(
        (s) => typeof (s.equations as Record<string, { answer: number }>)?.[bot.playerId]?.answer === 'number',
        2_000
      )
    } catch {
      break // round ended — no more GAME_UPDATEs
    }
    const eq = (state.equations as Record<string, { answer: number }>)[bot.playerId]!
    bot.send('GAME_INPUT', { type: 'ANSWER', answer: eq.answer })
    await sleep(100)
  }
}

async function memorymatch(bot: BotPlayer): Promise<void> {
  // Server broadcasts the sequence on start — submit it back immediately for a perfect score
  const state = await bot.waitForGameUpdate((s) => Array.isArray(s.sequence), 5_000)
  bot.send('GAME_INPUT', { type: 'SUBMIT', sequence: state.sequence as string[] })
}

async function fastesttyper(bot: BotPlayer): Promise<void> {
  // Server broadcasts the phrase on start — submit it immediately
  const state = await bot.waitForGameUpdate((s) => typeof s.phrase === 'string', 3_000)
  bot.send('GAME_INPUT', { type: 'TYPE', text: state.phrase as string })
}

async function rockpaperscissors(bot: BotPlayer): Promise<void> {
  // Best-of-3 throws: wait for 'picking' phase, send 'rock', wait for 'reveal', repeat
  for (let throw_ = 0; throw_ < 3; throw_++) {
    await bot.waitForGameUpdate((s) => s.phase === 'picking', 10_000)
    bot.send('GAME_INPUT', { type: 'PICK', choice: 'rock' })
    await bot.waitForGameUpdate((s) => s.phase === 'reveal', 5_000)
  }
}

async function wordscramble(_bot: BotPlayer): Promise<void> {
  // The answer is never broadcast — let the 25s server timeout resolve this round
}

async function colorword(bot: BotPlayer): Promise<void> {
  // Server broadcasts { word, inkColor } immediately — answer with the ink color
  const state = await bot.waitForGameUpdate((s) => typeof s.inkColor === 'string', 3_000)
  bot.send('GAME_INPUT', { type: 'PICK_COLOR', color: state.inkColor as string })
}

async function higherorlower(bot: BotPlayer): Promise<void> {
  // Only the clue number is sent, not the target — pick 'higher' as a blind guess
  await bot.waitForGameUpdate((s) => s.phase === 'guessing', 3_000)
  bot.send('GAME_INPUT', { type: 'PICK_DIRECTION', answer: 'higher' })
}

const STRATEGIES: Record<string, (bot: BotPlayer) => Promise<void>> = {
  clickspeed,
  coinflip,
  reactiontest,
  numberguess,
  quickmaths,
  memorymatch,
  fastesttyper,
  rockpaperscissors,
  wordscramble,
  colorword,
  higherorlower,
}

/** Dispatch to the correct per-game strategy, swallowing errors gracefully. */
export async function playRound(bot: BotPlayer, minigameId: string): Promise<void> {
  const strategy = STRATEGIES[minigameId]
  if (!strategy) return
  await strategy(bot).catch(() => {
    // Strategy timed out (e.g. round resolved before strategy could act) — that's fine
  })
}
