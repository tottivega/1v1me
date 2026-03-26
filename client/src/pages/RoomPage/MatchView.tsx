import { useEffect, useState, useRef, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/gameStore'
import { MINIGAME_CONFIGS } from '@shared/types'
import { MINIGAME_COMPONENTS } from '../../minigames/registry'
import {
  playClick,
  playRoundWin,
  playRoundLose,
  playTick,
  startAmbient,
  stopAmbient,
} from '../../utils/sounds'
import ScoreBoard from '../../components/ScoreBoard'
import TimerBar from '../../components/TimerBar'
import { CATEGORY_OVERLAY_BG, EMOTES } from './constants'

function RoundEndOverlay() {
  const {
    lastRoundWinnerId,
    myPlayerId,
    players,
    scores,
    wsStatus,
    send,
    isMockMatch,
    mockNextRound,
  } = useGameStore()
  const iWon = lastRoundWinnerId === myPlayerId
  const winner = players.find((p) => p.id === lastRoundWinnerId)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    iWon ? playRoundWin() : playRoundLose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function confirm() {
    if (confirmed) return
    setConfirmed(true)
    playClick()
    if (isMockMatch) {
      mockNextRound()
    } else {
      send('ROUND_READY')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}
    >
      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 60,
            color: iWon ? 'var(--yellow)' : 'var(--red)',
            textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
          }}
        >
          {iWon
            ? '🏆 You won that!'
            : lastRoundWinnerId === null
              ? '🤝 Draw!'
              : `${winner?.nickname ?? 'Opponent'} wins!`}
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 16, justifyContent: 'center' }}>
          {players.map((p) => (
            <div key={p.id} style={{ textAlign: 'center', color: 'var(--white)' }}>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: 48 }}>
                {scores[p.id] ?? 0}
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 700 }}>
                {p.id === myPlayerId ? 'You' : p.nickname}
              </div>
            </div>
          ))}
        </div>
      </div>

      {wsStatus === 'connected' ? (
        confirmed ? (
          <div className="subtitle anim-pulse" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Waiting for opponent…
          </div>
        ) : (
          <button className="btn btn-orange btn-lg" onClick={confirm} style={{ minWidth: 200 }}>
            Next Round →
          </button>
        )
      ) : (
        <div className="subtitle" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Next round starting…
        </div>
      )}
    </div>
  )
}

