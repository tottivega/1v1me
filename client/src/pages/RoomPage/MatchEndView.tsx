import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore, getStreak } from '../../store/gameStore'
import { MINIGAME_CONFIGS } from '@shared/types'
import { playClick, playMatchWin, playMatchLose } from '../../utils/sounds'
import RoomSettings from './RoomSettings'

function Confetti() {
  const COLORS = [
    'var(--orange)',
    'var(--yellow)',
    'var(--green)',
    'var(--blue)',
    'var(--pink)',
    'var(--purple)',
  ]
  // Stabilise all random values so they don't recalculate on re-renders
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const r = Math.random()
        // Three shapes: circle, square, or thin strip (wide or tall)
        const shape = r < 0.4 ? 'circle' : r < 0.7 ? 'square' : r < 0.85 ? 'strip-h' : 'strip-v'
        const base = 6 + Math.random() * 10 // 6–16px
        return {
          left: Math.random() * 100,
          width: shape === 'strip-h' ? base * 2.5 : base,
          height: shape === 'strip-v' ? base * 2.5 : base,
          color: COLORS[i % COLORS.length],
          radius: shape === 'circle' ? '50%' : '2px',
          delay: Math.random() * 1.6,
          duration: 1.6 + Math.random() * 2,
          drift: (Math.random() - 0.5) * 240, // –120 to +120px horizontal arc
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: -20,
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            border: '2px solid var(--black)',
            borderRadius: p.radius,
            animation: `confetti-fall ${p.duration}s ease ${p.delay}s forwards`,
            ['--drift' as string]: `${p.drift}px`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      ))}
    </>
  )
}

