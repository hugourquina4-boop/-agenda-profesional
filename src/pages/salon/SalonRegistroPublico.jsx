import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

const GREEN  = '#16a34a'
const DARK   = '#1a1a1a'
const BG     = '#FAFAF8'
const BORDER = 'rgba(0,0,0,0.09)'

const VERTICALES = [
  { key:'salon',      icon:'✂️', label:'Peluquería' },
  { key:'barberia',   icon:'💈', label:'Barbería'   },
  { key:'spa',        icon:'🧖', label:'Spa'        },
  { key:'nails',      icon:'💅', label:'Uñas'       },
  { key:'maquillaje', icon:'💄', label:'Maquillaje' },
  { key:'otro',       icon:'🏪', label:'Otro'       },
]

const PLANES = [
  {
    key: 'starter',
    label: 'Independiente',
    price: '$60.000',
    hint: '1 profesional',
    features: [
      'Agenda y citas ilimitadas',
      'Portal de reservas online',
      'Gestión de clientes',
      'Caja y cobros',
      'Pagos en línea (Wompi/PSE)',
    ],
  },
  {
    key: 'pro',
    label: 'Grupal',
    price: '$100.000',
    hint: 'Hasta 5 profesionales',
    popular: true,
    features: [
      'Todo lo de Independiente',
      'WhatsApp automático (confirmaciones + recordatorios)',
      'Comisiones y planilla PDF',
      'Inventario y proveedores',
      'Analytics e informe P&L',
      'Programa de puntos de fidelización',
    ],
  },
  {
    key: 'ultra',
    label: 'Grupal Plus',
    price: '$140.000',
    hint: 'Profesionales ilimitados',
    features: [
      'Todo lo de Grupal',
      'Multi-sede desde un solo panel',
      'WhatsApp ilimitado',
      'Soporte prioritario',
    ],
  },
]

