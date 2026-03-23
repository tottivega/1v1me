// Human-readable room codes: ADJECTIVE-NUMBER (e.g. SWIFT-42, GHOST-7)
// Easy to share verbally, distinct enough to avoid collisions at small scale.

const WORDS = [
  'WOLF', 'BEAR', 'HAWK', 'TIGER', 'SHARK', 'VIPER', 'GHOST', 'STORM',
  'BLAZE', 'FROST', 'PIXEL', 'TURBO', 'HYPER', 'ULTRA', 'SWIFT', 'BRAVE',
  'SONIC', 'LASER', 'NEON', 'ROUGE', 'STEEL', 'IRON', 'GOLD', 'JADE',
  'CYBER', 'ASTRO', 'CHAOS', 'PRIME', 'OMEGA', 'ALPHA', 'NOVA', 'COMET',
]

export function generateRoomCode(): string {
  const word   = WORDS[Math.floor(Math.random() * WORDS.length)]
  const number = Math.floor(Math.random() * 99) + 1
  return `${word}-${number}`
}
