import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'
import { useToast } from '../../context/ToastContext'

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('es-CO').format(n ?? 0)
const today = () => new Date().toISOString().slice(0, 10)

const TIPO_LABEL = {
  flash: 'Flash', pack_cumpleanos: 'Cumpleaños', recuperacion: 'Recuperación',
  doble_asistencia: 'Doble', temporada: 'Temporada', lanzamiento: 'Lanzamiento',
}
const TIPO_COLOR = {
  flash: '#f59e0b', pack_cumpleanos: '#ec4899', recuperacion: '#8b5cf6',
  doble_asistencia: '#06b6d4', temporada: '#10b981', lanzamiento: '#6366f1',
}
const SEGMENTO_LABEL = { todos: 'Todos', sin_visita: 'Sin visita', con_tag: 'Por etiqueta', cumpleanos_mes: 'Cumpleaños del mes' }

const AUTOS_META = [
  {
    tipo: 'resena_post_visita', icon: '⭐', titulo: 'Reseña post-visita',
    desc: 'WhatsApp automático N horas después de completar una cita',
    defaults: { horas_despues_cita: 2, descuento_porcentaje: 0,
      mensaje_wa: 'Hola {{nombre}}! Gracias por visitarnos en {{negocio}} 💖 Tu opinión nos importa. ¿Puedes dejarnos una reseña rápida? {{link_resena}}' }
  },
  {
    tipo: 'te_extranamos', icon: '💐', titulo: 'Te extrañamos',
    desc: 'WhatsApp a clientes sin visita en N días con descuento especial',
    defaults: { dias_sin_visita: 90, descuento_porcentaje: 15,
      mensaje_wa: 'Hola {{nombre}}! Te extrañamos en {{negocio}} 🌸 Hace {{dias}} días no te vemos. ¡Vuelve esta semana y te damos un {{descuento}}% de descuento!' }
  },
  {
    tipo: 'cumpleanos_pack', icon: '🎂', titulo: 'Pack de cumpleaños',
    desc: 'WhatsApp el día del cumpleaños con oferta y descripción del pack',
    defaults: { descuento_porcentaje: 20, pack_descripcion: 'Servicio principal + bebida de cortesía',
      mensaje_wa: '¡Feliz cumpleaños {{nombre}}! 🎉 En {{negocio}} celebramos contigo. Hoy tienes {{descuento}}% OFF + {{pack}}. ¡Te esperamos!' }
  },
  {
    tipo: 'recordatorio_servicio', icon: '💅', titulo: 'Recordatorio de servicio',
    desc: 'Recuerda al cliente cuándo es momento de retocarse',
    defaults: { dias_recordatorio: 30,
      mensaje_wa: 'Hola {{nombre}}! Han pasado {{dias}} días desde tu último {{servicio}} en {{negocio}}. ¿Te agendamos pronto? Escríbenos 😊' }
  },
]

