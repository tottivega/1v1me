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
  })
})

describe('ScoreBoard', () => {
  it('renders both player nicknames', () => {
    render(<ScoreBoard />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders correct round display', () => {
    useGameStore.setState({ currentRound: 3 })
    render(<ScoreBoard />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('shows "First to 3 wins" when no spectators', () => {
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
