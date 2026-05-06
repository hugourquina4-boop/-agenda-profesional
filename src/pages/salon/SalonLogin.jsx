import { useState } from 'react'
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
  const [email,      setEmail]      = useState('')
  const [pass,       setPass]       = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [recovery,   setRecovery]   = useState(false)
  const [recSent,    setRecSent]    = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (err) {
      setError(
        err.message.includes('Invalid login') ? 'Email o contraseña incorrectos' :
        err.message.includes('Email not confirmed') ? 'Confirma tu email antes de ingresar' :
        err.message
      )
      setLoading(false)
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

  // ── Pantalla recuperar contraseña ─────────────────────────────────────────
  if (recovery) return (
    <div style={{
      minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24,
      background:'var(--bg)',
    }}>
      <div style={{ width:'100%', maxWidth:360 }}>
        <button onClick={() => { setRecovery(false); setRecSent(false); setError('') }}
          style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer',
            display:'flex', alignItems:'center', gap:6, marginBottom:32, fontSize:14 }}>
          <Ico d="M15 19l-7-7 7-7" size={16} />
          Volver
        </button>

        {recSent ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📨</div>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, color:'var(--text)', marginBottom:8 }}>
              Revisa tu email
            </h2>
            <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.6 }}>
              Enviamos un link a <b>{email}</b> para restablecer tu contraseña.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:24, color:'var(--text)', marginBottom:6 }}>
              Recuperar acceso
            </h2>
            <p style={{ fontSize:14, color:'var(--text-3)', marginBottom:28 }}>
              Ingresa tu email y te enviamos un link.
            </p>
            <form onSubmit={handleRecovery} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input className="sp-input" type="email" placeholder="tu@email.com" required
                value={email} onChange={e => setEmail(e.target.value)} />
              {error && <p style={{ fontSize:13, color:'#f87171' }}>{error}</p>}
              <button type="submit" disabled={loading} style={{
                padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
                background:'var(--accent)', color:'#fff',
                fontFamily:'Outfit', fontWeight:700, fontSize:16,
                opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )

  // ── Login principal ───────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24,
      background:'var(--bg)',
    }}>
      {/* Fondo mesh */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        background:'radial-gradient(ellipse 70% 50% at 20% 30%, rgba(244,63,94,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(168,85,247,0.05) 0%, transparent 70%)',
      }} />

      <div style={{ width:'100%', maxWidth:360, position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{
            width:64, height:64, borderRadius:20,
            background:'linear-gradient(135deg, var(--accent), var(--accent)99)',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 16px',
            boxShadow:'0 8px 32px var(--accent-glow)',
          }}>
            <Ico d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v2.101a8.01 8.01 0 015 0V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4H7z" size={30} />
          </div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:28, color:'var(--text)',
            letterSpacing:'-0.5px', marginBottom:6 }}>
            Salón Pro
          </h1>
          <p style={{ fontSize:14, color:'var(--text-3)' }}>Gestiona tu salón desde el celular</p>
        </div>

        {/* Form card */}
        <div style={{
          background:'var(--card)', border:'1px solid var(--border)',
          borderRadius:24, padding:28, backdropFilter:'blur(20px)',
          boxShadow:'var(--shadow-sm)',
        }}>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600,
                letterSpacing:0.5, display:'block', marginBottom:8 }}>
                EMAIL
              </label>
              <input className="sp-input" type="email" placeholder="tu@email.com" required
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5 }}>
                  CONTRASEÑA
                </label>
                <button type="button" onClick={() => setRecovery(true)}
                  style={{ background:'none', border:'none', fontSize:12,
                    color:'var(--accent)', cursor:'pointer', fontWeight:600 }}>
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <input className="sp-input" type="password" placeholder="••••••••" required
                value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" />
            </div>

            {error && (
              <div style={{
                padding:'12px 14px', borderRadius:12,
                background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                fontSize:13, color:'#f87171',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop:4, padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
              background:`linear-gradient(135deg, var(--accent), var(--accent)bb)`,
              color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
              boxShadow:'0 4px 20px var(--accent-glow)',
              opacity: loading ? 0.7 : 1,
              transition:'all 0.2s',
            }}>
              {loading ? 'Entrando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        {/* Registro link */}
        {onRegistro && (
          <p style={{ textAlign:'center', marginTop:20, fontSize:14, color:'var(--text-3)' }}>
            ¿Eres nuevo?{' '}
            <button onClick={onRegistro} style={{
              background:'none', border:'none', color:'var(--accent)',
              fontWeight:700, cursor:'pointer', fontSize:14,
            }}>
              Crea tu salón gratis
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
