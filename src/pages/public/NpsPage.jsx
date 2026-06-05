import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const STAR_LABELS = { 1: 'Muy mala', 2: 'Mala', 3: 'Regular', 4: 'Buena', 5: 'Excelente' }
const STAR_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#22c55e' }

export default function NpsPage() {
  const { token } = useParams()
  const [info,       setInfo]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [puntuacion, setPuntuacion] = useState(0)
  const [hover,      setHover]      = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando,   setEnviando]   = useState(false)
  const [exito,      setExito]      = useState(false)

  useEffect(() => {
    supabase.rpc('nps_info_por_token', { p_token: token })
      .then(({ data }) => { setInfo(data); setLoading(false) })
  }, [token])

  async function enviar() {
    if (!puntuacion || enviando) return
    setEnviando(true)
    const { data } = await supabase.rpc('nps_registrar', {
      p_token:      token,
      p_puntuacion: puntuacion,
      p_comentario: comentario.trim() || null,
    })
    setEnviando(false)
    if (data?.ok || data?.error === 'ya_respondio') setExito(true)
  }

  const col     = info?.color || '#f43f5e'
  const active  = hover || puntuacion
  const actCol  = active > 0 ? (STAR_COLORS[active] || col) : '#374151'

  if (loading) return (
    <Screen>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${col}`, borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite',
      }} />
    </Screen>
  )

  if (!info?.ok) return (
    <Screen>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
      <p style={{ color: '#6b7280', fontFamily: 'Outfit, sans-serif', textAlign: 'center', fontSize: 15 }}>
        Este enlace no es válido o ya expiró.
      </p>
    </Screen>
  )

  if (exito || info.ya_respondio) return (
    <Screen>
      <div style={{ fontSize: 80, animation: 'pop 0.5s cubic-bezier(0.34,1.56,0.64,1)', marginBottom: 20 }}>
        🎉
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#f9fafb', marginBottom: 8, textAlign: 'center', fontFamily: 'Outfit' }}>
        {info.ya_respondio && !exito ? '¡Ya respondiste!' : '¡Gracias!'}
      </div>
      <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', maxWidth: 280, fontFamily: 'Outfit', lineHeight: 1.5 }}>
        Tu opinión ayuda a <b style={{ color: '#9ca3af' }}>{info.salon}</b> a mejorar cada visita. ✨
      </div>
    </Screen>
  )

  const nombre = info.cliente?.split(' ')[0] || ''

  return (
    <>
      <GlobalStyles col={col} />
      <div style={{
        minHeight: '100dvh', background: '#0f0f0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px 20px',
        fontFamily: 'Outfit, sans-serif',
        animation: 'slideUp 0.35s ease',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 76, height: 76, borderRadius: 24, margin: '0 auto 18px',
              background: `${col}20`, border: `2px solid ${col}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 38,
            }}>✂️</div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
            }}>
              {info.salon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f9fafb', lineHeight: 1.3 }}>
              {nombre ? `¿Cómo estuvo tu visita, ${nombre}?` : '¿Cómo estuvo tu visita?'}
            </div>
            {(info.servicio || info.profesional) && (
              <div style={{ fontSize: 13, color: '#4b5563', marginTop: 7 }}>
                {info.servicio}{info.profesional ? ` · con ${info.profesional}` : ''}
              </div>
            )}
          </div>

          {/* Card */}
          <div style={{
            background: '#161616', borderRadius: 24,
            border: '1px solid #252525', padding: '28px 22px 26px',
            boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${col}15`,
          }}>
            {/* Estrellas */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n}
                  onClick={() => setPuntuacion(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  style={{
                    width: 56, height: 56, borderRadius: 18, border: 'none',
                    cursor: 'pointer', fontSize: 30,
                    background: n <= active ? `${STAR_COLORS[active] || col}22` : '#222',
                    transform: n === active ? 'scale(1.25)' : n < active ? 'scale(1.05)' : 'scale(1)',
                    filter: n <= active ? 'none' : 'grayscale(1) brightness(0.35)',
                    transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                    outline: 'none',
                  }}
                >⭐</button>
              ))}
            </div>

            {/* Label dinámico */}
            <div style={{
              textAlign: 'center', height: 22, marginBottom: 18,
              fontSize: 14, fontWeight: 700,
              color: active > 0 ? actCol : 'transparent',
              transition: 'color 0.2s',
            }}>
              {STAR_LABELS[active] || ''}
            </div>

            {/* Comentario + botón (aparecen al seleccionar estrellas) */}
            <div style={{
              overflow: 'hidden',
              maxHeight: puntuacion > 0 ? 300 : 0,
              transition: 'max-height 0.4s ease',
            }}>
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="¿Algo que podamos mejorar? (opcional)"
                rows={3}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 14,
                  background: '#1f1f1f', border: '1px solid #2d2d2d',
                  color: '#e5e7eb', fontSize: 14, resize: 'none',
                  fontFamily: 'Outfit, sans-serif', lineHeight: 1.5,
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = col }}
                onBlur={e  => { e.target.style.borderColor = '#2d2d2d' }}
              />
              <button
                onClick={enviar}
                disabled={enviando || puntuacion === 0}
                style={{
                  marginTop: 12, width: '100%', padding: '15px',
                  borderRadius: 14, border: 'none',
                  cursor: enviando ? 'default' : 'pointer',
                  background: puntuacion > 0
                    ? `linear-gradient(135deg,${actCol},${actCol}cc)`
                    : '#2a2a2a',
                  color: '#fff', fontWeight: 800, fontSize: 15,
                  fontFamily: 'Outfit, sans-serif',
                  opacity: enviando ? 0.7 : 1,
                  boxShadow: puntuacion > 0 ? `0 4px 20px ${actCol}40` : 'none',
                  transition: 'all 0.3s',
                }}
              >
                {enviando ? 'Enviando…' : 'Enviar opinión'}
              </button>
            </div>

            {/* Hint cuando no hay selección */}
            {puntuacion === 0 && (
              <p style={{ textAlign: 'center', fontSize: 13, color: '#374151', marginTop: 4 }}>
                Toca una estrella para comenzar
              </p>
            )}
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#2d2d2d', marginTop: 20 }}>
            Tu respuesta es confidencial y ayuda a mejorar el servicio.
          </p>
        </div>
      </div>
    </>
  )
}

function Screen({ children }) {
  return (
    <>
      <GlobalStyles col="#f43f5e" />
      <div style={{
        minHeight: '100dvh', background: '#0f0f0f',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        fontFamily: 'Outfit, sans-serif',
      }}>
        {children}
      </div>
    </>
  )
}

function GlobalStyles({ col }) {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #0f0f0f; }
      textarea { outline: none; }
      button { outline: none; }
      @keyframes spin    { to { transform: rotate(360deg); } }
      @keyframes pop     { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
  )
}
