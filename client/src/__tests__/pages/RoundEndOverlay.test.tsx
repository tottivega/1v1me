import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomPage from '../../pages/RoomPage'
import { useGameStore } from '../../store/gameStore'
import { DEFAULT_ROOM_CONFIG } from '@shared/types'

const mockPlayRoundWin = vi.fn()
const mockPlayRoundLose = vi.fn()
const mockPlayClick = vi.fn()

vi.mock('../../utils/sounds', () => ({
  playClick: (...args: unknown[]) => mockPlayClick(...args),
  playReady: vi.fn(),
  playTick: vi.fn(),
  playRoundWin: (...args: unknown[]) => mockPlayRoundWin(...args),
  playRoundLose: (...args: unknown[]) => mockPlayRoundLose(...args),
  playMatchWin: vi.fn(),
  playMatchLose: vi.fn(),
  playCoinFlip: vi.fn(),
  playReaction: vi.fn(),
  playCountIn: vi.fn(),
  playEmote: vi.fn(),
  isMuted: vi.fn(() => false),
  getVolume: vi.fn(() => 1),
  startAmbient: vi.fn(),
  stopAmbient: vi.fn(),
}))

const ME = { id: 'p1', nickname: 'Alice', avatar: '🐺', ready: true, connected: true }
const OPP = { id: 'p2', nickname: 'Bob', avatar: '🦊', ready: true, connected: true }

const NO_WS = {
  connect: vi.fn(),
  reconnectSaved: vi.fn(),
  disconnect: vi.fn(),
}

function renderRoundEnd() {
  return render(
    <MemoryRouter initialEntries={['/room/TEST-42']}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockPlayRoundWin.mockClear()
  mockPlayRoundLose.mockClear()
  mockPlayClick.mockClear()

  useGameStore.setState({
    myPlayerId: 'p1',
    myNickname: 'Alice',
    players: [ME, OPP],
    roomStatus: 'round_end',
    wsStatus: 'connected',
    roomId: 'TEST-42',
    currentMinigame: 'coinflip',
    currentRound: 1,
    scores: { p1: 1, p2: 0 },
    lastRoundWinnerId: 'p1',
    spectatorCount: 0,
    roomConfig: { ...DEFAULT_ROOM_CONFIG },
    send: vi.fn(),
    ...NO_WS,
  })
})

describe('RoundEndOverlay', () => {
  it('shows win message when I won the round', () => {
    renderRoundEnd()
    expect(screen.getByText(/You won that/i)).toBeInTheDocument()
  })

  it('shows opponent name when I lose', () => {
    useGameStore.setState({ lastRoundWinnerId: 'p2' })
    renderRoundEnd()
    expect(screen.getByText(/Bob wins/i)).toBeInTheDocument()
  })

  it('shows draw message on null winner', () => {
    useGameStore.setState({ lastRoundWinnerId: null })
    renderRoundEnd()
    expect(screen.getByText(/Draw/i)).toBeInTheDocument()
  })

  it('renders both scores', () => {
    renderRoundEnd()
    // Score "1" appears in both the ScoreBoard and the overlay — getAllByText handles multiples
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('shows Next Round button when connected', () => {
    renderRoundEnd()
    expect(screen.getByText(/Next Round/i)).toBeInTheDocument()
  })

  it('clicking Next Round sends ROUND_READY', () => {
    const send = vi.fn()
    useGameStore.setState({ send })
    renderRoundEnd()
    fireEvent.click(screen.getByText(/Next Round/i))
    expect(send).toHaveBeenCalledWith('ROUND_READY')
  })

  it('shows auto-advance message when disconnected', () => {
    useGameStore.setState({ wsStatus: 'disconnected' })
    renderRoundEnd()
    expect(screen.getByText(/Next round starting/i)).toBeInTheDocument()
    expect(screen.queryByText(/Next Round →/i)).not.toBeInTheDocument()
  })
})
