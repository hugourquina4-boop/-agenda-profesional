import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const SB_URL  = 'https://unpxoamfyushsbyyziyn.supabase.co'
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucHhvYW1meXVzaHNieXl6aXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUyOTQsImV4cCI6MjA5MjU5MTI5NH0.MvtKlr9QDDc2sgUz6u424eAFiPFEcZvW5xTKbV8STV0'
const ADMIN_HASH = 'e8f3b093450617294857b208734d3da24124fa0c99bcede207ea0584996f5f91'

async function rpcAnon(fn, params) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SB_ANON, 'Authorization': `Bearer ${SB_ANON}` },
    body: JSON.stringify(params),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`)
  return json
}

function genClave() {
  const ch = 'abcdefghjkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < 8; i++) p += ch[Math.floor(Math.random() * ch.length)]
  return p.charAt(0).toUpperCase() + p.slice(1) + '!'
}

const PLAN_PRECIO  = { basico: 80000, pro: 160000, premium: 200000, starter: 80000, ultra: 200000 }
const PLAN_COLOR   = { basico: '#f43f5e', pro: '#a855f7', premium: '#f59e0b', starter: '#f43f5e', ultra: '#f59e0b' }
const PLANES       = ['basico', 'pro', 'premium']
const PLAN_DETALLE = {
  basico:   { label: 'Básico',   max_usuarios: 2,    mensajeria: false },
  pro:      { label: 'Pro',      max_usuarios: 10,   mensajeria: false },
  premium:  { label: 'Premium',  max_usuarios: null, mensajeria: true  },
  starter:  { label: 'Básico',   max_usuarios: 2,    mensajeria: false },
  ultra:    { label: 'Premium',  max_usuarios: null, mensajeria: true  },
}
const VERTICALES  = ['salon', 'barberia', 'spa', 'estetica', 'unas']
const COLORES     = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899','#14b8a6']

function fmtCOP(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function fmtFecha(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Componentes UI ────────────────────────────────────────────────────────────
function PlanBadge({ plan }) {
  const c     = PLAN_COLOR[plan] || '#9ca3af'
  const label = PLAN_DETALLE[plan]?.label || plan || '—'
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: c, background: `${c}18`, border: `1px solid ${c}35`,
    }}>{label}</span>
  )
}

function Toast({ msg, color }) {
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: color || '#22c55e', color: '#fff',
      padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
      zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
    }}>{msg}</div>
  )
}

// ── Modal genérico de confirmación ────────────────────────────────────────────
function ModalConfirm({ titulo, mensaje, onConfirm, onClose, loading, colorBtn = '#ef4444' }) {
  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">{titulo}</p>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.6 }}>{mensaje}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 600,
          }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: colorBtn, color: '#fff', fontWeight: 700, opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Procesando…' : 'Confirmar'}</button>
        </div>
      </div>
    </>
  )
}

// ── Modal credenciales generadas ──────────────────────────────────────────────
function ModalClave({ data, onClose }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(`Email: ${data.email}\nClave: ${data.clave}`)
      .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }
  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">🔑 Credenciales generadas</p>
        <div style={{ textAlign: 'center', padding: '4px 0 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
            Negocio: <b>{data.negocio}</b>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Email de acceso</div>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{data.email}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>Contraseña temporal</div>
            <div style={{
              padding: '14px 24px', borderRadius: 14,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#4ade80', letterSpacing: 3,
            }}>{data.clave}</div>
          </div>
          <button onClick={copiar} style={{
            padding: '9px 20px', borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)',
            background: 'rgba(34,197,94,0.1)', color: '#4ade80', fontWeight: 700,
            cursor: 'pointer', fontSize: 13, marginBottom: 12,
          }}>{copiado ? '✓ Copiado' : 'Copiar credenciales'}</button>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>
            Guarda esta clave — no se puede recuperar después
          </p>
          <button onClick={onClose} style={{
            padding: '11px 24px', borderRadius: 12, background: 'var(--accent)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', width: '100%',
          }}>Listo</button>
        </div>
      </div>
    </>
  )
}

// ── Modal editar plan ─────────────────────────────────────────────────────────
function ModalEditar({ negocio, onClose, onSaved, showToast }) {
  const [plan,   setPlan]   = useState(() => PLANES.includes(negocio.plan) ? negocio.plan : 'basico')
  const [vence,  setVence]  = useState(negocio.fecha_vencimiento?.split('T')[0] || '')
  const [saving, setSaving] = useState(false)

  // Renovar +1 mes desde hoy o desde fecha actual
  function renovarMes() {
    const base = vence ? new Date(vence) : new Date()
    if (base < new Date()) base.setTime(new Date().getTime())
    base.setMonth(base.getMonth() + 1)
    setVence(base.toISOString().split('T')[0])
  }

  async function guardar() {
    setSaving(true)
    try {
      const res = await rpcAnon('salon_admin_set_plan', {
        p_token: ADMIN_HASH, p_tenant_id: negocio.id,
        p_plan: plan, p_fecha_vencimiento: vence || null,
      })
      if (!res?.ok) throw new Error(res?.error || 'Error')
      showToast('Plan actualizado')
      onSaved(); onClose()
    } catch (e) { showToast(e.message, '#f87171') }
    setSaving(false)
  }

  const inpStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
  }

  const det = PLAN_DETALLE[plan] || {}

  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">Suscripción — {negocio.nombre}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Datos negocio (lectura) */}
          <div style={{
            padding: '10px 12px', borderRadius: 12, background: 'var(--bg)',
            border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {negocio.admin_email && <div>📧 {negocio.admin_email}</div>}
            {negocio.telefono    && <div>📞 {negocio.telefono}</div>}
            {negocio.instagram   && <div>📷 {negocio.instagram}</div>}
            {negocio.pagina_web  && <div>🌐 {negocio.pagina_web}</div>}
            {negocio.ciudad      && <div>📍 {negocio.ciudad}</div>}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} style={inpStyle}>
              {PLANES.map(p => {
                const d = PLAN_DETALLE[p]
                const extras = d.mensajeria ? ' · +Mensajería' : ''
                const usuarios = d.max_usuarios ? ` · ${d.max_usuarios} usuarios` : ' · ilimitado'
                return (
                  <option key={p} value={p}>{d.label} — {fmtCOP(PLAN_PRECIO[p])}/mes{usuarios}{extras}</option>
                )
              })}
            </select>
            {det.label && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 8 }}>
                <span>{det.max_usuarios ? `Hasta ${det.max_usuarios} usuarios` : 'Usuarios ilimitados'}</span>
                {det.mensajeria && <span style={{ color: '#22c55e' }}>✓ Mensajería incluida</span>}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Fecha de vencimiento</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={vence} onChange={e => setVence(e.target.value)} style={{ ...inpStyle, flex: 1 }} />
              <button onClick={renovarMes} title="Sumar 1 mes" style={{
                padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
              }}>+1 mes</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)',
            }}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{
              flex: 2, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Guardando…' : 'Guardar'}</button>
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
      const res = await rpcAnon('salon_admin_reset_password', {
        p_token: ADMIN_HASH, p_email: email.trim(), p_nueva_clave: clave.trim(),
      })
      if (!res?.ok) throw new Error(res?.error || 'Error')
      setOk(true)
    } catch (e) { showToast(e.message, '#f87171') }
    setSaving(false)
  }

  const inpStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: 14, outline: 'none',
  }

  if (ok) return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">🔑 Clave actualizada</p>
        <div style={{ textAlign: 'center', padding: '4px 0 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>{email}</div>
          <div style={{
            padding: '14px 24px', borderRadius: 14, marginBottom: 12,
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#4ade80', letterSpacing: 3,
          }}>{clave}</div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>Copia antes de cerrar</p>
          <button onClick={onClose} style={{
            padding: '11px 24px', borderRadius: 12, background: 'var(--accent)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', width: '100%',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Email del admin</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@negocio.com" style={inpStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Nueva clave</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={clave} onChange={e => setClave(e.target.value)}
                style={{ ...inpStyle, flex: 1, fontFamily: 'monospace' }} />
              <button onClick={() => setClave(genClave())} style={{
                padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12,
              }}>↺</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)',
            }}>Cancelar</button>
            <button onClick={resetear} disabled={saving} style={{
              flex: 2, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 700,
              opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Reseteando…' : '🔑 Resetear clave'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Modal registrar pago ─────────────────────────────────────────────────────
function ModalPago({ negocio, onClose, onSaved, showToast }) {
  const precio = PLAN_PRECIO[negocio.plan] || 0
  const [monto,  setMonto]  = useState(String(precio))
  const [metodo, setMetodo] = useState('transferencia')
  const [meses,  setMeses]  = useState(1)
  const [ref_,   setRef]    = useState('')
  const [saving, setSaving] = useState(false)

  const vence    = negocio.fecha_vencimiento ? new Date(negocio.fecha_vencimiento) : new Date()
  const base     = vence < new Date() ? new Date() : vence
  const nuevaDate = new Date(base)
  nuevaDate.setMonth(nuevaDate.getMonth() + meses)
  const nuevaLabel = nuevaDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  const METODOS = ['transferencia', 'nequi', 'daviplata', 'efectivo', 'tarjeta', 'otro']

  async function guardar() {
    const n = parseFloat(monto)
    if (!n || n <= 0) { showToast('Ingresa un monto válido', '#f87171'); return }
    setSaving(true)
    try {
      const res = await rpcAnon('salon_admin_registrar_pago', {
        p_token: ADMIN_HASH, p_tenant_id: negocio.id,
        p_monto: n, p_metodo: metodo, p_meses: meses,
        p_referencia: ref_.trim() || null,
      })
      if (!res?.ok) throw new Error(res?.error || 'Error')
      showToast(`Pago registrado ✓ Vence: ${nuevaLabel}`)
      onSaved(); onClose()
    } catch (e) { showToast(e.message, '#f87171') }
    setSaving(false)
  }

  const inpStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
  }

  return (
    <>
      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet">
        <div className="sp-sheet-handle" />
        <p className="sp-sheet-title">💳 Registrar pago — {negocio.nombre}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Plan</div>
              <PlanBadge plan={negocio.plan} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Vence actualmente</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{fmtFecha(negocio.fecha_vencimiento)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Monto (COP)</label>
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={inpStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Meses a renovar</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {[1, 3, 6, 12].map(m => (
                  <button key={m} onClick={() => setMeses(m)} style={{
                    flex: 1, padding: '10px 4px', borderRadius: 9, cursor: 'pointer',
                    border: `2px solid ${meses === m ? 'var(--accent)' : 'var(--border)'}`,
                    background: meses === m ? 'var(--accent-dim)' : 'var(--card)',
                    color: meses === m ? 'var(--accent)' : 'var(--text-3)',
                    fontWeight: 700, fontSize: 12,
                  }}>{m}m</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Método de pago</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {METODOS.map(m => (
                <button key={m} onClick={() => setMetodo(m)} style={{
                  padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: metodo === m ? 'var(--accent)' : 'var(--card)',
                  color: metodo === m ? '#fff' : 'var(--text-2)',
                  border: `1px solid ${metodo === m ? 'var(--accent)' : 'var(--border)'}`,
                }}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Referencia / comprobante (opcional)</label>
            <input value={ref_} onChange={e => setRef(e.target.value)} placeholder="TX-12345" style={inpStyle} />
          </div>

          <div style={{ padding: '11px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Nueva fecha de vencimiento</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>{nuevaLabel}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)',
            }}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={{
              flex: 2, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: '#fff', fontWeight: 700, opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Registrando…' : '💳 Confirmar pago'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Formulario nuevo negocio ──────────────────────────────────────────────────
const FORM0 = {
  nombre: '', slug: '', ciudad: '', vertical: 'salon', plan: 'starter',
  color: '#f43f5e', representante: '', telefono: '', email_admin: '', clave_admin: '',
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
      const { data: tenantId, error: errT } = await supabase.rpc('crear_negocio', {
        p_nombre: form.nombre.trim(), p_slug: form.slug.trim(),
        p_ciudad: form.ciudad || null, p_vertical: form.vertical,
        p_plan: form.plan, p_color: form.color,
        p_representante: form.representante || null, p_telefono: form.telefono || null,
      })
      if (errT) throw new Error(errT.message)

      if (form.email_admin.trim()) {
        const clave = form.clave_admin.trim() || genClave()
        const res = await rpcAnon('salon_admin_crear_usuario', {
          p_token: ADMIN_HASH, p_email: form.email_admin.trim(),
          p_clave: clave, p_tenant_id: tenantId, p_rol: 'admin',
          p_nombre: form.representante || null,
        })
        if (!res?.ok) throw new Error(res?.error || 'Error creando usuario')
        onCreado({ negocio: form.nombre.trim(), email: form.email_admin.trim(), clave })
      } else {
        showToast(`"${form.nombre}" creado ✓`)
        onCancel()
      }
    } catch (e) {
      showToast(e.message || 'Error', '#f87171')
    }
    setCreando(false)
  }

  const inp = (key, extra = {}) => ({
    value: form[key],
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
    style: {
      width: '100%', padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
      border: '1px solid var(--border)', background: 'var(--bg)',
      color: 'var(--text)', fontSize: 13, outline: 'none', ...extra,
    },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Nombre del negocio *</label>
          <input {...inp('nombre')} placeholder="Glamour Studio"
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value, slug: slugify(e.target.value) }))} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Slug (URL) *</label>
          <input {...inp('slug')} value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
            placeholder="glamour-studio" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Ciudad</label>
          <input {...inp('ciudad')} placeholder="Bogotá" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Tipo</label>
          <select value={form.vertical} onChange={e => setForm(f => ({ ...f, vertical: e.target.value }))}
            style={{ width: '100%', padding: '10px 8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}>
            {VERTICALES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Plan</label>
          <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
            style={{ width: '100%', padding: '10px 8px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none' }}>
            {PLANES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Representante</label>
          <input {...inp('representante')} placeholder="Nombre del dueño" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Teléfono</label>
          <input {...inp('telefono')} placeholder="+57 300..." />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>Color de marca</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'var(--bg)' }} />
          {COLORES.map(c => (
            <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
              style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer', flexShrink: 0, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>🔑 Acceso del dueño</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>
              Email <span style={{ fontWeight: 400 }}>(opcional)</span>
            </label>
            <input {...inp('email_admin')} type="email" placeholder="dueno@negocio.com" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>Contraseña temporal</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input {...inp('clave_admin', { fontFamily: 'monospace', flex: 1 })} />
              <button onClick={() => setForm(f => ({ ...f, clave_admin: genClave() }))} style={{
                padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12,
              }}>↺</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 600,
        }}>Cancelar</button>
        <button onClick={crear} disabled={creando} style={{
          flex: 2, padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#fff', fontWeight: 700,
          fontSize: 14, opacity: creando ? 0.7 : 1,
        }}>{creando ? 'Creando…' : 'Crear negocio'}</button>
      </div>
    </div>
  )
}

// ── Tab Mensajes — broadcast a negocios ───────────────────────────────────────
function MensajesTab({ negocios, cardStyle }) {
  const [mensaje,       setMensaje]       = useState('')
  const [destinatarios, setDestinatarios] = useState('activos')
  const [copiado,       setCopiado]       = useState(false)

  const activos = negocios.filter(n => n.activo)
  const lista   = destinatarios === 'todos'   ? negocios
    : destinatarios === 'activos' ? activos
    : activos.filter(n => n.plan === destinatarios)

  const grupos = [
    ['todos',   `Todos (${negocios.length})`],
    ['activos', `Activos (${activos.length})`],
    ...PLANES.map(p => [`${p}`, `${PLAN_DETALLE[p]?.label} (${activos.filter(n=>n.plan===p).length})`]),
  ]

  function copiarNumeros() {
    const nums = lista.map(n => n.whatsapp || n.telefono).filter(Boolean).join('\n')
    if (!nums) return
    navigator.clipboard.writeText(nums).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2200)
    })
  }

  function abrirWA(tel) {
    const num   = tel.replace(/\D/g, '')
    const texto = encodeURIComponent(mensaje.trim() || 'Hola, te escribimos desde Salón Pro.')
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank')
  }

  return (
    <div style={{ margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Textarea mensaje */}
      <div style={cardStyle}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Mensaje</p>
        <textarea
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          placeholder="Hola! Te recordamos que tu suscripción Salón Pro vence pronto. Para renovar contáctanos…"
          rows={5}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
            border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none',
            fontFamily: 'inherit', lineHeight: 1.5,
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, textAlign: 'right' }}>
          {mensaje.length} / 1000 caracteres
        </div>
      </div>

      {/* Selector destinatarios */}
      <div style={cardStyle}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Destinatarios</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {grupos.map(([k, l]) => (
            <button key={k} onClick={() => setDestinatarios(k)} style={{
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: destinatarios === k ? 'var(--accent)' : 'var(--card)',
              color: destinatarios === k ? '#fff' : 'var(--text-2)',
              border: `1px solid ${destinatarios === k ? 'var(--accent)' : 'var(--border)'}`,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Lista de destinatarios */}
      {lista.length > 0 ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{lista.length} negocios</p>
            <button onClick={copiarNumeros} style={{
              padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: copiado ? 'rgba(34,197,94,0.1)' : 'var(--bg)',
              color: copiado ? '#4ade80' : 'var(--text-3)',
              border: `1px solid ${copiado ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            }}>{copiado ? '✓ Copiados' : 'Copiar números'}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lista.map(n => {
              const tel = n.whatsapp || n.telefono
              const col = n.color_primario || '#f43f5e'
              return (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  opacity: n.activo ? 1 : 0.5,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: `${col}22`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13, fontWeight: 800, color: col,
                  }}>{(n.nombre || '?')[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{n.nombre}</div>
                    {tel && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{tel}</div>}
                  </div>
                  <PlanBadge plan={n.plan} />
                  {tel && (
                    <button onClick={() => abrirWA(tel)} style={{
                      padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(34,197,94,0.3)',
                      background: 'rgba(34,197,94,0.08)', color: '#4ade80',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>WA</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13 }}>Sin destinatarios en este grupo</div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SalonSuperadmin({ onGestionar }) {
  const { user } = useTenant()

  const [negocios,    setNegocios]    = useState([])
  const [usuarios,    setUsuarios]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState(null)
  const [buscar,      setBuscar]      = useState('')
  const [filtro,      setFiltro]      = useState('todos')  // todos | activos | suspendidos
  const [tab,         setTab]         = useState('negocios')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editModal,   setEditModal]   = useState(null)
  const [resetModal,  setResetModal]  = useState(null)
  const [elimModal,   setElimModal]   = useState(null)
  const [claveModal,  setClaveModal]  = useState(null)
  const [pagoModal,   setPagoModal]   = useState(null)
  const [gestionando, setGestionando] = useState(null)
  const [toast,       setToast]       = useState(null)

  // Mi acceso maestro
  const [masterClave,  setMasterClave]  = useState('')
  const [masterSaving, setMasterSaving] = useState(false)
  const [masterOk,     setMasterOk]     = useState(false)

  const showToast = (msg, color = '#22c55e') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await rpcAnon('salon_admin_get_tenants', { p_token: ADMIN_HASH })
      if (!Array.isArray(data)) {
        if (data?.error) throw new Error(data.error)
        setNegocios([])
      } else {
        setNegocios(data)
      }
    } catch (e) {
      setLoadError(e.message || 'Error al cargar')
      setNegocios([])
    }
    setLoading(false)
  }, [])

  const cargarUsuarios = useCallback(async () => {
    try {
      const data = await rpcAnon('salon_admin_get_users', { p_token: ADMIN_HASH })
      setUsuarios(Array.isArray(data) ? data : [])
    } catch { setUsuarios([]) }
  }, [])

  // Siempre cargar al montar — no dependemos de esSuperadmin (sidebar ya filtra)
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (tab === 'usuarios') cargarUsuarios() }, [tab, cargarUsuarios])

  async function actualizarClaveMaestra() {
    if (!masterClave.trim() || masterClave.trim().length < 6) {
      showToast('Mínimo 6 caracteres', '#f87171'); return
    }
    setMasterSaving(true)
    try {
      const res = await rpcAnon('salon_admin_reset_password', {
        p_token: ADMIN_HASH, p_email: user?.email, p_nueva_clave: masterClave.trim(),
      })
      if (!res?.ok) throw new Error(res?.error || 'Error')
      setMasterOk(true); setMasterClave('')
      setTimeout(() => setMasterOk(false), 3000)
    } catch (e) { showToast(e.message, '#f87171') }
    setMasterSaving(false)
  }

  async function toggleActivo(n) {
    try {
      await rpcAnon('salon_admin_set_activo', {
        p_token: ADMIN_HASH, p_tenant_id: n.id, p_activo: !n.activo,
      })
      showToast(n.activo ? `"${n.nombre}" suspendido` : `"${n.nombre}" activado`)
      cargar()
    } catch (e) { showToast(e.message, '#f87171') }
  }

  async function eliminarTenant() {
    if (!elimModal) return
    try {
      const res = await rpcAnon('salon_admin_eliminar_tenant', {
        p_token: ADMIN_HASH, p_tenant_id: elimModal.id,
      })
      if (!res?.ok) throw new Error(res?.error || 'Error')
      showToast(`"${elimModal.nombre}" eliminado`)
      setElimModal(null); cargar()
    } catch (e) { showToast(e.message, '#f87171') }
  }

  async function gestionar(tenantId) {
    setGestionando(tenantId)
    await onGestionar(tenantId)
    setGestionando(null)
  }

  // ── Estadísticas derivadas ──────────────────────────────────────────────────
  const activos     = negocios.filter(n => n.activo)
  const suspendidos = negocios.filter(n => !n.activo)
  const citasHoy    = negocios.reduce((s, n) => s + (n.citas_hoy || 0), 0)
  const mrr         = activos.reduce((s, n) => s + (PLAN_PRECIO[n.plan] || 0), 0)

  const distribPlan = PLANES.reduce((acc, p) => {
    const cnt = activos.filter(n => n.plan === p).length
    if (cnt > 0) acc.push({ plan: p, count: cnt })
    return acc
  }, [])

  const filtrados = negocios
    .filter(n => filtro === 'activos' ? n.activo : filtro === 'suspendidos' ? !n.activo : true)
    .filter(n => !buscar || n.nombre?.toLowerCase().includes(buscar.toLowerCase())
      || n.slug?.toLowerCase().includes(buscar.toLowerCase())
      || n.ciudad?.toLowerCase().includes(buscar.toLowerCase()))

  // ── Estilos reutilizables ────────────────────────────────────────────────────
  const cardStyle = {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '14px 16px',
  }

  const btnOutline = (color) => ({
    padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    border: `1px solid ${color}40`, background: `${color}10`, color,
  })

  return (
    <>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      {/* Modales */}
      {editModal && (
        <ModalEditar negocio={editModal} onClose={() => setEditModal(null)} onSaved={cargar} showToast={showToast} />
      )}
      {resetModal && (
        <ModalReset negocio={resetModal} onClose={() => setResetModal(null)} showToast={showToast} />
      )}
      {elimModal && (
        <ModalConfirm
          titulo={`Eliminar — ${elimModal.nombre}`}
          mensaje={`Esta acción elimina el acceso al negocio y oculta sus datos del panel. Los registros internos no se borran. ¿Continuar?`}
          onConfirm={eliminarTenant}
          onClose={() => setElimModal(null)}
          loading={false}
          colorBtn="#ef4444"
        />
      )}
      {claveModal && (
        <ModalClave data={claveModal} onClose={() => { setClaveModal(null); setMostrarForm(false); cargar() }} />
      )}
      {pagoModal && (
        <ModalPago negocio={pagoModal} onClose={() => setPagoModal(null)} onSaved={cargar} showToast={showToast} />
      )}

      <div style={{ padding: '0 0 40px' }}>

        {/* ── Mi acceso maestro ────────────────────────────────── */}
        <div style={{ margin: '16px 16px 0', ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🔑</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Mi acceso maestro</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{user?.email || 'hugourquina@gmail.com'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '0 0 auto' }}>
            <input
              type="password"
              value={masterClave}
              onChange={e => setMasterClave(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && actualizarClaveMaestra()}
              placeholder="Nueva contraseña (≥6 chars)"
              style={{
                padding: '8px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: 13, outline: 'none', width: 200,
              }}
            />
            <button onClick={actualizarClaveMaestra} disabled={masterSaving} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: masterOk ? '#22c55e' : 'linear-gradient(135deg,#f43f5e,#e11d48)',
              color: '#fff', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
              opacity: masterSaving ? 0.7 : 1,
            }}>
              {masterOk ? '✓ Actualizada' : masterSaving ? 'Guardando…' : 'Actualizar clave'}
            </button>
          </div>
        </div>

        {/* ── KPI strip ────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1,
          background: 'var(--border)', margin: '12px 16px 0', borderRadius: 14, overflow: 'hidden',
        }}>
          {[
            ['TOTAL NEGOCIOS',  negocios.length,    '#60a5fa', 'registrados'],
            ['ACTIVOS',         activos.length,      '#4ade80', 'con acceso vigente'],
            ['SUSPENDIDOS',     suspendidos.length,  '#f87171', 'sin acceso'],
            ['CITAS HOY',       citasHoy,            '#c084fc', 'en todos los negocios'],
            ['MRR ESTIMADO',    fmtCOP(mrr),         '#22c55e', 'suscripciones activas'],
          ].map(([lbl, val, c, sub]) => (
            <div key={lbl} style={{ padding: '14px 10px', background: 'var(--card)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: c, fontFamily: 'Outfit', lineHeight: 1.1 }}>{val}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{lbl}</div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2, fontWeight: 400 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Distribución por plan ─────────────────────────────── */}
        {distribPlan.length > 0 && (
          <div style={{ margin: '12px 16px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Distribución por plan — negocios activos
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {distribPlan.map(({ plan, count }) => {
                const c = PLAN_COLOR[plan] || '#9ca3af'
                return (
                  <div key={plan} style={{
                    flex: 1, ...cardStyle, textAlign: 'center', padding: '12px 10px',
                    borderTop: `3px solid ${c}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: c, textTransform: 'uppercase', letterSpacing: 0.5 }}>{plan}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', fontFamily: 'Outfit', lineHeight: 1.2, margin: '4px 0' }}>{count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
                      {PLAN_PRECIO[plan] ? fmtCOP(PLAN_PRECIO[plan]) + '/mes' : 'Gratis'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Tab bar (scrollable en móvil) ─────────────────────── */}
        <div style={{
          display: 'flex', gap: 0, margin: '16px 16px 0',
          borderBottom: '2px solid var(--border)',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {[
            ['negocios',  'Negocios'],
            ['accesos',   '🔑 Accesos'],
            ['pagos',     '💳 Pagos'],
            ['mensajes',  '📢 Mensajes'],
            ['usuarios',  'Usuarios'],
          ].map(([key, lbl]) => (
            <button key={key} onClick={() => { setTab(key); setMostrarForm(false) }} style={{
              padding: '10px 16px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 13, fontWeight: 700,
              color: tab === key ? 'var(--accent)' : 'var(--text-3)',
              borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -2, whiteSpace: 'nowrap', flexShrink: 0,
            }}>{lbl}</button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════
            TAB: NEGOCIOS
        ════════════════════════════════════════════════════════ */}
        {tab === 'negocios' && (
          <>
            {/* Barra de filtros */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 13 }}>🔍</span>
                <input value={buscar} onChange={e => setBuscar(e.target.value)}
                  placeholder="Buscar negocio, ciudad, slug..."
                  style={{
                    width: '100%', padding: '8px 12px 8px 30px', borderRadius: 10, boxSizing: 'border-box',
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', fontSize: 13, outline: 'none',
                  }} />
              </div>
              {[['todos', 'Todos'], ['activos', 'Activos'], ['suspendidos', 'Suspendidos']].map(([k, l]) => (
                <button key={k} onClick={() => setFiltro(k)} style={{
                  padding: '7px 14px', borderRadius: 9, border: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: filtro === k ? 'var(--accent)' : 'var(--card)',
                  color: filtro === k ? '#fff' : 'var(--text-2)',
                  boxShadow: filtro === k ? '0 2px 8px rgba(244,63,94,0.25)' : 'none',
                }}>{l}</button>
              ))}
              <button onClick={() => setMostrarForm(f => !f)} style={{
                padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: mostrarForm ? 'var(--card)' : 'linear-gradient(135deg,#f43f5e,#e11d48)',
                color: mostrarForm ? 'var(--text-2)' : '#fff',
                border: mostrarForm ? '1px solid var(--border)' : 'none',
              }}>{mostrarForm ? '✕ Cancelar' : '+ Nuevo Negocio'}</button>
              <button onClick={cargar} style={{
                padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13,
              }}>↻</button>
            </div>

            {/* Formulario nuevo negocio */}
            {mostrarForm && (
              <div style={{ margin: '12px 16px 0', ...cardStyle }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Nuevo negocio</p>
                <FormNuevoNegocio
                  showToast={showToast}
                  onCancel={() => setMostrarForm(false)}
                  onCreado={creds => setClaveModal(creds)}
                />
              </div>
            )}

            {/* Error */}
            {loadError && (
              <div style={{
                margin: '10px 16px 0', padding: '12px 16px', borderRadius: 12,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>Error al cargar negocios</p>
                <p style={{ fontSize: 11, color: 'rgba(248,113,113,0.8)', fontFamily: 'monospace', marginBottom: 8 }}>{loadError}</p>
                <button onClick={cargar} style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                  color: '#f87171', fontSize: 12, fontWeight: 700,
                }}>Reintentar</button>
              </div>
            )}

            {/* Tabla */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
                <div className="sp-spinner" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="sp-empty" style={{ paddingTop: 40 }}>
                <span className="sp-empty-icon">🏪</span>
                <p className="sp-empty-title">{buscar ? 'Sin resultados' : 'Sin negocios'}</p>
                <p className="sp-empty-sub">{buscar ? 'Prueba otra búsqueda' : 'Crea el primer negocio con + Nuevo Negocio'}</p>
              </div>
            ) : (
              <div style={{ margin: '10px 16px 0', overflowX: 'auto' }}>
                {/* Header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 80px 90px 80px 90px 180px',
                  padding: '6px 12px', marginBottom: 2,
                  fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.7,
                }}>
                  <span>Negocio</span>
                  <span style={{ textAlign: 'center' }}>Ciudad</span>
                  <span style={{ textAlign: 'center' }}>Plan</span>
                  <span style={{ textAlign: 'center' }}>Estado</span>
                  <span style={{ textAlign: 'center' }}>Vence</span>
                  <span style={{ textAlign: 'right' }}>Acciones</span>
                </div>

                {filtrados.map(n => {
                  const col = n.color_primario || '#f43f5e'
                  return (
                    <div key={n.id} style={{
                      display: 'grid', gridTemplateColumns: '1.4fr 80px 90px 80px 90px 180px',
                      alignItems: 'center', marginBottom: 6, padding: '11px 12px',
                      borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)',
                      borderLeft: `3px solid ${col}`, opacity: n.activo ? 1 : 0.6,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          textTransform: 'uppercase', letterSpacing: 0.3,
                        }}>{n.nombre}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>/{n.slug}</div>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-2)' }}>
                        {n.ciudad || '—'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <PlanBadge plan={n.plan} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: n.activo ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: n.activo ? '#4ade80' : '#f87171',
                          border: `1px solid ${n.activo ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}>● {n.activo ? 'Activo' : 'Suspendido'}</span>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>
                        {fmtFecha(n.fecha_vencimiento)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => gestionar(n.id)} disabled={!!gestionando}
                          style={{ ...btnOutline(col), opacity: gestionando === n.id ? 0.6 : 1 }}>
                          {gestionando === n.id ? '…' : 'Ver'}
                        </button>
                        <button onClick={() => setEditModal(n)} style={btnOutline('#60a5fa')}>Editar</button>
                        <button onClick={() => toggleActivo(n)} style={btnOutline(n.activo ? '#f87171' : '#4ade80')}>
                          {n.activo ? 'Suspender' : 'Activar'}
                        </button>
                        <button onClick={() => setElimModal(n)} style={btnOutline('#ef4444')}>Eliminar</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: ACCESOS
        ════════════════════════════════════════════════════════ */}
        {tab === 'accesos' && (
          <div style={{ margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
              Resetea la contraseña del administrador de cada negocio. La clave se muestra en pantalla para entregársela directamente.
            </p>
            {negocios.map(n => (
              <div key={n.id} style={{
                ...cardStyle,
                display: 'flex', alignItems: 'center', gap: 12, opacity: n.activo ? 1 : 0.55,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${n.color_primario || '#f43f5e'}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: n.color_primario || '#f43f5e',
                }}>{(n.nombre || '?')[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{n.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                    {n.admin_email || 'Sin email de admin'}
                  </div>
                </div>
                <PlanBadge plan={n.plan} />
                <button onClick={() => setResetModal(n)} style={{
                  ...btnOutline('#f59e0b'),
                  whiteSpace: 'nowrap',
                }}>🔑 Resetear clave</button>
              </div>
            ))}
            {negocios.length === 0 && !loading && (
              <div className="sp-empty">
                <span className="sp-empty-icon">🔑</span>
                <p className="sp-empty-title">Sin negocios</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: PAGOS
        ════════════════════════════════════════════════════════ */}
        {tab === 'pagos' && (
          <div style={{ margin: '12px 16px 0' }}>
            {/* Resumen rápido */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { lbl: 'MRR',          val: fmtCOP(mrr),                                     col: '#4ade80' },
                { lbl: 'Vence ≤ 7d',   val: activos.filter(n => { const v = n.fecha_vencimiento ? new Date(n.fecha_vencimiento) : null; return v && Math.ceil((v - new Date()) / 86400000) <= 7 }).length, col: '#f87171' },
                { lbl: 'Vence ≤ 30d',  val: activos.filter(n => { const v = n.fecha_vencimiento ? new Date(n.fecha_vencimiento) : null; const d = v ? Math.ceil((v - new Date()) / 86400000) : null; return d !== null && d > 7 && d <= 30 }).length, col: '#f59e0b' },
              ].map(({ lbl, val, col }) => (
                <div key={lbl} style={{ ...cardStyle, textAlign: 'center', padding: '12px 8px', borderTop: `3px solid ${col}` }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: col, fontFamily: 'Outfit' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{lbl}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {negocios.map(n => {
                const precio = PLAN_PRECIO[n.plan] || 0
                const vence  = n.fecha_vencimiento ? new Date(n.fecha_vencimiento) : null
                const dias   = vence ? Math.ceil((vence - new Date()) / 86400000) : null
                const diasColor = !dias ? '#9ca3af' : dias < 0 ? '#ef4444' : dias < 7 ? '#f97316' : dias < 30 ? '#f59e0b' : '#22c55e'
                const urgente = dias !== null && dias <= 7
                return (
                  <div key={n.id} style={{
                    ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    borderLeft: `3px solid ${urgente ? '#f87171' : (n.color_primario || 'var(--border)')}`,
                    opacity: n.activo ? 1 : 0.55,
                  }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{n.nombre}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <PlanBadge plan={n.plan} />
                        {precio > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtCOP(precio)}/mes</span>
                        )}
                        {!n.activo && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>SUSPENDIDO</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 100 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Vence</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{fmtFecha(n.fecha_vencimiento)}</div>
                      {dias !== null && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: diasColor, marginTop: 2 }}>
                          {dias > 0 ? `${dias}d` : dias === 0 ? 'Hoy' : 'VENCIDO'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setPagoModal(n)} style={{
                        ...btnOutline('#22c55e'),
                        background: urgente ? 'rgba(239,68,68,0.1)' : undefined,
                        borderColor: urgente ? 'rgba(239,68,68,0.4)' : undefined,
                        color: urgente ? '#f87171' : '#22c55e',
                        whiteSpace: 'nowrap',
                      }}>
                        {urgente ? '⚠ Pago' : '💳 Pago'}
                      </button>
                      <button onClick={() => setEditModal(n)} style={{ ...btnOutline('#60a5fa') }} title="Editar plan/fecha">
                        ✏️
                      </button>
                    </div>
                  </div>
                )
              })}
              {negocios.length === 0 && !loading && (
                <div className="sp-empty">
                  <span className="sp-empty-icon">💳</span>
                  <p className="sp-empty-title">Sin negocios</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: MENSAJES
        ════════════════════════════════════════════════════════ */}
        {tab === 'mensajes' && (
          <MensajesTab negocios={negocios} cardStyle={cardStyle} />
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: USUARIOS
        ════════════════════════════════════════════════════════ */}
        {tab === 'usuarios' && (
          <div style={{ margin: '12px 16px 0' }}>
            {usuarios.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <div className="sp-spinner" />
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                  {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} en la plataforma
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {usuarios.map(u => (
                    <div key={u.user_id} style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: 'var(--accent)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff',
                      }}>{(u.email || '?')[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{u.email}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                          Creado: {fmtFecha(u.created_at)}
                          {u.last_sign_in && ` · Último acceso: ${fmtFecha(u.last_sign_in)}`}
                        </div>
                        {u.tenants && u.tenants.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {u.tenants.map(t => (
                              <span key={t.tenant_id} style={{
                                padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                                background: 'var(--accent-dim)', color: 'var(--accent)',
                                border: '1px solid var(--accent-glow)',
                              }}>{t.nombre} · {t.rol}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setResetModal({ id: null, nombre: u.email, admin_email: u.email })}
                        style={{ ...btnOutline('#f59e0b'), flexShrink: 0 }}>🔑</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </>
  )
}
