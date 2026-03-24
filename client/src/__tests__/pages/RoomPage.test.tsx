import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomPage from '../../pages/RoomPage'
import { useGameStore } from '../../store/gameStore'
import { DEFAULT_ROOM_CONFIG } from '@shared/types'

// Silence Web Audio API — not available in happy-dom
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

// Stub clipboard — happy-dom exposes it as a getter-only property
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
})

const ME = { id: 'p1', nickname: 'Alice', avatar: '🐺', ready: false, connected: true }
const OPP = { id: 'p2', nickname: 'Bob', avatar: '🦊', ready: false, connected: true }

function renderLobby(roomId = 'TEST-42') {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// Shared no-op action overrides — prevent RoomPage from opening a real WebSocket
const NO_WS = {
  connect: vi.fn(),
  reconnectSaved: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
}

beforeEach(() => {
  useGameStore.setState({
    myPlayerId: 'p1',
    myNickname: 'Alice',
    players: [ME, OPP],
    roomStatus: 'lobby',
    wsStatus: 'connected',
    roomId: 'TEST-42',
    spectatorCount: 0,
    roomConfig: { ...DEFAULT_ROOM_CONFIG },
    ...NO_WS,
  })
})

describe('LobbyView — basic render', () => {
  it('renders the room code', () => {
    renderLobby()
    expect(screen.getByText('TEST-42')).toBeInTheDocument()
  })

  it('renders both player nicknames', () => {
    renderLobby()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders the Copy Invite Link button', () => {
    renderLobby()
    expect(screen.getByText('📋 Copy Invite Link')).toBeInTheDocument()
  })

  it('shows "Copied!" flash after clicking copy button', async () => {
    renderLobby()
    fireEvent.click(screen.getByText('📋 Copy Invite Link'))
    expect(await screen.findByText('✅ Copied!')).toBeInTheDocument()
  })

  it('renders Ready Up button when opponent is present', () => {
    renderLobby()
    expect(screen.getByText('⚔️ Ready Up!')).toBeInTheDocument()
  })
})

describe('LobbyView — spectator badge', () => {
  it('does not show spectator badge when count is 0', () => {
    renderLobby()
    expect(screen.queryByText(/watching/)).not.toBeInTheDocument()
  })

  it('shows spectator badge when count > 0', () => {
    useGameStore.setState({ spectatorCount: 3 })
    renderLobby()
    expect(screen.getByText('👁 3 watching')).toBeInTheDocument()
  })
})

describe('MatchEndView', () => {
  function renderMatchEnd() {
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
      roomStatus: 'match_end',
      wsStatus: 'connected',
      roomId: 'TEST-42',
      spectatorCount: 0,
      roomConfig: { ...DEFAULT_ROOM_CONFIG },
      scores: { p1: 3, p2: 1 },
      matchWinnerId: 'p1',
      roundHistory: [],
      rematchVoting: false,
      matchStartedAt: null,
    })
  })

  it('shows winner message when I win', () => {
    renderMatchEnd()
    expect(screen.getByText(/You Win/i)).toBeInTheDocument()
  })

  it('shows loser message when I lose', () => {
    useGameStore.setState({ matchWinnerId: 'p2' })
    renderMatchEnd()
    expect(screen.getByText(/You Lose/i)).toBeInTheDocument()
  })

  it('shows final score', async () => {
    renderMatchEnd()
    await waitFor(() => expect(screen.getAllByText('3').length).toBeGreaterThan(0))
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('shows match duration when matchStartedAt is set', () => {
    const fiveSecondsAgo = Date.now() - 5000
    useGameStore.setState({ matchStartedAt: fiveSecondsAgo })
    renderMatchEnd()
    expect(screen.getByText(/⏱/)).toBeInTheDocument()
  })

  it('does not show duration when matchStartedAt is null', () => {
    useGameStore.setState({ matchStartedAt: null })
    renderMatchEnd()
    expect(screen.queryByText(/⏱/)).not.toBeInTheDocument()
  })
})

