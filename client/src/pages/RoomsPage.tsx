import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

interface OpenRoom {
  roomId: string
  creatorNickname: string
  createdAt: number
}

const API_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001').replace(/^ws/, 'http')

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

export default function RoomsPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<OpenRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  const [total, setTotal] = useState(0)

  const fetchRooms = useCallback(
    async (pageNum = page) => {
      try {
        const res = await fetch(
          `${API_BASE}/rooms?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { rooms: OpenRoom[]; total: number } = await res.json()
        setRooms(data.rooms)
        setTotal(data.total)
        setError(null)
      } catch {
        setError('Could not reach server')
      } finally {
        setLoading(false)
        setLastRefresh(Date.now())
      }
    },
    [page]
  )

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 5000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--cream)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
        gap: 24,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: 36,
            color: 'var(--black)',
            margin: 0,
          }}
        >
          🌐 Open Rooms
        </h1>
        <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13, marginTop: 6 }}>
          Rooms waiting for a second player · refreshes every 5s
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-white" onClick={() => navigate('/')}>
          ← Back
        </button>
        <button className="btn btn-orange" onClick={() => fetchRooms()}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="badge" style={{ background: 'var(--red)', color: '#fff', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>Loading…</p>
      ) : rooms.length === 0 ? (
        <div
          style={{
            background: 'var(--white)',
            border: 'var(--border)',
            borderRadius: 12,
            padding: '32px 48px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>😴</div>
          <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>No open rooms right now</p>
          <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 13, marginTop: 4 }}>
            Create one from the home page and share the link!
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
            maxWidth: 480,
          }}
        >
          {rooms.map((room) => (
            <div
              key={room.roomId}
              style={{
                background: 'var(--white)',
                border: 'var(--border)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 900, fontSize: 15 }}>{room.creatorNickname}</span>
                <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>
                  {room.roomId} · {timeAgo(room.createdAt)}
                </span>
              </div>
              <button
                className="btn btn-green"
                style={{ fontSize: 13, padding: '6px 14px' }}
                onClick={() => navigate(`/room/${room.roomId}`)}
              >
                Join ⚔️
              </button>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-white btn-sm"
            disabled={page === 0}
            onClick={() => {
              setPage((p) => p - 1)
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.6 }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <button
            className="btn btn-white btn-sm"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => {
              setPage((p) => p + 1)
            }}
          >
            Next →
          </button>
        </div>
      )}

      <p style={{ color: 'rgba(0,0,0,0.3)', fontSize: 11, marginTop: 'auto' }}>
        Last updated {new Date(lastRefresh).toLocaleTimeString()}
      </p>
    </div>
  )
}
