import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playClick, playCorrect, playWrong } from '../utils/sounds'
import type { TapSequenceState } from '@shared/types'

const BUTTONS = 4
const START_LEVEL = 1
const MAX_LEVEL = 10
const SHOW_ON_MS = 500
const SHOW_OFF_MS = 200
const SHOW_PRE_DELAY_MS = 600
const SHOW_PER_BUTTON_MS = SHOW_ON_MS + SHOW_OFF_MS // must match server
const RESULT_DELAY_MS = 1500

function levelToSeqLen(level: number): number {
  return level + 3
}

function generateSeq(len: number): number[] {
  return Array.from({ length: len }, () => Math.floor(Math.random() * BUTTONS))
}

// Classic Simon Says button colors
const BTN_COLORS = ['#43a047', '#e53935', '#fdd835', '#1e88e5'] as const
const BTN_LABELS = ['green', 'red', 'yellow', 'blue'] as const

interface MockState {
  level: number
  seqLen: number
  phase: 'showing' | 'input'
  sequence: number[]
  myProgress: number
  oppProgress: number
  myEliminated: boolean
  oppEliminated: boolean
  myPassed: boolean
  oppPassed: boolean
  winnerId: string | null
  resolved: boolean
}

function initMock(): MockState {
  const lvl = START_LEVEL
  return {
    level: lvl,
    seqLen: levelToSeqLen(lvl),
    phase: 'showing',
    sequence: generateSeq(levelToSeqLen(lvl)),
    myProgress: 0,
    oppProgress: 0,
    myEliminated: false,
    oppEliminated: false,
    myPassed: false,
    oppPassed: false,
    winnerId: null,
    resolved: false,
  }
}

