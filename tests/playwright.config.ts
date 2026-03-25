import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000, // 2 min — wordscramble can hit its 25s timer
  workers: 1, // server is stateful in-memory; tests must run sequentially
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    video: 'retain-on-failure',
  },
  webServer: [
    {
      // Non-watch mode so the process doesn't restart mid-test
      command: 'npm --prefix ../server run start',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'npm --prefix ../client run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
