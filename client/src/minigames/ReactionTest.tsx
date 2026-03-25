import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { playReactionGo, playEarly } from '../utils/sounds'
import { type ReactionTestState } from '@shared/types'

type Phase = 'waiting' | 'ready' | 'clicked' | 'too-early' | 'result'

export default function ReactionTest() {
  const { myPlayerId, players, sendInput, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected' && minigameState !== null
  const opponent = players.find((p) => p.id !== myPlayerId)

  // ── Live mode: driven by server GAME_UPDATE ───────────────────────────────
  const serverState = isLive ? (minigameState as ReactionTestState | null) : null

  // Track whether we've already sent our reaction this round
  const hasSentReaction = useRef(false)
  const [_localClickedAt, setLocalClickedAt] = useState<number | null>(null)

  // Reset on new round (minigameState resets to null on ROUND_START)
  useEffect(() => {
    if (minigameState === null) {
      hasSentReaction.current = false
      setLocalClickedAt(null)
    }
  }, [minigameState])

  function handleLiveClick() {
    if (hasSentReaction.current) return
    const phase = serverState?.phase
    if (phase === 'waiting') {
      // Clicked too early — server will handle penalisation
      sendInput({ type: 'REACT' })
      hasSentReaction.current = true
    } else if (phase === 'ready') {
      setLocalClickedAt(Date.now())
      sendInput({ type: 'REACT' })
      hasSentReaction.current = true
    }
    // If phase === 'result', ignore
  }

  // Play GO sound when server phase transitions to 'ready'
  const prevLivePhase = useRef<string>('')
  useEffect(() => {
    if (!isLive || !serverState) return
    if (serverState.phase === 'ready' && prevLivePhase.current !== 'ready') playReactionGo()
    prevLivePhase.current = serverState.phase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverState?.phase, isLive])

  const iAmPenalized = serverState?.penalized?.includes(myPlayerId) ?? false
  const myReactionMs = serverState?.reactions?.[myPlayerId] ?? null
  const oppReactionMs = opponent ? (serverState?.reactions?.[opponent.id] ?? null) : null
  const liveWinnerId = serverState?.winnerId

  // ── Mock mode: local simulation ───────────────────────────────────────────
  const [mockPhase, setMockPhase] = useState<Phase>('waiting')
  const [mockMyTime, setMockMyTime] = useState<number | null>(null)
  const [mockOppTime, setMockOppTime] = useState<number | null>(null)
  const signalAt = useRef<number>(0)
  const mockTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (isLive) return
    setMockPhase('waiting')
    setMockMyTime(null)
    setMockOppTime(null)

    const delay = 1500 + Math.random() * 2500
    mockTimerRef.current = window.setTimeout(() => {
      signalAt.current = Date.now()
      playReactionGo()
      setMockPhase('ready')
      const oppDelay = 200 + Math.random() * 500
      setTimeout(() => setMockOppTime(Math.round(oppDelay)), oppDelay)
      setTimeout(() => setMockPhase((p) => (p === 'ready' ? 'result' : p)), 3000)
    }, delay)

    return () => {
      if (mockTimerRef.current) clearTimeout(mockTimerRef.current)
    }
  }, [isLive])

  function handleMockClick() {
    if (mockPhase === 'waiting') {
      if (mockTimerRef.current) clearTimeout(mockTimerRef.current)
      playEarly()
      setMockPhase('too-early')
      return
    }
    if (mockPhase !== 'ready') return
    setMockMyTime(Date.now() - signalAt.current)
    setMockPhase('clicked')
    setTimeout(() => setMockPhase('result'), 800)
  }

  // ── Unified rendering ─────────────────────────────────────────────────────
  if (isLive) {
    const phase = serverState?.phase ?? 'waiting'
    const showResult = phase === 'result'
    const iWon = liveWinnerId === myPlayerId

    const bgColor = iAmPenalized
      ? '#880000'
      : phase === 'ready'
        ? 'var(--green)'
        : showResult
          ? '#222222'
          : '#cc2222'

    return (
      <div
        onClick={handleLiveClick}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: bgColor,
          transition: 'background 0.15s',
          cursor: showResult ? 'default' : 'pointer',
          userSelect: 'none',
          borderTop: 'var(--border)',
        }}
      >
        {phase === 'waiting' && !iAmPenalized && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 48,
                color: 'var(--white)',
                textShadow: '3px 3px 0 rgba(0,0,0,0.4)',
              }}
            >
              ⚠️ WAIT…
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 18 }}>
              Click when the screen turns green!
            </div>
            {hasSentReaction.current && (
              <div className="badge badge-red">⚡ Input sent — waiting…</div>
            )}
          </>
        )}
        {iAmPenalized && (
          <div className="anim-shake" style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 52,
                color: 'var(--yellow)',
                textShadow: '3px 3px 0 rgba(0,0,0,0.4)',
              }}
            >
              TOO EARLY! 💀
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 700,
                marginTop: 12,
                fontSize: 18,
              }}
            >
              You clicked too soon. Opponent wins.
            </div>
          </div>
        )}
        {phase === 'ready' && !hasSentReaction.current && (
          <div className="anim-pop">
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 72,
                color: 'var(--white)',
                textShadow: '4px 4px 0 rgba(0,0,0,0.4)',
              }}
            >
              🟢 CLICK NOW!
            </div>
          </div>
        )}
        {phase === 'ready' && hasSentReaction.current && (
          <div style={{ fontFamily: 'var(--font-title)', fontSize: 52, color: 'var(--white)' }}>
            ⚡ Reacted!
          </div>
        )}
        {showResult && (
          <div className="anim-bounce" style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 52,
                color: iWon ? 'var(--yellow)' : 'var(--red)',
                textShadow: '3px 3px 0 rgba(0,0,0,0.4)',
              }}
            >
              {iWon ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 24, justifyContent: 'center' }}>
              {myReactionMs !== null && <ReactionTime label="You" ms={myReactionMs} />}
              {oppReactionMs !== null && (
                <ReactionTime label={opponent?.nickname ?? 'Opponent'} ms={oppReactionMs} />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Mock mode
  const mockIWon =
    mockMyTime !== null && mockOppTime !== null
      ? mockMyTime < mockOppTime
      : mockPhase === 'too-early'
        ? false
        : mockMyTime !== null

  const mockBg =
    mockPhase === 'waiting'
      ? '#cc2222'
      : mockPhase === 'too-early'
        ? '#880000'
        : mockPhase === 'ready'
          ? 'var(--green)'
          : '#222222'

  return (
    <div
      onClick={handleMockClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        background: mockBg,
        transition: 'background 0.15s',
        cursor: mockPhase === 'result' ? 'default' : 'pointer',
        userSelect: 'none',
        borderTop: 'var(--border)',
      }}
    >
      {mockPhase === 'waiting' && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 48,
              color: 'var(--white)',
              textShadow: '3px 3px 0 rgba(0,0,0,0.4)',
            }}
          >
            ⚠️ WAIT…
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 18 }}>
            Click when the screen turns green!
          </div>
        </>
      )}
      {mockPhase === 'too-early' && (
        <div className="anim-shake" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: 'var(--yellow)',
              textShadow: '3px 3px 0 rgba(0,0,0,0.4)',
            }}
          >
            TOO EARLY! 💀
          </div>
          <div
            style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginTop: 12, fontSize: 18 }}
          >
            You're disqualified. Opponent wins.
          </div>
        </div>
      )}
      {mockPhase === 'ready' && (
        <div className="anim-pop">
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 72,
              color: 'var(--white)',
              textShadow: '4px 4px 0 rgba(0,0,0,0.4)',
            }}
          >
            🟢 CLICK NOW!
          </div>
        </div>
      )}
      {mockPhase === 'clicked' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: 52, color: 'var(--white)' }}>
            ⚡ {mockMyTime}ms
          </div>
          <div
            style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 18, marginTop: 8 }}
          >
            Waiting for result…
          </div>
        </div>
      )}
      {mockPhase === 'result' && (
        <div className="anim-bounce" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: mockIWon ? 'var(--yellow)' : 'var(--red)',
              textShadow: '3px 3px 0 rgba(0,0,0,0.4)',
            }}
          >
            {mockIWon ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
          </div>
          <div style={{ display: 'flex', gap: 32, marginTop: 24, justifyContent: 'center' }}>
            {mockMyTime && <ReactionTime label="You" ms={mockMyTime} />}
            {mockOppTime && (
              <ReactionTime label={opponent?.nickname ?? 'Opponent'} ms={mockOppTime} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ReactionTime({ label, ms }: { label: string; ms: number }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--white)' }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 36 }}>{ms}ms</div>
      <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 700 }}>{label}</div>
    </div>
  )
}
