interface Props {
  onClose: () => void
}

export default function AboutModal({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 380, width: '100%', position: 'relative' }}
      >
        <button
          onClick={onClose}
          title="Close"
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            color: 'var(--black)',
          }}
        >
          ×
        </button>
        <h2 className="font-title" style={{ marginBottom: 16 }}>
          About 1v1 ME
        </h2>
        <p style={{ marginBottom: 12 }}>
          Settle it the only fair way — a best-of series of random minigames. No login, no download.
          Just send a link and fight.
        </p>
        <p style={{ marginBottom: 12 }}>
          Each match pulls from a pool of quick challenges: reflex tests, math sprints, luck flips,
          memory puzzles, and more. Win enough rounds and the dispute is officially settled. Loser
          has no excuses.
        </p>
        <p style={{ opacity: 0.5, fontSize: 13 }}>
          Made for fun. Play responsibly. Results are binding.
        </p>
      </div>
    </div>
  )
}
