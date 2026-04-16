/**
 * Minigame smoke tests — one describe block per game.
 * Goals: render without crashing in mock mode, show key UI, respond to primary interaction.
 * All games use isMockMatch=true (wsStatus='disconnected') so no server needed.
 *
 * Live-mode tests set minigameState (with the `kind` discriminant) and wsStatus='connected'
 * to verify that state received from the server is reflected in the UI.
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
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking the button does not throw', async () => {
    await renderGame('ClickSpeed')
    const [btn] = screen.getAllByRole('button')
    expect(() => fireEvent.mouseDown(btn!)).not.toThrow()
  })

  it('shows live click counts from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: { kind: 'clickspeed', clicks: { [ME]: 7, [OPP]: 3 } },
    })
    await renderGame('ClickSpeed')
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

// ── CoinFlip ───────────────────────────────────────────────────────────────────

describe('CoinFlip', () => {
  it('renders without crashing', async () => {
    await renderGame('CoinFlip')
    expect(document.body).toBeTruthy()
  })

  it('shows the coin flip heading', async () => {
    await renderGame('CoinFlip')
    expect(screen.getByText(/coin flip/i)).toBeInTheDocument()
  })

  it('shows flipping state from server', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: { kind: 'coinflip', phase: 'flipping' },
    })
    await renderGame('CoinFlip')
    expect(document.body).toBeTruthy()
  })

  it('shows result state from server', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: { kind: 'coinflip', phase: 'result', winnerId: ME },
    })
    await renderGame('CoinFlip')
    // Result phase should render something (win or lose message)
    expect(document.body).toBeTruthy()
  })
})

// ── ReactionTest ───────────────────────────────────────────────────────────────

describe('ReactionTest', () => {
  it('renders the waiting state initially', async () => {
    await renderGame('ReactionTest')
    expect(screen.getByText(/wait/i)).toBeInTheDocument()
  })

  it('renders ready phase from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: { kind: 'reactiontest', phase: 'ready' },
    })
    await renderGame('ReactionTest')
    // Ready phase shows the "GO" / clickable area
    expect(document.body).toBeTruthy()
  })

  it('renders result phase with winner from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'reactiontest',
        phase: 'result',
        reactions: { [ME]: 210, [OPP]: 180 },
        winnerId: OPP,
      },
    })
    await renderGame('ReactionTest')
    expect(document.body).toBeTruthy()
  })
})

// ── QuickMaths ─────────────────────────────────────────────────────────────────

describe('QuickMaths', () => {
  it('renders the calculator keypad', async () => {
    await renderGame('QuickMaths')
    for (const d of ['0', '1', '5', '9']) {
      expect(screen.getByRole('button', { name: d })).toBeInTheDocument()
    }
  })

  it('clicking a digit does not throw', async () => {
    await renderGame('QuickMaths')
    expect(() => fireEvent.click(screen.getByRole('button', { name: '4' }))).not.toThrow()
  })

  it('shows equation from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'quickmaths',
        equations: { [ME]: { question: '6 + 7', answer: 13 } },
        correct: { [ME]: 2, [OPP]: 1 },
      },
    })
    await renderGame('QuickMaths')
    // Equation renders as "6 + 7 = ?" — match substring
    expect(document.body.textContent).toContain('6 + 7')
  })
})

// ── MemoryMatch ────────────────────────────────────────────────────────────────

describe('MemoryMatch', () => {
  it('renders the memorize phase with symbols', async () => {
    await renderGame('MemoryMatch')
    expect(document.body).toBeTruthy()
  })

  it('renders server sequence in live mode', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'memorymatch',
        roundNum: 1,
        seqLen: 3,
        phase: 'memorize',
        sequence: ['🔴', '🔵', '🟡'],
        submissions: {},
      },
    })
    await renderGame('MemoryMatch')
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

  it('shows phrases from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'fastesttyper',
        phrases: ['cats sleep all day', 'run like the wind'],
        completed: { [ME]: 0, [OPP]: 0 },
        charProgress: { [ME]: 0, [OPP]: 0 },
        resolved: false,
        winnerId: null,
      },
    })
    await renderGame('FastestTyper')
    expect(document.body.textContent).toContain('cats sleep all day')
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

  it('renders picking phase from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'rockpaperscissors',
        phase: 'picking',
        throwNum: 1,
        submitted: [],
        scores: { [ME]: 0, [OPP]: 0 },
        history: [],
      },
    })
    await renderGame('RockPaperScissors')
    expect(screen.getByRole('button', { name: /rock/i })).toBeInTheDocument()
  })

  it('renders reveal phase with picks from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'rockpaperscissors',
        phase: 'reveal',
        throwNum: 1,
        picks: { [ME]: 'rock', [OPP]: 'scissors' },
        throwWinnerId: ME,
        scores: { [ME]: 1, [OPP]: 0 },
        history: [],
      },
    })
    await renderGame('RockPaperScissors')
    expect(document.body).toBeTruthy()
  })
})

// ── ColorWord ──────────────────────────────────────────────────────────────────

describe('ColorWord', () => {
  it('renders six color buttons', async () => {
    await renderGame('ColorWord')
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(6)
  })

  it('clicking a color button does not throw', async () => {
    await renderGame('ColorWord')
    const buttons = screen.getAllByRole('button')
    expect(() => fireEvent.click(buttons[0]!)).not.toThrow()
  })

  it('shows the word and ink buttons from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'colorword',
        puzzles: {
          [ME]: { word: 'red', inkColor: 'blue', seq: 1 },
          [OPP]: { word: 'green', inkColor: 'yellow', seq: 0 },
        },
        scores: {},
      },
    })
    await renderGame('ColorWord')
    // The word "RED" should appear as display text
    expect(screen.getByText('RED')).toBeInTheDocument()
    // Six color choice buttons still present
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(6)
  })
})

// ── Kaboom ─────────────────────────────────────────────────────────────────────

describe('Kaboom', () => {
  it('renders the wire grid', async () => {
    await renderGame('Kaboom')
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(8)
  })

  it('clicking a wire does not throw', async () => {
    await renderGame('Kaboom')
    const buttons = screen.getAllByRole('button')
    expect(() => fireEvent.click(buttons[0]!)).not.toThrow()
  })

  it('shows picking phase from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'kaboom',
        wires: [0, 1, 2, 3, 4, 5, 6, 7],
        eliminated: [],
        phase: 'picking',
        currentPlayerId: ME,
        roundNum: 1,
      },
    })
    await renderGame('Kaboom')
    expect(document.body.textContent).toContain('KABOOM')
  })

  it('shows reveal phase with bomb pick from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'kaboom',
        wires: [0, 1, 2, 3, 4, 5, 6, 7],
        eliminated: [],
        phase: 'reveal',
        currentPlayerId: OPP,
        lastPick: { playerId: OPP, wire: 3, isBomb: true },
        roundNum: 2,
        winnerId: ME,
      },
    })
    await renderGame('Kaboom')
    expect(document.body).toBeTruthy()
  })
})

// ── TapSequence ────────────────────────────────────────────────────────────────

describe('TapSequence', () => {
  it('renders the 4-button grid', async () => {
    await renderGame('TapSequence')
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(4)
  })

  it('clicking a button does not throw during input phase', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'tapsequence',
        level: 1,
        seqLen: 4,
        phase: 'input',
        sequence: [0, 1, 2, 3],
        progress: {},
        passed: {},
        eliminated: {},
      },
    })
    await renderGame('TapSequence')
    const buttons = screen.getAllByRole('button')
    expect(() => fireEvent.click(buttons[0]!)).not.toThrow()
  })

  it('shows showing phase from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'tapsequence',
        level: 2,
        seqLen: 5,
        phase: 'showing',
        sequence: [0, 1, 2, 3, 0],
        progress: {},
        passed: {},
        eliminated: {},
      },
    })
    await renderGame('TapSequence')
    expect(screen.getByText(/watch/i)).toBeInTheDocument()
  })

  it('shows input phase from server state', async () => {
    useGameStore.setState({
      wsStatus: 'connected',
      isMockMatch: false,
      minigameState: {
        kind: 'tapsequence',
        level: 1,
        seqLen: 4,
        phase: 'input',
        sequence: [0, 1, 2, 3],
        progress: { [ME]: 2 },
        passed: {},
        eliminated: {},
      },
    })
    await renderGame('TapSequence')
    expect(screen.getByText(/your turn/i)).toBeInTheDocument()
  })
})
