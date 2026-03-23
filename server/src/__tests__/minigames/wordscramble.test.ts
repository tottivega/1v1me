import { describe, it, expect } from 'vitest'
import { scramble } from '../../minigames/wordscramble'

describe('scramble()', () => {
  it('never returns the original word', () => {
    // Run many times to be confident given the random nature
    const word = 'planet'
    for (let i = 0; i < 200; i++) {
      expect(scramble(word)).not.toBe(word)
    }
  })

  it('returns an anagram — same letters, different order', () => {
    const word = 'castle'
    for (let i = 0; i < 50; i++) {
      const result = scramble(word)
      expect(result.split('').sort().join('')).toBe(word.split('').sort().join(''))
    }
  })

  it('returns a string of the same length', () => {
    const word = 'dragon'
    expect(scramble(word)).toHaveLength(word.length)
  })

  it('handles 2-letter words without infinite recursion', () => {
    // 'ab' can only scramble to 'ba' — should always succeed
    const result = scramble('ab')
    expect(result).toBe('ba')
  })

  it('handles longer words from the pool', () => {
    const word = 'blanket'
    const result = scramble(word)
    expect(result).not.toBe(word)
    expect(result).toHaveLength(word.length)
  })
})
