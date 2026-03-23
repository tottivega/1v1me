import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
    // TODO (prod): pipe to error reporting service (Sentry, etc.)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--cream)',
            padding: 24,
          }}
        >
          <div
            className="card anim-pop"
            style={{
              maxWidth: 420,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 64, lineHeight: 1 }}>💥</div>
            <div style={{ fontFamily: 'var(--font-title)', fontSize: 28, color: 'var(--red)' }}>
              Something exploded
            </div>
            <div style={{ fontSize: 14, opacity: 0.6, lineHeight: 1.5 }}>
              A render error crashed the app. Reload to get back in the game.
            </div>
            <pre
              style={{
                background: 'var(--cream)',
                border: 'var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 11,
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 120,
                color: 'var(--red)',
                margin: 0,
              }}
            >
              {this.state.error.message}
            </pre>
            <button
              className="btn btn-orange btn-lg"
              style={{ width: '100%' }}
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
