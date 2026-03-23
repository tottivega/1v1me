import type { ComponentType } from 'react'
import type { MinigameId } from '@shared/types'
import ClickSpeed from './ClickSpeed'
import CoinFlip from './CoinFlip'
import ReactionTest from './ReactionTest'
import NumberGuess from './NumberGuess'
import QuickMaths from './QuickMaths'
import MemoryMatch from './MemoryMatch'
import FastestTyper from './FastestTyper'
import RockPaperScissors from './RockPaperScissors'
import WordScramble from './WordScramble'

// TypeScript will error here if a MinigameId is missing a component.
// When you add a new game: create the component file and add it here.
export const MINIGAME_COMPONENTS: Record<MinigameId, ComponentType> = {
  clickspeed:        ClickSpeed,
  coinflip:          CoinFlip,
  reactiontest:      ReactionTest,
  numberguess:       NumberGuess,
  quickmaths:        QuickMaths,
  memorymatch:       MemoryMatch,
  fastesttyper:      FastestTyper,
  rockpaperscissors: RockPaperScissors,
  wordscramble:      WordScramble,
}
