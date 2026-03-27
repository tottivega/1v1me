import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playClick, playCorrect, playWrong } from '../utils/sounds'
import { randomDelay } from './mockUtils'
import {
  type RPSChoice,
  type RPSThrowRecord,
  type RockPaperScissorsState,
  type RockPaperScissorsStatePicking,
  type RockPaperScissorsStateReveal,
} from '@shared/types'

type Choice = RPSChoice

const CHOICES: { id: Choice; emoji: string; label: string }[] = [
  { id: 'rock', emoji: '🪨', label: 'ROCK' },
  { id: 'paper', emoji: '📄', label: 'PAPER' },
  { id: 'scissors', emoji: '✂️', label: 'SCISSORS' },
]

const BEATS: Record<Choice, Choice> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }

// ── Mock state ────────────────────────────────────────────────────────────────
interface MockState {
  throwNum: number
  phase: 'picking' | 'reveal' | 'done'
  myPick: Choice | null
  revealPicks: Record<string, Choice>
  throwWinnerId: string | null
  scores: Record<string, number>
  history: RPSThrowRecord[]
  finalWinnerId: string | null
}

const INITIAL_MOCK: MockState = {
  throwNum: 1,
  phase: 'picking',
  myPick: null,
  revealPicks: {},
  throwWinnerId: null,
  scores: {},
  history: [],
  finalWinnerId: null,
}

function getThrowWinner(c1: Choice, c2: Choice, p1Id: string, p2Id: string): string | null {
  if (c1 === c2) return null
  return BEATS[c1] === c2 ? p1Id : p2Id
}

