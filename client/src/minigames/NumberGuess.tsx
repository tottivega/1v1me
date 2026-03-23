import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

interface ServerStateGuessing {
  phase: 'guessing'
  submitted?: string[]
  count?: number
}
interface ServerStateReveal {
  phase: 'reveal'
  secret: number
  guesses: Record<string, number>
  winnerId: string
}
type ServerState = ServerStateGuessing | ServerStateReveal

export default function NumberGuess() {
  const { myPlayerId, players, sendInput, minigameState, wsStatus } = useGameStore()
  const isLive = wsStatus === 'connected'
  const opponent = players.find((p) => p.id !== myPlayerId)

  const [value, setValue] = useState(50)
  const [submitted, setSubmitted] = useState(false)
  const [mockResult, setMockResult] = useState<{
    secret: number
    myGuess: number
    oppGuess: number
    iWon: boolean
  } | null>(null)

  // Reset on new round
  useEffect(() => {
    if (minigameState === null) {
      setValue(50)
      setSubmitted(false)
    }
  }, [minigameState])

  function handleSubmit() {
    if (submitted) return
    setSubmitted(true)
    sendInput({ type: 'GUESS', value })
  }

  // ── Live mode ─────────────────────────────────────────────────────────────
  if (isLive) {
    const serverState = minigameState as ServerState | null
    const isReveal = serverState?.phase === 'reveal'
    const revealState = isReveal ? (serverState as ServerStateReveal) : null
    const submittedIds = (serverState as ServerStateGuessing | null)?.submitted ?? []
    const opponentSubmitted = opponent ? submittedIds.includes(opponent.id) : false
    const iWon = revealState?.winnerId === myPlayerId

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          flex: 1,
          padding: 32,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 36,
            color: 'var(--pink)',
            textAlign: 'center',
          }}
        >
          NUMBER GUESS 🎯
        </div>

        {!isReveal ? (
          <>
            <div
              style={{
                color: 'var(--black)',
                fontWeight: 700,
                fontSize: 16,
                opacity: 0.7,
                textAlign: 'center',
              }}
            >
              I'm thinking of a number 1–100.
              <br />
              Closest guess wins!
            </div>

            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 96,
                color: submitted ? 'var(--green)' : 'var(--blue)',
                lineHeight: 1,
                textShadow: '4px 4px 0px var(--black)',
                transition: 'color 0.2s',
              }}
            >
              {value}
            </div>

            <div
              style={{
                width: '100%',
                maxWidth: 400,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <input
                type="range"
                min={1}
                max={100}
                value={value}
                onChange={(e) => !submitted && setValue(Number(e.target.value))}
                disabled={submitted}
                style={{
                  width: '100%',
                  height: 12,
                  cursor: submitted ? 'not-allowed' : 'pointer',
                  accentColor: 'var(--blue)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="label">1</span>
                <span className="label">100</span>
              </div>
            </div>

            <button
              className="btn btn-lg"
              onClick={handleSubmit}
              disabled={submitted}
              style={{
                background: 'var(--pink)',
                color: 'var(--white)',
                fontSize: 20,
                padding: '16px 48px',
                borderRadius: 14,
              }}
            >
              {submitted ? '✅ Locked in!' : '🎯 Lock it in!'}
            </button>

            {/* Live: show opponent submitted status */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div className={`badge ${submitted ? 'badge-green' : 'badge-orange'}`}>
                You {submitted ? '✅' : '⏳'}
              </div>
              <div className={`badge ${opponentSubmitted ? 'badge-green' : 'badge-orange'}`}>
                {opponent?.nickname ?? '???'} {opponentSubmitted ? '✅' : '⏳'}
              </div>
            </div>
          </>
        ) : (
          <div
            className="anim-bounce"
            style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'center',
            }}
          >
            <div>
              <div className="label" style={{ opacity: 0.5 }}>
                The number was
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: 80,
                  color: 'var(--yellow)',
                  textShadow: '4px 4px 0px var(--black)',
                  WebkitTextStroke: '2px var(--black)',
                }}
              >
                {revealState!.secret}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 32 }}>
              <GuessCard
                label="You"
                guess={revealState!.guesses[myPlayerId] ?? value}
                secret={revealState!.secret}
                highlight
              />
              {opponent && (
                <GuessCard
                  label={opponent.nickname}
                  guess={revealState!.guesses[opponent.id] ?? 0}
                  secret={revealState!.secret}
                />
              )}
            </div>

            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 52,
                color: iWon ? 'var(--green)' : 'var(--red)',
                WebkitTextStroke: '2px var(--black)',
                textShadow: '3px 3px 0px var(--black)',
              }}
            >
              {iWon ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Mock mode: local simulation ───────────────────────────────────────────
  function handleMockSubmit() {
    if (submitted) return
    setSubmitted(true)
    sendInput({ type: 'GUESS', value })
    setTimeout(() => {
      const secret = Math.floor(Math.random() * 100) + 1
      const oppGuess = Math.floor(Math.random() * 100) + 1
      const iWon = Math.abs(value - secret) <= Math.abs(oppGuess - secret)
      setMockResult({ secret, myGuess: value, oppGuess, iWon })
    }, 1200)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        flex: 1,
        padding: 32,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-title)',
          fontSize: 36,
          color: 'var(--pink)',
          textAlign: 'center',
        }}
      >
        NUMBER GUESS 🎯
      </div>

      {!mockResult ? (
        <>
          <div
            style={{
              color: 'var(--black)',
              fontWeight: 700,
              fontSize: 16,
              opacity: 0.7,
              textAlign: 'center',
            }}
          >
            I'm thinking of a number 1–100.
            <br />
            Closest guess wins!
          </div>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 96,
              color: submitted ? 'var(--green)' : 'var(--blue)',
              lineHeight: 1,
              textShadow: '4px 4px 0px var(--black)',
              transition: 'color 0.2s',
            }}
          >
            {value}
          </div>
          <div
            style={{
              width: '100%',
              maxWidth: 400,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <input
              type="range"
              min={1}
              max={100}
              value={value}
              onChange={(e) => !submitted && setValue(Number(e.target.value))}
              disabled={submitted}
              style={{
                width: '100%',
                height: 12,
                cursor: submitted ? 'not-allowed' : 'pointer',
                accentColor: 'var(--blue)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="label">1</span>
              <span className="label">100</span>
            </div>
          </div>
          <button
            className="btn btn-lg"
            onClick={handleMockSubmit}
            disabled={submitted}
            style={{
              background: 'var(--pink)',
              color: 'var(--white)',
              fontSize: 20,
              padding: '16px 48px',
              borderRadius: 14,
            }}
          >
            {submitted ? '✅ Locked in!' : '🎯 Lock it in!'}
          </button>
          {submitted && (
            <div className="subtitle anim-pulse" style={{ opacity: 0.6 }}>
              Waiting for opponent…
            </div>
          )}
        </>
      ) : (
        <div
          className="anim-bounce"
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <div>
            <div className="label" style={{ opacity: 0.5 }}>
              The number was
            </div>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 80,
                color: 'var(--yellow)',
                textShadow: '4px 4px 0px var(--black)',
                WebkitTextStroke: '2px var(--black)',
              }}
            >
              {mockResult.secret}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <GuessCard
              label="You"
              guess={mockResult.myGuess}
              secret={mockResult.secret}
              highlight
            />
            <GuessCard
              label={opponent?.nickname ?? 'Opponent'}
              guess={mockResult.oppGuess}
              secret={mockResult.secret}
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: 52,
              color: mockResult.iWon ? 'var(--green)' : 'var(--red)',
              WebkitTextStroke: '2px var(--black)',
              textShadow: '3px 3px 0px var(--black)',
            }}
          >
            {mockResult.iWon ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
          </div>
        </div>
      )}
    </div>
  )
}

function GuessCard({
  label,
  guess,
  secret,
  highlight,
}: {
  label: string
  guess: number
  secret: number
  highlight?: boolean
}) {
  return (
    <div
      style={{
        background: highlight ? 'var(--blue)' : 'var(--orange)',
        border: 'var(--border)',
        borderRadius: 12,
        padding: '16px 24px',
        boxShadow: 'var(--shadow)',
        textAlign: 'center',
        color: 'var(--white)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          opacity: 0.8,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: 48, lineHeight: 1.1 }}>{guess}</div>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, marginTop: 4 }}>
        off by {Math.abs(guess - secret)}
      </div>
    </div>
  )
}
