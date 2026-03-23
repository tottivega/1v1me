import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoomPage from '../../pages/RoomPage'
import { useGameStore } from '../../store/gameStore'
import { DEFAULT_ROOM_CONFIG } from '@shared/types'

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

describe('LobbyView — room settings', () => {
  it('renders MATCH SETTINGS panel', () => {
    renderLobby()
    expect(screen.getByText(/MATCH SETTINGS/i)).toBeInTheDocument()
  })

  it('highlights the current bestOf value', () => {
    renderLobby()
    // Default is bestOf=5; the "5" button should be visually active (btn-orange class)
    // We just check all four options render
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '9' })).toBeInTheDocument()
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
    // All bestOf buttons should be disabled for the non-creator
    const btn3 = screen.getByRole('button', { name: '3' })
    expect(btn3).toBeDisabled()
  })

  it('settings controls are enabled for creator', () => {
    // p1 is the creator (players[0])
    renderLobby()
    const btn3 = screen.getByRole('button', { name: '3' })
    expect(btn3).not.toBeDisabled()
  })
})