function ShareButton({
  iWon,
  myNickname,
  oppNickname,
  myScore,
  oppScore,
}: {
  iWon: boolean
  myNickname: string
  oppNickname: string
  myScore: number
  oppScore: number
}) {
  const { roundHistory, myPlayerId } = useGameStore()
  const [saved, setSaved] = useState(false)
  const [discordCopied, setDiscordCopied] = useState(false)

  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://1v1me.vercel.app'
  const shareText = iWon
    ? `I beat ${oppNickname} ${myScore}–${oppScore} in 1v1 ME 🏆`
    : `Close one — ${oppNickname} beat me ${oppScore}–${myScore} in 1v1 ME 😤`

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${appUrl}`)}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${appUrl}`)}`
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(appUrl)}&title=${encodeURIComponent(shareText)}`
  const discordText = iWon
    ? `🎮 **1v1 ME** — I beat ${oppNickname} ${myScore}–${oppScore}\n👉 ${appUrl}`
    : `🎮 **1v1 ME** — ${oppNickname} beat me ${oppScore}–${myScore}\n👉 ${appUrl}`

  async function copyDiscord() {
    playClick()
    try {
      await navigator.clipboard.writeText(discordText)
    } catch {
      // silent
    }
    setDiscordCopied(true)
    setTimeout(() => setDiscordCopied(false), 2500)
  }

  async function buildCard(): Promise<Blob> {
    const PAD = 32
    const W = 560
    const ROW_H = 40
    const HEADER_H = 160
    const FOOTER_H = 40
    const ROUNDS_H = roundHistory.length > 0 ? roundHistory.length * ROW_H + 12 : 0
    const H = HEADER_H + ROUNDS_H + FOOTER_H

    const accent = iWon ? '#f7c948' : '#e63946'
    const BG = '#18181b'
    const streak = getStreak()

    // Top-3 most-played games from round history
    const counts: Record<string, number> = {}
    for (const r of roundHistory) counts[r.minigameId] = (counts[r.minigameId] ?? 0) + 1
    const top3 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => MINIGAME_CONFIGS[id as keyof typeof MINIGAME_CONFIGS]?.emoji ?? '🎮')
      .join(' ')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const canvas = document.createElement('canvas')
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Dark background
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)

    // Top accent bar
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, W, 6)

    // Win/lose title
    ctx.textAlign = 'left'
    ctx.fillStyle = accent
    ctx.font = '900 48px "Arial Black", Arial, sans-serif'
    ctx.fillText(iWon ? '🏆 YOU WIN!' : '💀 YOU LOSE', PAD, 68)

    // Big score
    ctx.font = '900 64px "Arial Black", Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${myScore}`, PAD, 138)
    ctx.font = '700 32px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('–', PAD + 60, 130)
    ctx.font = '900 64px "Arial Black", Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText(`${oppScore}`, PAD + 84, 138)

    // Nicknames under scores
    ctx.font = '700 14px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'left'
    ctx.fillText(myNickname, PAD, 156)
    ctx.fillText(oppNickname, PAD + 84, 156)

    // Streak badge (right side of header)
    if (iWon && streak >= 2) {
      ctx.font = '900 15px Arial, sans-serif'
      ctx.fillStyle = '#f7c948'
      ctx.textAlign = 'right'
      ctx.fillText(`🔥 ${streak} win streak`, W - PAD, 68)
    }

    // Top-3 game emojis (right side)
    if (top3) {
      ctx.font = '22px Arial, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(top3, W - PAD, 110)
    }

    if (roundHistory.length > 0) {
      // Divider
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD, HEADER_H)
      ctx.lineTo(W - PAD, HEADER_H)
      ctx.stroke()

      roundHistory.forEach((r, idx) => {
        const cfg = MINIGAME_CONFIGS[r.minigameId]
        const iWonRow = r.winnerId === myPlayerId
        const isDraw = r.winnerId === null
        const y = HEADER_H + idx * ROW_H + 6

        // Row tint
        ctx.fillStyle = iWonRow
          ? 'rgba(45,198,83,0.12)'
          : isDraw
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(230,57,70,0.12)'
        ctx.fillRect(PAD - 8, y, W - PAD * 2 + 16, ROW_H - 4)

        // Game label
        ctx.font = '700 14px Arial, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.textAlign = 'left'
        ctx.fillText(`${cfg.emoji}  ${cfg.label}`, PAD, y + 22)

        // Result
        ctx.font = '900 12px Arial, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillStyle = iWonRow ? '#2dc653' : isDraw ? '#888' : '#e63946'
        ctx.fillText(
          isDraw ? '🤝 Draw' : iWonRow ? `🏆 ${myNickname}` : `💀 ${oppNickname}`,
          W - PAD,
          y + 22
        )
      })
    }

    // Footer
    ctx.textAlign = 'center'
    ctx.font = '700 12px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fillText('⚔️  1v1 ME  •  Settle it. Once and for all.', W / 2, H - 12)

    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))),
        'image/png'
      )
    )
  }

  async function share() {
    playClick()

    // Tier 1: native share with result card image (mobile, supports file share)
    try {
      const blob = await buildCard()
      const file = new File([blob], '1v1me-result.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: iWon ? 'I won! 🏆' : 'GG 💀',
          text: shareText,
          url: appUrl,
        })
        return
      }
    } catch {
      // fall through to next tier
    }

    // Tier 2: text-only native share (desktop Chrome, Safari, etc.)
    if (navigator.share) {
      try {
        await navigator.share({ title: '1v1 ME', text: shareText, url: appUrl })
        return
      } catch {
        // user cancelled or not supported — fall through
      }
    }

    // Tier 3: clipboard copy with ✓ flash
    try {
      await navigator.clipboard.writeText(`${shareText}\n${appUrl}`)
    } catch {
      // clipboard unavailable — silent fail
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
      <button className="btn btn-white" onClick={share}>
        {saved ? '✓ Copied!' : '🔗 Share Result'}
      </button>
      <div style={{ display: 'flex', gap: 6 }}>
        <a
          className="btn btn-sm btn-white"
          href={twitterUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => playClick()}
          title="Share on X / Twitter"
          style={{ fontSize: 12 }}
        >
          𝕏
        </a>
        <a
          className="btn btn-sm btn-white"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => playClick()}
          title="Share on WhatsApp"
          style={{ fontSize: 12 }}
        >
          WA
        </a>
        <a
          className="btn btn-sm btn-white"
          href={redditUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => playClick()}
          title="Share on Reddit"
          style={{ fontSize: 12 }}
        >
          Reddit
        </a>
        <button
          className="btn btn-sm btn-white"
          onClick={copyDiscord}
          title="Copy for Discord"
          style={{ fontSize: 12 }}
        >
          {discordCopied ? '✓' : 'Discord'}
        </button>
      </div>
    </div>
  )
}