export default function RockPaperScissors() {
  const { myPlayerId, players, sendInput, minigameState, isMockMatch } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)
  const oppId = opponent?.id ?? 'opp'

  const [mock, setMock] = useState<MockState>(INITIAL_MOCK)
  // Holds the opponent's staged pick before the player has picked (mock mode only)
  const stagedOppPick = useRef<Choice | null>(null)
  // Tracks what I picked in live mode (server only echoes back who submitted, not what)
  const myLivePickRef = useRef<Choice | null>(null)

  const serverState = isLive ? (minigameState as RockPaperScissorsState | null) : null

  // ── Reset on new round ─────────────────────────────────────────────────────
  useEffect(() => {
    setMock(INITIAL_MOCK)
    stagedOppPick.current = null
    myLivePickRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minigameState === null ? 0 : 1]) // fires when minigameState resets to null

  // ── Mock: schedule opponent's pick for the current throw ───────────────────
  useEffect(() => {
    if (isLive || mock.phase !== 'picking' || mock.finalWinnerId !== null) return
    stagedOppPick.current = null
    return randomDelay(700, 2200, () => {
      const oppChoice = CHOICES[Math.floor(Math.random() * 3)]!.id
      stagedOppPick.current = oppChoice
      // If player already picked, resolve immediately
      setMock((prev) => {
        if (prev.phase !== 'picking' || prev.myPick === null) return prev
        return resolveMockThrow(prev, prev.myPick, oppChoice)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock.phase, mock.throwNum, isLive])

  // ── Mock: advance to next throw after reveal delay ─────────────────────────
  useEffect(() => {
    if (isLive || mock.phase !== 'reveal' || mock.finalWinnerId !== null) return
    const t = setTimeout(() => {
      stagedOppPick.current = null
      setMock((prev) => ({
        ...prev,
        throwNum: prev.throwNum + 1,
        phase: 'picking',
        myPick: null,
        revealPicks: {},
        throwWinnerId: null,
      }))
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock.phase, mock.history.length, isLive])

  function resolveMockThrow(prev: MockState, myChoice: Choice, oppChoice: Choice): MockState {
    const winnerId = getThrowWinner(myChoice, oppChoice, myPlayerId, oppId)
    const newScores = { ...prev.scores }
    if (winnerId) newScores[winnerId] = (newScores[winnerId] ?? 0) + 1

    const revealPicks = { [myPlayerId]: myChoice, [oppId]: oppChoice }
    const newHistory: RPSThrowRecord[] = [...prev.history, { picks: revealPicks, winnerId }]

    const matchWinner = [myPlayerId, oppId].find((id) => (newScores[id] ?? 0) >= 2)
    const allDone = newHistory.length >= 3

    const base: MockState = {
      ...prev,
      phase: 'reveal',
      myPick: myChoice,
      revealPicks,
      throwWinnerId: winnerId,
      scores: newScores,
      history: newHistory,
    }

    if (matchWinner || allDone) {
      const s1 = newScores[myPlayerId] ?? 0
      const s2 = newScores[oppId] ?? 0
      const finalWinnerId =
        s1 > s2 ? myPlayerId : s2 > s1 ? oppId : Math.random() < 0.5 ? myPlayerId : oppId
      return { ...base, finalWinnerId }
    }
    return base
  }

  // ── Pick handlers ──────────────────────────────────────────────────────────
  function handlePick(choice: Choice) {
    playClick()
    if (isLive) {
      if (myLivePickRef.current) return
      myLivePickRef.current = choice
      sendInput({ type: 'PICK', choice })
    } else {
      if (mock.phase !== 'picking' || mock.myPick !== null) return
      if (stagedOppPick.current !== null) {
        setMock((prev) => resolveMockThrow(prev, choice, stagedOppPick.current!))
      } else {
        setMock((prev) => ({ ...prev, myPick: choice }))
      }
    }
  }

  // ── Sound on throw reveal ──────────────────────────────────────────────────
  const liveReveal =
    serverState?.phase === 'reveal' ? (serverState as RockPaperScissorsStateReveal) : null
  const revealWinner = isLive ? liveReveal?.throwWinnerId : mock.throwWinnerId
  const revealThrowNum = isLive ? (serverState?.throwNum ?? 0) : mock.throwNum

  useEffect(() => {
    const inReveal = isLive ? serverState?.phase === 'reveal' : mock.phase === 'reveal'
    if (!inReveal) return
    if (revealWinner === myPlayerId) playCorrect()
    else if (revealWinner !== null) playWrong()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealThrowNum, isLive ? serverState?.phase : mock.phase])

  // ── Derived display values ─────────────────────────────────────────────────
  const phase = isLive ? (serverState?.phase ?? 'picking') : mock.phase
  const throwNum = isLive ? (serverState?.throwNum ?? 1) : mock.throwNum
  const scores = isLive ? (serverState?.scores ?? {}) : mock.scores
  const history = isLive ? (serverState?.history ?? []) : mock.history

  const iHavePicked = isLive
    ? serverState?.phase === 'picking' &&
      (serverState as RockPaperScissorsStatePicking).submitted.includes(myPlayerId)
    : mock.myPick !== null

  const revealPicks: Record<string, Choice> | null = isLive
    ? (liveReveal?.picks ?? null)
    : mock.phase === 'reveal'
      ? mock.revealPicks
      : null

  const myScore = scores[myPlayerId] ?? 0
  const oppScore = scores[oppId] ?? 0
  const oppName = opponent?.nickname ?? '???'

  const finalWinnerId = isLive
    ? null // live final result comes through ROUND_END, not here
    : mock.finalWinnerId

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        flex: 1,
        padding: 24,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 32,
          color: 'var(--red)',
          textAlign: 'center',
        }}
      >
        ROCK PAPER SCISSORS ✂️
      </div>

      {/* Scoreboard */}
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <ThrowScore label="You" score={myScore} color="var(--blue)" />
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 18, opacity: 0.35 }}>vs</div>
        <ThrowScore label={oppName} score={oppScore} color="var(--orange)" />
      </div>

      {/* Throw counter / status */}
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 13,
          letterSpacing: 2,
          opacity: 0.45,
          textTransform: 'uppercase',
        }}
      >
        {finalWinnerId ? 'GAME OVER' : `Throw ${throwNum} of 3`}
      </div>

      {/* ── Final result (mock done) ── */}
      {finalWinnerId && (
        <div className="anim-bounce" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: finalWinnerId === myPlayerId ? 'var(--green)' : 'var(--red)',
              WebkitTextStroke: '2px var(--black)',
              textShadow: '3px 3px 0 var(--black)',
            }}
          >
            {finalWinnerId === myPlayerId ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
          </div>
        </div>
      )}

      {/* ── Picking phase ── */}
      {!finalWinnerId && phase === 'picking' && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 16,
              opacity: 0.5,
              letterSpacing: 1,
            }}
          >
            {iHavePicked ? `Waiting for ${oppName}…` : 'MAKE YOUR PICK'}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {CHOICES.map(({ id, emoji, label }) => {
              const isPicked = isLive ? myLivePickRef.current === id : mock.myPick === id
              return (
                <button
                  key={id}
                  onClick={() => handlePick(id)}
                  disabled={iHavePicked}
                  style={{
                    width: 96,
                    height: 108,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: isPicked ? 'var(--blue)' : 'var(--white)',
                    border: `3px solid var(--black)`,
                    borderRadius: 16,
                    boxShadow: isPicked ? '2px 2px 0 var(--black)' : '4px 4px 0 var(--black)',
                    transform: isPicked ? 'translate(2px, 2px)' : 'none',
                    cursor: iHavePicked ? 'default' : 'pointer',
                    opacity: iHavePicked && !isPicked ? 0.35 : 1,
                    transition: 'all 0.1s',
                    fontSize: 40,
                    padding: 0,
                  }}
                >
                  {emoji}
                  <span
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: 11,
                      color: isPicked ? 'var(--white)' : 'var(--black)',
                    }}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Reveal phase ── */}
      {!finalWinnerId && phase === 'reveal' && revealPicks && (
        <div
          className="anim-pop"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
        >
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <PickDisplay
              choice={revealPicks[myPlayerId]}
              label="You"
              isWinner={revealWinner === myPlayerId}
            />
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 20, opacity: 0.4 }}>VS</div>
            <PickDisplay
              choice={revealPicks[oppId]}
              label={oppName}
              isWinner={revealWinner === oppId}
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 20,
              color:
                revealWinner === myPlayerId
                  ? 'var(--green)'
                  : revealWinner === null
                    ? 'var(--orange)'
                    : 'var(--red)',
            }}
          >
            {revealWinner === myPlayerId
              ? '🏆 You take this throw!'
              : revealWinner === null
                ? '🤝 Tie!'
                : `${oppName} takes this throw!`}
          </div>
        </div>
      )}

      {/* Throw history dots */}
      {history.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {history.map((record: RPSThrowRecord, i: number) => {
            const won = record.winnerId === myPlayerId
            const tied = record.winnerId === null
            return (
              <div
                key={i}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '2px solid var(--black)',
                  background: tied ? 'var(--orange)' : won ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-title)',
                  fontSize: 14,
                  color: 'var(--white)',
                }}
              >
                {tied ? '–' : won ? '✓' : '✗'}
              </div>
            )
          })}
          {/* Empty slots for remaining throws */}
          {Array.from({ length: Math.max(0, 3 - history.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '2px dashed rgba(0,0,0,0.2)',
                background: 'transparent',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ThrowScore({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 52,
          color,
          lineHeight: 1,
          textShadow: '3px 3px 0 var(--black)',
        }}
      >
        {score}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          opacity: 0.55,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function PickDisplay({
  choice,
  label,
  isWinner,
}: {
  choice: Choice | undefined
  label: string
  isWinner: boolean
}) {
  const emoji =
    choice === 'rock' ? '🪨' : choice === 'paper' ? '📄' : choice === 'scissors' ? '✂️' : '❓'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        background: isWinner ? 'rgba(68,204,68,0.15)' : 'rgba(0,0,0,0.04)',
        border: `3px solid ${isWinner ? 'var(--green)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: 14,
        padding: '14px 22px',
        transition: 'all 0.2s',
      }}
    >
      <span style={{ fontSize: 52 }}>{emoji}</span>
      <span style={{ fontFamily: 'var(--font-title)', fontSize: 12, opacity: 0.55 }}>
        {label.toUpperCase()}
      </span>
    </div>
  )
}
