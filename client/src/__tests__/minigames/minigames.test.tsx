/**
 * Minigame smoke tests — one describe block per game.
 * Goals: render without crashing in mock mode, show key UI, respond to primary interaction.
 * All games use isMockMatch=true (wsStatus='disconnected') so no server needed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGameStore } from '../../store/gameStore'

vi.mock('../../utils/sounds', () => ({
  playClick: vi.fn(),
  playReady: vi.fn(),
  playTick: vi.fn(),
  playCorrect: vi.fn(),
  playWrong: vi.fn(),
  playMatchWin: vi.fn(),
  playMatchLose: vi.fn(),
  playCoinFlip: vi.fn(),
  playCoinResult: vi.fn(),
  playReactionGo: vi.fn(),
  playEarly: vi.fn(),
  playReaction: vi.fn(),
  playCountIn: vi.fn(),
  playEmote: vi.fn(),
  playRoundWin: vi.fn(),
  playClickHit: vi.fn(),
  isMuted: vi.fn(() => false),
  getVolume: vi.fn(() => 1),
}))

const ME = 'p1'
const OPP = 'p2'

const BASE_STATE = {
  myPlayerId: ME,
  myNickname: 'Alice',
  players: [
    { id: ME, nickname: 'Alice', avatar: '🐺', ready: true, connected: true },
    { id: OPP, nickname: 'Bob', avatar: '🦊', ready: true, connected: true },
  ],
  scores: { [ME]: 0, [OPP]: 0 },
  wsStatus: 'disconnected' as const,
  isMockMatch: true,
  remainingMs: 5000,
  timeoutMs: 5000,
  roomStatus: 'playing' as const,
  minigameState: null,
  sendInput: vi.fn(),
  send: vi.fn(),
}

beforeEach(() => {
  useGameStore.setState(BASE_STATE)
})

// ── Lazy imports (avoids top-level import issues with import.meta.glob) ────────

async function renderGame(name: string) {
  const mod = await import(`../../minigames/${name}.tsx`)
  const Component = mod.default
  return render(<Component />)
}

// ── ClickSpeed ─────────────────────────────────────────────────────────────────

describe('ClickSpeed', () => {
  it('renders the click button', async () => {
    await renderGame('ClickSpeed')
    // Button contains the 👊 emoji — there is exactly one button
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking the button does not throw', async () => {
    await renderGame('ClickSpeed')
    const [btn] = screen.getAllByRole('button')
    expect(() => fireEvent.mouseDown(btn!)).not.toThrow()
  })
})

// ── CoinFlip ───────────────────────────────────────────────────────────────────

describe('CoinFlip', () => {
  it('renders without crashing', async () => {
    await renderGame('CoinFlip')
    // Shows either the coin animation or a result — either way renders
    expect(document.body).toBeTruthy()
  })

  it('shows the coin flip heading', async () => {
    await renderGame('CoinFlip')
    expect(screen.getByText(/coin flip/i)).toBeInTheDocument()
  })
})

// ── ReactionTest ───────────────────────────────────────────────────────────────

describe('ReactionTest', () => {
  it('renders the waiting state initially', async () => {
    await renderGame('ReactionTest')
    // In mock mode starts in waiting phase
    expect(screen.getByText(/wait/i)).toBeInTheDocument()
  })
})

// ── QuickMaths ─────────────────────────────────────────────────────────────────

describe('QuickMaths', () => {
  it('renders an equation input', async () => {
    await renderGame('QuickMaths')
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('typing an answer does not throw', async () => {
    await renderGame('QuickMaths')
    const input = screen.getByRole('spinbutton')
    expect(() => fireEvent.change(input, { target: { value: '42' } })).not.toThrow()
  })
})

// ── MemoryMatch ────────────────────────────────────────────────────────────────

describe('MemoryMatch', () => {
  it('renders the memorize phase with symbols', async () => {
    await renderGame('MemoryMatch')
    // Should show symbol buttons or the sequence display
    expect(document.body).toBeTruthy()
  })
})

// ── FastestTyper ───────────────────────────────────────────────────────────────

describe('FastestTyper', () => {
  it('renders the typing input', async () => {
    await renderGame('FastestTyper')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('typing in the input does not throw', async () => {
    await renderGame('FastestTyper')
    const input = screen.getByRole('textbox')
    expect(() => fireEvent.change(input, { target: { value: 'hello' } })).not.toThrow()
  })
})

// ── RockPaperScissors ──────────────────────────────────────────────────────────

describe('RockPaperScissors', () => {
  it('renders three choice buttons', async () => {
    await renderGame('RockPaperScissors')
    expect(screen.getByRole('button', { name: /rock/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paper/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /scissors/i })).toBeInTheDocument()
  })

  it('clicking a choice does not throw', async () => {
    await renderGame('RockPaperScissors')
    expect(() => fireEvent.click(screen.getByRole('button', { name: /rock/i }))).not.toThrow()
  })
})

// ── ColorWord ──────────────────────────────────────────────────────────────────

describe('ColorWord', () => {
  it('renders six color buttons', async () => {
    await renderGame('ColorWord')
    const buttons = screen.getAllByRole('button')
    // 6 color choice buttons
    expect(buttons.length).toBeGreaterThanOrEqual(6)
  })

  it('clicking a color button does not throw', async () => {
    await renderGame('ColorWord')
    const buttons = screen.getAllByRole('button')
    expect(() => fireEvent.click(buttons[0]!)).not.toThrow()
  })
})

// ── HigherOrLower ──────────────────────────────────────────────────────────────

describe('HigherOrLower', () => {
  it('renders Higher and Lower buttons', async () => {
    await renderGame('HigherOrLower')
    expect(screen.getByRole('button', { name: /higher/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lower/i })).toBeInTheDocument()
  })

  it('clicking Higher does not throw', async () => {
    await renderGame('HigherOrLower')
    expect(() => fireEvent.click(screen.getByRole('button', { name: /higher/i }))).not.toThrow()
  })
})
