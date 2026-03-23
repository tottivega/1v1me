import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimerBar from '../../components/TimerBar'
import { useGameStore } from '../../store/gameStore'

beforeEach(() => {
  useGameStore.setState({
    roomStatus: 'playing',
    wsStatus: 'connected',
    remainingMs: 0,
    timeoutMs: 0,
  })
})

function renderWithTime(remainingMs: number, timeoutMs: number) {
  useGameStore.setState({ remainingMs, timeoutMs, roomStatus: 'playing', wsStatus: 'connected' })
  render(<TimerBar />)
  return screen.getByTestId('timer-bar-fill') as HTMLElement
}

describe('TimerBar color thresholds', () => {
  it('shows green when above 33% remaining', () => {
    const bar = renderWithTime(4000, 5000) // 80%
    expect(bar.style.background).toContain('var(--green)')
  })

  it('shows yellow between 15% and 33%', () => {
    const bar = renderWithTime(1200, 5000) // 24%
    expect(bar.style.background).toContain('var(--yellow)')
  })

  it('shows red below 15%', () => {
    const bar = renderWithTime(500, 5000) // 10%
    expect(bar.style.background).toContain('var(--red)')
  })

  it('displays the correct seconds count', () => {
    renderWithTime(3400, 5000)
    // Math.ceil(3400 / 1000) = 4
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
