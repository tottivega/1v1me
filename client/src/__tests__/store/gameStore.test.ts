import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../store/gameStore'

// Reset relevant store state before each test
beforeEach(() => {
  useGameStore.setState({
    myPlayerId: 'player-1',
    roomId: null,
    players: [],
    scores: {},
    currentRound: 1,
    currentMinigame: null,
    remainingMs: 0,
    timeoutMs: 0,
    roomStatus: 'lobby',
    lastRoundWinnerId: null,
    matchWinnerId: null,
    roundHistory: [],
    minigameState: null,
    spectatorCount: 0,
    rematchVoting: false,
    toasts: [],
    reconnectCountdown: null,
  })
})

function dispatch(msg: { type: string; payload: unknown }) {
  useGameStore.getState().handleServerMessage(msg as never)
}

describe('ROOM_JOINED', () => {
  it('sets player identity, room id, and players', () => {
    dispatch({
      type: 'ROOM_JOINED',
      payload: {
        roomId: 'abc123',
        playerId: 'uuid-me',
        players: [
          { id: 'uuid-me', nickname: 'Alice', avatar: '🐺', ready: false, connected: true },
        ],
        spectatorCount: 0,
      },
    })
    const s = useGameStore.getState()
    expect(s.myPlayerId).toBe('uuid-me')
    expect(s.roomId).toBe('abc123')
    expect(s.players).toHaveLength(1)
    expect(s.roomStatus).toBe('lobby')
  })

  it('clears rematchVoting', () => {
    useGameStore.setState({ rematchVoting: true })
    dispatch({
      type: 'ROOM_JOINED',
      payload: { roomId: 'r', playerId: 'p', players: [], spectatorCount: 0 },
    })
    expect(useGameStore.getState().rematchVoting).toBe(false)
  })

  it('sets spectatorCount from payload', () => {
    dispatch({
      type: 'ROOM_JOINED',
      payload: { roomId: 'r', playerId: 'p', players: [], spectatorCount: 3 },
    })
    expect(useGameStore.getState().spectatorCount).toBe(3)
  })
})

describe('PLAYER_READY', () => {
  it('marks the specified player as ready', () => {
    useGameStore.setState({
      players: [
        { id: 'p1', nickname: 'Alice', avatar: '🐺', ready: false, connected: true },
        { id: 'p2', nickname: 'Bob', avatar: '🦊', ready: false, connected: true },
      ],
    })
    dispatch({ type: 'PLAYER_READY', payload: { playerId: 'p1', bothReady: false } })
    const { players } = useGameStore.getState()
    expect(players.find((p) => p.id === 'p1')!.ready).toBe(true)
    expect(players.find((p) => p.id === 'p2')!.ready).toBe(false)
  })
})

describe('ROUND_START', () => {
  it('sets current round, minigame, and timer', () => {
    dispatch({
      type: 'ROUND_START',
      payload: { round: 2, minigameId: 'coinflip', timeoutMs: 0 },
    })
    const s = useGameStore.getState()
    expect(s.currentRound).toBe(2)
    expect(s.currentMinigame).toBe('coinflip')
    expect(s.timeoutMs).toBe(0)
    expect(s.roomStatus).toBe('playing')
  })
})

describe('TIMER_TICK', () => {
  it('updates remainingMs', () => {
    dispatch({ type: 'TIMER_TICK', payload: { remainingMs: 3200 } })
    expect(useGameStore.getState().remainingMs).toBe(3200)
  })
})

describe('ROUND_END', () => {
  it('updates scores and lastRoundWinnerId', () => {
    dispatch({
      type: 'ROUND_END',
      payload: { winnerId: 'p1', scores: { p1: 1, p2: 0 }, reason: 'completed' },
    })
    const s = useGameStore.getState()
    expect(s.lastRoundWinnerId).toBe('p1')
    expect(s.scores['p1']).toBe(1)
    expect(s.roomStatus).toBe('round_end')
  })
})

describe('MATCH_END', () => {
  it('sets matchWinnerId and round history', () => {
    dispatch({
      type: 'MATCH_END',
      payload: {
        winnerId: 'p2',
        scores: { p1: 1, p2: 3 },
        roundHistory: [{ round: 1, minigameId: 'coinflip', winnerId: 'p2' }],
      },
    })
    const s = useGameStore.getState()
    expect(s.matchWinnerId).toBe('p2')
    expect(s.roomStatus).toBe('match_end')
    expect(s.roundHistory).toHaveLength(1)
  })
})

describe('SPECTATOR_COUNT', () => {
  it('updates spectatorCount', () => {
    dispatch({ type: 'SPECTATOR_COUNT', payload: { count: 5 } })
    expect(useGameStore.getState().spectatorCount).toBe(5)
  })
})

describe('REMATCH_VOTE', () => {
  it('sets rematchVoting to true', () => {
    dispatch({ type: 'REMATCH_VOTE', payload: { waiting: true } })
    expect(useGameStore.getState().rematchVoting).toBe(true)
  })
})

describe('ERROR', () => {
  it('pushes a toast', () => {
    dispatch({ type: 'ERROR', payload: { code: 'ROOM_FULL', message: 'Room is full' } })
    expect(useGameStore.getState().toasts[0]?.message).toBe('Room is full')
    expect(useGameStore.getState().toasts[0]?.type).toBe('error')
  })
})
