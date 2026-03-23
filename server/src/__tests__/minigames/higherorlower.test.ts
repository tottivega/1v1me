import { describe, it, expect } from 'vitest'
import { generatePuzzle } from '../../minigames/higherorlower'

describe('generatePuzzle()', () => {
  it('target and clue are always different', () => {
    for (let i = 0; i < 200; i++) {
      const { target, clue } = generatePuzzle()
      expect(target).not.toBe(clue)
    }
  })

  it('target is always in range 2–99', () => {
    for (let i = 0; i < 200; i++) {
      const { target } = generatePuzzle()
      expect(target).toBeGreaterThanOrEqual(2)
      expect(target).toBeLessThanOrEqual(99)
    }
  })

  it('clue is always in range 1–99', () => {
    for (let i = 0; i < 200; i++) {
      const { clue } = generatePuzzle()
      expect(clue).toBeGreaterThanOrEqual(1)
      expect(clue).toBeLessThanOrEqual(99)
    }
  })

  it('offset between target and clue is 1–20', () => {
    for (let i = 0; i < 200; i++) {
      const { target, clue } = generatePuzzle()
      const diff = Math.abs(target - clue)
      expect(diff).toBeGreaterThanOrEqual(1)
      expect(diff).toBeLessThanOrEqual(20)
    }
  })
})
