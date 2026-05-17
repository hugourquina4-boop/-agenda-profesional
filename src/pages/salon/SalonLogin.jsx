import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function Ico({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function SalonLogin({ onLogin, onRegistro }) {
  // paso: 'selector' | 'login' | 'recovery'
  const [paso,     setPaso]    = useState('selector')
  const [salones,  setSalones] = useState([])
  const [cargando, setCargando]= useState(true)
  const [busqueda, setBusqueda]= useState('')
  const [salon,    setSalon]   = useState(null)   // tenant seleccionado

  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [recSent, setRecSent] = useState(false)

  useEffect(() => {
    supabase
      .from('tenants')
      .select('id, nombre, slug, ciudad, color_primario')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => { setSalones(data || []); setCargando(false) })
  }, [])

  // Si hay ?tenant=slug en la URL, pre-seleccionar
  useEffect(() => {
    if (!salones.length) return
    const slug = new URLSearchParams(window.location.search).get('tenant')
    if (slug) {
      const found = salones.find(s => s.slug === slug)
      if (found) { setSalon(found); setPaso('login') }
    }
  }, [salones])

  function elegirSalon(s) {
    setSalon(s)
    setError('')
    setPaso('login')
    // Actualizar URL para que TenantContext sepa qué tenant cargar tras el login
    const url = new URL(window.location)
    url.searchParams.set('tenant', s.slug)
    window.history.replaceState({}, '', url)
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
    setLoading(false)
    if (err) {
      setError(
        err.message.includes('Invalid login') ? 'Email o contraseña incorrectos' :
        err.message.includes('Email not confirmed') ? 'Confirma tu email antes de ingresar' :
        err.message
      )
      return
    }
    onLogin?.()
  }

  async function handleRecovery(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/salon',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setRecSent(true)
  }

  const salonColor  = salon?.color_primario || '#f43f5e'
  const salonNombre = salon?.nombre || 'Salón Pro'

  const salonesFiltrados = busqueda.trim()
    ? salones.filter(s =>
        s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (s.ciudad || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : salones

  // ── Fondo compartido ──────────────────────────────────────────────────────
  const fondo = (
    <div style={{
      position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
      background:`radial-gradient(ellipse 70% 50% at 20% 30%, ${salonColor}18 0%, transparent 70%),
                  radial-gradient(ellipse 50% 60% at 80% 80%, rgba(168,85,247,0.05) 0%, transparent 70%)`,
    }} />
  )

  // ── PASO: Recuperar contraseña ────────────────────────────────────────────
  if (paso === 'recovery') return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)' }}>
      {fondo}
      <div style={{ width:'100%', maxWidth:360, position:'relative', zIndex:1 }}>
        <button onClick={() => { setPaso('login'); setRecSent(false); setError('') }}
          style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer',
            display:'flex', alignItems:'center', gap:6, marginBottom:32, fontSize:14 }}>
          <Ico d="M15 19l-7-7 7-7" size={16} /> Volver
        </button>

        {recSent ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📨</div>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22,
              color:'var(--text)', marginBottom:8 }}>Revisa tu email</h2>
            <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.6 }}>
              Enviamos un link a <b>{email}</b> para restablecer tu contraseña.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:24,
              color:'var(--text)', marginBottom:6 }}>Recuperar acceso</h2>
            <p style={{ fontSize:14, color:'var(--text-3)', marginBottom:28 }}>
              Ingresa tu email y te enviamos un link.
            </p>
            <form onSubmit={handleRecovery} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input className="sp-input" type="email" placeholder="tu@email.com" required
                value={email} onChange={e => setEmail(e.target.value)} />
              {error && <p style={{ fontSize:13, color:'#f87171' }}>{error}</p>}
              <button type="submit" disabled={loading} style={{
                padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
                background:salonColor, color:'#fff',
                fontFamily:'Outfit', fontWeight:700, fontSize:16, opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )

  // ── PASO: Login ───────────────────────────────────────────────────────────
  if (paso === 'login') return (
    <div style={{ minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)' }}>
      {fondo}
      <div style={{ width:'100%', maxWidth:360, position:'relative', zIndex:1 }}>

        {/* Botón volver */}
        <button onClick={() => { setPaso('selector'); setError('') }}
          style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer',
            display:'flex', alignItems:'center', gap:6, marginBottom:28, fontSize:14 }}>
          <Ico d="M15 19l-7-7 7-7" size={16} /> Cambiar salón
        </button>

        {/* Cabecera del salón */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:64, height:64, borderRadius:20,
            background:`linear-gradient(135deg, ${salonColor}, ${salonColor}bb)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px',
            boxShadow:`0 8px 32px ${salonColor}44`,
          }}>
            <Ico d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v2.101a8.01 8.01 0 015 0V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4H7z" size={30} />
          </div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:26,
            color:'var(--text)', letterSpacing:'-0.5px', marginBottom:4 }}>
            {salonNombre}
          </h1>
          {salon?.ciudad && (
            <p style={{ fontSize:13, color:'var(--text-3)' }}>{salon.ciudad}</p>
          )}
        </div>

        {/* Form */}
        <div style={{
          background:'var(--card)',
          borderRadius:24, padding:28, boxShadow:'0 4px 24px rgba(0,0,0,0.12)',
        }}>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                letterSpacing:0.5, display:'block', marginBottom:8 }}>EMAIL</label>
              <input className="sp-input" type="email" placeholder="tu@email.com" required
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div>
              <div style={{ display:'flex', alignItems:'center',
                justifyContent:'space-between', marginBottom:8 }}>
                <label style={{ fontSize:12, color:'var(--text-3)',
                  fontWeight:600, letterSpacing:0.5 }}>CONTRASEÑA</label>
                <button type="button" onClick={() => setPaso('recovery')}
                  style={{ background:'none', border:'none', fontSize:12,
                    color:salonColor, cursor:'pointer', fontWeight:600 }}>
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <input className="sp-input" type="password" placeholder="••••••••" required
                value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" />
            </div>

            {error && (
              <div style={{ padding:'12px 14px', borderRadius:12,
                background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                fontSize:13, color:'#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop:4, padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg, ${salonColor}, ${salonColor}bb)`,
              color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
              boxShadow:`0 4px 20px ${salonColor}44`,
              opacity: loading ? 0.7 : 1, transition:'all 0.2s',
            }}>
              {loading ? 'Entrando…' : 'Ingresar'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )

  // ── PASO: Selector de salón ───────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg)', padding:'24px 16px 40px' }}>
      {fondo}
      <div style={{ maxWidth:600, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Header */}
        <div style={{ textAlign:'center', padding:'32px 0 28px' }}>
          <div style={{
            width:56, height:56, borderRadius:16,
            background:'linear-gradient(135deg, #f43f5e, #e11d48)',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 14px', boxShadow:'0 8px 24px rgba(244,63,94,0.3)',
          }}>
            <Ico d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v2.101a8.01 8.01 0 015 0V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4H7z" size={26} />
          </div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:26,
            color:'var(--text)', marginBottom:6 }}>Salón Pro</h1>
          <p style={{ fontSize:14, color:'var(--text-3)' }}>Selecciona tu peluquería para ingresar</p>
        </div>

        {/* Búsqueda */}
        <div style={{ position:'relative', marginBottom:20 }}>
          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
            color:'var(--text-3)', pointerEvents:'none' }}>
            <Ico d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" size={16} />
          </span>
          <input
            className="sp-input"
            style={{ paddingLeft:40 }}
            type="text"
            placeholder="Buscar por nombre o ciudad…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            autoFocus
          />
        </div>

        {/* Lista */}
        {cargando ? (
          <div style={{ display:'flex', justifyContent:'center', paddingTop:48 }}>
            <div className="sp-spinner" />
          </div>
        ) : salonesFiltrados.length === 0 ? (
          <div style={{ textAlign:'center', paddingTop:48, color:'var(--text-3)', fontSize:14 }}>
            {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay salones disponibles'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {salonesFiltrados.map(s => (
              <button
                key={s.id}
                onClick={() => elegirSalon(s)}
                style={{
                  display:'flex', alignItems:'center', gap:14,
                  padding:'16px 18px',
                  background:`linear-gradient(135deg,${s.color_primario || '#f43f5e'}08,var(--card))`,
                  border:'1px solid transparent', boxShadow:'0 1px 8px rgba(0,0,0,0.08)',
                  borderRadius:16, cursor:'pointer', textAlign:'left',
                  transition:'all 0.15s', width:'100%',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = s.color_primario || '#f43f5e'
                  e.currentTarget.style.boxShadow = `0 4px 16px ${s.color_primario || '#f43f5e'}22`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.08)'
                }}
              >
                {/* Color badge */}
                <div style={{
                  width:44, height:44, borderRadius:12, flexShrink:0,
                  background:`linear-gradient(135deg, ${s.color_primario || '#f43f5e'}, ${s.color_primario || '#f43f5e'}88)`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Ico d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v2.101a8.01 8.01 0 015 0V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4H7z" size={20} />
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'Outfit', fontWeight:700, fontSize:15,
                    color:'var(--text)', marginBottom:2 }}>{s.nombre}</div>
                  {s.ciudad && (
                    <div style={{ fontSize:13, color:'var(--text-3)' }}>{s.ciudad}</div>
                  )}
                </div>

                {/* Flecha */}
                <Ico d="M9 5l7 7-7 7" size={18} />
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
