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
        <h2 className="font-title" style={{ marginBottom: 12 }}>
          About 1v1 ME
        </h2>
        <p>TODO: ADD</p>
      </div>
    </div>
  )
}