export default function MatchView() {
  const navigate = useNavigate()
  const {
    currentMinigame,
    roomStatus,
    currentRound,
    reconnectCountdown,
    players,
    myPlayerId,
    scores,
    roomConfig,
    send,
    disconnect,
    incomingEmote,
    roundHistory,
    isMockMatch,
  } = useGameStore()
  const MinigameComp = currentMinigame ? MINIGAME_COMPONENTS[currentMinigame] : null
  const cfg = currentMinigame ? MINIGAME_CONFIGS[currentMinigame] : null
  const isMatchOver = Object.values(scores).some((s) => s >= Math.ceil(roomConfig.bestOf / 2))

  const [showTransition, setShowTransition] = useState(false)
  const [transitionData, setTransitionData] = useState<{
    round: number
    cfg: typeof cfg
    matchPointFor: string | null // playerId if someone is on match point, else null
    isFinalRound: boolean
    timesPlayed: number // how many times this game appeared in roundHistory before this round
  } | null>(null)
  const [countNum, setCountNum] = useState<number | null>(null)
  const prevRound = useRef(0)
  const countInTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (currentRound !== prevRound.current && currentMinigame && cfg) {
      prevRound.current = currentRound
      const winsNeeded = Math.ceil(roomConfig.bestOf / 2)
      const opponent = players.find((p) => p.id !== myPlayerId)
      const myWins = scores[myPlayerId] ?? 0
      const oppWins = opponent ? (scores[opponent.id] ?? 0) : 0
      const matchPointFor =
        myWins === winsNeeded - 1
          ? myPlayerId
          : oppWins === winsNeeded - 1
            ? (opponent?.id ?? null)
            : null
      const isFinalRound = currentRound === roomConfig.bestOf
      const timesPlayed = roundHistory.filter((r) => r.minigameId === currentMinigame).length
      setTransitionData({ round: currentRound, cfg, matchPointFor, isFinalRound, timesPlayed })
      setShowTransition(true)
      setCountNum(null)
      // Use a ref-managed timer array so React Strict Mode's effect cleanup
      // doesn't cancel the hide timeout and leave the overlay stuck.
      countInTimers.current.forEach(clearTimeout)
      countInTimers.current = [
        setTimeout(() => {
          setCountNum(3)
          playTick()
        }, 350),
        setTimeout(() => {
          setCountNum(2)
          playTick()
        }, 900),
        setTimeout(() => {
          setCountNum(1)
          playTick(true)
        }, 1450),
        setTimeout(() => {
          setCountNum(0)
        }, 1900),
        setTimeout(() => {
          setShowTransition(false)
          setCountNum(null)
        }, 2300),
      ]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound, currentMinigame])

  // Ambient sound — start when round is active, stop on round end / match end
  useEffect(() => {
    if (roomStatus === 'playing' && currentMinigame) {
      startAmbient(currentMinigame)
    } else {
      stopAmbient()
    }
    return () => stopAmbient()
  }, [roomStatus, currentMinigame])

  // Emote keyboard shortcuts (1/2/3/4)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const idx = ['1', '2', '3', '4'].indexOf(e.key)
      if (idx === -1) return
      const emote = EMOTES[idx]
      if (!emote) return
      playClick()
      send('EMOTE', { emote })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send])

  // How-to-play tooltip
  const [showTooltip, setShowTooltip] = useState(false)
  useEffect(() => {
    setShowTooltip(false)
  }, [currentMinigame])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <ScoreBoard />

      {/* Forfeit button */}
      <button
        className="btn btn-white btn-sm"
        onClick={() => {
          disconnect()
          navigate('/')
        }}
        style={{ position: 'fixed', top: 12, left: 12, zIndex: 95 }}
      >
        ← Leave
      </button>

      {/* Minigame label banner */}
      {cfg && (
        <div
          style={{
            position: 'relative',
            padding: '8px 20px',
            background: 'var(--orange)',
            borderBottom: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--white)' }}>
            {cfg.emoji} {cfg.label}
          </span>
          {/* How to play */}
          <button
            onClick={() => setShowTooltip((v) => !v)}
            style={{
              position: 'absolute',
              right: 12,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              border: '2px solid rgba(255,255,255,0.6)',
              color: 'var(--white)',
              fontWeight: 900,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ?
          </button>
          {showTooltip && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 8,
                zIndex: 50,
                background: 'var(--black)',
                color: 'var(--white)',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '10px 14px',
                maxWidth: 240,
                fontWeight: 700,
                fontSize: 13,
                lineHeight: 1.5,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              {cfg.description}
            </div>
          )}
        </div>
      )}

      {/* Timer — only show for games with a countdown */}
      {cfg && cfg.timeoutMs > 0 && <TimerBar />}

      {/* Round transition overlay */}
      {roomStatus === 'round_end' && !isMatchOver && <RoundEndOverlay />}

      {/* Reconnect waiting overlay */}
      {roomStatus === 'reconnecting' &&
        (() => {
          const disconnected = players.find((p) => p.id !== myPlayerId && !p.connected)
          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 105,
                background: 'rgba(0,0,0,0.82)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                pointerEvents: 'none',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: 48,
                    color: 'var(--yellow)',
                    textShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  ⏳ Connection lost
                </div>
                <div
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 700,
                    fontSize: 18,
                    marginTop: 8,
                  }}
                >
                  {disconnected
                    ? `${disconnected.nickname} disconnected…`
                    : 'Opponent disconnected…'}
                </div>
                {reconnectCountdown !== null && (
                  <div
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: 72,
                      color: reconnectCountdown <= 5 ? 'var(--red)' : 'var(--white)',
                      marginTop: 16,
                      textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                      transition: 'color 0.3s',
                    }}
                  >
                    {reconnectCountdown}
                  </div>
                )}
                <div
                  style={{
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 700,
                    fontSize: 14,
                    marginTop: 8,
                  }}
                >
                  Game paused — waiting for reconnect
                </div>
              </div>
            </div>
          )
        })()}

      {/* Round count-in overlay */}
      {showTransition && transitionData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: CATEGORY_OVERLAY_BG[transitionData.cfg!.category],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            pointerEvents: 'all',
            cursor: 'default',
          }}
        >
          <div className="anim-pop" style={{ textAlign: 'center' }}>
            {/* Match point / final round label */}
            {(transitionData.matchPointFor || transitionData.isFinalRound) && (
              <div
                className="badge anim-pulse"
                style={{
                  background:
                    transitionData.matchPointFor === myPlayerId
                      ? 'var(--green)'
                      : transitionData.isFinalRound
                        ? 'var(--yellow)'
                        : 'var(--red)',
                  color:
                    transitionData.isFinalRound && !transitionData.matchPointFor
                      ? 'var(--black)'
                      : 'var(--white)',
                  fontSize: 13,
                  letterSpacing: 2,
                  marginBottom: 12,
                  display: 'inline-block',
                }}
              >
                {transitionData.matchPointFor === myPlayerId
                  ? '🏆 MATCH POINT'
                  : transitionData.matchPointFor
                    ? '⚠️ THEIR MATCH POINT'
                    : '⚡ FINAL ROUND'}
              </div>
            )}
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 18,
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: 4,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Round {transitionData.round} of {roomConfig.bestOf}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 60,
                color: 'var(--yellow)',
                textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
              }}
            >
              {transitionData.cfg!.emoji} {transitionData.cfg!.label}
            </div>
            {transitionData.timesPlayed > 0 && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {transitionData.timesPlayed === 1
                  ? '2nd time this match'
                  : transitionData.timesPlayed === 2
                    ? '3rd time this match'
                    : `${transitionData.timesPlayed + 1}th time this match`}
              </div>
            )}
          </div>
          {/* Count-in number — key forces remount so anim-count-in replays each tick */}
          <div
            style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {countNum !== null && (
              <div
                key={countNum}
                className="anim-count-in"
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: countNum === 0 ? 72 : 88,
                  color: countNum <= 1 ? 'var(--green)' : 'var(--white)',
                  textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                  lineHeight: 1,
                }}
              >
                {countNum === 0 ? 'GO!' : countNum}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming emote pop */}
      {incomingEmote &&
        (() => {
          const sender = players.find((p) => p.id === incomingEmote.fromPlayerId)
          const senderName = sender
            ? sender.id === myPlayerId
              ? 'You'
              : sender.nickname
            : (incomingEmote.fromName ?? null)
          return (
            <div
              className="anim-pop"
              style={{
                position: 'fixed',
                top: 80,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 120,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {senderName && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 8,
                  }}
                >
                  {senderName}
                </div>
              )}
              <div style={{ fontSize: 64, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
                {incomingEmote.emote}
              </div>
            </div>
          )
        })()}

      {/* Emote buttons */}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {EMOTES.map((e) => (
          <button
            key={e}
            onClick={() => {
              playClick()
              send('EMOTE', { emote: e })
            }}
            style={{
              width: 44,
              height: 44,
              fontSize: 22,
              background: 'var(--white)',
              border: 'var(--border)',
              borderRadius: 12,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Minigame area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {MinigameComp ? (
          <Suspense
            fallback={
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: 0.5,
                }}
              >
                <div style={{ fontSize: 48 }}>{cfg?.emoji ?? '🎮'}</div>
                <div className="label">{cfg?.label ?? 'Loading…'}</div>
              </div>
            }
          >
            <MinigameComp />
          </Suspense>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="subtitle" style={{ opacity: 0.5 }}>
              {isMockMatch ? 'Select a minigame in the dev panel →' : 'Loading…'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
