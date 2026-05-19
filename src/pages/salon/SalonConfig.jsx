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
  const { tenant, recargar, suscripcion } = useTenant()
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
      wompi_public_key:    tenant.wompi_public_key    || '',
      pagos_portal_activo: tenant.pagos_portal_activo ?? false,
      fotos_galeria:       (tenant.config_vertical?.fotos_galeria || []).concat(['','','','']).slice(0,4),
      puntos_por_visita:   tenant.puntos_por_visita   ?? 10,
      puntos_canje_min:    tenant.puntos_canje_min    ?? 50,
      meta_ingresos_mes:   tenant.config_vertical?.meta_ingresos_mes ?? 0,
      link_google_reviews: tenant.config_vertical?.link_google_reviews || '',
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
      descripcion:          form.descripcion.trim() || null,
      wompi_public_key:     form.wompi_public_key.trim()  || null,
      pagos_portal_activo:  form.pagos_portal_activo,
      puntos_por_visita:    Number(form.puntos_por_visita) || 10,
      puntos_canje_min:     Number(form.puntos_canje_min)  || 50,
      config_vertical: {
        ...(tenant.config_vertical || {}),
        fotos_galeria:        form.fotos_galeria.filter(Boolean),
        promo:                form.promo.trim()                || null,
        horario_texto:        form.horario_texto.trim()        || null,
        tipologia:            form.tipologia,
        hora_apertura:        form.hora_apertura,
        hora_cierre:          form.hora_cierre,
        duracion_slot_min:    Number(form.duracion_slot_min),
        anticipacion_horas:   Number(form.anticipacion_horas),
        politica_cancelacion: form.politica_cancelacion.trim() || null,
        meta_ingresos_mes:    Number(form.meta_ingresos_mes) || 0,
        link_google_reviews:  form.link_google_reviews.trim() || null,
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
            style={{ width:56, height:44, borderRadius:12, border:'none',
              padding:4, background:'var(--card)', cursor:'pointer', display:'block',
              boxShadow:'0 1px 6px rgba(0,0,0,0.15)' }} />
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
              background:'var(--card)', border:'none', boxShadow:'inset 0 1px 4px rgba(0,0,0,0.1)',
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
          padding:'20px 16px', borderRadius:14, background:'var(--card)', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
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

      {/* ── Programa de puntos ── */}
      <Seccion titulo="Programa de puntos ⭐">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Campo label="Puntos por visita completada">
            <input className="sp-input" type="number" min="0" max="500"
              value={form.puntos_por_visita}
              onChange={e => set('puntos_por_visita', e.target.value)} />
          </Campo>
          <Campo label="Mínimo para canjear">
            <input className="sp-input" type="number" min="0" max="5000"
              value={form.puntos_canje_min}
              onChange={e => set('puntos_canje_min', e.target.value)} />
          </Campo>
        </div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
          Los clientes acumulan puntos automáticamente al completar cada cita. El mínimo para canjear controla cuántos puntos se necesitan para un canje.
        </div>
      </Seccion>

      {/* ── Objetivos del mes ── */}
      <Seccion titulo="Objetivos del mes 🎯">
        <Campo label="Meta de ingresos (COP)">
          <input className="sp-input" type="number" min="0" step="50000"
            placeholder="Ej: 3000000"
            value={form.meta_ingresos_mes || ''}
            onChange={e => set('meta_ingresos_mes', e.target.value)} />
        </Campo>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
          Aparece como barra de progreso en Caja e informe gerencial. Deja en 0 para ocultar.
        </div>
      </Seccion>

      {/* ── Reseñas Google ── */}
      <Seccion titulo="Reseñas Google ⭐">
        <Campo label="Link de reseña Google">
          <input className="sp-input" type="url"
            placeholder="https://g.page/r/tu-negocio/review"
            value={form.link_google_reviews}
            onChange={e => set('link_google_reviews', e.target.value)} />
        </Campo>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
          Aparece como botón "Pedir reseña" en cada cita completada para enviar por WhatsApp.
        </div>
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
                background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
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

      {/* ── Automatizaciones WhatsApp ──────────────────────── */}
      <Seccion titulo="Automatizaciones WhatsApp 🤖">
        {[
          {
            icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
            titulo: 'Recordatorio 24h antes',
            desc: 'Avisa al cliente el día anterior a su cita.',
            cron: 'Todos los días 10:00am · función: notificacion-recordatorio',
          },
          {
            icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
            titulo: 'Recordatorio 1h antes',
            desc: 'Avisa al cliente cuando la cita es en 1 hora.',
            cron: 'Cada hora · misma función: notificacion-recordatorio',
          },
          {
            icon: 'M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21l-6-6m6 6l-6 6',
            titulo: 'Felicitación de cumpleaños',
            desc: 'Mensaje personalizado el día del cumpleaños del cliente.',
            cron: 'Todos los días 9:00am · función: cumpleanos-clientes',
          },
          {
            icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
            titulo: 'Resumen diario al salón',
            desc: 'Ingresos, citas atendidas y agenda de mañana.',
            cron: 'Todos los días 9:00pm · función: resumen-diario',
          },
        ].map((a, i) => (
          <div key={i} style={{
            padding:'14px 16px', borderRadius:14,
            background:`linear-gradient(135deg,${col}0d,var(--card))`,
            boxShadow:'0 2px 12px rgba(0,0,0,0.09)',
            display:'flex', alignItems:'flex-start', gap:12,
          }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${col}18`,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:col, flexShrink:0 }}>
              <Ico d={a.icon} size={16} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3 }}>
                {a.titulo}
              </div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{a.desc}</div>
              <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-3)',
                background:'rgba(0,0,0,0.18)', padding:'4px 8px', borderRadius:6,
                wordBreak:'break-all' }}>
                {a.cron}
              </div>
            </div>
          </div>
        ))}
        <div style={{ padding:'12px 14px', borderRadius:12,
          background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)',
          fontSize:11, color:'#93c5fd', lineHeight:1.6 }}>
          Para activar: ve a Supabase → Edge Functions → Schedules y crea un cron para cada función según el horario indicado. Requiere WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en los secrets.
        </div>
      </Seccion>

      {/* ── Tu plan ────────────────────────────────────── */}
      <Seccion titulo="Tu plan">
        {(() => {
          const plan = tenant?.plan || 'basico'
          const PLAN_COLOR_MAP = {
            basico: '#f43f5e', pro: '#a855f7', premium: '#f59e0b',
            starter: '#f43f5e', ultra: '#f59e0b',
          }
          const PLAN_LABEL_MAP = {
            basico: 'Básico', pro: 'Pro', premium: 'Premium',
            starter: 'Básico', ultra: 'Premium',
          }
          const PLAN_PRECIO_MAP = {
            basico: '$80.000', pro: '$160.000', premium: '$200.000',
            starter: '$80.000', ultra: '$200.000',
          }
          const PLAN_DETALLE_MAP = {
            basico:   '2 usuarios · Sin mensajería',
            pro:      '10 usuarios · Sin mensajería',
            premium:  'Usuarios ilimitados · Mensajería incluida',
            starter:  '2 usuarios',
            ultra:    'Usuarios ilimitados · Mensajería incluida',
          }
          const planColor   = PLAN_COLOR_MAP[plan]   || '#60a5fa'
          const planLabel   = PLAN_LABEL_MAP[plan]   || plan
          const planPrecio  = PLAN_PRECIO_MAP[plan]  || '$80.000'
          const planDetalle = PLAN_DETALLE_MAP[plan] || ''
          const vence = tenant?.fecha_vencimiento
          const venceDate = vence ? new Date(vence) : null
          const diasRestantes = venceDate
            ? Math.ceil((venceDate - new Date()) / (1000 * 60 * 60 * 24))
            : null
          const vencido = diasRestantes !== null && diasRestantes <= 0
          return (
            <div style={{
              padding:'16px', borderRadius:14,
              background:`${planColor}08`,
              border:`1px solid ${vencido ? '#ef444440' : planColor + '30'}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{
                  width:44, height:44, borderRadius:12,
                  background:`linear-gradient(135deg,${planColor},${planColor}aa)`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:`0 4px 12px ${planColor}40`,
                }}>
                  <Ico d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" size={20} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'Outfit', fontWeight:900, fontSize:18, color:planColor }}>
                      Plan {planLabel}
                    </span>
                    <span style={{
                      padding:'2px 8px', borderRadius:20,
                      background:`${planColor}18`, border:`1px solid ${planColor}40`,
                      fontSize:11, fontWeight:700, color:planColor,
                    }}>{planPrecio}/mes</span>
                  </div>
                  {planDetalle && (
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>{planDetalle}</div>
                  )}
                  {venceDate && (
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>
                      Vigente hasta{' '}
                      <span style={{ fontWeight:700, color: diasRestantes && diasRestantes < 10 ? '#f87171' : 'var(--text-2)' }}>
                        {venceDate.toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric' })}
                      </span>
                      {diasRestantes !== null && (
                        <span style={{ marginLeft:6, color: diasRestantes < 10 ? '#f87171' : 'var(--text-3)' }}>
                          ({diasRestantes > 0 ? `${diasRestantes} días restantes` : 'VENCIDO'})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{
                fontSize:11, color:'var(--text-3)', lineHeight:1.6,
                padding:'10px 12px', borderRadius:10,
                background:'rgba(0,0,0,0.15)',
              }}>
                Para cambiar de plan o renovar, contacta al administrador de Salón Pro.
              </div>
            </div>
          )
        })()}
      </Seccion>

      {/* ── Galería del negocio (portal) ─────────────────── */}
      <Seccion titulo="Galería para el portal (hasta 4 fotos)">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'center' }}>
              <ImageUploader
                value={form.fotos_galeria[i] || ''}
                onChange={url => {
                  const arr = [...form.fotos_galeria]
                  arr[i] = url
                  set('fotos_galeria', arr)
                }}
                label={`Foto ${i + 1}`}
                shape="square"
                size={100}
                folder="galeria"
                accent={col}
              />
            </div>
          ))}
        </div>
        <p style={{ fontSize:11, color:'var(--text-3)', margin:'8px 0 0' }}>
          Estas fotos aparecen en la portada de tu portal de reservas
        </p>
      </Seccion>

      {/* ── Pagos en línea (portal) ──────────────────────── */}
      <Seccion titulo="Pagos en línea desde el portal">
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Toggle activar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Activar cobro online</div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                Tus clientes pagan al reservar desde el portal
              </div>
            </div>
            <button type="button" onClick={() => set('pagos_portal_activo', !form.pagos_portal_activo)} style={{
              width:46, height:26, borderRadius:13, border:'none', cursor:'pointer',
              background: form.pagos_portal_activo ? col : 'var(--border)',
              position:'relative', transition:'background 0.2s', flexShrink:0,
            }}>
              <span style={{
                position:'absolute', top:3, left: form.pagos_portal_activo ? 22 : 3,
                width:20, height:20, borderRadius:'50%', background:'#fff',
                transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* Clave pública Wompi */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)' }}>
              Clave pública Wompi
            </label>
            <input
              value={form.wompi_public_key}
              onChange={e => set('wompi_public_key', e.target.value)}
              placeholder="pub_stagtest_xxxxx o pub_prod_xxxxx"
              style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1px solid var(--border)',
                background:'var(--card)', color:'var(--text)', fontSize:13, fontFamily:'monospace',
                outline:'none', boxSizing:'border-box' }}
            />
            <p style={{ fontSize:11, color:'var(--text-3)', margin:0 }}>
              Consíguela en app.wompi.co → Desarrolladores → Llaves. Solo la clave pública (pub_…) — nunca la privada.
            </p>
          </div>

          {form.pagos_portal_activo && !form.wompi_public_key && (
            <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(245,158,11,0.1)',
              border:'1px solid rgba(245,158,11,0.3)', fontSize:12, color:'#fbbf24', fontWeight:600 }}>
              ⚠️ Activa los pagos y agrega tu clave pública para que funcione en el portal.
            </div>
          )}
          {form.pagos_portal_activo && form.wompi_public_key && (
            <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(34,197,94,0.08)',
              border:'1px solid rgba(34,197,94,0.25)', fontSize:12, color:'#4ade80', fontWeight:600 }}>
              ✓ Tus clientes podrán pagar con tarjeta o PSE al reservar en el portal.
            </div>
          )}
        </div>
      </Seccion>

      {/* ── Suscripción y pagos ──────────────────────────── */}
      <Seccion titulo="Suscripción y pagos">
        {(() => {
          const dias = suscripcion?.dias_restantes ?? null
          const limite = suscripcion?.fecha_limite
          const planNombre = suscripcion?.plan_nombre || tenant?.plan || null
          const vencido = dias !== null && dias <= 0
          const limiteDate = limite ? new Date(limite + 'T00:00:00') : null
          const diasColor = dias === null ? 'var(--text-3)' : dias <= 2 ? '#f87171' : dias <= 5 ? '#fbbf24' : '#4ade80'
          const metodos = [
            { label:'Nequi',       value:'3155734848',                       color:'#a855f7', icon:'📱' },
            { label:'Transfiya',   value:'3155734848',                       color:'#3b82f6', icon:'💸' },
            { label:'Bancolombia', value:'Cta Ahorros 45492209477 · Hugo F. Urquina', color:'#f59e0b', icon:'🏦' },
          ]
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Estado actual */}
              <div style={{ padding:'14px', borderRadius:14, background:'var(--card)',
                border:`1px solid ${vencido ? '#ef444440' : 'var(--border)'}` }}>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', marginBottom:8 }}>
                  Estado actual
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {planNombre && (
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>Plan</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', textTransform:'capitalize' }}>{planNombre}</span>
                    </div>
                  )}
                  {limiteDate && (
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>Vigente hasta</span>
                      <span style={{ fontSize:12, fontWeight:700, color: vencido ? '#f87171' : 'var(--text)' }}>
                        {limiteDate.toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric' })}
                      </span>
                    </div>
                  )}
                  {dias !== null && (
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>Días restantes</span>
                      <span style={{ fontSize:13, fontWeight:800, color:diasColor }}>
                        {vencido ? `Vencido hace ${Math.abs(dias)} día${Math.abs(dias)!==1?'s':''}` : `${dias} día${dias!==1?'s':''}`}
                      </span>
                    </div>
                  )}
                  {!suscripcion && (
                    <p style={{ fontSize:11, color:'var(--text-3)', margin:0 }}>
                      Sin suscripción activa registrada.
                    </p>
                  )}
                </div>
              </div>

              {/* Métodos de pago */}
              <div style={{ padding:'14px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', marginBottom:10 }}>
                  Medios de pago para renovación
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {metodos.map(m => (
                    <div key={m.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'10px 12px', borderRadius:10,
                      background:`${m.color}08`, border:`1px solid ${m.color}25` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{m.icon}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:800, color:m.color }}>{m.label}</div>
                          <div style={{ fontSize:11, color:'var(--text-2)' }}>{m.value}</div>
                        </div>
                      </div>
                      <button type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(m.value.replace(/\D/g,'') || m.value)
                          showToast(`${m.label} copiado ✓`)
                        }}
                        style={{ fontSize:11, fontWeight:700, padding:'5px 10px', borderRadius:8, cursor:'pointer',
                          border:`1px solid ${m.color}40`, background:`${m.color}15`, color:m.color }}>
                        Copiar
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:10, color:'var(--text-3)', marginTop:8, marginBottom:0 }}>
                  Después de tu pago, el administrador activará tu plan. Si tienes dudas, escríbenos.
                </p>
              </div>
            </div>
          )
        })()}
      </Seccion>

      {/* ── Seguridad — cambiar contraseña ──────────────── */}
      <Seccion titulo="Seguridad">
        <CambiarClave accentColor={col} />
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

