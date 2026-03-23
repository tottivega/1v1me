import { describe, it, expect } from 'vitest'
import { throwWinner } from '../../minigames/rockpaperscissors'

describe('throwWinner()', () => {
  it('rock beats scissors', () => {
    expect(throwWinner('rock', 'scissors', 'p1', 'p2')).toBe('p1')
    expect(throwWinner('scissors', 'rock', 'p1', 'p2')).toBe('p2')
  })

  it('scissors beats paper', () => {
    expect(throwWinner('scissors', 'paper', 'p1', 'p2')).toBe('p1')
    expect(throwWinner('paper', 'scissors', 'p1', 'p2')).toBe('p2')
  })

  it('paper beats rock', () => {
    expect(throwWinner('paper', 'rock', 'p1', 'p2')).toBe('p1')
    expect(throwWinner('rock', 'paper', 'p1', 'p2')).toBe('p2')
  })

  it('tie returns null', () => {
    expect(throwWinner('rock', 'rock', 'p1', 'p2')).toBeNull()
    expect(throwWinner('paper', 'paper', 'p1', 'p2')).toBeNull()
    expect(throwWinner('scissors', 'scissors', 'p1', 'p2')).toBeNull()
  })
})
