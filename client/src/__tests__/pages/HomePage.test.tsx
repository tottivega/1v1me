import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../../pages/HomePage'
import { MINIGAME_CONFIGS } from '@shared/types'

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  )
}

describe('HomePage — game gallery', () => {
  it('shows all games by default', () => {
    renderHome()
    const totalGames = Object.keys(MINIGAME_CONFIGS).length
    // Each game card has its label rendered; count unique cfg labels
    const labels = Object.values(MINIGAME_CONFIGS).map((cfg) => cfg.label)
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(labels).toHaveLength(totalGames)
  })

  it('renders ALL and all 5 category filter pills', () => {
    renderHome()
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^reflex$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^math$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^luck$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^strategy$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^trivia$/i })).toBeInTheDocument()
  })

  it('filters to only reflex games when Reflex pill is clicked', () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: /^reflex$/i }))

    const reflexGames = Object.values(MINIGAME_CONFIGS).filter((cfg) => cfg.category === 'reflex')
    const nonReflexGames = Object.values(MINIGAME_CONFIGS).filter(
      (cfg) => cfg.category !== 'reflex'
    )

    for (const cfg of reflexGames) {
      expect(screen.getByText(cfg.label)).toBeInTheDocument()
    }
    for (const cfg of nonReflexGames) {
      expect(screen.queryByText(cfg.label)).not.toBeInTheDocument()
    }
  })

  it('restores all games when ALL pill is clicked after filtering', () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: /^math$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^all$/i }))

    for (const cfg of Object.values(MINIGAME_CONFIGS)) {
      expect(screen.getByText(cfg.label)).toBeInTheDocument()
    }
  })
})

describe('HomePage — nickname input', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the nickname input', () => {
    renderHome()
    expect(screen.getByPlaceholderText(/CoolDude99/i)).toBeInTheDocument()
  })

  it('renders Create Room and Join with code buttons', () => {
    renderHome()
    expect(screen.getByText(/Create Room/i)).toBeInTheDocument()
    expect(screen.getByText(/Join with code/i)).toBeInTheDocument()
  })
})
