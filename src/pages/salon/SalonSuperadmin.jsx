import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function fmtCOP(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const PLAN_PRECIO = { starter: 60000, pro: 100000, ultra: 140000 }
const PLAN_COLOR  = { starter: '#60a5fa', pro: '#a855f7', ultra: '#f59e0b' }
const VERTICALES  = ['salon', 'barberia', 'spa', 'estetica', 'unas']
const PLANES      = ['starter', 'pro', 'ultra']
const COLORES_PRESET = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899','#14b8a6']

function PlanBadge({ plan }) {
  const color = PLAN_COLOR[plan] || '#60a5fa'
  return (
    <span style={{
      padding:'3px 8px', borderRadius:20,
      background:`${color}18`, border:`1px solid ${color}40`,
      fontSize:10, fontWeight:700, color, letterSpacing:0.5,
      textTransform:'uppercase', flexShrink:0,
    }}>
      {plan || 'starter'}
    </span>
  )
}

const FORM_INICIAL = { nombre:'', slug:'', ciudad:'', vertical:'salon', plan:'starter', color:'#f43f5e', email_dueno:'', password_temp:'', representante:'', telefono:'', direccion:'', web:'', instagram:'' }

const ADMIN_SECRET = 'salonpro2026'
const ADMIN_HASH   = 'e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91'

// Modal para resetear contraseña (por email o por tenant)
function ModalResetClave({ titulo, emailInicial, tenantId, onClose, showToast }) {
  const [email,    setEmail]    = useState(emailInicial || '')
  const [clave,    setClave]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [resultado, setResultado] = useState(null)

  async function handleReset(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setResultado(null)
    const body = tenantId
      ? { tenant_id: tenantId, nueva_clave: clave.trim() || undefined }
      : { email: email.trim(), nueva_clave: clave.trim() || undefined }

    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      headers: { 'x-admin-secret': ADMIN_SECRET },
      body,
    })
    setLoading(false)
    if (error || data?.error) {
      showToast(data?.error || error?.message || 'Error', '#f87171')
    } else {
      setResultado({ email: data.email, clave: data.clave })
      showToast(`Clave actualizada para ${data.email}`)
    }
  }

  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">{titulo}</p>

        {resultado ? (
          <div style={{ textAlign:'center', padding:'16px 0 24px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔑</div>
            <p style={{ fontSize:14, color:'var(--text-2)', marginBottom:8 }}>
              Contraseña actualizada para:
            </p>
            <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:16 }}>
              {resultado.email}
            </p>
            <div style={{
              padding:'14px 18px', borderRadius:14,
              background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)',
              fontFamily:'monospace', fontSize:18, fontWeight:700,
              color:'#4ade80', letterSpacing:2, marginBottom:20,
            }}>
              {resultado.clave}
            </div>
            <p style={{ fontSize:12, color:'var(--text-3)' }}>
              Copia esta clave — no se muestra de nuevo
            </p>
            <button onClick={onClose} style={{
              marginTop:16, width:'100%', padding:'12px', borderRadius:14,
              background:'linear-gradient(135deg,#f43f5e,#e11d48)',
              border:'none', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
            }}>
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {!tenantId && (
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                  EMAIL DEL USUARIO
                </label>
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  style={{
                    width:'100%', padding:'10px 14px', borderRadius:12,
                    border:'1px solid var(--border)', background:'var(--bg)',
                    color:'var(--text)', fontSize:14, outline:'none',
                  }}
                />
              </div>
            )}
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                NUEVA CONTRASEÑA <span style={{ color:'var(--text-3)', fontWeight:400 }}>(vacío = generar automáticamente)</span>
              </label>
              <input
                type="text"
                value={clave} onChange={e => setClave(e.target.value)}
                placeholder="Dejar vacío para generar"
                style={{
                  width:'100%', padding:'10px 14px', borderRadius:12,
                  border:'1px solid var(--border)', background:'var(--bg)',
                  color:'var(--text)', fontSize:14, outline:'none',
                }}
              />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={onClose} style={{
                flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                background:'transparent', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} style={{
                flex:2, padding:'12px', borderRadius:14, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg,#f43f5e,#e11d48)',
                color:'#fff', fontWeight:700, fontSize:14, opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Actualizando…' : 'Resetear contraseña'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}

export default function SalonSuperadmin({ onGestionar }) {
  const { esSuperadmin, user } = useTenant()

  const [negocios,    setNegocios]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState(null)
  const [buscar,      setBuscar]      = useState('')
  const [modal,       setModal]       = useState(false)
  const [creando,     setCreando]     = useState(false)
  const [gestionando, setGestionando] = useState(null)
  const [toast,       setToast]       = useState(null)
  const [form,        setForm]        = useState(FORM_INICIAL)
  const [resetModal,  setResetModal]  = useState(null)  // { titulo, emailInicial, tenantId }

  const showToast = (msg, color = '#22c55e') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2800)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase.rpc('salon_admin_get_tenants', { p_token: ADMIN_HASH })

    if (error) {
      setLoadError(error.message || 'Error al cargar negocios')
      setNegocios([])
      setLoading(false)
      return
    }

    const tenants = Array.isArray(data) ? data : (data || [])
    const hoy = new Date()

    const conMetricas = await Promise.all(tenants.map(async t => {
      const { count: usuarios } = await supabase
        .from('usuarios_tenant')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', t.id)
        .eq('activo', true)
        .neq('rol', 'superadmin')

      const vence = t.fecha_vencimiento ? new Date(t.fecha_vencimiento) : null
      const diasRestantes = vence ? Math.ceil((vence - hoy) / 86400000) : null

      return { ...t, tenant_id: t.id, usuarios_count: usuarios || 0, dias_restantes: diasRestantes }
    }))

    setNegocios(conMetricas)
    setLoading(false)
  }, [])

  useEffect(() => { if (esSuperadmin) cargar() }, [cargar, esSuperadmin])

  function slugify(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  function setNombre(v) {
    setForm(f => ({ ...f, nombre: v, slug: slugify(v) }))
  }

  async function crearNegocio() {
    if (!form.nombre.trim() || !form.slug.trim()) {
      showToast('Nombre y slug son requeridos', '#f87171'); return
    }
    setCreando(true)
    const { error } = await supabase.rpc('crear_negocio', {
      p_nombre:         form.nombre.trim(),
      p_slug:           form.slug.trim(),
      p_ciudad:         form.ciudad         || null,
      p_vertical:       form.vertical,
      p_plan:           form.plan,
      p_color:          form.color,
      p_representante:  form.representante  || null,
      p_telefono:       form.telefono       || null,
      p_direccion:      form.direccion      || null,
      p_web:            form.web            || null,
      p_instagram:      form.instagram      || null,
    })
    if (error) { setCreando(false); showToast(error.message || 'Error creando negocio', '#f87171'); return }

    if (form.email_dueno.trim()) {
      const { data: lista } = await supabase.rpc('superadmin_tenants_info')
      const nuevo = lista?.find(t => t.slug === form.slug.trim())
      if (nuevo) {
        await supabase.functions.invoke('admin-crear-usuario', {
          headers: { 'x-admin-secret': 'salonpro2026' },
          body: {
            email:     form.email_dueno.trim(),
            password:  form.password_temp.trim() || 'SalonPro2026!',
            tenant_id: nuevo.tenant_id,
            rol:       'admin',
          },
        })
      }
    }

    setCreando(false)
    showToast(`"${form.nombre}" creado ✓`)
    setModal(false)
    setForm(FORM_INICIAL)
    cargar()
  }

  async function gestionar(tenantId) {
    setGestionando(tenantId)
    await onGestionar(tenantId)
    setGestionando(null)
  }

  const filtrados = negocios.filter(n =>
    n.nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
    n.ciudad?.toLowerCase().includes(buscar.toLowerCase()) ||
    n.slug?.toLowerCase().includes(buscar.toLowerCase())
  )

  const activos      = negocios.filter(n => n.activo)
  const mrr          = activos.reduce((s, n) => s + (PLAN_PRECIO[n.plan] || 49000), 0)
  const arr          = mrr * 12
  const totalUsuarios = negocios.reduce((s, n) => s + (n.usuarios_count || 0), 0)
  const ingresosMes  = 0

  if (!esSuperadmin) return (
    <div className="sp-empty">
      <span className="sp-empty-icon">🔒</span>
      <p className="sp-empty-title">Sin acceso</p>
      <p className="sp-empty-sub">Solo superadmin puede ver esta sección</p>
    </div>
  )

  return (
    <>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {/* ── Modal reset clave ─────────────────────────────── */}
      {resetModal && (
        <ModalResetClave
          titulo={resetModal.titulo}
          emailInicial={resetModal.emailInicial}
          tenantId={resetModal.tenantId}
          onClose={() => setResetModal(null)}
          showToast={showToast}
        />
      )}

      {/* ── Mi acceso superadmin ─────────────────────────── */}
      <div style={{ margin:'16px 16px 0', padding:'14px 16px', borderRadius:16,
        background:'var(--card)', border:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          width:40, height:40, borderRadius:12, flexShrink:0,
          background:'linear-gradient(135deg,#f43f5e,#e11d48)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 12px rgba(244,63,94,0.3)',
        }}>
          <Ico d="M12 11c0-1.657-1.343-3-3-3S6 9.343 6 11m6 0c0-1.657 1.343-3 3-3s3 1.343 3 3m-6 0v2m0 4h.01M5 20h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2z" size={20} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
            Mi acceso superadmin
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {user?.email || '—'}
          </div>
        </div>
        <button
          onClick={() => setResetModal({ titulo:'Resetear mi contraseña', emailInicial: user?.email || '', tenantId: null })}
          style={{
            padding:'7px 14px', borderRadius:10, border:'1px solid rgba(244,63,94,0.3)',
            background:'rgba(244,63,94,0.1)', color:'#f87171',
            fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0,
          }}>
          <Ico d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" size={13} />
        </button>
      </div>

      {/* ── Modal: nuevo negocio ──────────────────────────── */}
      {modal && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setModal(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Nuevo negocio</p>

            <div style={{ display:'flex', flexDirection:'column', gap:14, paddingBottom:8 }}>
              {/* Nombre */}
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                  Nombre del negocio *
                </label>
                <input
                  autoFocus
                  value={form.nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Glamour Studio"
                  style={{
                    width:'100%', padding:'10px 14px', borderRadius:12, boxSizing:'border-box',
                    border:'1px solid var(--border)', background:'var(--bg)',
                    color:'var(--text)', fontSize:14, outline:'none',
                  }}
                />
              </div>

              {/* Slug */}
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                  Slug URL *
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{
                    position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
                    fontSize:13, color:'var(--text-3)', fontWeight:600, pointerEvents:'none',
                  }}>
                    /reservar/
                  </span>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="glamour-studio"
                    style={{
                      width:'100%', padding:'10px 14px 10px 88px', borderRadius:12, boxSizing:'border-box',
                      border:'1px solid var(--border)', background:'var(--bg)',
                      color:'var(--text)', fontSize:14, outline:'none',
                    }}
                  />
                </div>
              </div>

              {/* Ciudad */}
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                  Ciudad
                </label>
                <input
                  value={form.ciudad}
                  onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                  placeholder="Bogotá"
                  style={{
                    width:'100%', padding:'10px 14px', borderRadius:12, boxSizing:'border-box',
                    border:'1px solid var(--border)', background:'var(--bg)',
                    color:'var(--text)', fontSize:14, outline:'none',
                  }}
                />
              </div>

              {/* Vertical + Plan */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                    Tipo
                  </label>
                  <select value={form.vertical}
                    onChange={e => setForm(f => ({ ...f, vertical: e.target.value }))}
                    style={{
                      width:'100%', padding:'10px 12px', borderRadius:12,
                      border:'1px solid var(--border)', background:'var(--bg)',
                      color:'var(--text)', fontSize:13, outline:'none',
                    }}>
                    {VERTICALES.map(v => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                    Plan
                  </label>
                  <select value={form.plan}
                    onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                    style={{
                      width:'100%', padding:'10px 12px', borderRadius:12,
                      border:'1px solid var(--border)', background:'var(--bg)',
                      color:'var(--text)', fontSize:13, outline:'none',
                    }}>
                    {PLANES.map(p => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)} — {fmtCOP(PLAN_PRECIO[p])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color */}
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:8 }}>
                  Color de marca
                </label>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <input type="color" value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    style={{
                      width:40, height:40, borderRadius:10, border:'1px solid var(--border)',
                      cursor:'pointer', padding:3, background:'var(--bg)',
                    }}
                  />
                  {COLORES_PRESET.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width:28, height:28, borderRadius:8, background:c, cursor:'pointer', flexShrink:0,
                        outline: form.color === c ? `3px solid ${c}` : 'none',
                        outlineOffset: 2,
                        transition:'outline 0.1s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Email dueño */}
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                  Email del dueño <span style={{ color:'var(--text-3)', fontWeight:400 }}>(opcional — crea acceso automático)</span>
                </label>
                <input
                  type="email"
                  value={form.email_dueno}
                  onChange={e => setForm(f => ({ ...f, email_dueno: e.target.value }))}
                  placeholder="dueno@salon.com"
                  style={{
                    width:'100%', padding:'10px 14px', borderRadius:12, boxSizing:'border-box',
                    border:'1px solid var(--border)', background:'var(--bg)',
                    color:'var(--text)', fontSize:14, outline:'none',
                  }}
                />
              </div>

              {form.email_dueno.trim() && (
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                    Contraseña temporal <span style={{ color:'var(--text-3)', fontWeight:400 }}>(default: SalonPro2026!)</span>
                  </label>
                  <input
                    type="text"
                    value={form.password_temp}
                    onChange={e => setForm(f => ({ ...f, password_temp: e.target.value }))}
                    placeholder="SalonPro2026!"
                    style={{
                      width:'100%', padding:'10px 14px', borderRadius:12, boxSizing:'border-box',
                      border:'1px solid var(--border)', background:'var(--bg)',
                      color:'var(--text)', fontSize:14, outline:'none',
                    }}
                  />
                </div>
              )}

              {/* ── Sección Contacto ── */}
              <div style={{
                padding:'14px', borderRadius:14, marginTop:4,
                background:'rgba(128,128,128,0.05)', border:'1px solid var(--border)',
              }}>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.8,
                  textTransform:'uppercase', marginBottom:12 }}>Datos de contacto</p>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>
                      Nombre del representante
                    </label>
                    <input
                      value={form.representante}
                      onChange={e => setForm(f => ({ ...f, representante: e.target.value }))}
                      placeholder="Ej: María García"
                      style={{
                        width:'100%', padding:'9px 12px', borderRadius:10, boxSizing:'border-box',
                        border:'1px solid var(--border)', background:'var(--bg)',
                        color:'var(--text)', fontSize:13, outline:'none',
                      }}
                    />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>
                        Teléfono
                      </label>
                      <input
                        value={form.telefono}
                        onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                        placeholder="+57 300 0000000"
                        style={{
                          width:'100%', padding:'9px 12px', borderRadius:10, boxSizing:'border-box',
                          border:'1px solid var(--border)', background:'var(--bg)',
                          color:'var(--text)', fontSize:13, outline:'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>
                        Instagram
                      </label>
                      <div style={{ position:'relative' }}>
                        <span style={{
                          position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                          fontSize:12, color:'var(--text-3)', pointerEvents:'none',
                        }}>@</span>
                        <input
                          value={form.instagram}
                          onChange={e => setForm(f => ({ ...f, instagram: e.target.value.replace('@','') }))}
                          placeholder="miestudio"
                          style={{
                            width:'100%', padding:'9px 12px 9px 22px', borderRadius:10, boxSizing:'border-box',
                            border:'1px solid var(--border)', background:'var(--bg)',
                            color:'var(--text)', fontSize:13, outline:'none',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>
                      Dirección
                    </label>
                    <input
                      value={form.direccion}
                      onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                      placeholder="Calle 50 # 20-30, Cali"
                      style={{
                        width:'100%', padding:'9px 12px', borderRadius:10, boxSizing:'border-box',
                        border:'1px solid var(--border)', background:'var(--bg)',
                        color:'var(--text)', fontSize:13, outline:'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>
                      Página web
                    </label>
                    <input
                      value={form.web}
                      onChange={e => setForm(f => ({ ...f, web: e.target.value }))}
                      placeholder="https://miestudio.com"
                      style={{
                        width:'100%', padding:'9px 12px', borderRadius:10, boxSizing:'border-box',
                        border:'1px solid var(--border)', background:'var(--bg)',
                        color:'var(--text)', fontSize:13, outline:'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Preview slug */}
            {form.slug && (
              <div style={{
                padding:'10px 14px', borderRadius:12, marginTop:4,
                background:'var(--bg)', border:'1px solid var(--border)',
                fontSize:12, color:'var(--text-3)',
              }}>
                Portal: <span style={{ color:'var(--text-2)', fontWeight:600 }}>
                  /reservar/{form.slug}
                </span>
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setModal(false)} style={{
                flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                background:'transparent', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>
                Cancelar
              </button>
              <button onClick={crearNegocio} disabled={creando} style={{
                flex:2, padding:'12px', borderRadius:14, border:'none', cursor:'pointer',
                background:'linear-gradient(135deg,#f43f5e,#e11d48)',
                color:'#fff', fontWeight:700, fontSize:14,
                opacity: creando ? 0.7 : 1,
              }}>
                {creando ? 'Creando…' : 'Crear negocio'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── KPI strip ────────────────────────────────────── */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
        background:'var(--border)', margin:'16px 16px 0', borderRadius:16, overflow:'hidden',
      }}>
        {[
          ['Negocios', negocios.length, '#60a5fa'],
          ['Activos',  activos.length,  '#4ade80'],
          ['MRR',      fmtCOP(mrr),     '#c084fc'],
          ['Usuarios', totalUsuarios,   '#fb923c'],
        ].map(([lbl, val, c]) => (
          <div key={lbl} style={{ padding:'14px 10px', background:'var(--card)', textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:900, color:c, fontFamily:'Outfit', lineHeight:1 }}>{val}</div>
            <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700,
              textTransform:'uppercase', letterSpacing:0.6, marginTop:4 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* ARR + ingresos reales */}
      {ingresosMes > 0 && (
        <div style={{ margin:'8px 16px 0', padding:'10px 14px', borderRadius:12,
          background:'var(--card)', border:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:16, fontSize:12 }}>
          <div>
            <span style={{ color:'var(--text-3)', fontWeight:600 }}>ARR est. </span>
            <span style={{ color:'var(--text)', fontWeight:800, fontFamily:'Outfit' }}>{fmtCOP(arr)}</span>
          </div>
          <div style={{ width:1, height:16, background:'var(--border)' }} />
          <div>
            <span style={{ color:'var(--text-3)', fontWeight:600 }}>Ingresos este mes </span>
            <span style={{ color:'#4ade80', fontWeight:800, fontFamily:'Outfit' }}>{fmtCOP(ingresosMes)}</span>
          </div>
        </div>
      )}

      {/* ── Action bar ───────────────────────────────────── */}
      <div style={{ padding:'12px 16px 8px', display:'flex', gap:10 }}>
        <div style={{ flex:1, position:'relative', display:'flex', alignItems:'center' }}>
          <div style={{ position:'absolute', left:11, color:'var(--text-3)', pointerEvents:'none', display:'flex' }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={15} />
          </div>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar negocio…"
            style={{
              width:'100%', padding:'9px 12px 9px 36px', borderRadius:12,
              border:'1px solid var(--border)', background:'var(--card)',
              color:'var(--text)', fontSize:13, outline:'none',
            }}
          />
        </div>
        <button onClick={() => setModal(true)} style={{
          display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:12,
          background:'linear-gradient(135deg,#f43f5e,#e11d48)', border:'none',
          color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', flexShrink:0,
          boxShadow:'0 4px 14px rgba(244,63,94,0.35)',
        }}>
          <Ico d="M12 4v16m8-8H4" size={14} />
          Nuevo
        </button>
      </div>

      {/* ── Error persistente ────────────────────────────── */}
      {loadError && (
        <div style={{
          margin:'12px 16px 0', padding:'14px 16px', borderRadius:14,
          background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)',
          display:'flex', alignItems:'flex-start', gap:12,
        }}>
          <div style={{ fontSize:18, flexShrink:0 }}>⚠️</div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'#f87171', marginBottom:4 }}>
              Error cargando negocios
            </p>
            <p style={{ fontSize:12, color:'rgba(248,113,113,0.8)', marginBottom:10, fontFamily:'monospace', lineHeight:1.5 }}>
              {loadError}
            </p>
            <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:10, lineHeight:1.5 }}>
              Aplica <b>v42_fix_superadmin_info.sql</b> en Supabase → SQL Editor y recarga.
            </p>
            <button onClick={cargar} style={{
              padding:'7px 14px', borderRadius:9, border:'1px solid rgba(239,68,68,0.35)',
              background:'rgba(239,68,68,0.12)', color:'#f87171',
              fontSize:12, fontWeight:700, cursor:'pointer',
            }}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* ── Lista negocios ───────────────────────────────── */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
          <div className="sp-spinner" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">🏪</span>
          <p className="sp-empty-title">{buscar ? 'Sin resultados' : 'Sin negocios'}</p>
          <p className="sp-empty-sub">{buscar ? 'Intenta otra búsqueda' : 'Crea el primer negocio'}</p>
        </div>
      ) : (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          {filtrados.map(n => {
            const col = n.color_primario || '#f43f5e'
            return (
              <div key={n.tenant_id} style={{
                borderRadius:18, background:'var(--card)',
                border:'1px solid var(--border)', overflow:'hidden',
                opacity: n.activo ? 1 : 0.55,
              }}>
                {/* Accent bar */}
                <div style={{ height:3, background:`linear-gradient(90deg,${col},${col}55)` }} />

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px' }}>
                  <div style={{
                    width:46, height:46, borderRadius:13, flexShrink:0,
                    background:`linear-gradient(135deg,${col},${col}88)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Outfit', fontWeight:900, fontSize:19, color:'#fff',
                    boxShadow:`0 4px 12px ${col}44`,
                  }}>
                    {n.nombre?.[0]?.toUpperCase()}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{n.nombre}</span>
                      <PlanBadge plan={n.plan} />
                      {!n.activo && (
                        <span style={{
                          padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700,
                          background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)',
                          color:'#f87171',
                        }}>INACTIVO</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)', display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span>/{n.slug}</span>
                      {n.ciudad && <><span>·</span><span>{n.ciudad}</span></>}
                      {n.vertical && <><span>·</span><span>{n.vertical}</span></>}
                    </div>
                  </div>

                  <button
                    onClick={() => gestionar(n.tenant_id)}
                    disabled={!!gestionando}
                    style={{
                      padding:'8px 14px', borderRadius:10, border:`1px solid ${col}40`,
                      background:`${col}15`, color:col, fontWeight:700, fontSize:12,
                      cursor:'pointer', flexShrink:0,
                      opacity: gestionando === n.tenant_id ? 0.6 : 1,
                    }}>
                    {gestionando === n.tenant_id ? '…' : 'Gestionar →'}
                  </button>
                </div>

                {/* Stats */}
                <div style={{
                  display:'grid', gridTemplateColumns:'1fr 1fr',
                  gap:1, background:'var(--border)',
                  borderTop:'1px solid var(--border)',
                }}>
                  {[
                    ['Días de plan', n.dias_restantes !== null
                      ? (n.dias_restantes <= 0
                          ? <span style={{ color:'#f87171' }}>Vencido</span>
                          : <span style={{ color: n.dias_restantes <= 7 ? '#f59e0b' : '#4ade80' }}>{n.dias_restantes}d</span>)
                      : '—'],
                    ['Usuarios', n.usuarios_count ?? 0],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ padding:'10px 8px', background:'var(--card)', textAlign:'center' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', fontFamily:'Outfit' }}>{val}</div>
                      <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:600,
                        textTransform:'uppercase', letterSpacing:0.4 }}>{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Contacto */}
                {(n.nombre_representante || n.telefono || n.instagram || n.pagina_web || n.direccion) && (
                  <div style={{
                    padding:'10px 16px', borderTop:'1px solid var(--border)',
                    display:'flex', flexWrap:'wrap', gap:'6px 16px',
                  }}>
                    {n.nombre_representante && (
                      <span style={{ fontSize:11, color:'var(--text-3)', display:'flex', alignItems:'center', gap:4 }}>
                        <Ico d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" size={12} />
                        {n.nombre_representante}
                      </span>
                    )}
                    {n.telefono && (
                      <span style={{ fontSize:11, color:'var(--text-3)', display:'flex', alignItems:'center', gap:4 }}>
                        <Ico d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" size={12} />
                        {n.telefono}
                      </span>
                    )}
                    {n.instagram && (
                      <span style={{ fontSize:11, color:'#c084fc', display:'flex', alignItems:'center', gap:3 }}>
                        @{n.instagram}
                      </span>
                    )}
                    {n.pagina_web && (
                      <a href={n.pagina_web} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize:11, color:'#60a5fa', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
                        <Ico d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" size={12} />
                        Web
                      </a>
                    )}
                    {n.direccion && (
                      <span style={{ fontSize:11, color:'var(--text-3)', display:'flex', alignItems:'center', gap:3 }}>
                        <Ico d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" size={12} />
                        {n.direccion}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div style={{ padding:'8px 16px', display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600 }}>MRR:</span>
                  <span style={{ fontSize:12, fontWeight:800, color:PLAN_COLOR[n.plan] || '#60a5fa',
                    fontFamily:'Outfit' }}>
                    {fmtCOP(PLAN_PRECIO[n.plan] || 49000)}/mes
                  </span>
                  <span style={{ flex:1 }} />
                  <button
                    onClick={() => setResetModal({
                      titulo: `Resetear clave — ${n.nombre}`,
                      emailInicial: n.admin_email || '',
                      tenantId: n.tenant_id,
                    })}
                    style={{
                      padding:'5px 11px', borderRadius:8, cursor:'pointer',
                      border:'1px solid rgba(245,158,11,0.3)',
                      background:'rgba(245,158,11,0.08)',
                      color:'#fbbf24', fontWeight:700, fontSize:11,
                      display:'flex', alignItems:'center', gap:5,
                    }}>
                    <Ico d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" size={12} />
                    Resetear clave
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