export default function TapSequence() {
  const { myPlayerId, players, sendInput, minigameState, isMockMatch } = useGameStore()
  const isLive = !isMockMatch
  const opponent = players.find((p) => p.id !== myPlayerId)
  const oppId = opponent?.id ?? 'opp'

  // ── Live mode ──────────────────────────────────────────────────────────────
  const server = isLive ? (minigameState as TapSequenceState | null) : null

  // ── Mock mode ──────────────────────────────────────────────────────────────
  const [mock, setMock] = useState<MockState>(initMock)
  const mockRef = useRef(mock)
  mockRef.current = mock

  useEffect(() => {
    if (isLive) return
    setMock(initMock())
  }, [isLive])

  // ── Unified display values ─────────────────────────────────────────────────
  const level = isLive ? (server?.level ?? START_LEVEL) : mock.level
  const seqLen = isLive ? (server?.seqLen ?? 4) : mock.seqLen
  const phase = isLive ? (server?.phase ?? 'showing') : mock.phase
  const sequence = isLive ? (server?.sequence ?? []) : mock.sequence
  const myProgress = isLive ? (server?.progress?.[myPlayerId] ?? 0) : mock.myProgress
  const oppProgress = isLive ? (server?.progress?.[oppId] ?? 0) : mock.oppProgress
  const myPassed = isLive ? !!server?.passed?.[myPlayerId] : mock.myPassed
  const oppPassed = isLive ? !!server?.passed?.[oppId] : mock.oppPassed
  const myEliminated = isLive ? !!server?.eliminated?.[myPlayerId] : mock.myEliminated
  const oppEliminated = isLive ? !!server?.eliminated?.[oppId] : mock.oppEliminated
  const winnerId = isLive ? server?.winnerId : mock.winnerId
  const iWon = winnerId === myPlayerId

  // ── Flash animation ────────────────────────────────────────────────────────
  // litButton: which button index (0-3) is currently highlighted, or null
  const [litButton, setLitButton] = useState<number | null>(null)

  useEffect(() => {
    if (phase !== 'showing' || sequence.length === 0) {
      setLitButton(null)
      return
    }
    setLitButton(null)

    let cancelled = false
    let tid: ReturnType<typeof setTimeout>

    function flashStep(idx: number) {
      if (cancelled) return
      if (idx >= sequence.length) {
        setLitButton(null)
        return
      }
      setLitButton(sequence[idx]!)
      tid = setTimeout(() => {
        if (cancelled) return
        setLitButton(null)
        tid = setTimeout(() => flashStep(idx + 1), SHOW_OFF_MS)
      }, SHOW_ON_MS)
    }

    tid = setTimeout(() => flashStep(0), SHOW_PRE_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(tid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sequence.join(','), level])

  // ── Mock: switch from showing → input after animation ─────────────────────
  useEffect(() => {
    if (isLive) return
    const m = mockRef.current
    if (m.phase !== 'showing' || m.resolved) return
    const delay = SHOW_PRE_DELAY_MS + m.seqLen * SHOW_PER_BUTTON_MS + 400
    const t = setTimeout(() => {
      if (mockRef.current.resolved) return
      setMock((prev) => ({ ...prev, phase: 'input' }))
    }, delay)
    return () => clearTimeout(t)
     
  }, [isLive, mock.level])

  // ── Mock: computer opponent presses buttons one at a time ──────────────────
  // 70% chance of pressing the correct button at each position
  useEffect(() => {
    if (isLive) return
    const m = mockRef.current
    if (m.phase !== 'input' || m.resolved || m.oppEliminated || m.oppPassed) return

    const delay = 500 + Math.random() * 700
    const t = setTimeout(() => {
      const cur = mockRef.current
      if (cur.phase !== 'input' || cur.resolved || cur.oppEliminated || cur.oppPassed) return
      const pos = cur.oppProgress
      if (pos >= cur.seqLen) return
      const correct = Math.random() < 0.7
      const btn = correct
        ? cur.sequence[pos]!
        : (cur.sequence[pos]! + 1 + Math.floor(Math.random() * (BUTTONS - 1))) % BUTTONS
      applyMockPress(oppId, btn)
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, mock.phase, mock.oppProgress, mock.oppEliminated, mock.oppPassed, mock.level])

  // ── Mock: advance to next level when both passed ───────────────────────────
  useEffect(() => {
    if (isLive) return
    if (!mock.myPassed || !mock.oppPassed || mock.resolved) return
    const t = setTimeout(() => {
      if (mockRef.current.resolved) return
      const newLevel = mockRef.current.level + 1
      setMock((prev) => ({
        ...prev,
        level: newLevel,
        seqLen: levelToSeqLen(newLevel),
        phase: 'showing',
        sequence: generateSeq(levelToSeqLen(newLevel)),
        myProgress: 0,
        oppProgress: 0,
        myEliminated: false,
        oppEliminated: false,
        myPassed: false,
        oppPassed: false,
      }))
    }, RESULT_DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, mock.myPassed, mock.oppPassed])

  // ── Mock press logic ───────────────────────────────────────────────────────
  function applyMockPress(pid: string, btn: number) {
    setMock((prev) => {
      if (prev.resolved || prev.phase !== 'input') return prev
      const isMe = pid === myPlayerId
      if (isMe && (prev.myEliminated || prev.myPassed)) return prev
      if (!isMe && (prev.oppEliminated || prev.oppPassed)) return prev

      const pos = isMe ? prev.myProgress : prev.oppProgress
      const expected = prev.sequence[pos]

      if (btn !== expected) {
        // Wrong button
        const next = isMe ? { ...prev, myEliminated: true } : { ...prev, oppEliminated: true }

        const bothElim = next.myEliminated && next.oppEliminated
        if (bothElim) {
          return {
            ...next,
            resolved: true,
            winnerId: Math.random() < 0.5 ? myPlayerId : oppId,
          }
        }
        if (next.myEliminated && !next.oppEliminated) {
          return { ...next, resolved: true, winnerId: oppId }
        }
        if (next.oppEliminated && !next.myEliminated) {
          return { ...next, resolved: true, winnerId: myPlayerId }
        }
        return next
      }

      // Correct press
      const newProgress = pos + 1
      const next = isMe
        ? { ...prev, myProgress: newProgress }
        : { ...prev, oppProgress: newProgress }

      if (newProgress >= prev.seqLen) {
        const nextWithPassed = isMe ? { ...next, myPassed: true } : { ...next, oppPassed: true }

        if (prev.level >= MAX_LEVEL) {
          return { ...nextWithPassed, resolved: true, winnerId: pid }
        }

        const myNowPassed = isMe ? true : prev.myPassed
        const oppNowPassed = isMe ? prev.oppPassed : true

        if (isMe && prev.oppEliminated) {
          return { ...nextWithPassed, resolved: true, winnerId: myPlayerId }
        }
        if (!isMe && prev.myEliminated) {
          return { ...nextWithPassed, resolved: true, winnerId: oppId }
        }
        // If both now passed, the useEffect above handles advancing the level
        void myNowPassed
        void oppNowPassed
        return nextWithPassed
      }

      return next
    })
  }

  // ── Player input handler ───────────────────────────────────────────────────
  function handlePress(btn: number) {
    if (phase !== 'input') return
    if (myEliminated || myPassed) return
    playClick()

    if (isLive) {
      sendInput({ type: 'PRESS', button: btn })
    } else {
      applyMockPress(myPlayerId, btn)
    }
  }

  // ── Derived display ────────────────────────────────────────────────────────
  const isInteractive = phase === 'input' && !myEliminated && !myPassed && !winnerId
  const showResult = !!winnerId

  // Sound on my elimination/pass in mock mode
  const prevMyElimRef = useRef(false)
  const prevMyPassRef = useRef(false)
  useEffect(() => {
    if (isLive) return
    if (mock.myEliminated && !prevMyElimRef.current) playWrong()
    if (mock.myPassed && !prevMyPassRef.current) playCorrect()
    prevMyElimRef.current = mock.myEliminated
    prevMyPassRef.current = mock.myPassed
  }, [isLive, mock.myEliminated, mock.myPassed])

  // ── Render ─────────────────────────────────────────────────────────────────
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
      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 28,
          color: 'var(--blue)',
          textAlign: 'center',
        }}
      >
        TAP SEQUENCE 🟩
      </div>

      {/* Level badge */}
      {!showResult && (
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 14,
            color: 'rgba(0,0,0,0.45)',
            letterSpacing: 1,
          }}
        >
          LEVEL {level} / {MAX_LEVEL} — {seqLen} BUTTONS
        </div>
      )}

      {/* Phase label */}
      {!showResult && (
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 16,
            letterSpacing: 2,
            color: phase === 'showing' ? 'var(--orange)' : 'var(--green)',
            transition: 'color 0.3s',
          }}
        >
          {phase === 'showing'
            ? 'WATCH...'
            : myEliminated
              ? 'WRONG BUTTON! ✗'
              : myPassed
                ? 'PASSED! ✓'
                : 'YOUR TURN!'}
        </div>
      )}

      {/* 2×2 Button grid */}
      {!showResult && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {BTN_COLORS.map((color, i) => {
            const isLit = litButton === i
            const isDisabled = !isInteractive
            return (
              <button
                key={i}
                aria-label={BTN_LABELS[i]}
                onClick={() => handlePress(i)}
                disabled={isDisabled}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 16,
                  border: '3px solid var(--black)',
                  background: isLit
                    ? `color-mix(in srgb, ${color} 100%, white 0%)`
                    : `color-mix(in srgb, ${color} 55%, #888 45%)`,
                  boxShadow: isLit
                    ? `0 0 0 4px var(--black), 0 0 24px 6px ${color}`
                    : 'var(--shadow)',
                  cursor: isDisabled ? 'default' : 'pointer',
                  transform: isLit ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.08s, box-shadow 0.08s, background 0.08s',
                  outline: 'none',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Progress slots */}
      {!showResult && phase === 'input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <ProgressSlots
            label="You"
            progress={myProgress}
            seqLen={seqLen}
            sequence={sequence}
            eliminated={myEliminated}
            passed={myPassed}
          />
          <ProgressSlots
            label={opponent?.nickname ?? 'Opponent'}
            progress={oppProgress}
            seqLen={seqLen}
            sequence={sequence}
            eliminated={oppEliminated}
            passed={oppPassed}
          />
        </div>
      )}

      {/* Waiting message after passing (levels 1-9) */}
      {!showResult && myPassed && !oppPassed && !oppEliminated && (
        <div
          className="anim-pulse"
          style={{ fontSize: 14, fontWeight: 700, color: 'rgba(0,0,0,0.4)' }}
        >
          Waiting for {opponent?.nickname ?? 'opponent'}…
        </div>
      )}

      {/* Result */}
      {showResult && (
        <div className="anim-bounce" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: iWon ? 'var(--green)' : 'var(--red)',
              WebkitTextStroke: '2px var(--black)',
              textShadow: '3px 3px 0 var(--black)',
            }}
          >
            {iWon ? 'YOU WIN! 🎉' : 'YOU LOSE 😤'}
          </div>
          <div className="subtitle" style={{ opacity: 0.6, marginTop: 8 }}>
            {iWon
              ? myEliminated
                ? 'Opponent slipped up!'
                : `Level ${level} complete!`
              : myEliminated
                ? 'Wrong button!'
                : `Beaten to level ${level}!`}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressSlots({
  label,
  progress,
  seqLen,
  sequence,
  eliminated,
  passed,
}: {
  label: string
  progress: number
  seqLen: number
  sequence: number[]
  eliminated: boolean
  passed: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: 'rgba(0,0,0,0.45)',
          width: 60,
          textAlign: 'right',
          textTransform: 'uppercase',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: seqLen }).map((_, i) => {
          const btn = sequence[i]
          const filled = i < progress
          const color = btn !== undefined ? BTN_COLORS[btn] : '#888'
          return (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: filled ? color : 'rgba(0,0,0,0.1)',
                border: filled ? '2px solid rgba(0,0,0,0.25)' : '2px dashed rgba(0,0,0,0.15)',
                transition: 'background 0.1s',
              }}
            />
          )
        })}
      </div>
      {eliminated && <div style={{ fontSize: 16, lineHeight: 1 }}>✗</div>}
      {passed && <div style={{ fontSize: 16, lineHeight: 1 }}>✓</div>}
    </div>
  )
}