// ─── estilos base ──────────────────────────────────────────────────────────────
const S = {
  page:    { padding: '24px 28px', maxWidth: 1100 },
  tabs:    { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 },
  tab:     (act) => ({
    padding: '8px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none',
    borderRadius: '8px 8px 0 0', transition: 'all .15s',
    background: act ? 'var(--accent)' : 'transparent',
    color: act ? '#fff' : 'var(--text-2)',
  }),
  card:    { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  row:     { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  label:   { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, display: 'block' },
  input:   { background: 'var(--surface, var(--bg))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: 'var(--text)', width: '100%', outline: 'none' },
  btn:     (v='accent') => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
    background: v === 'accent' ? 'var(--accent)' : v === 'ghost' ? 'transparent' : 'var(--border)',
    color: v === 'accent' ? '#fff' : 'var(--text)',
    border: v === 'ghost' ? '1px solid var(--border)' : 'none',
  }),
  badge:   (color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${color}22`, color }),
  toggle:  (on) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start',
    width: 40, height: 22, borderRadius: 11, padding: 2, cursor: 'pointer', transition: 'background .2s',
    background: on ? 'var(--accent)' : 'var(--border)',
  }),
  dot:     { width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  select:  { background: 'var(--surface, var(--bg))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: 'var(--text)', width: '100%', outline: 'none' },
  textarea:{ background: 'var(--surface, var(--bg))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', width: '100%', outline: 'none', resize: 'vertical', minHeight: 72, fontFamily: 'inherit' },
  field:   { flex: 1 },
  sep:     { height: 1, background: 'var(--border)', margin: '16px 0' },
  h2:      { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' },
  sub:     { fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' },
  empty:   { textAlign: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 14 },
}

// ─── Componente Modal ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: wide ? 700 : 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Campo de formulario ──────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )
}

// ─── Modal Lanzar Campaña ─────────────────────────────────────────────────────
function ModalLanzar({ campana, tenant, onClose }) {
  const [clientes, setClientes] = useState(null)

  useEffect(() => {
    async function cargar() {
      let q = supabase.from('clientes_agenda')
        .select('id, nombre, whatsapp, telefono, fecha_nacimiento, ultima_visita, tags, barrio')
        .eq('tenant_id', tenant.id).eq('activo', true)

      if (campana.segmento === 'sin_visita' && campana.segmento_dias) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - campana.segmento_dias)
        q = q.or(`ultima_visita.is.null,ultima_visita.lte.${cutoff.toISOString()}`)
      } else if (campana.segmento === 'con_tag' && campana.segmento_tag) {
        q = q.contains('tags', [campana.segmento_tag])
      } else if (campana.segmento === 'cumpleanos_mes') {
        // filter client-side: extract month from fecha_nacimiento
        const mes = new Date().getMonth() + 1
        const { data } = await q
        setClientes((data || []).filter(c => c.fecha_nacimiento && new Date(c.fecha_nacimiento).getMonth() + 1 === mes))
        return
      } else if (campana.segmento === 'por_barrio' && campana.segmento_barrio) {
        q = q.ilike('barrio', `%${campana.segmento_barrio}%`)
      }

      const { data } = await q.order('nombre')
      setClientes(data || [])
    }
    cargar()
  }, [campana, tenant.id])

  function mensajePersonalizado(c) {
    const tel = c.whatsapp || c.telefono || ''
    const msg = (campana.mensaje_wa || '')
      .replace(/\{\{nombre\}\}/g, c.nombre)
      .replace(/\{\{negocio\}\}/g, tenant.nombre || '')
      .replace(/\{\{descuento\}\}/g, campana.descuento_valor || '')
      .replace(/\{\{fecha\}\}/g, campana.fecha_inicio || '')
    return { tel: tel.replace(/\D/g, ''), msg }
  }

  return (
    <Modal title={`Lanzar: ${campana.nombre}`} onClose={onClose} wide>
      {clientes === null ? (
        <div style={S.empty}>Buscando clientes...</div>
      ) : (
        <>
          <div style={{ background: 'var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>{clientes.length}</strong> cliente{clientes.length !== 1 ? 's' : ''} en el segmento <em>{SEGMENTO_LABEL[campana.segmento] || campana.segmento}</em>
            {campana.segmento_barrio && ` · zona "${campana.segmento_barrio}"`}
          </div>

          {clientes.length === 0 ? (
            <div style={S.empty}>No hay clientes que coincidan con este segmento aún.</div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clientes.map(c => {
                const { tel, msg } = mensajePersonalizado(c)
                const waUrl = tel ? `https://wa.me/57${tel}?text=${encodeURIComponent(msg)}` : null
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {tel || 'Sin número'}
                        {c.barrio && <span style={{ marginLeft: 8 }}>📍 {c.barrio}</span>}
                      </div>
                    </div>
                    {waUrl ? (
                      <a href={waUrl} target="_blank" rel="noreferrer"
                        style={{ ...S.btn('accent'), textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        📤 Enviar WA
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Sin WhatsApp</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
            💡 Cada botón "Enviar WA" abre WhatsApp con el mensaje personalizado para ese cliente. Envía uno por uno o en paralelo en varias pestañas.
          </div>
        </>
      )}
    </Modal>
  )
}

// ─── Tab: Campañas ────────────────────────────────────────────────────────────
function TabCampanas({ tenant, toast }) {
  const [lista, setLista]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)   // 'form' | 'lanzar'
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [campanaLanzar, setCampanaLanzar] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('campanas_marketing')
      .select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })
    setLista(data || [])
    setLoading(false)
  }, [tenant.id])

  useEffect(() => { cargar() }, [cargar])

  function abrirNueva() {
    setForm({ tipo: 'flash', tipo_descuento: 'porcentaje', descuento_valor: 10, segmento: 'todos', segmento_dias: 90, activo: true, fecha_inicio: today(), mensaje_wa: '' })
    setModal('form')
  }
  function abrirEditar(c) { setForm({ ...c }); setModal('form') }

  async function guardar() {
    if (!form.nombre?.trim()) { toast.error('Escribe un nombre'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant.id }
    const { error } = form.id
      ? await supabase.from('campanas_marketing').update(payload).eq('id', form.id)
      : await supabase.from('campanas_marketing').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(form.id ? 'Campaña actualizada' : 'Campaña creada')
    setModal(null)
    cargar()
  }

  async function toggleActivo(c) {
    await supabase.from('campanas_marketing').update({ activo: !c.activo }).eq('id', c.id)
    cargar()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta campaña?')) return
    await supabase.from('campanas_marketing').delete().eq('id', id)
    toast.success('Eliminada')
    cargar()
  }

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={S.h2}>Campañas</h2>
          <p style={S.sub}>Promociones, packs y ofertas especiales configurables por el negocio</p>
        </div>
        <button style={S.btn('accent')} onClick={abrirNueva}>+ Nueva campaña</button>
      </div>

      {loading ? <div style={S.empty}>Cargando...</div> :
        lista.length === 0 ? <div style={S.empty}>Aún no hay campañas. ¡Crea la primera!</div> :
        lista.map(c => (
          <div key={c.id} style={{ ...S.card, opacity: c.activo ? 1 : .5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{c.nombre}</span>
                  <span style={S.badge(TIPO_COLOR[c.tipo] || '#6366f1')}>{TIPO_LABEL[c.tipo] || c.tipo}</span>
                  {c.descuento_valor > 0 && <span style={S.badge('#10b981')}>{c.tipo_descuento === 'porcentaje' ? `${c.descuento_valor}% OFF` : c.tipo_descuento === 'monto_fijo' ? `-$${fmt(c.descuento_valor)}` : 'Gratis'}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {c.fecha_inicio && <span>📅 {c.fecha_inicio}{c.fecha_fin ? ` → ${c.fecha_fin}` : ''}</span>}
                  <span>👥 {SEGMENTO_LABEL[c.segmento] || c.segmento}{c.segmento_barrio ? ` "${c.segmento_barrio}"` : ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={S.toggle(c.activo)} onClick={() => toggleActivo(c)}><div style={S.dot} /></div>
                <button style={S.btn('accent')} onClick={() => { setCampanaLanzar(c); setModal('lanzar') }}>📤 Lanzar</button>
                <button style={S.btn('ghost')} onClick={() => abrirEditar(c)}>Editar</button>
                <button style={{ ...S.btn('ghost'), color: '#ef4444' }} onClick={() => eliminar(c.id)}>✕</button>
              </div>
            </div>
          </div>
        ))
      }

      {modal === 'form' && (
        <Modal title={form.id ? 'Editar campaña' : 'Nueva campaña'} onClose={() => setModal(null)} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={S.grid2}>
              <Field label="Nombre de la campaña">
                <input style={S.input} value={form.nombre || ''} onChange={e => upd('nombre', e.target.value)} placeholder="Ej: Flash del lunes" />
              </Field>
              <Field label="Tipo">
                <select style={S.select} value={form.tipo || 'flash'} onChange={e => upd('tipo', e.target.value)}>
                  {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>

            <div style={S.grid3}>
              <Field label="Tipo de descuento">
                <select style={S.select} value={form.tipo_descuento || 'porcentaje'} onChange={e => upd('tipo_descuento', e.target.value)}>
                  <option value="porcentaje">Porcentaje %</option>
                  <option value="monto_fijo">Monto fijo $</option>
                  <option value="sin_costo">Sin costo</option>
                </select>
              </Field>
              {form.tipo_descuento !== 'sin_costo' && (
                <Field label={form.tipo_descuento === 'porcentaje' ? 'Descuento %' : 'Monto $'}>
                  <input style={S.input} type="number" min={0} value={form.descuento_valor || 0} onChange={e => upd('descuento_valor', +e.target.value)} />
                </Field>
              )}
              <Field label="Hora de envío">
                <input style={S.input} type="time" value={form.hora_envio || '10:00'} onChange={e => upd('hora_envio', e.target.value)} />
              </Field>
            </div>

            <div style={S.grid2}>
              <Field label="Fecha inicio">
                <input style={S.input} type="date" value={form.fecha_inicio || ''} onChange={e => upd('fecha_inicio', e.target.value)} />
              </Field>
              <Field label="Fecha fin (opcional)">
                <input style={S.input} type="date" value={form.fecha_fin || ''} onChange={e => upd('fecha_fin', e.target.value)} />
              </Field>
            </div>

            <div style={S.grid2}>
              <Field label="Segmento de clientes">
                <select style={S.select} value={form.segmento || 'todos'} onChange={e => upd('segmento', e.target.value)}>
                  {Object.entries(SEGMENTO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              {form.segmento === 'sin_visita' && (
                <Field label="Sin visita hace (días)">
                  <input style={S.input} type="number" min={1} value={form.segmento_dias || 90} onChange={e => upd('segmento_dias', +e.target.value)} />
                </Field>
              )}
              {form.segmento === 'con_tag' && (
                <Field label="Etiqueta del cliente">
                  <input style={S.input} value={form.segmento_tag || ''} onChange={e => upd('segmento_tag', e.target.value)} placeholder="Ej: VIP" />
                </Field>
              )}
              {form.segmento === 'por_barrio' && (
                <Field label="Barrio o zona">
                  <input style={S.input} value={form.segmento_barrio || ''} onChange={e => upd('segmento_barrio', e.target.value)} placeholder="Ej: Laureles, Centro, El Poblado…" />
                </Field>
              )}
            </div>

            <Field label="Mensaje de WhatsApp">
              <textarea style={S.textarea} value={form.mensaje_wa || ''} onChange={e => upd('mensaje_wa', e.target.value)}
                placeholder="Usa {{nombre}}, {{negocio}}, {{descuento}} como variables" />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Variables: {'{{nombre}}'} {'{{negocio}}'} {'{{descuento}}'} {'{{fecha}}'}</div>
            </Field>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={!!form.visible_portal} onChange={e => upd('visible_portal', e.target.checked)} />
                Visible en portal de reservas
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={!!form.contador_activo} onChange={e => upd('contador_activo', e.target.checked)} />
                Mostrar contador regresivo
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button style={S.btn('ghost')} onClick={() => setModal(null)}>Cancelar</button>
              <button style={S.btn('accent')} onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : form.id ? 'Actualizar' : 'Crear campaña'}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'lanzar' && campanaLanzar && (
        <ModalLanzar campana={campanaLanzar} tenant={tenant} onClose={() => { setModal(null); setCampanaLanzar(null) }} />
      )}
    </div>
  )
}

// ─── Tab: Fidelización ────────────────────────────────────────────────────────
function TabFidelizacion({ tenant, toast }) {
  const [cfg, setCfg]         = useState(null)
  const [form, setForm]       = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [topClientes, setTop] = useState([])

  useEffect(() => {
    async function cargar() {
      const [{ data: c }, { data: t }] = await Promise.all([
        supabase.from('sellos_config').select('*').eq('tenant_id', tenant.id).maybeSingle(),
        supabase.from('sellos_cliente').select('*, clientes(nombre)').eq('tenant_id', tenant.id)
          .order('sellos_actuales', { ascending: false }).limit(10),
      ])
      const cfg0 = c || {
        activo: true, nombre: 'Tarjeta de sellos', sellos_requeridos: 8,
        recompensa_tipo: 'descuento', recompensa_descuento_pct: 100,
        recompensa_descripcion: '1 servicio gratis', descuento_qr_bienvenida: 10,
        mensaje_bienvenida_qr: '¡Bienvenido/a {{nombre}}! Por registrarte hoy tienes un {{descuento}}% de descuento en tu próxima visita 🎉',
      }
      setCfg(cfg0)
      setForm(cfg0)
      setTop(t || [])
      setLoading(false)
    }
    cargar()
  }, [tenant.id])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    setSaving(true)
    const payload = { ...form, tenant_id: tenant.id }
    const { error } = cfg?.id
      ? await supabase.from('sellos_config').update(payload).eq('id', cfg.id)
      : await supabase.from('sellos_config').upsert(payload, { onConflict: 'tenant_id' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Configuración guardada')
    setCfg({ ...form })
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/s/${tenant.slug || tenant.id}/unirse`)}`

  if (loading) return <div style={S.empty}>Cargando...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr min(320px, 100%)', gap: 24, alignItems: 'start' }}>
      {/* Configuración */}
      <div>
        <h2 style={S.h2}>Tarjeta de sellos</h2>
        <p style={S.sub}>Configura el programa de fidelización y el descuento de bienvenida por QR</p>

        <div style={S.card}>
          {/* Toggle activo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Programa activo</span>
            <div style={S.toggle(form.activo)} onClick={() => upd('activo', !form.activo)}><div style={S.dot} /></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Fila 1: Nombre del programa + Sellos requeridos */}
            <div style={S.grid2}>
              <Field label="Nombre del programa">
                <input style={S.input} value={form.nombre || ''} onChange={e => upd('nombre', e.target.value)} />
              </Field>
              <Field label="Sellos requeridos">
                <input style={S.input} type="number" min={2} max={20} value={form.sellos_requeridos || 8} onChange={e => upd('sellos_requeridos', +e.target.value)} />
              </Field>
            </div>

            {/* Fila 2: Recompensa */}
            <div style={S.grid2}>
              <Field label="Recompensa al completar">
                <select style={S.select} value={form.recompensa_tipo || 'descuento'} onChange={e => upd('recompensa_tipo', e.target.value)}>
                  <option value="descuento">Descuento %</option>
                  <option value="servicio">Servicio gratis</option>
                  <option value="producto">Producto gratis</option>
                </select>
              </Field>
              {form.recompensa_tipo === 'descuento' ? (
                <Field label="Descuento %">
                  <input style={S.input} type="number" min={1} max={100} value={form.recompensa_descuento_pct || 100} onChange={e => upd('recompensa_descuento_pct', +e.target.value)} />
                </Field>
              ) : (
                <Field label="Descripción de la recompensa">
                  <input style={S.input} value={form.recompensa_descripcion || ''} onChange={e => upd('recompensa_descripcion', e.target.value)} placeholder="Ej: Corte + lavado gratis" />
                </Field>
              )}
            </div>

            <div style={S.sep} />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Registro por QR</h3>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 8px' }}>El cliente escanea el QR en el local y recibe el descuento por WhatsApp automáticamente</p>

            {/* Fila 3: Descuento bienvenida — campo ancho completo, no en grid de 2 */}
            <Field label="Descuento de bienvenida (%)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input style={{ ...S.input, width: 100, flexShrink: 0 }} type="number" min={0} max={50} value={form.descuento_qr_bienvenida || 10} onChange={e => upd('descuento_qr_bienvenida', +e.target.value)} />
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>% de descuento en la primera visita del cliente</span>
              </div>
            </Field>

            <Field label="Mensaje de bienvenida (WhatsApp automático al registrarse)">
              <textarea style={S.textarea} value={form.mensaje_bienvenida_qr || ''} onChange={e => upd('mensaje_bienvenida_qr', e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Variables: {'{{nombre}}'} {'{{descuento}}'} {'{{negocio}}'}</div>
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={S.btn('accent')} onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </div>
        </div>

        {/* Top clientes */}
        {topClientes.length > 0 && (
          <div style={S.card}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>Progreso de clientes</h3>
            {topClientes.map(sc => (
              <div key={sc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>{sc.clientes?.nombre || '—'}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{sc.sellos_actuales}/{form.sellos_requeridos || 8} sellos</span>
                  {sc.tarjetas_completadas > 0 && <span style={S.badge('#10b981')}>🏆 ×{sc.tarjetas_completadas}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Preview */}
      <div style={{ position: 'sticky', top: 20 }}>
        <div style={{ ...S.card, padding: '24px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)', textAlign: 'center' }}>QR de registro</h3>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20, textAlign: 'center', lineHeight: 1.5 }}>
            Coloca este QR en el local. El cliente se registra y recibe el descuento de bienvenida automáticamente.
          </p>

          {/* QR centrado con contenedor explícito */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <img
              src={qrUrl}
              alt="QR fidelización"
              style={{ display: 'block', width: 200, height: 200, borderRadius: 12, border: '2px solid var(--border)', padding: 8, background: '#fff' }}
            />
          </div>

          {/* URL truncada */}
          <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px', marginBottom: 16 }}>
            {window.location.origin}/s/{tenant.slug || tenant.id}/unirse
          </p>

          <button style={{ ...S.btn('ghost'), width: '100%' }} onClick={() => window.open(qrUrl, '_blank')}>
            Descargar QR
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Membresías ──────────────────────────────────────────────────────────
const MODELOS_MEMBRESIA = [
  {
    nombre: 'Plan Base', color: '#10b981', precio_mensual: 80000, max_usos_mes: 4,
    descripcion: '4 servicios/mes (ej: corte mensual + 3 retoques)',
    tip: 'Ideal para clientes frecuentes que vienen cada semana. Fideliza y garantiza ingresos mensuales recurrentes.',
    beneficios: ['4 visitas al mes', 'Servicio principal incluido', 'Sin costos extra por agendamiento'],
  },
  {
    nombre: 'Plan Pro', color: '#6366f1', precio_mensual: 130000, max_usos_mes: 8,
    descripcion: '8 servicios/mes + 1 tratamiento especial incluido',
    tip: 'Para clientes que visitan 2 veces/semana. Aumenta ticket promedio incluyendo servicios de mayor valor.',
    beneficios: ['8 visitas al mes', '1 coloración o tratamiento incluido', '10% OFF en productos'],
  },
  {
    nombre: 'Plan VIP', color: '#ec4899', precio_mensual: 200000, max_usos_mes: null,
    descripcion: 'Visitas ilimitadas al mes + 15% descuento en extras',
    tip: 'Para el cliente más fiel. Genera embajadores de marca. Precio premium justificado por la exclusividad.',
    beneficios: ['Visitas ilimitadas', '15% OFF en todos los extras', 'Prioridad de agendamiento', 'Acceso a eventos exclusivos'],
  },
]

function TabMembresias({ tenant, toast }) {
  const [planes, setPlanes]       = useState([])
  const [activos, setActivos]     = useState([])
  const [clientes, setClientes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [formAsig, setFormAsig]   = useState({ fecha_inicio: new Date().toISOString().slice(0,10), estado: 'activo' })
  const [saving, setSaving]       = useState(false)
  const [showEstrategia, setShowEstrategia] = useState(false)

  const cargar = useCallback(async () => {
    const [{ data: p }, { data: a }, { data: c }] = await Promise.all([
      supabase.from('membresias_config').select('*').eq('tenant_id', tenant.id).eq('activo', true).order('precio_mensual'),
      supabase.from('membresias_cliente').select('*, clientes_agenda(nombre, telefono), membresias_config(nombre, color)')
        .eq('tenant_id', tenant.id).eq('estado', 'activo').order('fecha_vencimiento', { ascending: true }),
      supabase.from('clientes_agenda').select('id,nombre,telefono').eq('tenant_id', tenant.id).order('nombre'),
    ])
    setPlanes(p || [])
    setActivos(a || [])
    setClientes(c || [])
    setLoading(false)
  }, [tenant.id])

  useEffect(() => { cargar() }, [cargar])

  function abrirNuevo(modelo) {
    setForm(modelo
      ? { precio_mensual: modelo.precio_mensual, color: modelo.color, activo: true,
          nombre: modelo.nombre, descripcion: modelo.descripcion, max_usos_mes: modelo.max_usos_mes }
      : { precio_mensual: 100000, color: '#6366f1', activo: true })
    setModal('plan')
  }
  function abrirEditar(p) { setForm({ ...p }); setModal('plan') }

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardarPlan() {
    if (!form.nombre?.trim()) { toast.error('Escribe un nombre'); return }
    setSaving(true)
    const payload = { ...form, tenant_id: tenant.id }
    const { error } = form.id
      ? await supabase.from('membresias_config').update(payload).eq('id', form.id)
      : await supabase.from('membresias_config').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(form.id ? 'Plan actualizado' : 'Plan creado')
    setModal(null)
    cargar()
  }

  async function archivarPlan(id) {
    if (!confirm('¿Desactivar este plan?')) return
    await supabase.from('membresias_config').update({ activo: false }).eq('id', id)
    toast.success('Plan desactivado')
    cargar()
  }

  const updA = (k, v) => setFormAsig(f => ({ ...f, [k]: v }))

  async function guardarAsignacion() {
    if (!formAsig.cliente_id) { toast.error('Selecciona un cliente'); return }
    if (!formAsig.membresia_id) { toast.error('Selecciona un plan'); return }
    setSaving(true)
    const payload = {
      tenant_id: tenant.id,
      cliente_id: formAsig.cliente_id,
      membresia_id: formAsig.membresia_id,
      fecha_inicio: formAsig.fecha_inicio || new Date().toISOString().slice(0,10),
      fecha_vencimiento: formAsig.fecha_vencimiento || null,
      estado: 'activo',
      usos_este_mes: 0,
    }
    const { error } = await supabase.from('membresias_cliente').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Membresía asignada')
    setModal(null)
    cargar()
  }

  const COLORES = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444']

  if (loading) return <div style={S.empty}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={S.h2}>Planes de membresía</h2>
          <p style={S.sub}>Suscripciones mensuales con usos ilimitados o cuotas de servicios incluidos</p>
        </div>
        <button style={S.btn('accent')} onClick={abrirNuevo}>+ Nuevo plan</button>
      </div>

      {/* ── Estrategia: plantillas sugeridas ── */}
      <div style={{ ...S.card, marginBottom: 28, borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowEstrategia(v => !v)}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
              💡 Estrategia de membresías — Modelos sugeridos
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Referencia de cómo estructurar tus planes. Puedes usarlos directamente o adaptarlos.
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1, userSelect: 'none' }}>
            {showEstrategia ? '▲' : '▼'}
          </span>
        </div>

        {showEstrategia && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text)' }}>¿Por qué membresías?</strong>{' '}
              Convierten clientes ocasionales en ingresos fijos mensuales, reducen cancelaciones de último minuto
              y crean un vínculo de compromiso mutuo. Un salón con 20 clientes en plan base genera
              $1.6M fijos cada mes antes de abrir la puerta.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {MODELOS_MEMBRESIA.map(m => (
                <div key={m.nombre} style={{ background: 'var(--card)', border: `2px solid ${m.color}33`,
                  borderTop: `4px solid ${m.color}`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: m.color, marginBottom: 4 }}>{m.nombre}</div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--text)', margin: '6px 0' }}>
                    ${new Intl.NumberFormat('es-CO').format(m.precio_mensual)}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>/mes</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>{m.descripcion}</div>
                  <ul style={{ margin: '0 0 10px', padding: '0 0 0 16px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>
                    {m.beneficios.map(b => <li key={b}>{b}</li>)}
                  </ul>
                  <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
                    borderRadius: 8, padding: '7px 10px', marginBottom: 12, lineHeight: 1.5 }}>
                    💡 {m.tip}
                  </div>
                  <button style={{ ...S.btn('ghost'), width: '100%', fontSize: 12, padding: '7px' }}
                    onClick={() => abrirNuevo(m)}>
                    Usar este modelo →
                  </button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.5 }}>
              Ajusta precios según tu ciudad y mercado. Barranquilla o municipios intermedios: reduce 20–30%.
              Bogotá / Medellín estratos 4–6: puedes subir 30–40%. Siempre inicia con el Plan Base para medir aceptación.
            </p>
          </div>
        )}
      </div>

      {/* Planes disponibles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        {planes.length === 0 && <div style={S.empty}>Sin planes activos</div>}
        {planes.map(p => (
          <div key={p.id} style={{ ...S.card, borderTop: `4px solid ${p.color || '#6366f1'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{p.nombre}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ ...S.btn('ghost'), padding: '4px 10px', fontSize: 12 }} onClick={() => abrirEditar(p)}>Editar</button>
                <button style={{ ...S.btn('ghost'), padding: '4px 10px', fontSize: 12, color: '#ef4444' }} onClick={() => archivarPlan(p.id)}>✕</button>
              </div>
            </div>
            {p.descripcion && <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 10px' }}>{p.descripcion}</p>}
            <div style={{ fontSize: 22, fontWeight: 800, color: p.color || '#6366f1', margin: '8px 0' }}>
              ${fmt(p.precio_mensual)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>/mes</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {p.max_usos_mes ? `${p.max_usos_mes} usos/mes` : 'Usos ilimitados'}
            </div>
          </div>
        ))}
      </div>

      {/* Clientes activos */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Clientes con membresía activa</h3>
          {planes.length > 0 && (
            <button style={{ ...S.btn('accent'), fontSize:13, padding:'6px 14px' }}
              onClick={() => { setFormAsig({ fecha_inicio: new Date().toISOString().slice(0,10), estado:'activo' }); setModal('asignar') }}>
              + Asignar plan
            </button>
          )}
        </div>
        {activos.length === 0 && <div style={S.empty}>Sin membresías activas. Crea un plan y asígnalo a un cliente.</div>}
        {activos.map(m => (
          <div key={m.id} style={{ ...S.card, padding: '14px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{m.clientes_agenda?.nombre || '—'}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)', marginLeft: 12 }}>{m.membresias_config?.nombre}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-3)', alignItems: 'center' }}>
                <span>Usos este mes: <strong style={{ color: 'var(--text)' }}>{m.usos_este_mes}</strong></span>
                {m.fecha_vencimiento && <span>Vence: <strong style={{ color: 'var(--text)' }}>{m.fecha_vencimiento}</strong></span>}
                <span style={S.badge(m.membresias_config?.color || '#6366f1')}>{m.estado}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal === 'asignar' && (
        <Modal title="Asignar membresía a cliente" onClose={() => setModal(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="Cliente">
              <select style={S.input} value={formAsig.cliente_id || ''} onChange={e => updA('cliente_id', e.target.value)}>
                <option value="">— Seleccionar cliente —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` · ${c.telefono}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Plan de membresía">
              <select style={S.input} value={formAsig.membresia_id || ''} onChange={e => updA('membresia_id', e.target.value)}>
                <option value="">— Seleccionar plan —</option>
                {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${fmt(p.precio_mensual)}/mes</option>)}
              </select>
            </Field>
            <div style={S.grid2}>
              <Field label="Fecha inicio">
                <input style={S.input} type="date" value={formAsig.fecha_inicio || ''} onChange={e => updA('fecha_inicio', e.target.value)} />
              </Field>
              <Field label="Fecha vencimiento (opcional)">
                <input style={S.input} type="date" value={formAsig.fecha_vencimiento || ''} onChange={e => updA('fecha_vencimiento', e.target.value)} />
              </Field>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
              <button style={S.btn('ghost')} onClick={() => setModal(null)}>Cancelar</button>
              <button style={S.btn('accent')} onClick={guardarAsignacion} disabled={saving}>{saving ? 'Guardando...' : 'Asignar'}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'plan' && (
        <Modal title={form.id ? 'Editar plan' : 'Nuevo plan'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nombre del plan">
              <input style={S.input} value={form.nombre || ''} onChange={e => upd('nombre', e.target.value)} placeholder="Ej: Plan Básico" />
            </Field>
            <Field label="Descripción (opcional)">
              <input style={S.input} value={form.descripcion || ''} onChange={e => upd('descripcion', e.target.value)} placeholder="Ej: Cortes ilimitados" />
            </Field>
            <div style={S.grid2}>
              <Field label="Precio mensual ($)">
                <input style={S.input} type="number" min={0} value={form.precio_mensual || 0} onChange={e => upd('precio_mensual', +e.target.value)} />
              </Field>
              <Field label="Máx. usos/mes (vacío = ilimitado)">
                <input style={S.input} type="number" min={1} value={form.max_usos_mes || ''} onChange={e => upd('max_usos_mes', e.target.value ? +e.target.value : null)} placeholder="Ilimitado" />
              </Field>
            </div>
            <Field label="Color del plan">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORES.map(c => (
                  <div key={c} onClick={() => upd('color', c)} style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: form.color === c ? '3px solid var(--text)' : '2px solid transparent' }} />
                ))}
              </div>
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button style={S.btn('ghost')} onClick={() => setModal(null)}>Cancelar</button>
              <button style={S.btn('accent')} onClick={guardarPlan} disabled={saving}>{saving ? 'Guardando...' : form.id ? 'Actualizar' : 'Crear plan'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab: Automatizaciones ────────────────────────────────────────────────────
function TabAutomatizaciones({ tenant, toast }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(null)

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('automatizaciones_marketing')
        .select('*').eq('tenant_id', tenant.id)
      const guardadas = Object.fromEntries((data || []).map(d => [d.tipo, d]))
      setItems(AUTOS_META.map(m => ({ ...m.defaults, ...guardadas[m.tipo], tipo: m.tipo, _meta: m })))
      setLoading(false)
    }
    cargar()
  }, [tenant.id])

  const updItem = (tipo, k, v) => setItems(prev => prev.map(i => i.tipo === tipo ? { ...i, [k]: v } : i))

  async function guardarItem(item) {
    setSaving(item.tipo)
    const payload = {
      tenant_id: tenant.id, tipo: item.tipo, activo: item.activo,
      horas_despues_cita: item.horas_despues_cita, dias_sin_visita: item.dias_sin_visita,
      hora_envio: item.hora_envio, descuento_porcentaje: item.descuento_porcentaje,
      mensaje_wa: item.mensaje_wa, pack_descripcion: item.pack_descripcion,
      dias_recordatorio: item.dias_recordatorio,
    }
    const { error } = await supabase.from('automatizaciones_marketing')
      .upsert(payload, { onConflict: 'tenant_id,tipo' })
    setSaving(null)
    if (error) { toast.error(error.message); return }
    toast.success('Automatización guardada')
  }

  async function toggleActivo(item) {
    const next = { ...item, activo: !item.activo }
    updItem(item.tipo, 'activo', !item.activo)
    const payload = { tenant_id: tenant.id, tipo: item.tipo, activo: next.activo, mensaje_wa: item.mensaje_wa || '' }
    await supabase.from('automatizaciones_marketing').upsert(payload, { onConflict: 'tenant_id,tipo' })
    toast.success(next.activo ? 'Activado' : 'Desactivado')
  }

  if (loading) return <div style={S.empty}>Cargando...</div>

  return (
    <div>
      <h2 style={S.h2}>Automatizaciones</h2>
      <p style={S.sub}>Configura mensajes de WhatsApp para momentos clave del cliente</p>

      <div style={{ background:'#fffbe6', border:'1px solid #f5c842', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13 }}>
        <strong>⚙️ Configuración guardada — envío pendiente de integración</strong>
        <p style={{ margin:'6px 0 0', color:'#7a5c00', lineHeight:1.5 }}>
          Los ajustes se guardan aquí, pero el envío automático requiere conectar tu número de WhatsApp Business.
          Contacta a soporte para activar el canal de envío.
        </p>
      </div>

      {items.map(item => {
        const meta = item._meta
        return (
          <div key={item.tipo} style={{ ...S.card, opacity: item.activo ? 1 : .7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: item.activo ? 16 : 0 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.titulo}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{meta.desc}</div>
                </div>
              </div>
              <div style={S.toggle(item.activo)} onClick={() => toggleActivo(item)}><div style={S.dot} /></div>
            </div>

            {item.activo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={S.sep} />
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {item.tipo === 'resena_post_visita' && (
                    <Field label="Enviar N horas después de la cita">
                      <input style={{ ...S.input, width: 100 }} type="number" min={1} value={item.horas_despues_cita || 2}
                        onChange={e => updItem(item.tipo, 'horas_despues_cita', +e.target.value)} />
                    </Field>
                  )}
                  {item.tipo === 'te_extranamos' && (<>
                    <Field label="Sin visita hace (días)">
                      <input style={{ ...S.input, width: 100 }} type="number" min={7} value={item.dias_sin_visita || 90}
                        onChange={e => updItem(item.tipo, 'dias_sin_visita', +e.target.value)} />
                    </Field>
                    <Field label="Descuento a ofrecer (%)">
                      <input style={{ ...S.input, width: 100 }} type="number" min={0} max={80} value={item.descuento_porcentaje || 0}
                        onChange={e => updItem(item.tipo, 'descuento_porcentaje', +e.target.value)} />
                    </Field>
                  </>)}
                  {item.tipo === 'cumpleanos_pack' && (<>
                    <Field label="Descuento (%)">
                      <input style={{ ...S.input, width: 100 }} type="number" min={0} max={80} value={item.descuento_porcentaje || 0}
                        onChange={e => updItem(item.tipo, 'descuento_porcentaje', +e.target.value)} />
                    </Field>
                    <Field label="Descripción del pack">
                      <input style={{ ...S.input, width: 300 }} value={item.pack_descripcion || ''}
                        onChange={e => updItem(item.tipo, 'pack_descripcion', e.target.value)}
                        placeholder="Ej: Servicio + bebida de cortesía" />
                    </Field>
                  </>)}
                  {item.tipo === 'recordatorio_servicio' && (
                    <Field label="Recordar cada (días)">
                      <input style={{ ...S.input, width: 100 }} type="number" min={7} value={item.dias_recordatorio || 30}
                        onChange={e => updItem(item.tipo, 'dias_recordatorio', +e.target.value)} />
                    </Field>
                  )}
                  <Field label="Hora de envío">
                    <input style={{ ...S.input, width: 110 }} type="time" value={item.hora_envio || '10:00'}
                      onChange={e => updItem(item.tipo, 'hora_envio', e.target.value)} />
                  </Field>
                </div>

                <Field label="Mensaje de WhatsApp">
                  <textarea style={S.textarea} value={item.mensaje_wa || ''} onChange={e => updItem(item.tipo, 'mensaje_wa', e.target.value)} />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Variables: {'{{nombre}}'} {'{{negocio}}'} {'{{descuento}}'} {'{{dias}}'} {'{{servicio}}'} {'{{pack}}'} {'{{link_resena}}'}
                  </div>
                </Field>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={S.btn('accent')} onClick={() => guardarItem(item)} disabled={saving === item.tipo}>
                    {saving === item.tipo ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function SalonMarketing() {
  const { tenant } = useTenant()
  const toast = useToast()
  const [tab, setTab] = useState('campanas')

  const TABS = [
    { key: 'campanas',       label: '📣 Campañas'       },
    { key: 'fidelizacion',   label: '🎟 Fidelización'   },
    { key: 'membresias',     label: '💎 Membresías'     },
    { key: 'automatizaciones', label: '⚡ Automatizaciones' },
  ]

  return (
    <div className="sp-page">
      <div style={S.page}>
        <div style={S.tabs}>
          {TABS.map(t => (
            <button key={t.key} style={S.tab(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {tab === 'campanas'         && <TabCampanas       tenant={tenant} toast={toast} />}
        {tab === 'fidelizacion'     && <TabFidelizacion   tenant={tenant} toast={toast} />}
        {tab === 'membresias'       && <TabMembresias     tenant={tenant} toast={toast} />}
        {tab === 'automatizaciones' && <TabAutomatizaciones tenant={tenant} toast={toast} />}
      </div>
    </div>
  )
}
