import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScoreBoard from '../../components/ScoreBoard'
import { useGameStore } from '../../store/gameStore'

const ME = { id: 'p1', nickname: 'Alice', ready: true, connected: true }
const OPP = { id: 'p2', nickname: 'Bob', ready: true, connected: true }

beforeEach(() => {
  useGameStore.setState({
    players: [ME, OPP],
    myPlayerId: 'p1',
    scores: { p1: 0, p2: 0 },
    currentRound: 1,
    myColor: 'var(--blue)',
    oppColor: 'var(--orange)',
    spectatorCount: 0,
    roomConfig: { bestOf: 5, enabledCategories: ['reflex', 'math', 'luck', 'strategy', 'trivia'] },
  })
})

describe('ScoreBoard', () => {
  it('renders both player nicknames', () => {
    render(<ScoreBoard />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders correct round display using bestOf from config', () => {
    useGameStore.setState({ currentRound: 3 })
    render(<ScoreBoard />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('reflects bestOf=7 in round display and wins-needed', () => {
    useGameStore.setState({
      currentRound: 2,
      roomConfig: { bestOf: 7, enabledCategories: ['reflex'] },
    })
    render(<ScoreBoard />)
    expect(screen.getByText('2/7')).toBeInTheDocument()
    expect(screen.getByText('First to 4 wins')).toBeInTheDocument()
  })

  it('shows "First to 3 wins" for default bestOf=5 when no spectators', () => {
    render(<ScoreBoard />)
    expect(screen.getByText('First to 3 wins')).toBeInTheDocument()
  })

  it('shows spectator count when there are watchers', () => {
    useGameStore.setState({ spectatorCount: 4 })
    render(<ScoreBoard />)
    expect(screen.getByText('👁 4 watching')).toBeInTheDocument()
  })

  it('renders current scores', () => {
    useGameStore.setState({ scores: { p1: 2, p2: 1 } })
    render(<ScoreBoard />)
    // Both score values should appear somewhere in the rendered output
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