export default function MatchEndView() {
  const {
    myPlayerId,
    players,
    scores,
    matchWinnerId,
    disconnect,
    send,
    roundHistory,
    rematchVoting,
    matchStartedAt,
    roomConfig,
    sendRoomConfig,
    isMockMatch,
    mockRematch,
  } = useGameStore()
  const navigate = useNavigate()
  const iWon = matchWinnerId === myPlayerId
  const isCreator = players[0]?.id === myPlayerId

  const matchDuration = matchStartedAt
    ? (() => {
        const secs = Math.round((Date.now() - matchStartedAt) / 1000)
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return m > 0 ? `${m}m ${s}s` : `${s}s`
      })()
    : null

  useEffect(() => {
    iWon ? playMatchWin() : playMatchLose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const me = players.find((p) => p.id === myPlayerId)
  const opponent = players.find((p) => p.id !== myPlayerId)
  const myScore = scores[myPlayerId] ?? 0
  const oppScore = opponent ? (scores[opponent.id] ?? 0) : 0

  const [displayedScores, setDisplayedScores] = useState({ my: 0, opp: 0 })
  useEffect(() => {
    const duration = 600
    const start = Date.now()
    const tick = () => {
      const ease = 1 - Math.pow(1 - Math.min((Date.now() - start) / duration, 1), 3)
      setDisplayedScores({ my: Math.round(myScore * ease), opp: Math.round(oppScore * ease) })
      if (ease < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [myScore, oppScore])

  function goHome() {
    playClick()
    disconnect()
    navigate('/')
  }

  function rematch() {
    playClick()
    if (isMockMatch) {
      mockRematch()
    } else {
      send('REMATCH')
    }
  }

  return (
    <div className="page" style={{ position: 'relative', overflow: 'hidden' }}>
      {iWon && <Confetti />}

      <div className="anim-bounce" style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 80,
            color: iWon ? 'var(--yellow)' : 'var(--red)',
            WebkitTextStroke: '3px var(--black)',
            textShadow: '5px 5px 0 var(--black)',
            lineHeight: 1,
          }}
        >
          {iWon ? '🏆 YOU WIN!' : '💀 YOU LOSE'}
        </div>
        {iWon ? (
          <div className="subtitle" style={{ marginTop: 12, opacity: 0.7 }}>
            Get rekt, opponent! gg ez no re 😤
          </div>
        ) : (
          <div className="subtitle" style={{ marginTop: 12, opacity: 0.7 }}>
            Touch grass and try again. 🌱
          </div>
        )}
      </div>

      <div className="card" style={{ minWidth: 300, width: '100%', maxWidth: 420 }}>
        {/* Score header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 56,
                color: 'var(--blue)',
                lineHeight: 1,
              }}
            >
              {displayedScores.my}
            </div>
            <div className="label">{me?.nickname ?? 'You'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 32, opacity: 0.3 }}>—</div>
            {matchDuration && (
              <div style={{ fontSize: 11, opacity: 0.45, fontWeight: 700, marginTop: 4 }}>
                ⏱ {matchDuration}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-title)',
                fontSize: 56,
                color: 'var(--orange)',
                lineHeight: 1,
              }}
            >
              {displayedScores.opp}
            </div>
            <div className="label">{opponent?.nickname ?? 'Opponent'}</div>
          </div>
        </div>

        {/* Round-by-round breakdown */}
        {roundHistory.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              borderTop: '2px solid rgba(0,0,0,0.08)',
              paddingTop: 16,
            }}
          >
            <div className="label" style={{ marginBottom: 6, textAlign: 'center' }}>
              Round Breakdown
            </div>
            {roundHistory.map((r) => {
              const cfg = MINIGAME_CONFIGS[r.minigameId]
              const iWonRound = r.winnerId === myPlayerId
              const isDraw = r.winnerId === null
              const winnerName =
                r.winnerId === myPlayerId
                  ? (me?.nickname ?? 'You')
                  : (opponent?.nickname ?? 'Opponent')
              return (
                <div
                  key={r.round}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: iWonRound
                      ? 'rgba(68,204,68,0.08)'
                      : isDraw
                        ? 'rgba(0,0,0,0.03)'
                        : 'rgba(255,51,51,0.06)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    border: `1.5px solid ${iWonRound ? 'rgba(68,204,68,0.3)' : isDraw ? 'rgba(0,0,0,0.08)' : 'rgba(255,51,51,0.2)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{cfg.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 700 }}>
                        Round {r.round}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: 13,
                      color: iWonRound ? 'var(--green)' : isDraw ? 'var(--black)' : 'var(--red)',
                    }}
                  >
                    {isDraw ? '🤝 Draw' : `${iWonRound ? '🏆' : '💀'} ${winnerName}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <RoomSettings
        config={roomConfig}
        isCreator={isCreator}
        locked={rematchVoting}
        onChange={sendRoomConfig}
      />

      <div className="match-end-actions" style={{ display: 'flex', gap: 12 }}>
        {rematchVoting ? (
          <>
            <button className="btn btn-orange btn-lg anim-pulse" disabled>
              ⏳ Waiting for opponent…
            </button>
            <button
              className="btn btn-white"
              onClick={() => {
                playClick()
                disconnect()
                navigate('/')
              }}
            >
              ✕ Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-orange btn-lg" onClick={rematch}>
            🔁 Rematch
          </button>
        )}
        <button className="btn btn-white" onClick={goHome}>
          🏠 Home
        </button>
        <ShareButton
          iWon={iWon}
          myNickname={me?.nickname ?? 'Player'}
          oppNickname={opponent?.nickname ?? 'Opponent'}
          myScore={myScore}
          oppScore={oppScore}
        />
      </div>
    </div>
  )
}
