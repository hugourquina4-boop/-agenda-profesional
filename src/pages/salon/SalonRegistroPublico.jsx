import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY

const VERTICALES = [
  { key:'salon',    emoji:'✂️', label:'Peluquería / Estética' },
  { key:'barberia', emoji:'💈', label:'Barbería' },
  { key:'spa',      emoji:'🧖', label:'Spa / Masajes' },
  { key:'nails',    emoji:'💅', label:'Uñas' },
  { key:'maquillaje', emoji:'💄', label:'Maquillaje' },
  { key:'otro',     emoji:'🏪', label:'Otro' },
]

function slugify(t) {
  return t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'')
}

function Ico({ d, size=20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function SalonRegistroPublico() {
  const navigate = useNavigate()
  const [step,        setStep]       = useState(1)
  const [saving,      setSaving]     = useState(false)
  const [error,       setError]      = useState('')

  // Paso 1
  const [nombre,      setNombre]     = useState('')
  const [slug,        setSlug]       = useState('')
  const [slugManual,  setSlugManual] = useState(false)
  const [vertical,    setVertical]   = useState('salon')
  const [ciudad,      setCiudad]     = useState('')
  const [telefono,    setTelefono]   = useState('')

  // Paso 2
  const [ownerNombre, setOwnerNombre]= useState('')
  const [email,       setEmail]      = useState('')
  const [clave,       setClave]      = useState('')
  const [clave2,      setClave2]     = useState('')

  function handleNombre(v) {
    setNombre(v)
    if (!slugManual) setSlug(slugify(v))
  }

  async function registrar(e) {
    e.preventDefault()
    setError('')

    if (clave !== clave2)    { setError('Las contraseñas no coinciden'); return }
    if (clave.length < 6)    { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (!slug.trim())        { setError('El identificador del negocio es requerido'); return }

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
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (!data?.ok) {
      const msgs = {
        slug_taken:  'Ese identificador ya está en uso, elige otro.',
        email_taken: 'Ese email ya tiene una cuenta. ¿Quieres iniciar sesión?',
        clave_corta: 'La contraseña debe tener al menos 6 caracteres.',
        duplicate:   'El email o identificador ya están registrados.',
      }
      setError(msgs[data?.error] || data?.detail || 'Error al crear la cuenta. Intenta de nuevo.')
      return
    }

    // Login automático con las credenciales recién creadas
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: clave,
    })

    if (signInErr) {
      // Registro OK pero login falló — igual al salon con ?tenant= y mensaje
      navigate(`/salon?tenant=${data.slug}&nuevo=true`)
      return
    }

    navigate(`/salon?tenant=${data.slug}&nuevo=true`)
  }

  const accent = '#f43f5e'

  // ── Pantalla confirmación ──────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:'100dvh', background:'var(--bg)', padding:'24px 16px 60px',
      display:'flex', flexDirection:'column', alignItems:'center',
    }}>
      {/* Fondo decorativo */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        background:`radial-gradient(ellipse 70% 50% at 20% 30%, ${accent}15 0%, transparent 70%),
                    radial-gradient(ellipse 50% 60% at 80% 80%, rgba(168,85,247,0.05) 0%, transparent 70%)`,
      }} />

      <div style={{ width:'100%', maxWidth:440, position:'relative', zIndex:1 }}>

        {/* Volver */}
        <button onClick={() => navigate('/salon')}
          style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer',
            display:'flex', alignItems:'center', gap:6, marginBottom:28, fontSize:14, padding:0 }}>
          <Ico d="M15 19l-7-7 7-7" size={16} /> Volver al inicio
        </button>

        {/* Logo + título */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{
            width:60, height:60, borderRadius:18,
            background:`linear-gradient(135deg, ${accent}, #e11d48)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 16px', boxShadow:`0 8px 28px ${accent}40`,
          }}>
            <Ico d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v2.101a8.01 8.01 0 015 0V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4H7z" size={28} />
          </div>
          <h1 style={{ fontFamily:'Outfit', fontWeight:900, fontSize:26,
            color:'var(--text)', letterSpacing:'-0.5px', marginBottom:6 }}>
            14 días gratis
          </h1>
          <p style={{ fontSize:14, color:'var(--text-3)' }}>
            Sin tarjeta de crédito · Cancela cuando quieras
          </p>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display:'flex', gap:8, marginBottom:28 }}>
          {['Tu negocio','Tu cuenta'].map((label, i) => (
            <div key={label} style={{ flex:1 }}>
              <div style={{
                height:4, borderRadius:4, marginBottom:6,
                background: step > i+1 ? accent : step === i+1 ? accent : 'var(--border)',
                transition: 'background 0.3s',
              }} />
              <p style={{ fontSize:11, fontWeight:step === i+1 ? 700 : 400,
                color: step === i+1 ? accent : 'var(--text-3)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tarjeta */}
        <div style={{
          background:'var(--card)', borderRadius:24, padding:28,
          boxShadow:'0 4px 32px rgba(0,0,0,0.12)',
        }}>
          <form onSubmit={step === 1
            ? (e) => { e.preventDefault(); setError(''); setStep(2) }
            : registrar
          } style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* ── Paso 1: datos del negocio ──────────────────────────────────── */}
            {step === 1 && (<>

              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', display:'block', marginBottom:8 }}>NOMBRE DEL NEGOCIO *</label>
                <input
                  className="sp-input"
                  value={nombre}
                  onChange={e => handleNombre(e.target.value)}
                  placeholder="Salón Glamour"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', display:'block', marginBottom:8 }}>TIPO DE NEGOCIO *</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {VERTICALES.map(v => (
                    <button key={v.key} type="button"
                      onClick={() => setVertical(v.key)}
                      style={{
                        padding:'10px 12px', borderRadius:12,
                        border:`2px solid ${vertical === v.key ? accent : 'var(--border)'}`,
                        background: vertical === v.key ? `${accent}10` : 'var(--bg)',
                        cursor:'pointer', textAlign:'left', fontSize:13,
                        color: vertical === v.key ? accent : 'var(--text-2)',
                        fontWeight: vertical === v.key ? 700 : 400, transition:'all 0.15s',
                      }}>
                      {v.emoji} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                    color:'var(--text-3)', display:'block', marginBottom:8 }}>CIUDAD</label>
                  <input className="sp-input" value={ciudad}
                    onChange={e => setCiudad(e.target.value)} placeholder="Cali" />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                    color:'var(--text-3)', display:'block', marginBottom:8 }}>WHATSAPP</label>
                  <input className="sp-input" value={telefono}
                    onChange={e => setTelefono(e.target.value)} placeholder="3001234567" />
                </div>
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', display:'block', marginBottom:8 }}>TU URL PÚBLICA</label>
                <div style={{
                  display:'flex', alignItems:'center', gap:0,
                  background:'var(--bg)', border:'1.5px solid var(--border)',
                  borderRadius:12, overflow:'hidden', fontSize:13,
                }}>
                  <span style={{ padding:'12px 10px 12px 14px', color:'var(--text-3)',
                    whiteSpace:'nowrap', flexShrink:0 }}>salon.pro/</span>
                  <input
                    style={{ flex:1, border:'none', background:'transparent', outline:'none',
                      padding:'12px 14px 12px 0', fontFamily:'monospace', fontSize:13,
                      color:'var(--text)', minWidth:0 }}
                    value={slug}
                    onChange={e => { setSlugManual(true); setSlug(slugify(e.target.value)) }}
                    placeholder="mi-negocio"
                    required
                  />
                </div>
              </div>

              {error && (
                <div style={{ padding:'12px 14px', borderRadius:12, fontSize:13, color:'#f87171',
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  {error}
                </div>
              )}

              <button type="submit"
                disabled={!nombre.trim() || !slug.trim()}
                style={{
                  padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg, ${accent}, #e11d48)`,
                  color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
                  boxShadow:`0 4px 20px ${accent}44`,
                  opacity: (!nombre.trim() || !slug.trim()) ? 0.5 : 1,
                }}>
                Continuar →
              </button>
            </>)}

            {/* ── Paso 2: datos del dueño ────────────────────────────────────── */}
            {step === 2 && (<>

              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', display:'block', marginBottom:8 }}>TU NOMBRE *</label>
                <input className="sp-input" value={ownerNombre}
                  onChange={e => setOwnerNombre(e.target.value)}
                  placeholder="Tu nombre completo" required autoFocus />
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', display:'block', marginBottom:8 }}>EMAIL *</label>
                <input className="sp-input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" required autoComplete="email" />
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', display:'block', marginBottom:8 }}>CONTRASEÑA *</label>
                <input className="sp-input" type="password" value={clave}
                  onChange={e => setClave(e.target.value)}
                  placeholder="Mínimo 6 caracteres" required autoComplete="new-password" />
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, letterSpacing:0.5,
                  color:'var(--text-3)', display:'block', marginBottom:8 }}>REPETIR CONTRASEÑA *</label>
                <input className="sp-input" type="password" value={clave2}
                  onChange={e => setClave2(e.target.value)}
                  placeholder="Repite la contraseña" required autoComplete="new-password" />
              </div>

              {error && (
                <div style={{ padding:'12px 14px', borderRadius:12, fontSize:13, color:'#f87171',
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  {error}
                </div>
              )}

              <button type="submit"
                disabled={saving || !email || !clave || !ownerNombre}
                style={{
                  padding:'16px', borderRadius:14, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg, ${accent}, #e11d48)`,
                  color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:16,
                  boxShadow:`0 4px 20px ${accent}44`,
                  opacity: (saving || !email || !clave || !ownerNombre) ? 0.6 : 1,
                }}>
                {saving ? 'Creando tu cuenta…' : 'Comenzar 14 días gratis'}
              </button>

              <button type="button" onClick={() => { setStep(1); setError('') }}
                style={{ background:'none', border:'none', cursor:'pointer',
                  fontSize:13, color:'var(--text-3)', padding:'4px 0' }}>
                ← Volver
              </button>
            </>)}

          </form>
        </div>

        {/* Footer */}
        <p style={{ textAlign:'center', fontSize:13, color:'var(--text-3)', marginTop:20 }}>
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => navigate('/salon')}
            style={{ background:'none', border:'none', cursor:'pointer',
              color: accent, fontWeight:700, fontSize:13, padding:0 }}>
            Inicia sesión
          </button>
        </p>

      </div>
    </div>
  )
}
