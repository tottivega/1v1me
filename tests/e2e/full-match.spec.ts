import { test, expect } from '@playwright/test'
import { BotPlayer } from './helpers/BotPlayer'
import { playRound } from './helpers/gameInputs'

const WS_URL = 'ws://localhost:3001'

/**
 * Full-match E2E test.
 *
 * P1 (browser)  — navigates via the real UI: HomePage → RoomPage lobby → match
 * P2 (bot)      — raw WebSocket client that joins the same room and plays each
 *                 minigame using per-game input strategies.
 *
 * Configuration: bestOf=3 (2 wins to clinch) keeps the test fast while still
 * exercising the full create → lobby → match → match-end flow.
 */
test('create room, join as bot, play full match, verify match-end screen', async ({ page }) => {
  // ── 1. P1 navigates to home and creates a room ─────────────────────────────
  await page.goto('/')
  await page.getByPlaceholder('e.g. CoolDude99').fill('TestPlayer1')
  await page.getByRole('button', { name: /Create Room/i }).click()

  // Wait for lobby — URL becomes /room/:roomCode
  await page.waitForURL(/\/room\//)
  const roomId = page.url().split('/room/')[1]!

  // ── 2. P2 bot joins the same room via WebSocket ────────────────────────────
  const bot = new BotPlayer(WS_URL, roomId)
  await bot.join('BotPlayer2')

  // ── 3. Wait for P2 to appear in P1's lobby, then configure and ready up ────
  await expect(page.getByText('BotPlayer2')).toBeVisible({ timeout: 8_000 })

  // Shorten match to bestOf=3 so the test completes in < 30s in the happy path
  await page.getByRole('button', { name: 'best-of-3' }).click()

  // Both players ready up
  await page.getByRole('button', { name: /Ready Up/i }).click()
  bot.send('SET_READY')

  // ── 4. Play rounds until MATCH_END ─────────────────────────────────────────
  await bot.waitFor('MATCH_START', 10_000)

  // Seed the loop with the first ROUND_START
  let roundStartMsg = await bot.waitFor('ROUND_START', 15_000)

  for (let safetyBreak = 0; safetyBreak < 10; safetyBreak++) {
    const { minigameId } = roundStartMsg.payload as { minigameId: string }

    // Bot plays its round strategy (fire-and-forget; errors swallowed inside)
    await playRound(bot, minigameId)

    // Wait for this round to finish
    await bot.waitFor('ROUND_END', 40_000)

    // Send ROUND_READY immediately; also click "Next Round →" in the browser
    // (server auto-advances after 5s regardless, so this just speeds things up)
    bot.send('ROUND_READY')
    await page
      .getByRole('button', { name: /Next Round/i })
      .click({ timeout: 5_500 })
      .catch(() => {
        // Button may not appear if match already ended or round advanced via timeout
      })

    // After ROUND_END the server either starts another round or ends the match
    const next = await bot.waitForEither(['ROUND_START', 'MATCH_END'], 12_000)
    if (next.type === 'MATCH_END') break

    roundStartMsg = next
  }

  // ── 5. Verify match-end screen ─────────────────────────────────────────────
  // Whoever wins, P1's browser shows either "YOU WIN" or "YOU LOSE"
  await expect(
    page.getByText('YOU WIN').or(page.getByText('YOU LOSE'))
  ).toBeVisible({ timeout: 10_000 })

  bot.disconnect()
})