function CambiarClave({ accentColor }) {
  const [abierto,  setAbierto]  = useState(false)
  const [pass,     setPass]     = useState('')
  const [pass2,    setPass2]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState(null)   // { text, ok }

  async function handleSubmit(e) {
    e.preventDefault()
    if (pass !== pass2) { setMsg({ text:'Las contraseñas no coinciden', ok:false }); return }
    if (pass.length < 6) { setMsg({ text:'Mínimo 6 caracteres', ok:false }); return }
    setMsg(null); setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pass })
    setLoading(false)
    if (error) {
      setMsg({ text: error.message, ok: false })
    } else {
      setMsg({ text:'Contraseña actualizada correctamente', ok: true })
      setPass(''); setPass2('')
      setTimeout(() => setAbierto(false), 2000)
    }
  }

  if (!abierto) return (
    <button
      onClick={() => setAbierto(true)}
      style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'12px 16px', borderRadius:14, cursor:'pointer', width:'100%',
        background:'var(--card)', border:'none', boxShadow:'0 1px 8px rgba(0,0,0,0.1)',
        color:'var(--text-2)', fontWeight:600, fontSize:13, textAlign:'left',
      }}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
      Cambiar mi contraseña
    </button>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <input
        type="password" required placeholder="Nueva contraseña (mín. 6 caracteres)"
        value={pass} onChange={e => setPass(e.target.value)}
        style={{
          width:'100%', padding:'10px 14px', borderRadius:12,
          border:'none', background:'var(--card)',
          color:'var(--text)', fontSize:14, outline:'none',
          boxShadow:'inset 0 1px 4px rgba(0,0,0,0.12)',
        }}
      />
      <input
        type="password" required placeholder="Confirmar contraseña"
        value={pass2} onChange={e => setPass2(e.target.value)}
        style={{
          width:'100%', padding:'10px 14px', borderRadius:12,
          border:'none', background:'var(--card)',
          color:'var(--text)', fontSize:14, outline:'none',
          boxShadow:'inset 0 1px 4px rgba(0,0,0,0.12)',
        }}
      />
      {msg && (
        <p style={{ fontSize:13, color: msg.ok ? '#4ade80' : '#f87171', padding:'8px 12px',
          borderRadius:10, background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
          {msg.text}
        </p>
      )}
      <div style={{ display:'flex', gap:10 }}>
        <button type="button" onClick={() => { setAbierto(false); setPass(''); setPass2(''); setMsg(null) }}
          style={{
            flex:1, padding:'10px', borderRadius:12, cursor:'pointer',
            background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
            color:'var(--text-2)', fontWeight:600, fontSize:13,
          }}>
          Cancelar
        </button>
        <button type="submit" disabled={loading} style={{
          flex:2, padding:'10px', borderRadius:12, border:'none', cursor:'pointer',
          background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`,
          color:'#fff', fontWeight:700, fontSize:13, opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </div>
    </form>
  )
}
