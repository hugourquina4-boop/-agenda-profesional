import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'
import ImageUploader from '../../components/ImageUploader'

function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, letterSpacing:1.2,
        textTransform:'uppercase', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:1, background:'var(--border)' }} />
        {titulo}
        <div style={{ flex:1, height:1, background:'var(--border)' }} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700,
        letterSpacing:0.6, display:'block', marginBottom:7, textTransform:'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function SalonConfig() {
  const { tenant, recargar } = useTenant()
  const [form,   setForm]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState(null)

  useEffect(() => {
    if (!tenant) return
    setForm({
      nombre:         tenant.nombre         || '',
      whatsapp:       tenant.whatsapp       || '',
      telefono:       tenant.telefono       || '',
      email:          tenant.email          || '',
      ciudad:         tenant.ciudad         || '',
      direccion:      tenant.direccion      || '',
      logo_url:       tenant.logo_url       || '',
      color_primario: tenant.color_primario || '#f43f5e',
      descripcion:    tenant.descripcion    || '',
      promo:          tenant.config_vertical?.promo         || '',
      horario_texto:  tenant.config_vertical?.horario_texto || '',
    })
  }, [tenant])

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  function showToast(msg, ok = true) {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), 2800)
  }

  async function guardar() {
    if (!form.nombre.trim()) { showToast('El nombre es requerido', false); return }
    setSaving(true)
    const { error } = await supabase.from('tenants').update({
      nombre:          form.nombre.trim(),
      whatsapp:        form.whatsapp.trim()   || null,
      telefono:        form.telefono.trim()   || null,
      email:           form.email.trim()      || null,
      ciudad:          form.ciudad.trim()     || null,
      direccion:       form.direccion.trim()  || null,
      logo_url:        form.logo_url.trim()   || null,
      color_primario:  form.color_primario,
      descripcion:     form.descripcion.trim() || null,
      config_vertical: {
        ...(tenant.config_vertical || {}),
        promo:         form.promo.trim()         || null,
        horario_texto: form.horario_texto.trim() || null,
      },
    }).eq('id', tenant.id)
    setSaving(false)
    if (error) { showToast(error.message, false); return }
    showToast('Configuración guardada')
    recargar()
  }

  const col = form?.color_primario || '#f43f5e'

  if (!form) return (
    <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
      <div className="sp-spinner" />
    </div>
  )

  return (
    <div style={{ padding:'0 16px 60px', maxWidth:580 }}>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {/* ── Identidad ── */}
      <Seccion titulo="Identidad">
        <Campo label="Nombre del salón *">
          <input className="sp-input" value={form.nombre}
            onChange={e => set('nombre', e.target.value)} />
        </Campo>

        <Campo label="Descripción (visible en el portal)">
          <input className="sp-input" placeholder="Ej: Especialistas en colorimetría y cuidado capilar"
            value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
        </Campo>

        <Campo label="Color de marca">
          <input type="color" value={form.color_primario}
            onChange={e => set('color_primario', e.target.value)}
            style={{ width:56, height:44, borderRadius:12, border:'1px solid var(--border)',
              padding:4, background:'var(--card)', cursor:'pointer', display:'block' }} />
        </Campo>

        <ImageUploader
          label="Logo del salón"
          value={form.logo_url}
          onChange={url => set('logo_url', url)}
          shape="square"
          size={80}
          folder="logos"
          accent={col}
        />
      </Seccion>

      {/* ── Contacto ── */}
      <Seccion titulo="Contacto">
        <Campo label="WhatsApp del salón (los clientes verán este número)">
          <div style={{ display:'flex', alignItems:'center', gap:0 }}>
            <span style={{ padding:'0 12px', height:46, display:'flex', alignItems:'center',
              background:'var(--card)', border:'1px solid var(--border)', borderRight:'none',
              borderRadius:'12px 0 0 12px', fontSize:13, color:'var(--text-3)', flexShrink:0 }}>
              +57
            </span>
            <input className="sp-input" type="tel" placeholder="3001234567"
              value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)}
              style={{ borderRadius:'0 12px 12px 0' }} />
          </div>
        </Campo>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Campo label="Teléfono fijo">
            <input className="sp-input" type="tel" placeholder="6024445566"
              value={form.telefono} onChange={e => set('telefono', e.target.value)} />
          </Campo>
          <Campo label="Email">
            <input className="sp-input" type="email" placeholder="salon@correo.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
          </Campo>
        </div>

        <Campo label="Ciudad">
          <input className="sp-input" placeholder="Ej: Cali"
            value={form.ciudad} onChange={e => set('ciudad', e.target.value)} />
        </Campo>
        <Campo label="Dirección">
          <input className="sp-input" placeholder="Ej: Cra 5 #23-10, El Peñón"
            value={form.direccion} onChange={e => set('direccion', e.target.value)} />
        </Campo>
      </Seccion>

      {/* ── Portal de reservas ── */}
      <Seccion titulo="Portal de reservas">
        <Campo label="Banner de promoción (aparece en la parte superior del portal)">
          <textarea className="sp-input" rows={2}
            placeholder="Ej: ✨ 20% de dcto en mechas este mes · Agenda tu cita ahora"
            value={form.promo} onChange={e => set('promo', e.target.value)}
            style={{ resize:'none' }} />
        </Campo>

        <Campo label="Horario de atención (aparece en el pie del portal)">
          <input className="sp-input"
            placeholder="Ej: Lun–Sáb: 9am–7pm · Dom: Solo con cita previa"
            value={form.horario_texto} onChange={e => set('horario_texto', e.target.value)} />
        </Campo>

        {/* Link del portal */}
        <div style={{ padding:'14px 16px', borderRadius:14, background:`${col}0e`,
          border:`1px solid ${col}28` }}>
          <div style={{ fontSize:11, color:col, fontWeight:700, marginBottom:6 }}>
            TU LINK DE RESERVAS
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:13, color:'var(--text-2)', flex:1, minWidth:0,
              overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
              fontFamily:'monospace' }}>
              {window.location.origin}/reservar/{tenant?.slug}
            </span>
            <button onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/reservar/${tenant?.slug}`)
              showToast('Link copiado')
            }} style={{ padding:'7px 14px', borderRadius:9, border:`1px solid ${col}35`,
              background:`${col}18`, color:col, fontWeight:700, fontSize:12,
              cursor:'pointer', flexShrink:0 }}>
              Copiar
            </button>
          </div>
        </div>

        {/* Instrucciones WhatsApp */}
        {!form.whatsapp && (
          <div style={{ padding:'12px 14px', borderRadius:12,
            background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
            fontSize:12, color:'#fbbf24', display:'flex', gap:8 }}>
            <Ico d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={15} />
            Agrega el número de WhatsApp para que los clientes puedan contactarte fácilmente
          </div>
        )}
      </Seccion>

      <button onClick={guardar} disabled={saving} style={{
        width:'100%', padding:'16px', borderRadius:14, cursor: saving ? 'not-allowed' : 'pointer',
        background: `linear-gradient(135deg,${col},${col}cc)`,
        border:'none', color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:15,
        opacity: saving ? 0.7 : 1, boxShadow:`0 4px 18px ${col}35`,
      }}>
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </div>
  )
}
