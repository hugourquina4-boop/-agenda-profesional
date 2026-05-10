import { Component } from 'react'

function isChunkError(error) {
  const msg = error?.message || ''
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Unable to preload CSS') ||
    msg.includes('error loading dynamically imported module')
  )
}

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    // Chunk errors are handled in componentDidCatch via reload — don't render error UI
    if (isChunkError(error)) return { error: null }
    return { error }
  }

  componentDidCatch(error) {
    if (isChunkError(error)) {
      // New deploy invalidated old chunk hashes — reload to get fresh HTML + new chunks
      window.location.reload()
    }
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
          minHeight: '40dvh',
        }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
          <h3 style={{
            fontFamily: 'Outfit', fontWeight: 700, fontSize: 18,
            color: 'var(--text)', marginBottom: 8,
          }}>
            Algo salió mal
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24, maxWidth: 280 }}>
            {error?.message || 'Error inesperado en este módulo'}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '10px 22px', borderRadius: 10, border: 'none',
              background: '#f43f5e', color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
