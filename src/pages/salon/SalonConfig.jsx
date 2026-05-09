import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'
import ImageUploader from '../../components/ImageUploader'
import { QRCodeSVG } from 'qrcode.react'

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
  const qrRef = useRef(null)

  const [reglas,      setReglas]      = useState([])
  const [modalRegla,  setModalRegla]  = useState(false)
  const [editRegla,   setEditRegla]   = useState(null)
  const [savingRegla, setSavingRegla] = useState(false)
  const [reglaForm,   setReglaForm]   = useState({
    nombre:'', dias_semana:[5, 6], hora_inicio:'17:00', hora_fin:'21:00', pct:20,
  })

  const cargarReglas = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase.from('reglas_precio_dinamico')
      .select('*').eq('tenant_id', tenant.id).order('created_at')
    setReglas(data || [])
  }, [tenant])

  useEffect(() => { cargarReglas() }, [cargarReglas])

  function descargarQR() {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const size = 400
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `qr-reservas-${tenant?.slug || 'salon'}.png`
      a.click()
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
  }

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
      promo:               tenant.config_vertical?.promo               || '',
      horario_texto:       tenant.config_vertical?.horario_texto       || '',
      tipologia:           tenant.config_vertical?.tipologia           || 'salon',
      hora_apertura:       tenant.config_vertical?.hora_apertura       || '09:00',
      hora_cierre:         tenant.config_vertical?.hora_cierre         || '20:00',
      duracion_slot_min:   tenant.config_vertical?.duracion_slot_min   || 30,
      anticipacion_horas:  tenant.config_vertical?.anticipacion_horas  || 2,
      politica_cancelacion:tenant.config_vertical?.politica_cancelacion|| '',
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
        promo:                form.promo.trim()                || null,
        horario_texto:        form.horario_texto.trim()        || null,
        tipologia:            form.tipologia,
        hora_apertura:        form.hora_apertura,
        hora_cierre:          form.hora_cierre,
        duracion_slot_min:    Number(form.duracion_slot_min),
        anticipacion_horas:   Number(form.anticipacion_horas),
        politica_cancelacion: form.politica_cancelacion.trim() || null,
      },
    }).eq('id', tenant.id)
    setSaving(false)
    if (error) { showToast(error.message, false); return }
    showToast('Configuración guardada')
    recargar()
  }

  async function guardarRegla() {
    if (!reglaForm.nombre.trim() || !reglaForm.dias_semana.length) {
      showToast('Nombre y días son requeridos', false); return
    }
    setSavingRegla(true)
    const row = {
      nombre:        reglaForm.nombre.trim(),
      dias_semana:   reglaForm.dias_semana,
      hora_inicio:   reglaForm.hora_inicio,
      hora_fin:      reglaForm.hora_fin,
      multiplicador: parseFloat((1 + Number(reglaForm.pct) / 100).toFixed(2)),
      activo:        true,
    }
    if (editRegla) {
      await supabase.from('reglas_precio_dinamico').update(row).eq('id', editRegla.id)
    } else {
      await supabase.from('reglas_precio_dinamico').insert({ ...row, tenant_id: tenant.id })
    }
    setSavingRegla(false)
    setModalRegla(false)
    setEditRegla(null)
    cargarReglas()
  }

  async function toggleRegla(id, activo) {
    await supabase.from('reglas_precio_dinamico').update({ activo: !activo }).eq('id', id)
    cargarReglas()
  }

  async function eliminarRegla(id) {
    await supabase.from('reglas_precio_dinamico').delete().eq('id', id)
    cargarReglas()
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

        {/* QR de reservas */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12,
          padding:'20px 16px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
            Código QR de tu portal
          </div>
          <div ref={qrRef} style={{ padding:14, background:'#ffffff', borderRadius:12 }}>
            <QRCodeSVG
              value={`${window.location.origin}/reservar/${tenant?.slug || 'demo'}`}
              size={140}
              level="H"
            />
          </div>
          <button onClick={descargarQR} style={{
            padding:'9px 22px', borderRadius:10, cursor:'pointer',
            background:`${col}18`, border:`1px solid ${col}40`,
            color:col, fontWeight:700, fontSize:13,
          }}>
            ↓ Descargar QR como PNG
          </button>
        </div>

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

      {/* ── Operación ── */}
      <Seccion titulo="Operación">
        <Campo label="Tipología del negocio">
          <select className="sp-input" value={form.tipologia}
            onChange={e => set('tipologia', e.target.value)}>
            <option value="salon">Salón de belleza</option>
            <option value="barberia">Barbería</option>
            <option value="spa">Spa</option>
            <option value="unas">Uñas / Manicure</option>
            <option value="estetica">Estética</option>
          </select>
        </Campo>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Campo label="Hora apertura">
            <input className="sp-input" type="time"
              value={form.hora_apertura} onChange={e => set('hora_apertura', e.target.value)} />
          </Campo>
          <Campo label="Hora cierre">
            <input className="sp-input" type="time"
              value={form.hora_cierre} onChange={e => set('hora_cierre', e.target.value)} />
          </Campo>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Campo label="Duración mínima de cita">
            <select className="sp-input" value={form.duracion_slot_min}
              onChange={e => set('duracion_slot_min', e.target.value)}>
              {[15,20,30,45,60].map(m => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </Campo>
          <Campo label="Anticipación mínima (horas)">
            <input className="sp-input" type="number" min="0" max="72"
              value={form.anticipacion_horas}
              onChange={e => set('anticipacion_horas', e.target.value)} />
          </Campo>
        </div>

        <Campo label="Política de cancelación">
          <textarea className="sp-input" rows={3}
            placeholder="Ej: Puedes cancelar hasta 24h antes sin costo. Cancelaciones tardías tienen cargo del 50%."
            value={form.politica_cancelacion}
            onChange={e => set('politica_cancelacion', e.target.value)}
            style={{ resize:'none' }} />
        </Campo>
      </Seccion>

      {/* ── Precios dinámicos ── */}
      {modalRegla && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setModalRegla(false)} style={{ zIndex:1000 }} />
          <div className="sp-sheet" style={{ zIndex:1001 }}>
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">{editRegla ? 'Editar regla' : 'Nueva regla de precio'}</p>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Campo label="Nombre de la regla">
                <input className="sp-input"
                  placeholder="Ej: Fin de semana, Temporada alta"
                  value={reglaForm.nombre}
                  onChange={e => setReglaForm(f => ({ ...f, nombre: e.target.value }))}
                  autoFocus
                />
              </Campo>

              <Campo label="Días de la semana">
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d, i) => {
                    const sel = reglaForm.dias_semana.includes(i)
                    return (
                      <button key={i}
                        onClick={() => setReglaForm(f => ({
                          ...f,
                          dias_semana: sel
                            ? f.dias_semana.filter(x => x !== i)
                            : [...f.dias_semana, i],
                        }))}
                        style={{
                          padding:'7px 13px', borderRadius:10, cursor:'pointer',
                          background: sel ? col : 'var(--bg)',
                          border:`1px solid ${sel ? col : 'var(--border)'}`,
                          color: sel ? '#fff' : 'var(--text-2)',
                          fontWeight:700, fontSize:12,
                        }}>
                        {d}
                      </button>
                    )
                  })}
                </div>
              </Campo>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Campo label="Hora inicio">
                  <input className="sp-input" type="time"
                    value={reglaForm.hora_inicio}
                    onChange={e => setReglaForm(f => ({ ...f, hora_inicio: e.target.value }))} />
                </Campo>
                <Campo label="Hora fin">
                  <input className="sp-input" type="time"
                    value={reglaForm.hora_fin}
                    onChange={e => setReglaForm(f => ({ ...f, hora_fin: e.target.value }))} />
                </Campo>
              </div>

              <Campo label={`Incremento de precio: +${reglaForm.pct}%`}>
                <input type="range" min="5" max="100" step="5"
                  value={reglaForm.pct}
                  onChange={e => setReglaForm(f => ({ ...f, pct: Number(e.target.value) }))}
                  style={{ width:'100%', accentColor:col }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)', marginTop:4 }}>
                  <span>+5%</span>
                  <span style={{ color:col, fontWeight:700 }}>
                    +{reglaForm.pct}% = ×{(1 + reglaForm.pct / 100).toFixed(2)}
                  </span>
                  <span>+100%</span>
                </div>
              </Campo>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => { setModalRegla(false); setEditRegla(null) }} style={{
                flex:1, padding:'12px', borderRadius:14, cursor:'pointer',
                background:'transparent', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>Cancelar</button>
              <button onClick={guardarRegla} disabled={savingRegla} style={{
                flex:2, padding:'12px', borderRadius:14, border:'none', cursor:'pointer',
                background:`linear-gradient(135deg,${col},${col}cc)`,
                color:'#fff', fontWeight:700, fontSize:14,
                opacity: savingRegla ? 0.7 : 1,
              }}>
                {savingRegla ? 'Guardando…' : 'Guardar regla'}
              </button>
            </div>
          </div>
        </>
      )}

      <Seccion titulo="Precios dinámicos ⚡">
        <div style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.5, marginBottom:4 }}>
          Define horarios donde el precio sube automáticamente. Los clientes verán el precio ajustado en el portal de reservas.
        </div>

        {reglas.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {reglas.map(r => {
              const pct       = Math.round((r.multiplicador - 1) * 100)
              const diasNombres = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
              return (
                <div key={r.id} style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'12px 14px', borderRadius:12,
                  background:'var(--card)',
                  border:`1px solid ${r.activo ? col + '40' : 'var(--border)'}`,
                  opacity: r.activo ? 1 : 0.55,
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3 }}>
                      {r.nombre} · <span style={{ color:col }}>+{pct}%</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>
                      {r.dias_semana.slice().sort((a,b)=>a-b).map(d => diasNombres[d]).join(', ')}
                      {' · '}{r.hora_inicio.slice(0,5)}–{r.hora_fin.slice(0,5)}
                    </div>
                  </div>
                  <button onClick={() => toggleRegla(r.id, r.activo)} style={{
                    padding:'5px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700,
                    background: r.activo ? '#22c55e18' : 'rgba(128,128,128,0.1)',
                    border:`1px solid ${r.activo ? '#22c55e40' : 'var(--border)'}`,
                    color: r.activo ? '#22c55e' : 'var(--text-3)', flexShrink:0,
                  }}>
                    {r.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => {
                    setEditRegla(r)
                    setReglaForm({
                      nombre:      r.nombre,
                      dias_semana: r.dias_semana,
                      hora_inicio: r.hora_inicio.slice(0,5),
                      hora_fin:    r.hora_fin.slice(0,5),
                      pct:         Math.round((r.multiplicador - 1) * 100),
                    })
                    setModalRegla(true)
                  }} style={{ background:'none', border:'none', cursor:'pointer',
                    color:'var(--text-3)', padding:4, flexShrink:0 }}>
                    <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={15} />
                  </button>
                  <button onClick={() => eliminarRegla(r.id)} style={{
                    background:'none', border:'none', cursor:'pointer',
                    color:'#f87171', padding:4, flexShrink:0,
                  }}>
                    <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <button onClick={() => {
          setEditRegla(null)
          setReglaForm({ nombre:'', dias_semana:[5,6], hora_inicio:'17:00', hora_fin:'21:00', pct:20 })
          setModalRegla(true)
        }} style={{
          width:'100%', padding:'11px', borderRadius:12, cursor:'pointer',
          background:'transparent', border:`2px dashed ${col}40`,
          color:col, fontWeight:700, fontSize:13,
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <Ico d="M12 4v16m8-8H4" size={14} />
          Agregar regla de precio
        </button>
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