function slugify(t) {
  return t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function IcoEye({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {open
        ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
        : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
      }
    </svg>
  )
}

function IcoCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={{ fontSize:12, fontWeight:700, color:'#71717a', letterSpacing:0.3 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width:'100%', padding:'13px 14px', borderRadius:12, fontSize:14,
  border:`1.5px solid ${BORDER}`, background:'white', color:DARK,
  outline:'none', boxSizing:'border-box', fontFamily:'inherit',
  transition:'border-color 0.15s',
}

export default function SalonRegistroPublico() {
  const navigate = useNavigate()

  const [tab,         setTab]        = useState('registro')   // 'login' | 'registro'
  const [saving,      setSaving]     = useState(false)
  const [error,       setError]      = useState('')
  const [showPass,    setShowPass]   = useState(false)
  const [showPass2,   setShowPass2]  = useState(false)
  const [planOpen,    setPlanOpen]   = useState('pro')         // plan cuyas features están expandidas

  // PWA install
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isIOS,         setIsIOS]         = useState(false)
  const [showIOSHint,   setShowIOSHint]   = useState(false)
  const [isStandalone,  setIsStandalone]  = useState(false)

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone)
    const handler = e => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function instalarApp() {
    if (installPrompt) {
      installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
    } else if (isIOS) {
      setShowIOSHint(v => !v)
    }
  }

  // Login
  const [loginEmail,  setLoginEmail] = useState('')
  const [loginClave,  setLoginClave] = useState('')
  const [resetSent,   setResetSent]  = useState(false)

  // Registro
  const [nombre,      setNombre]     = useState('')
  const [slug,        setSlug]       = useState('')
  const [slugManual,  setSlugManual] = useState(false)
  const [vertical,    setVertical]   = useState('salon')
  const [ciudad,      setCiudad]     = useState('')
  const [telefono,    setTelefono]   = useState('')
  const [direccion,   setDireccion]  = useState('')
  const [instagram,   setInstagram]  = useState('')
  const [ownerNombre, setOwnerNombre]= useState('')
  const [email,       setEmail]      = useState('')
  const [clave,       setClave]      = useState('')
  const [clave2,      setClave2]     = useState('')
  const [plan,        setPlan]       = useState('pro')

  function handleNombre(v) {
    setNombre(v)
    if (!slugManual) setSlug(slugify(v))
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginClave,
    })
    setSaving(false)
    if (err) {
      setError('Email o contraseña incorrectos.')
      return
    }
    navigate('/salon')
  }

  async function handleForgot() {
    if (!loginEmail.trim()) { setError('Ingresa tu email para recuperar tu contraseña.'); return }
    setError('')
    await supabase.auth.resetPasswordForEmail(loginEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/salon`,
    })
    setResetSent(true)
  }

  // ── Registro ─────────────────────────────────────────────────────────────────
  async function handleRegistro(e) {
    e.preventDefault()
    setError('')
    if (!ciudad.trim())     { setError('La ciudad es requerida.'); return }
    if (!telefono.trim())   { setError('El teléfono/WhatsApp es requerido.'); return }
    if (!direccion.trim())  { setError('La dirección del negocio es requerida.'); return }
    if (clave !== clave2)     { setError('Las contraseñas no coinciden.'); return }
    if (clave.length < 8)     { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (!/[0-9]/.test(clave)) { setError('La contraseña debe incluir al menos un número.'); return }
    if (!slug.trim())       { setError('El nombre del negocio es requerido.'); return }

    setSaving(true)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/salon_self_service_registrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({
        p_nombre_negocio: nombre.trim(),
        p_slug:           slug.trim(),
        p_email:          email.trim().toLowerCase(),
        p_clave:          clave,
        p_nombre_owner:   ownerNombre.trim(),
        p_vertical:       vertical,
        p_ciudad:         ciudad.trim() || null,
        p_telefono:       telefono.trim() || null,
        p_direccion:      direccion.trim() || null,
        p_instagram:      instagram.trim() || null,
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (!data?.ok) {
      const msgs = {
        slug_taken:  'Ese nombre de negocio ya está en uso, elige otro.',
        email_taken: 'Ese email ya tiene una cuenta. ¿Quieres iniciar sesión?',
        phone_taken: 'Ese número de WhatsApp ya está registrado. Si tuviste una cuenta anterior, debes pagar para reactivarla.',
        clave_corta:      'La contraseña debe tener al menos 8 caracteres.',
        clave_sin_numero: 'La contraseña debe incluir al menos un número.',
        duplicate:   'El email o nombre ya están registrados.',
      }
      setError(msgs[data?.error] || data?.detail || 'Error al crear la cuenta. Intenta de nuevo.')
      return
    }

    await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: clave,
    })
    navigate(`/salon?tenant=${data.slug}&nuevo=true`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:'100dvh', background: BG,
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'32px 16px 80px',
      fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: ${GREEN} !important; box-shadow: 0 0 0 3px ${GREEN}18; }
        input::placeholder { color: #a1a1aa; }
      `}</style>

      <div style={{ width:'100%', maxWidth:420 }}>

        {/* ── Logo ── */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <a href="/" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:38, height:38, borderRadius:10, background:DARK,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <span style={{ fontFamily:'Outfit', fontWeight:900, fontSize:15, color:GREEN }}>SP</span>
            </div>
            <span style={{ fontFamily:'Outfit', fontWeight:900, fontSize:20, color:DARK, letterSpacing:'-0.5px' }}>
              SALÓN <span style={{ color:GREEN }}>PRO</span>
            </span>
          </a>
        </div>

        {/* ── Tab switcher ── */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr',
          background:'white', border:`1.5px solid ${BORDER}`,
          borderRadius:14, padding:4, marginBottom:24,
          boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
        }}>
          {[['login','Iniciar sesión'],['registro','Crear cuenta']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => { setTab(key); setError('') }}
              style={{
                padding:'11px 0', borderRadius:11, border:'none', cursor:'pointer',
                fontFamily:'Outfit', fontWeight:700, fontSize:14,
                background: tab === key ? DARK : 'transparent',
                color: tab === key ? '#fff' : '#71717a',
                transition:'all 0.2s',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tarjeta ── */}
        <div style={{
          background:'white', borderRadius:22, padding:'28px 24px',
          boxShadow:'0 4px 32px rgba(0,0,0,0.09)', border:`1px solid ${BORDER}`,
        }}>

          {/* ════════════ LOGIN ════════════ */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <h2 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:22, color:DARK, marginBottom:4 }}>
                  Bienvenido de nuevo
                </h2>
                <p style={{ fontSize:13, color:'#71717a' }}>Ingresa a tu panel de negocio.</p>
              </div>

              <Campo label="Correo electrónico">
                <input style={inputStyle} type="email" placeholder="tu@email.com"
                  value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  autoComplete="email" required />
              </Campo>

              <Campo label={
                <span style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  Contraseña
                  <button type="button" onClick={handleForgot}
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:GREEN, fontSize:12, fontWeight:700, padding:0 }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </span>
              }>
                <div style={{ position:'relative' }}>
                  <input style={{ ...inputStyle, paddingRight:44 }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    value={loginClave} onChange={e => setLoginClave(e.target.value)}
                    autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer', color:'#a1a1aa', padding:0 }}>
                    <IcoEye open={showPass} />
                  </button>
                </div>
              </Campo>

              {resetSent && (
                <div style={{ padding:'11px 14px', borderRadius:10, fontSize:13, color:'#16a34a',
                  background:'rgba(22,163,74,0.07)', border:'1px solid rgba(22,163,74,0.2)' }}>
                  Te enviamos un enlace de recuperación a tu email.
                </div>
              )}

              {error && (
                <div style={{ padding:'11px 14px', borderRadius:10, fontSize:13, color:'#ef4444',
                  background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={saving}
                style={{
                  padding:'15px', borderRadius:13, border:'none', cursor:'pointer',
                  background:DARK, color:'#fff', fontFamily:'Outfit', fontWeight:800,
                  fontSize:15, opacity: saving ? 0.65 : 1, marginTop:4,
                }}>
                {saving ? 'Ingresando…' : 'Ingresar al panel →'}
              </button>
            </form>
          )}

          {/* ════════════ REGISTRO ════════════ */}
          {tab === 'registro' && (
            <form onSubmit={handleRegistro} style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Banner trial */}
              <div style={{
                padding:'13px 16px', borderRadius:14,
                background:`linear-gradient(135deg, ${GREEN}12, rgba(99,102,241,0.06))`,
                border:`1px solid ${GREEN}25`,
                display:'flex', alignItems:'center', gap:12,
              }}>
                <span style={{ fontSize:24, flexShrink:0 }}>🎁</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:GREEN, marginBottom:1 }}>
                    15 días gratis incluidos
                  </div>
                  <div style={{ fontSize:11, color:'#71717a' }}>
                    Sin tarjeta de crédito · Cancela cuando quieras
                  </div>
                </div>
              </div>

              <Campo label="Tu nombre completo *">
                <input style={inputStyle} placeholder="Carolina Gómez"
                  value={ownerNombre} onChange={e => setOwnerNombre(e.target.value)}
                  autoComplete="name" required autoFocus />
              </Campo>

              <Campo label="Nombre del negocio *">
                <input style={inputStyle} placeholder="Salón Glamour"
                  value={nombre} onChange={e => handleNombre(e.target.value)} required />
                {slug && (
                  <span style={{ fontSize:11, color:'#a1a1aa', marginTop:2 }}>
                    Tu link: <strong style={{ color:'#52525b' }}>salonpro.app/{slug}</strong>
                  </span>
                )}
              </Campo>

              {/* Tipo de negocio */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#71717a', letterSpacing:0.3 }}>
                  Tipo de negocio
                </label>
                <div style={{ display:'flex', gap:7, overflowX:'auto', paddingBottom:4 }}>
                  {VERTICALES.map(v => (
                    <button key={v.key} type="button" onClick={() => setVertical(v.key)}
                      style={{
                        padding:'8px 14px', borderRadius:22, border:`1.5px solid`,
                        borderColor: vertical === v.key ? GREEN : BORDER,
                        background: vertical === v.key ? `${GREEN}10` : 'white',
                        color: vertical === v.key ? GREEN : '#71717a',
                        fontWeight: vertical === v.key ? 700 : 500,
                        fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                        transition:'all 0.15s',
                      }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Campo label="Ciudad *">
                  <input style={inputStyle} placeholder="Bogotá"
                    value={ciudad} onChange={e => setCiudad(e.target.value)} required />
                </Campo>
                <Campo label="WhatsApp del negocio *">
                  <input style={inputStyle} placeholder="3001234567" type="tel"
                    value={telefono} onChange={e => setTelefono(e.target.value)} required />
                </Campo>
              </div>

              <Campo label="Dirección del negocio *">
                <input style={inputStyle} placeholder="Calle 45 #12-34, Barrio Centro"
                  value={direccion} onChange={e => setDireccion(e.target.value)} required />
              </Campo>

              <Campo label="Instagram del negocio">
                <div style={{ position:'relative' }}>
                  <span style={{
                    position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
                    fontSize:13, color:'#a1a1aa', fontWeight:600, pointerEvents:'none',
                  }}>@</span>
                  <input style={{ ...inputStyle, paddingLeft:26 }} placeholder="salonglamour"
                    value={instagram} onChange={e => setInstagram(e.target.value.replace('@', ''))} />
                </div>
              </Campo>

              <Campo label="Correo electrónico *">
                <input style={inputStyle} type="email" placeholder="tu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" required />
              </Campo>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Campo label="Contraseña *">
                  <div style={{ position:'relative' }}>
                    <input style={{ ...inputStyle, paddingRight:42 }}
                      type={showPass ? 'text' : 'password'}
                      placeholder="Mín. 6 caracteres"
                      value={clave} onChange={e => setClave(e.target.value)}
                      autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'#a1a1aa', padding:0 }}>
                      <IcoEye open={showPass} />
                    </button>
                  </div>
                </Campo>
                <Campo label="Confirmar *">
                  <div style={{ position:'relative' }}>
                    <input style={{ ...inputStyle, paddingRight:42 }}
                      type={showPass2 ? 'text' : 'password'}
                      placeholder="Repite"
                      value={clave2} onChange={e => setClave2(e.target.value)}
                      autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowPass2(v => !v)}
                      style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'#a1a1aa', padding:0 }}>
                      <IcoEye open={showPass2} />
                    </button>
                  </div>
                </Campo>
              </div>

              {/* ── Selector de plan ── */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'#71717a', letterSpacing:0.3 }}>
                  Elige tu plan (prueba 15 días gratis):
                </label>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {PLANES.map(p => {
                    const selected = plan === p.key
                    const open = planOpen === p.key
                    return (
                      <div key={p.key}
                        onClick={() => { setPlan(p.key); setPlanOpen(p.key) }}
                        style={{
                          borderRadius:14, border:`2px solid ${selected ? GREEN : BORDER}`,
                          background: selected ? `${GREEN}07` : 'white',
                          cursor:'pointer', overflow:'hidden',
                          transition:'border-color 0.15s, background 0.15s',
                          position:'relative',
                        }}>
                        {p.popular && (
                          <div style={{
                            position:'absolute', top:0, right:16,
                            background:GREEN, color:'#fff',
                            fontSize:9, fontWeight:800, padding:'2px 10px',
                            borderBottomLeftRadius:7, borderBottomRightRadius:7,
                            letterSpacing:0.8,
                          }}>
                            POPULAR
                          </div>
                        )}
                        <div style={{
                          display:'flex', alignItems:'center', gap:12,
                          padding:'14px 16px',
                        }}>
                          <div style={{
                            width:20, height:20, borderRadius:'50%', flexShrink:0,
                            border:`2px solid ${selected ? GREEN : '#d4d4d8'}`,
                            background: selected ? GREEN : 'white',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            {selected && (
                              <div style={{ width:7, height:7, borderRadius:'50%', background:'white' }}/>
                            )}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                              <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color:DARK }}>
                                {p.label}
                              </span>
                              <span style={{ fontSize:11, color:'#71717a' }}>{p.hint}</span>
                            </div>
                          </div>
                          <div style={{ fontFamily:'Outfit', fontWeight:900, fontSize:15, color: selected ? GREEN : DARK, flexShrink:0 }}>
                            {p.price}<span style={{ fontSize:10, fontWeight:600, color:'#71717a' }}>/mes</span>
                          </div>
                        </div>

                        {/* Features expandibles */}
                        {open && (
                          <div style={{
                            borderTop:`1px solid ${selected ? GREEN + '20' : BORDER}`,
                            padding:'12px 16px 14px',
                            display:'flex', flexDirection:'column', gap:7,
                            background: selected ? `${GREEN}04` : '#fafafa',
                          }}>
                            {p.features.map(f => (
                              <div key={f} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                                <div style={{
                                  width:18, height:18, borderRadius:5, flexShrink:0,
                                  background:`${GREEN}14`,
                                  display:'flex', alignItems:'center', justifyContent:'center', marginTop:1,
                                }}>
                                  <IcoCheck />
                                </div>
                                <span style={{ fontSize:12, color:'#52525b', lineHeight:1.5 }}>{f}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {error && (
                <div style={{ padding:'11px 14px', borderRadius:10, fontSize:13, color:'#ef4444',
                  background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  {error}
                </div>
              )}

              <button type="submit"
                disabled={saving || !nombre || !ownerNombre || !email || !clave || !clave2 || !ciudad || !telefono || !direccion}
                style={{
                  padding:'16px', borderRadius:13, border:'none', cursor:'pointer',
                  background: `linear-gradient(135deg, ${GREEN}, #15803d)`,
                  color:'#fff', fontFamily:'Outfit', fontWeight:800, fontSize:16,
                  boxShadow:`0 6px 22px ${GREEN}40`, marginTop:4,
                  opacity: (saving || !nombre || !ownerNombre || !email || !clave || !clave2 || !ciudad || !telefono || !direccion) ? 0.55 : 1,
                  transition:'opacity 0.2s',
                }}>
                {saving ? 'Creando tu cuenta…' : '🚀 Crear mi cuenta gratis'}
              </button>

              <p style={{ fontSize:11, color:'#a1a1aa', textAlign:'center', lineHeight:1.6 }}>
                Al registrarte aceptas nuestros{' '}
                <a href="/" style={{ color:'#71717a', textDecoration:'underline' }}>Términos de uso</a>
                {' '}y{' '}
                <a href="/" style={{ color:'#71717a', textDecoration:'underline' }}>Política de privacidad</a>.
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign:'center', fontSize:13, color:'#71717a', marginTop:20 }}>
          {tab === 'login' ? (
            <>¿No tienes cuenta?{' '}
              <button type="button" onClick={() => { setTab('registro'); setError('') }}
                style={{ background:'none', border:'none', cursor:'pointer',
                  color:GREEN, fontWeight:700, fontSize:13, padding:0 }}>
                Regístrate gratis →
              </button>
            </>
          ) : (
            <>¿Ya tienes cuenta?{' '}
              <button type="button" onClick={() => { setTab('login'); setError('') }}
                style={{ background:'none', border:'none', cursor:'pointer',
                  color:GREEN, fontWeight:700, fontSize:13, padding:0 }}>
                Inicia sesión →
              </button>
            </>
          )}
        </p>
        <p style={{ textAlign:'center', marginTop:12 }}>
          <button type="button"
            onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
            style={{ background:'none', border:'none', cursor:'pointer',
              fontSize:11, color:'#a1a1aa', padding:0 }}>
            ⚠️ ¿Problemas para entrar? Limpiar sesión
          </button>
        </p>

        {/* ── Instalar app ── */}
        {!isStandalone && (installPrompt || isIOS) && (
          <div style={{ marginTop:24, textAlign:'center' }}>
            <button type="button" onClick={instalarApp} style={{
              display:'inline-flex', alignItems:'center', gap:10,
              padding:'13px 24px', borderRadius:14, border:`1.5px solid ${BORDER}`,
              background:'white', color:DARK, cursor:'pointer',
              boxShadow:'0 2px 12px rgba(0,0,0,0.07)',
              fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif',
              fontWeight:700, fontSize:14, transition:'transform 0.15s',
            }}>
              <img src="/logo192.png" alt="" style={{ width:28, height:28, borderRadius:8, flexShrink:0 }} />
              📲 Instalar Salón Pro
            </button>
            {showIOSHint && (
              <div style={{
                marginTop:10, padding:'12px 16px', borderRadius:13,
                background:'white', border:`1.5px solid ${BORDER}`,
                fontSize:12, color:'#52525b', lineHeight:1.7,
                textAlign:'left', boxShadow:'0 2px 12px rgba(0,0,0,0.07)',
              }}>
                En Safari, toca el ícono <strong>Compartir</strong> (□↑) al pie de la pantalla<br/>
                y luego <strong>"Agregar a pantalla de inicio"</strong>.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
