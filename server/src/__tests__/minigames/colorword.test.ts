import { describe, it, expect } from 'vitest'
import { pick } from '../../minigames/colorword'

describe('pick()', () => {
  it('word and inkColor are always different', () => {
    for (let i = 0; i < 200; i++) {
      const { word, inkColor } = pick()
      expect(word).not.toBe(inkColor)
    }
  })

  it('always returns valid colors from the pool', () => {
    const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']
    for (let i = 0; i < 50; i++) {
      const { word, inkColor } = pick()
      expect(COLORS).toContain(word)
      expect(COLORS).toContain(inkColor)
    }
  })

  it('covers all 6 colors as word across many picks', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      seen.add(pick().word)
    }
    expect(seen.size).toBe(6)
  })
})
