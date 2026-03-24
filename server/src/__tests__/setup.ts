import { afterEach, vi } from 'vitest'

// Clear all fake timers after each test so pending callbacks from one test
// (e.g. roundReadyTimer set in resolveRound's else-branch) cannot fire
// during a later test's vi.runAllTimers() call.
afterEach(() => {
  vi.clearAllTimers()
})