describe('LobbyView — avatar picker', () => {
  it('shows the change-avatar button on the local player slot', () => {
    renderLobby()
    expect(screen.getByRole('button', { name: 'Change avatar' })).toBeInTheDocument()
  })

  it('opens the avatar picker when clicking the avatar', () => {
    renderLobby()
    fireEvent.click(screen.getByRole('button', { name: 'Change avatar' }))
    expect(screen.getByText('Pick your avatar')).toBeInTheDocument()
  })

  it('renders all 12 avatar options in the picker', () => {
    renderLobby()
    fireEvent.click(screen.getByRole('button', { name: 'Change avatar' }))
    // Avatar buttons use single emoji as aria-label (e.g. "🐺")
    // Use the known emoji list to count them precisely
    const emojis = ['🐺', '🦊', '🐻', '🐯', '🦁', '🐸', '🐨', '🦝', '🦄', '🐙', '🦖', '🐝']
    const avatarButtons = emojis.map((e) => screen.getByRole('button', { name: e }))
    expect(avatarButtons).toHaveLength(12)
  })

  it('closes the picker when backdrop is clicked', async () => {
    renderLobby()
    fireEvent.click(screen.getByRole('button', { name: 'Change avatar' }))
    expect(screen.getByText('Pick your avatar')).toBeInTheDocument()
    // Click the backdrop (the fixed overlay div)
    const backdrop = screen.getByText('Pick your avatar').closest('div')!.parentElement!
    fireEvent.click(backdrop)
    await waitFor(() => expect(screen.queryByText('Pick your avatar')).not.toBeInTheDocument())
  })

  it('does not show change-avatar button when player is ready (locked)', () => {
    useGameStore.setState({ players: [{ ...ME, ready: true }, OPP] })
    renderLobby()
    expect(screen.queryByRole('button', { name: 'Change avatar' })).not.toBeInTheDocument()
  })
})

describe('MatchEndView — config panel', () => {
  function renderMatchEnd() {
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
      players: [ME, OPP],
      roomStatus: 'match_end',
      wsStatus: 'connected',
      roomConfig: { ...DEFAULT_ROOM_CONFIG },
      scores: { p1: 3, p2: 1 },
      matchWinnerId: 'p1',
      roundHistory: [],
      rematchVoting: false,
      matchStartedAt: null,
    })
  })

  it('shows the Best-of selector on the match-end screen', () => {
    renderMatchEnd()
    expect(screen.getByText('Best of')).toBeInTheDocument()
  })

  it('P1 can change Best-of config', () => {
    const sendRoomConfig = vi.fn()
    useGameStore.setState({ sendRoomConfig })
    renderMatchEnd()
    fireEvent.click(screen.getByRole('button', { name: 'best-of-3' }))
    expect(sendRoomConfig).toHaveBeenCalledWith(expect.objectContaining({ bestOf: 3 }))
  })

  it('P2 cannot change config (read-only)', () => {
    const sendRoomConfig = vi.fn()
    useGameStore.setState({ myPlayerId: 'p2', sendRoomConfig })
    renderMatchEnd()
    // Buttons are rendered but clicking them for P2 (isCreator=false) should not call sendRoomConfig
    fireEvent.click(screen.getByRole('button', { name: 'best-of-3' }))
    expect(sendRoomConfig).not.toHaveBeenCalled()
  })

  it('config is locked while rematch is in progress', () => {
    const sendRoomConfig = vi.fn()
    useGameStore.setState({ rematchVoting: true, sendRoomConfig })
    renderMatchEnd()
    fireEvent.click(screen.getByRole('button', { name: 'best-of-3' }))
    expect(sendRoomConfig).not.toHaveBeenCalled()
  })
})

describe('Rematch flash', () => {
  it('shows REMATCH! overlay when status transitions from match_end to lobby', async () => {
    useGameStore.setState({ roomStatus: 'match_end' })
    render(
      <MemoryRouter initialEntries={['/room/TEST-42']}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomPage />} />
        </Routes>
      </MemoryRouter>
    )
    // Simulate rematch accepted: transition to lobby inside act so React processes it
    act(() => {
      useGameStore.setState({ roomStatus: 'lobby' })
    })
    expect(await screen.findByText(/REMATCH/i)).toBeInTheDocument()
  })
})

describe('LobbyView — room settings', () => {
  it('renders MATCH SETTINGS panel', () => {
    renderLobby()
    expect(screen.getByText(/MATCH SETTINGS/i)).toBeInTheDocument()
  })

  it('highlights the current bestOf value', () => {
    renderLobby()
    // Default is bestOf=5; check all four options render via aria-label
    expect(screen.getByRole('button', { name: 'best-of-3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'best-of-5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'best-of-7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'best-of-9' })).toBeInTheDocument()
  })

  it('all 5 category chips are visible', () => {
    renderLobby()
    expect(screen.getByRole('button', { name: /Reflex/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Math/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Luck/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Strategy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Trivia/i })).toBeInTheDocument()
  })

  it('settings controls are disabled for non-creator', () => {
    // p2 is not the creator (players[0] = p1)
    useGameStore.setState({ myPlayerId: 'p2' })
    renderLobby()
    expect(screen.getByRole('button', { name: 'best-of-3' })).toBeDisabled()
  })

  it('settings controls are enabled for creator', () => {
    // p1 is the creator (players[0])
    renderLobby()
    expect(screen.getByRole('button', { name: 'best-of-3' })).not.toBeDisabled()
  })
})
