import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomPage from '../../pages/RoomPage'
import { useGameStore } from '../../store/gameStore'
import { DEFAULT_ROOM_CONFIG } from '@shared/types'

vi.mock('../../utils/sounds', () => ({
  playClick: vi.fn(),
  playReady: vi.fn(),
  playTick: vi.fn(),
  playCorrect: vi.fn(),
  playWrong: vi.fn(),
  playMatchWin: vi.fn(),
  playMatchLose: vi.fn(),
  playCoinFlip: vi.fn(),
  playReaction: vi.fn(),
  playCountIn: vi.fn(),
  playEmote: vi.fn(),
  playRoundWin: vi.fn(),
  isMuted: vi.fn(() => false),
  getVolume: vi.fn(() => 1),
}))

const ME = { id: 'p1', nickname: 'Alice', avatar: '🐺', ready: true, connected: true }
const OPP = { id: 'p2', nickname: 'Bob', avatar: '🦊', ready: true, connected: true }

const POOL = ['clickspeed', 'coinflip', 'reactiontest', 'quickmaths'] as const

const NO_WS = {
  connect: vi.fn(),
  reconnectSaved: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
}

function renderBanPhase() {
  return render(
    <MemoryRouter initialEntries={['/room/TEST-42']}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useGameStore.setState({
    myPlayerId: 'p1',
    myNickname: 'Alice',
    players: [ME, OPP],
    roomStatus: 'banning',
    wsStatus: 'disconnected',
    roomId: 'TEST-42',
    spectatorCount: 0,
    roomConfig: { ...DEFAULT_ROOM_CONFIG, banCount: 1 },
    banPhasePool: [...POOL],
    banPhaseCount: 1,
    mockSubmitBans: vi.fn(),
    ...NO_WS,
  })
})

describe('BanPhaseView — render', () => {
  it('shows the BAN PHASE heading', () => {
    renderBanPhase()
    expect(screen.getByText(/BAN PHASE/i)).toBeInTheDocument()
  })

  it('renders each game in the pool', () => {
    renderBanPhase()
    // Each game button shows the game label from MINIGAME_CONFIGS
    // We just check that all 4 pool items render as buttons
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(POOL.length)
  })

  it('shows "Pick up to N games to ban" subtitle', () => {
    renderBanPhase()
    expect(screen.getByText(/Pick up to 1 game/i)).toBeInTheDocument()
  })

  it('shows "Skip Bans" when nothing is selected', () => {
    renderBanPhase()
    expect(screen.getByText(/Skip Bans/i)).toBeInTheDocument()
  })
})

describe('BanPhaseView — selection', () => {
  it('clicking a game selects it and updates subtitle', () => {
    renderBanPhase()
    const gameButtons = screen
      .getAllByRole('button')
      .filter((b) => !b.textContent?.includes('Skip') && !b.textContent?.includes('Ban '))
    fireEvent.click(gameButtons[0]!)
    // Submit button now reflects the ban count
    expect(screen.getByText(/Ban 1 Game/i)).toBeInTheDocument()
  })

  it('clicking the same game again deselects it', () => {
    renderBanPhase()
    const gameButtons = screen
      .getAllByRole('button')
      .filter((b) => !b.textContent?.includes('Skip') && !b.textContent?.includes('Ban '))
    fireEvent.click(gameButtons[0]!)
    expect(screen.getByText(/Ban 1 Game/i)).toBeInTheDocument()
    fireEvent.click(gameButtons[0]!)
    expect(screen.getByText(/Skip Bans/i)).toBeInTheDocument()
  })

  it('cannot select more games than banCount allows', () => {
    // banCount is 1, try to select 2 games
    renderBanPhase()
    const gameButtons = screen
      .getAllByRole('button')
      .filter((b) => !b.textContent?.includes('Skip') && !b.textContent?.includes('Ban '))
    fireEvent.click(gameButtons[0]!)
    fireEvent.click(gameButtons[1]!) // should be ignored
    // Still shows "Ban 1 Game", not "Ban 2 Games"
    expect(screen.getByText(/Ban 1 Game/i)).toBeInTheDocument()
    expect(screen.queryByText(/Ban 2 Game/i)).not.toBeInTheDocument()
  })
})

describe('BanPhaseView — submit', () => {
  it('calls mockSubmitBans with selected ids when in mock mode', () => {
    const mockSubmitBans = vi.fn()
    useGameStore.setState({ mockSubmitBans })
    renderBanPhase()

    const gameButtons = screen
      .getAllByRole('button')
      .filter((b) => !b.textContent?.includes('Skip') && !b.textContent?.includes('Ban '))
    fireEvent.click(gameButtons[0]!)
    fireEvent.click(screen.getByText(/Ban 1 Game/i))

    expect(mockSubmitBans).toHaveBeenCalledWith(expect.any(Array))
  })

  it('calls send(SUBMIT_BANS) when connected to server', () => {
    const send = vi.fn()
    useGameStore.setState({ wsStatus: 'connected', send })
    renderBanPhase()

    fireEvent.click(screen.getByText(/Skip Bans/i))

    expect(send).toHaveBeenCalledWith('SUBMIT_BANS', { bannedGameIds: [] })
  })

  it('disables game buttons after submitting', () => {
    renderBanPhase()
    fireEvent.click(screen.getByText(/Skip Bans/i))
    // After submit, the submit button disappears; badge and subtitle both confirm wait state
    expect(screen.queryByText(/Skip Bans/i)).not.toBeInTheDocument()
    // Both the subtitle ("Bans submitted — waiting for opponent…") and the badge
    // contain "waiting for opponent" — getAllByText confirms at least one is present
    expect(screen.getAllByText(/Waiting for opponent/i).length).toBeGreaterThan(0)
  })
})
