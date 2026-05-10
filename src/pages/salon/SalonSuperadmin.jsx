import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

// ── Fetch directo con anon key (salon_admin_* son GRANT TO anon) ──────────────
const SB_URL  = 'https://unpxoamfyushsbyyziyn.supabase.co'
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0'
const ADMIN_HASH   = 'e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91'
const ADMIN_SECRET = 'salonpro2026'

async function rpcAnon(fn, params) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_ANON,
      'Authorization': `Bearer ${SB_ANON}`,
    },
    body: JSON.stringify(params),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`)
  return json
}

function genClave() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p.charAt(0).toUpperCase() + p.slice(1) + '!'
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
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

function fmtFecha(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
}

const PLAN_PRECIO = { starter: 60000, pro: 100000, ultra: 140000 }
const PLAN_COLOR  = { starter: '#60a5fa', pro: '#a855f7', ultra: '#f59e0b' }
const VERTICALES  = ['salon', 'barberia', 'spa', 'estetica', 'unas']
const PLANES      = ['starter', 'pro', 'ultra']
const COLORES     = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899','#14b8a6']

function PlanBadge({ plan }) {
  const c = PLAN_COLOR[plan] || '#60a5fa'
  return (
    <span style={{
      padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700,
      color:c, background:`${c}18`, border:`1px solid ${c}40`,
      textTransform:'uppercase', letterSpacing:0.5, whiteSpace:'nowrap',
    }}>{plan || 'starter'}</span>
  )
}

// ── Modal clave generada ──────────────────────────────────────────────────────
function ModalClave({ data, onClose }) {
  const [copiado, setCopiado] = useState(false)
  function copiar(txt) {
    navigator.clipboard.writeText(txt).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }
  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">🔑 Credenciales generadas</p>
        <div style={{ textAlign:'center', padding:'8px 0 24px' }}>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:6 }}>Negocio: <b>{data.negocio}</b></div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:4 }}>Email de acceso</div>
            <div style={{ fontWeight:700, color:'var(--text)', fontSize:14 }}>{data.email}</div>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>Contraseña temporal</div>
            <div style={{
              padding:'16px 24px', borderRadius:14,
              background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)',
              fontFamily:'monospace', fontSize:22, fontWeight:800,
              color:'#4ade80', letterSpacing:3,
            }}>{data.clave}</div>
          </div>
          <button onClick={() => copiar(`Email: ${data.email}\nClave: ${data.clave}`)} style={{
            padding:'10px 20px', borderRadius:12, border:'1px solid rgba(34,197,94,0.3)',
            background:'rgba(34,197,94,0.1)', color:'#4ade80', fontWeight:700,
            cursor:'pointer', fontSize:13, marginBottom:12,
          }}>
            {copiado ? '✓ Copiado' : 'Copiar credenciales'}
          </button>
          <p style={{ fontSize:11, color:'var(--text-3)' }}>
            Guarda esta clave — no se puede recuperar después
          </p>
          <button onClick={onClose} style={{
            marginTop:12, padding:'10px 24px', borderRadius:12,
            background:'var(--accent)', border:'none', color:'#fff',
            fontWeight:700, fontSize:14, cursor:'pointer', display:'block', width:'100%',
          }}>Listo</button>
        </div>
      </div>
    </>
  )
}

// ── Modal editar negocio ──────────────────────────────────────────────────────
function ModalEditar({ negocio, onClose, onSaved, showToast }) {
  const [plan,   setPlan]   = useState(negocio.plan || 'starter')
  const [vence,  setVence]  = useState(negocio.fecha_vencimiento?.split('T')[0] || '')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    setSaving(true)
    try {
      await rpcAnon('salon_admin_set_plan', {
        p_token: ADMIN_HASH,
        p_tenant_id: negocio.id,
        p_plan: plan,
        p_fecha_vencimiento: vence || null,
      })
      showToast('Plan actualizado')
      onSaved()
      onClose()
    } catch (e) {
      showToast(e.message, '#f87171')
    }
    setSaving(false)
  }

  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">Editar — {negocio.nombre}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} style={{
              width:'100%', padding:'10px 12px', borderRadius:12,
              border:'1px solid var(--border)', background:'var(--bg)',
              color:'var(--text)', fontSize:13, outline:'none',
            }}>
              {PLANES.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)} — {fmtCOP(PLAN_PRECIO[p])}/mes</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>Vencimiento del plan</label>
            <input type="date" value={vence} onChange={e => setVence(e.target.value)} style={{
              width:'100%', padding:'10px 12px', borderRadius:12, boxSizing:'border-box',
              border:'1px solid var(--border)', background:'var(--bg)',
              color:'var(--text)', fontSize:14, outline:'none',
            }} />
          </div>
          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <button onClick={onClose} style={{
              flex:1, padding:'11px', borderRadius:12, cursor:'pointer',
              background:'transparent', border:'1px solid var(--border)', color:'var(--text-2)',
            }}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{
              flex:2, padding:'11px', borderRadius:12, border:'none', cursor:'pointer',
              background:'var(--accent)', color:'#fff', fontWeight:700,
              opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Modal reset clave ─────────────────────────────────────────────────────────
function ModalReset({ negocio, onClose, showToast }) {
  const [email,  setEmail]  = useState(negocio.admin_email || '')
  const [clave,  setClave]  = useState(genClave())
  const [saving, setSaving] = useState(false)
  const [ok,     setOk]     = useState(false)

  async function resetear() {
    if (!email.trim()) { showToast('Ingresa el email', '#f87171'); return }
    setSaving(true)
    try {
      await rpcAnon('salon_admin_reset_password', {
        p_token: ADMIN_HASH,
        p_email: email.trim(),
        p_nueva_clave: clave.trim(),
      })
      setOk(true)
    } catch (e) {
      showToast(e.message || 'Error reseteando clave', '#f87171')
    }
    setSaving(false)
  }

  if (ok) return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">🔑 Clave actualizada</p>
        <div style={{ textAlign:'center', padding:'8px 0 24px' }}>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:16 }}>{email}</div>
          <div style={{
            padding:'16px 24px', borderRadius:14, marginBottom:12,
            background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)',
            fontFamily:'monospace', fontSize:22, fontWeight:800, color:'#4ade80', letterSpacing:3,
          }}>{clave}</div>
          <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:16 }}>Copia antes de cerrar</p>
          <button onClick={onClose} style={{
            padding:'10px 24px', borderRadius:12, background:'var(--accent)', border:'none',
            color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', width:'100%',
          }}>Cerrar</button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">Resetear clave — {negocio.nombre}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>Email del usuario</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@negocio.com" style={{
                width:'100%', padding:'10px 12px', borderRadius:12, boxSizing:'border-box',
                border:'1px solid var(--border)', background:'var(--bg)',
                color:'var(--text)', fontSize:14, outline:'none',
              }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>Nueva clave</label>
            <div style={{ display:'flex', gap:8 }}>
              <input value={clave} onChange={e => setClave(e.target.value)} style={{
                flex:1, padding:'10px 12px', borderRadius:12,
                border:'1px solid var(--border)', background:'var(--bg)',
                color:'var(--text)', fontSize:14, outline:'none', fontFamily:'monospace',
              }} />
              <button onClick={() => setClave(genClave())} style={{
                padding:'10px 12px', borderRadius:12, border:'1px solid var(--border)',
                background:'var(--card)', color:'var(--text-2)', cursor:'pointer', fontSize:12, whiteSpace:'nowrap',
              }}>Nueva</button>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{
              flex:1, padding:'11px', borderRadius:12, cursor:'pointer',
              background:'transparent', border:'1px solid var(--border)', color:'var(--text-2)',
            }}>Cancelar</button>
            <button onClick={resetear} disabled={saving} style={{
              flex:2, padding:'11px', borderRadius:12, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#fff', fontWeight:700,
              opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Reseteando…' : '🔑 Resetear clave'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Formulario nuevo negocio ──────────────────────────────────────────────────
const FORM0 = {
  nombre:'', slug:'', ciudad:'', vertical:'salon', plan:'starter', color:'#f43f5e',
  representante:'', telefono:'', email_admin:'', clave_admin:'',
}

function FormNuevoNegocio({ onCreado, showToast, onCancel }) {
  const [form,    setForm]    = useState({ ...FORM0, clave_admin: genClave() })
  const [creando, setCreando] = useState(false)

  function slugify(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  async function crear() {
    if (!form.nombre.trim() || !form.slug.trim()) {
      showToast('Nombre y slug son requeridos', '#f87171'); return
    }
    setCreando(true)
    try {
      // 1. Crear tenant (usa auth.uid() de Hugo)
      const { data: tenantId, error: errTenant } = await supabase.rpc('crear_negocio', {
        p_nombre:        form.nombre.trim(),
        p_slug:          form.slug.trim(),
        p_ciudad:        form.ciudad || null,
        p_vertical:      form.vertical,
        p_plan:          form.plan,
        p_color:         form.color,
        p_representante: form.representante || null,
        p_telefono:      form.telefono || null,
      })
      if (errTenant) throw new Error(errTenant.message)

      // 2. Crear usuario admin si se dio email
      if (form.email_admin.trim()) {
        const clave = form.clave_admin.trim() || genClave()
        const resultado = await rpcAnon('salon_admin_crear_usuario', {
          p_token:     ADMIN_HASH,
          p_email:     form.email_admin.trim(),
          p_clave:     clave,
          p_tenant_id: tenantId,
          p_rol:       'admin',
          p_nombre:    form.representante || null,
        })
        if (!resultado?.ok) throw new Error(resultado?.error || 'Error creando usuario')

        onCreado({
          negocio: form.nombre.trim(),
          email:   form.email_admin.trim(),
          clave,
        })
      } else {
        showToast(`"${form.nombre}" creado ✓`)
        onCancel()
      }
    } catch (e) {
      showToast(e.message || 'Error', '#f87171')
    }
    setCreando(false)
  }

  const inp = (key, props = {}) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
    style: {
      width:'100%', padding:'10px 12px', borderRadius:12, boxSizing:'border-box',
      border:'1px solid var(--border)', background:'var(--bg)',
      color:'var(--text)', fontSize:13, outline:'none',
    },
    ...props,
  })

  return (
    <div style={{ padding:'0 16px 32px', display:'flex', flexDirection:'column', gap:14 }}>
      <p style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:4 }}>Nuevo negocio</p>

      {/* Nombre */}
      <div>
        <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Nombre del negocio *</label>
        <input {...inp('nombre')} placeholder="Glamour Studio"
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value, slug: slugify(e.target.value) }))} />
      </div>

      {/* Slug */}
      <div>
        <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Slug (URL) *</label>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
            fontSize:12, color:'var(--text-3)' }}>/</span>
          <input {...inp('slug')} style={{ ...inp('slug').style, paddingLeft:22 }}
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
            placeholder="glamour-studio" />
        </div>
      </div>

      {/* Ciudad + Vertical */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Ciudad</label>
          <input {...inp('ciudad')} placeholder="Bogotá" />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Tipo</label>
          <select value={form.vertical} onChange={e => setForm(f => ({ ...f, vertical:e.target.value }))} style={{
            width:'100%', padding:'10px 8px', borderRadius:12,
            border:'1px solid var(--border)', background:'var(--bg)',
            color:'var(--text)', fontSize:13, outline:'none',
          }}>
            {VERTICALES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* Plan */}
      <div>
        <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Plan</label>
        <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan:e.target.value }))} style={{
          width:'100%', padding:'10px 12px', borderRadius:12,
          border:'1px solid var(--border)', background:'var(--bg)',
          color:'var(--text)', fontSize:13, outline:'none',
        }}>
          {PLANES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)} — {fmtCOP(PLAN_PRECIO[p])}/mes</option>)}
        </select>
      </div>

      {/* Color */}
      <div>
        <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>Color de marca</label>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color:e.target.value }))}
            style={{ width:38, height:38, borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', padding:2, background:'var(--bg)' }} />
          {COLORES.map(c => (
            <div key={c} onClick={() => setForm(f => ({ ...f, color:c }))}
              style={{ width:26, height:26, borderRadius:7, background:c, cursor:'pointer', flexShrink:0,
                outline: form.color===c ? `3px solid ${c}` : 'none', outlineOffset:2 }} />
          ))}
        </div>
      </div>

      {/* Representante + Tel */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Representante</label>
          <input {...inp('representante')} placeholder="Nombre dueño" />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Teléfono</label>
          <input {...inp('telefono')} placeholder="+57 300..." />
        </div>
      </div>

      {/* Separador acceso */}
      <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginTop:4 }}>
        <p style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:12 }}>
          🔑 Acceso del dueño del negocio
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>
              Email de acceso <span style={{ fontWeight:400, color:'var(--text-3)' }}>(opcional)</span>
            </label>
            <input {...inp('email_admin')} type="email" placeholder="dueno@negocio.com" />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:5 }}>Contraseña temporal</label>
            <div style={{ display:'flex', gap:8 }}>
              <input {...inp('clave_admin')} style={{ ...inp('clave_admin').style, flex:1, fontFamily:'monospace' }} />
              <button onClick={() => setForm(f => ({ ...f, clave_admin: genClave() }))} style={{
                padding:'9px 12px', borderRadius:10, border:'1px solid var(--border)',
                background:'var(--card)', color:'var(--text-2)', cursor:'pointer', fontSize:11, whiteSpace:'nowrap',
              }}>Nueva</button>
            </div>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        <button onClick={onCancel} style={{
          flex:1, padding:'12px', borderRadius:13, cursor:'pointer',
          background:'transparent', border:'1px solid var(--border)', color:'var(--text-2)', fontWeight:600,
        }}>Cancelar</button>
        <button onClick={crear} disabled={creando} style={{
          flex:2, padding:'12px', borderRadius:13, border:'none', cursor:'pointer',
          background:'linear-gradient(135deg,#f43f5e,#e11d48)',
          color:'#fff', fontWeight:700, fontSize:14,
          opacity: creando ? 0.7 : 1,
        }}>{creando ? 'Creando…' : 'Crear negocio'}</button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SalonSuperadmin({ onGestionar }) {
  const { esSuperadmin } = useTenant()

  const [negocios,    setNegocios]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState(null)
  const [buscar,      setBuscar]      = useState('')
  const [tab,         setTab]         = useState('negocios') // 'negocios' | 'nuevo'
  const [editModal,   setEditModal]   = useState(null)
  const [resetModal,  setResetModal]  = useState(null)
  const [claveModal,  setClaveModal]  = useState(null)
  const [gestionando, setGestionando] = useState(null)
  const [toast,       setToast]       = useState(null)

  const showToast = (msg, color = '#22c55e') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await rpcAnon('salon_admin_get_tenants', { p_token: ADMIN_HASH })
      setNegocios(Array.isArray(data) ? data : (data || []))
    } catch (e) {
      setLoadError(e.message || 'Error al cargar negocios')
      setNegocios([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (esSuperadmin) cargar() }, [cargar, esSuperadmin])

  async function toggleActivo(n) {
    try {
      await rpcAnon('salon_admin_set_activo', {
        p_token: ADMIN_HASH, p_tenant_id: n.id, p_activo: !n.activo,
      })
      showToast(n.activo ? `"${n.nombre}" suspendido` : `"${n.nombre}" activado`)
      cargar()
    } catch (e) { showToast(e.message, '#f87171') }
  }

  async function gestionar(tenantId) {
    setGestionando(tenantId)
    await onGestionar(tenantId)
    setGestionando(null)
  }

  const activos     = negocios.filter(n => n.activo)
  const mrr         = activos.reduce((s, n) => s + (PLAN_PRECIO[n.plan] || 0), 0)
  const filtrados   = negocios.filter(n =>
    n.nombre?.toLowerCase().includes(buscar.toLowerCase()) ||
    n.slug?.toLowerCase().includes(buscar.toLowerCase()) ||
    n.ciudad?.toLowerCase().includes(buscar.toLowerCase())
  )

  if (!esSuperadmin) return (
    <div className="sp-empty">
      <span className="sp-empty-icon">🔒</span>
      <p className="sp-empty-title">Sin acceso</p>
      <p className="sp-empty-sub">Solo superadmin puede ver esta sección</p>
    </div>
  )

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:20, left:'50%', transform:'translateX(-50%)',
          background: toast.color || '#22c55e', color:'#fff',
          padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:700,
          zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
        }}>{toast.msg}</div>
      )}

      {/* Modales */}
      {editModal  && <ModalEditar  negocio={editModal}  onClose={() => setEditModal(null)}  onSaved={cargar} showToast={showToast} />}
      {resetModal && <ModalReset   negocio={resetModal} onClose={() => setResetModal(null)} showToast={showToast} />}
      {claveModal && <ModalClave   data={claveModal}    onClose={() => { setClaveModal(null); setTab('negocios'); cargar() }} />}

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1,
        background:'var(--border)', margin:'16px 16px 0', borderRadius:16, overflow:'hidden',
      }}>
        {[
          ['Total',      negocios.length,         '#60a5fa'],
          ['Activos',    activos.length,           '#4ade80'],
          ['Suspendidos',negocios.length-activos.length,'#f87171'],
          ['MRR',        fmtCOP(mrr),              '#c084fc'],
        ].map(([lbl, val, c]) => (
          <div key={lbl} style={{ padding:'14px 8px', background:'var(--card)', textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:900, color:c, fontFamily:'Outfit', lineHeight:1 }}>{val}</div>
            <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700,
              textTransform:'uppercase', letterSpacing:0.5, marginTop:4 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, padding:'12px 16px 0', alignItems:'center' }}>
        {[['negocios','Negocios'],['nuevo','+ Nuevo negocio']].map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer',
            fontWeight:700, fontSize:13,
            background: tab===key ? 'var(--accent)' : 'var(--card)',
            color:      tab===key ? '#fff'          : 'var(--text-2)',
            boxShadow:  tab===key ? '0 2px 10px rgba(244,63,94,0.3)' : 'none',
          }}>{lbl}</button>
        ))}
        <div style={{ flex:1 }} />
        <button onClick={cargar} style={{
          padding:'7px 12px', borderRadius:10, border:'1px solid var(--border)',
          background:'var(--card)', color:'var(--text-3)', cursor:'pointer', fontSize:12,
        }}>↻ Recargar</button>
      </div>

      {/* ── Tab: Nuevo negocio ─────────────────────────────────── */}
      {tab === 'nuevo' && (
        <div style={{ marginTop:16 }}>
          <FormNuevoNegocio
            showToast={showToast}
            onCancel={() => setTab('negocios')}
            onCreado={credenciales => setClaveModal(credenciales)}
          />
        </div>
      )}

      {/* ── Tab: Negocios ──────────────────────────────────────── */}
      {tab === 'negocios' && (
        <>
          {/* Buscador */}
          <div style={{ padding:'12px 16px 8px', position:'relative' }}>
            <div style={{ position:'absolute', left:27, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}>
              <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={14} />
            </div>
            <input value={buscar} onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar negocio, ciudad, slug…"
              style={{
                width:'100%', padding:'9px 12px 9px 36px', borderRadius:12, boxSizing:'border-box',
                border:'1px solid var(--border)', background:'var(--card)',
                color:'var(--text)', fontSize:13, outline:'none',
              }} />
          </div>

          {/* Error */}
          {loadError && (
            <div style={{
              margin:'0 16px 12px', padding:'12px 16px', borderRadius:12,
              background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)',
            }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#f87171', marginBottom:4 }}>Error al cargar</p>
              <p style={{ fontSize:12, color:'rgba(248,113,113,0.8)', fontFamily:'monospace' }}>{loadError}</p>
              <button onClick={cargar} style={{
                marginTop:8, padding:'6px 14px', borderRadius:8, cursor:'pointer',
                border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.1)',
                color:'#f87171', fontSize:12, fontWeight:700,
              }}>Reintentar</button>
            </div>
          )}

          {/* Lista */}
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
            <div style={{ padding:'0 16px', marginBottom:24 }}>
              {/* Cabecera */}
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 70px 80px 72px 80px 110px',
                padding:'6px 10px', marginBottom:4,
                fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:0.7,
              }}>
                <span>Negocio</span>
                <span style={{ textAlign:'center' }}>Ciudad</span>
                <span style={{ textAlign:'center' }}>Plan</span>
                <span style={{ textAlign:'center' }}>Estado</span>
                <span style={{ textAlign:'center' }}>Vence</span>
                <span style={{ textAlign:'right' }}>Acciones</span>
              </div>

              {filtrados.map(n => {
                const col = n.color_primario || '#f43f5e'
                return (
                  <div key={n.id} style={{
                    display:'grid', gridTemplateColumns:'1fr 70px 80px 72px 80px 110px',
                    alignItems:'center', marginBottom:8, padding:'11px 10px',
                    borderRadius:13, background:'var(--card)', border:'1px solid var(--border)',
                    borderLeft:`3px solid ${col}`, opacity: n.activo ? 1 : 0.6,
                  }}>
                    {/* Negocio */}
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {n.nombre}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-3)', marginTop:1 }}>/{n.slug}</div>
                    </div>

                    {/* Ciudad */}
                    <div style={{ textAlign:'center', fontSize:11, color:'var(--text-2)' }}>
                      {n.ciudad || '—'}
                    </div>

                    {/* Plan */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <PlanBadge plan={n.plan} />
                    </div>

                    {/* Estado */}
                    <div style={{ textAlign:'center' }}>
                      <span style={{
                        fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
                        background: n.activo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color:      n.activo ? '#4ade80'               : '#f87171',
                        border:     `1px solid ${n.activo ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      }}>
                        {n.activo ? '● Activo' : '● Suspendido'}
                      </span>
                    </div>

                    {/* Vence */}
                    <div style={{ textAlign:'center', fontSize:11, color:'var(--text-3)' }}>
                      {fmtFecha(n.fecha_vencimiento)}
                    </div>

                    {/* Acciones */}
                    <div style={{ display:'flex', justifyContent:'flex-end', gap:4 }}>
                      <button
                        onClick={() => gestionar(n.id)}
                        disabled={!!gestionando}
                        title="Entrar al negocio"
                        style={{
                          padding:'5px 8px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700,
                          border:`1px solid ${col}40`, background:`${col}15`, color:col,
                          opacity: gestionando===n.id ? 0.6 : 1,
                        }}>
                        {gestionando===n.id ? '…' : 'Ver'}
                      </button>
                      <button onClick={() => setEditModal(n)} title="Editar plan/vencimiento" style={{
                        padding:'5px 8px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700,
                        border:'1px solid rgba(96,165,250,0.35)', background:'rgba(96,165,250,0.1)', color:'#60a5fa',
                      }}>Edit</button>
                      <button onClick={() => toggleActivo(n)} title={n.activo ? 'Suspender' : 'Activar'} style={{
                        padding:'5px 8px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700,
                        border: n.activo ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)',
                        background: n.activo ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                        color: n.activo ? '#f87171' : '#4ade80',
                      }}>
                        {n.activo ? 'Susp.' : 'Activ.'}
                      </button>
                      <button onClick={() => setResetModal(n)} title="Resetear contraseña" style={{
                        padding:'5px 7px', borderRadius:7, cursor:'pointer', fontSize:13,
                        border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.1)', color:'#fbbf24',
                      }}>🔑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
