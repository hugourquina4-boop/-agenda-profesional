import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

function Ico({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const TEMPLATES = [
  {
    id: 'reactivar',
    titulo: 'Te extrañamos',
    emoji: '💐',
    texto: 'Hola {{nombre}}! Te extrañamos en {{negocio}} 🌸 Hace un tiempo no te vemos. ¿Qué tal si agendamos una cita esta semana? Escríbenos y te buscamos el mejor horario.',
  },
  {
    id: 'cumple',
    titulo: 'Cumpleaños',
    emoji: '🎂',
    texto: '¡Feliz cumpleaños {{nombre}}! 🎉 En {{negocio}} celebramos contigo. Por tu día especial tienes un descuento exclusivo en tu próxima visita. ¡Te esperamos!',
  },
  {
    id: 'promo',
    titulo: 'Promoción especial',
    emoji: '✨',
    texto: 'Hola {{nombre}}! En {{negocio}} tenemos una promoción especial esta semana. ¡Aprovecha nuestras ofertas y agenda tu cita ahora! 💅',
  },
  {
    id: 'recordatorio',
    titulo: 'Recordatorio de cita',
    emoji: '📅',
    texto: 'Hola {{nombre}}! Te recordamos que tienes una cita en {{negocio}}. Si necesitas cambiar el horario, escríbenos con tiempo. ¡Te esperamos! 😊',
  },
  {
    id: 'nuevo_servicio',
    titulo: 'Nuevo servicio',
    emoji: '🆕',
    texto: 'Hola {{nombre}}! 🎊 En {{negocio}} acabamos de lanzar un nuevo servicio que te va a encantar. ¡Contáctanos y cuéntanos qué te parece!',
  },
  {
    id: 'gracias',
    titulo: 'Gracias por tu visita',
    emoji: '🙏',
    texto: 'Hola {{nombre}}! Gracias por visitarnos en {{negocio}} 💖 Fue un placer atenderte. ¡Esperamos verte pronto! Si tienes un momento, nos encantaría conocer tu opinión.',
  },
]

const FILTROS = [
  { key: 'todos',        label: 'Todos'             },
  { key: 'cumple',       label: 'Cumpleaños 30d'    },
  { key: 'cumple_semana',label: 'Cumple esta semana' },
  { key: 'sin_visita',   label: 'Sin visita 30d'    },
  { key: 'sin_visita_60',label: 'Sin visita 60d'    },
  { key: 'servicio',     label: 'Por servicio'      },
]

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function isCumpleProximo(fechaNac) {
  if (!fechaNac) return false
  const hoyDate = new Date()
  const [, mesNac, diaNac] = fechaNac.split('-').map(Number)
  const proxCumple = new Date(hoyDate.getFullYear(), mesNac - 1, diaNac)
  if (proxCumple < hoyDate) proxCumple.setFullYear(hoyDate.getFullYear() + 1)
  const diff = (proxCumple - hoyDate) / (1000 * 60 * 60 * 24)
  return diff <= 30
}

function sinVisita30d(ultimaVisita) {
  if (!ultimaVisita) return true
  const diff = (new Date() - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24)
  return diff >= 30
}

function sinVisita60d(ultimaVisita) {
  if (!ultimaVisita) return true
  const diff = (new Date() - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24)
  return diff >= 60
}

function isCumpleEstaSemana(fechaNac) {
  if (!fechaNac) return false
  const hoyDate = new Date()
  const [, mesNac, diaNac] = fechaNac.split('-').map(Number)
  const proxCumple = new Date(hoyDate.getFullYear(), mesNac - 1, diaNac)
  if (proxCumple < hoyDate) proxCumple.setFullYear(hoyDate.getFullYear() + 1)
  const diff = (proxCumple - hoyDate) / (1000 * 60 * 60 * 24)
  return diff <= 7
}

export default function SalonMensajeria() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [clientes,       setClientes]       = useState([])
  const [servicios,      setServicios]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filtro,         setFiltro]         = useState('todos')
  const [filtroServicio, setFiltroServicio] = useState('')
  const [buscar,         setBuscar]         = useState('')
  const [sheetOpen,      setSheetOpen]      = useState(false)
  const [clienteSel,     setClienteSel]     = useState(null)
  const [enviados,       setEnviados]       = useState({})
  const [plantillas,     setPlantillas]     = useState([])
  const [editMode,       setEditMode]       = useState(false)
  const [draftPl,        setDraftPl]        = useState([])
  const [savingPl,       setSavingPl]       = useState(false)
  const [campanaOpen,    setCampanaOpen]    = useState(false)
  const [enviandoCampana, setEnviandoCampana] = useState(false)
  const [resultadoCampana, setResultadoCampana] = useState(null)
  const [metricas,       setMetricas]       = useState(null)
  const [metricasOpen,   setMetricasOpen]   = useState(false)

  const cargarPlantillas = useCallback(async () => {
    if (!tenant?.id) return
    const { data } = await supabase
      .from('plantillas_mensajeria')
      .select('id, titulo, emoji, texto, orden')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('orden')
    setPlantillas(data && data.length ? data : [])
  }, [tenant?.id])

  async function guardarPlantillas() {
    setSavingPl(true)
    await supabase.from('plantillas_mensajeria').delete().eq('tenant_id', tenant.id)
    if (draftPl.length) {
      await supabase.from('plantillas_mensajeria').insert(
        draftPl.map((p, i) => ({
          tenant_id: tenant.id,
          titulo: p.titulo, emoji: p.emoji, texto: p.texto, orden: i, activo: true,
        }))
      )
    }
    await cargarPlantillas()
    setSavingPl(false)
    setEditMode(false)
  }

  const cargar = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    const [{ data: clientesData }, { data: citasData }] = await Promise.all([
      supabase
        .from('clientes_agenda')
        .select('id, nombre, telefono, fecha_nacimiento, tipo_precio, notas')
        .eq('tenant_id', tenant.id)
        .eq('activo', true)
        .order('nombre'),
      supabase
        .from('citas')
        .select('cliente_id, fecha_inicio, servicios(nombre)')
        .eq('tenant_id', tenant.id)
        .eq('estado', 'completada')
        .order('fecha_inicio', { ascending: false }),
    ])
    // Compute ultima_visita and servicios_usados per client
    const ultimaVisita = {}
    const svcsUsados = {}
    ;(citasData || []).forEach(c => {
      if (!c.cliente_id) return
      if (!ultimaVisita[c.cliente_id]) ultimaVisita[c.cliente_id] = c.fecha_inicio
      const sn = c.servicios?.nombre
      if (sn) {
        if (!svcsUsados[c.cliente_id]) svcsUsados[c.cliente_id] = new Set()
        svcsUsados[c.cliente_id].add(sn)
      }
    })
    const merged = (clientesData || []).map(c => ({
      ...c,
      ultima_visita:   ultimaVisita[c.id] || null,
      servicios_usados: svcsUsados[c.id] ? [...svcsUsados[c.id]] : [],
    }))
    setClientes(merged)
    const allSvcs = new Set()
    merged.forEach(c => c.servicios_usados.forEach(s => allSvcs.add(s)))
    setServicios([...allSvcs].sort())
    setLoading(false)
  }, [tenant?.id])

  const cargarMetricas = useCallback(async () => {
    if (!tenant?.id) return
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: logs }, { data: citas30 }] = await Promise.all([
      supabase
        .from('wa_envios_log')
        .select('tipo')
        .eq('tenant_id', tenant.id)
        .gte('created_at', hace30),
      // Citas de los últimos 30 días ya pasadas (completadas o no_asistio) para comparar no-show
      supabase
        .from('citas')
        .select('estado, recordatorio_24h_enviado')
        .eq('tenant_id', tenant.id)
        .in('estado', ['completada', 'no_asistio'])
        .gte('fecha_inicio', hace30),
    ])

    // Conteo de envíos por tipo
    const porTipo = { confirmacion: 0, recordatorio_24h: 0, recordatorio_1h: 0, cumpleanos: 0, campana: 0, agente: 0 }
    ;(logs || []).forEach(l => { if (l.tipo in porTipo) porTipo[l.tipo]++ })
    const totalEnvios = (logs || []).length

    // No-show: con recordatorio vs sin recordatorio
    let conRecTotal = 0, conRecNoShow = 0, sinRecTotal = 0, sinRecNoShow = 0
    ;(citas30 || []).forEach(c => {
      const noShow = c.estado === 'no_asistio'
      if (c.recordatorio_24h_enviado) {
        conRecTotal++; if (noShow) conRecNoShow++
      } else {
        sinRecTotal++; if (noShow) sinRecNoShow++
      }
    })
    const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : null

    setMetricas({
      porTipo,
      totalEnvios,
      noshow: {
        conRec: { total: conRecTotal, noShow: conRecNoShow, pct: pct(conRecNoShow, conRecTotal) },
        sinRec: { total: sinRecTotal, noShow: sinRecNoShow, pct: pct(sinRecNoShow, sinRecTotal) },
      },
    })
  }, [tenant?.id])

  useEffect(() => { cargar(); cargarPlantillas(); cargarMetricas() }, [cargar, cargarPlantillas, cargarMetricas])

  const clientesFiltrados = clientes.filter(c => {
    const telefono = c.telefono?.replace(/\D/g, '') || ''
    if (!telefono) return false
    if (buscar && !c.nombre.toLowerCase().includes(buscar.toLowerCase())) return false
    if (filtro === 'cumple')        return isCumpleProximo(c.fecha_nacimiento)
    if (filtro === 'cumple_semana') return isCumpleEstaSemana(c.fecha_nacimiento)
    if (filtro === 'sin_visita')    return sinVisita30d(c.ultima_visita)
    if (filtro === 'sin_visita_60') return sinVisita60d(c.ultima_visita)
    if (filtro === 'servicio')      return filtroServicio ? c.servicios_usados.includes(filtroServicio) : true
    return true
  })

  function contarFiltro(key) {
    return clientes.filter(c => {
      if (!c.telefono?.replace(/\D/g,'')) return false
      if (key === 'todos')      return true
      if (key === 'cumple')        return isCumpleProximo(c.fecha_nacimiento)
      if (key === 'cumple_semana') return isCumpleEstaSemana(c.fecha_nacimiento)
      if (key === 'sin_visita')    return sinVisita30d(c.ultima_visita)
      if (key === 'sin_visita_60') return sinVisita60d(c.ultima_visita)
      if (key === 'servicio')      return filtroServicio ? c.servicios_usados.includes(filtroServicio) : true
      return false
    }).length
  }

  function abrirSheet(cliente) {
    setClienteSel(cliente)
    setSheetOpen(true)
  }

  function sustituir(texto, cliente) {
    return texto
      .replace(/{{nombre}}/g, cliente.nombre.split(' ')[0])
      .replace(/{{negocio}}/g, tenant?.nombre || 'el salón')
      .replace(/{{direccion}}/g, tenant?.direccion || '')
  }

  function enviarWA(template) {
    if (!clienteSel) return
    const texto = sustituir(template.texto, clienteSel)
    const tel = clienteSel.telefono.replace(/\D/g, '')
    const num = tel.startsWith('57') ? tel : `57${tel}`
    const url = `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank', 'noopener')
    setEnviados(e => ({ ...e, [clienteSel.id]: true }))
    setSheetOpen(false)
  }

  async function enviarCampanaMasiva(template) {
    if (!clientesFiltrados.length || enviandoCampana) return
    setEnviandoCampana(true)
    setResultadoCampana(null)
    const { data, error } = await supabase.functions.invoke('enviar-campana', {
      body: {
        tenant_id: tenant.id,
        mensaje:   template.texto,
        clientes:  clientesFiltrados.map(c => ({
          id:       c.id,
          telefono: c.telefono,
          nombre:   c.nombre,
        })),
      },
    })
    setEnviandoCampana(false)
    if (error || data?.error) {
      setResultadoCampana({ error: data?.error || 'Error al enviar la campaña' })
    } else {
      setResultadoCampana({ enviados: data.enviados, fallidos: data.fallidos })
      const map = {}
      clientesFiltrados.forEach(c => { map[c.id] = true })
      setEnviados(e => ({ ...e, ...map }))
    }
    setCampanaOpen(false)
  }

  return (
    <div className="sp-page" style={{ padding: '0 0 20px' }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <h2 style={{
          fontFamily: 'Outfit', fontWeight: 800, fontSize: 22,
          color: 'var(--text)', margin: 0, letterSpacing: '-0.3px',
        }}>
          Mensajería
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
          Envía mensajes WA a tus clientes
        </p>
      </div>

      {/* Métricas de WhatsApp (últimos 30 días) */}
      {metricas && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <button
              onClick={() => setMetricasOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📊</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  WhatsApp · últimos 30 días
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: col,
                  background: `${col}1a`, borderRadius: 8, padding: '2px 8px',
                }}>
                  {metricas.totalEnvios} envíos
                </span>
              </span>
              <span style={{
                color: 'var(--text-3)', fontSize: 12,
                transform: metricasOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
              }}>▼</span>
            </button>

            {metricasOpen && (
              <div style={{ padding: '0 16px 16px' }}>
                {/* Envíos automáticos por tipo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { k: 'confirmacion',     label: 'Confirmaciones',   emoji: '✅' },
                    { k: 'recordatorio_24h', label: 'Recordatorio 24h', emoji: '📅' },
                    { k: 'recordatorio_1h',  label: 'Recordatorio 1h',  emoji: '⏰' },
                    { k: 'cumpleanos',       label: 'Cumpleaños',       emoji: '🎂' },
                    { k: 'campana',          label: 'Campañas',         emoji: '📢' },
                    { k: 'agente',           label: 'Agente IA',        emoji: '🤖' },
                  ].map(({ k, label, emoji }) => (
                    <div key={k} style={{
                      background: 'var(--bg)', borderRadius: 10, padding: '10px 12px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 16 }}>{emoji}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', lineHeight: 1 }}>
                          {metricas.porTipo[k] || 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparación de no-show: con vs sin recordatorio */}
                <div style={{
                  borderTop: '1px solid var(--border)', paddingTop: 12,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: '0 0 8px' }}>
                    Impacto en inasistencias (no-show)
                  </p>
                  {(metricas.noshow.conRec.total + metricas.noshow.sinRec.total) === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                      Aún no hay suficientes citas pasadas para comparar.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { d: metricas.noshow.conRec, label: 'Con recordatorio', good: true },
                        { d: metricas.noshow.sinRec, label: 'Sin recordatorio', good: false },
                      ].map(({ d, label, good }) => {
                        const clr = d.pct === null ? 'var(--text-3)'
                          : d.pct >= 20 ? '#ef4444' : d.pct >= 10 ? '#f59e0b' : '#22c55e'
                        return (
                          <div key={label} style={{
                            background: 'var(--bg)', borderRadius: 10, padding: '10px 12px',
                            border: `1px solid ${good ? '#22c55e33' : 'var(--border)'}`,
                          }}>
                            <div style={{ fontWeight: 800, fontSize: 20, color: clr, lineHeight: 1 }}>
                              {d.pct === null ? '—' : `${d.pct}%`}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{label}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                              {d.noShow} de {d.total} faltaron
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {metricas.noshow.conRec.pct !== null && metricas.noshow.sinRec.pct !== null &&
                   metricas.noshow.sinRec.pct > metricas.noshow.conRec.pct && (
                    <p style={{ fontSize: 11, color: '#22c55e', margin: '8px 0 0', fontWeight: 600 }}>
                      ✓ El recordatorio reduce el no-show en {metricas.noshow.sinRec.pct - metricas.noshow.conRec.pct} puntos.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buscador */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-3)', pointerEvents: 'none',
          }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={16} />
          </span>
          <input
            className="sp-input"
            placeholder="Buscar cliente…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="sp-tabs-scroll" style={{
        gap: 8, padding: '0 16px 10px',
        scrollbarWidth: 'none',
      }}>
        {FILTROS.map(f => {
          const count = contarFiltro(f.key)
          const active = filtro === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 20,
                display: 'flex', alignItems: 'center', gap: 6,
                border: `1.5px solid ${active ? col : 'var(--border)'}`,
                background: active ? `${col}18` : 'var(--card)',
                color: active ? col : 'var(--text-2)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center',
                padding: '1px 5px', borderRadius: 10,
                background: active ? col : 'rgba(128,128,128,0.15)',
                color: active ? '#fff' : 'var(--text-3)',
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Selector de servicio */}
      {filtro === 'servicio' && (
        <div style={{ padding: '0 16px 10px' }}>
          <select
            value={filtroServicio}
            onChange={e => setFiltroServicio(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 11,
              border: '1.5px solid var(--border)', background: 'var(--card)',
              color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">— Todos los servicios ({servicios.length} tipos) —</option>
            {servicios.map(s => {
              const n = clientes.filter(c => c.servicios_usados.includes(s) && c.telefono?.replace(/\D/g,'')).length
              return <option key={s} value={s}>{s} ({n})</option>
            })}
          </select>
        </div>
      )}

      {/* Stats + Campaña masiva */}
      <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''} con teléfono
          {Object.keys(enviados).length > 0 && (
            <span style={{ marginLeft: 8, color: col, fontWeight: 600 }}>
              · {Object.keys(enviados).length} enviado{Object.keys(enviados).length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        {clientesFiltrados.length > 0 && (
          <button
            onClick={() => { setResultadoCampana(null); setCampanaOpen(true) }}
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 20,
              border: `1.5px solid ${col}60`, background: `${col}15`,
              color: col, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📢 Campaña masiva
          </button>
        )}
      </div>

      {/* Resultado de campaña */}
      {resultadoCampana && (
        <div style={{
          margin: '0 16px 12px', padding: '12px 14px', borderRadius: 12,
          background: resultadoCampana.error ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${resultadoCampana.error ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
          fontSize: 13, color: resultadoCampana.error ? '#ef4444' : '#16a34a', fontWeight: 600,
        }}>
          {resultadoCampana.error
            ? `⚠️ ${resultadoCampana.error}`
            : `✅ Campaña enviada — ${resultadoCampana.enviados} enviados${resultadoCampana.fallidos > 0 ? `, ${resultadoCampana.fallidos} fallidos` : ''}`
          }
        </div>
      )}

      {/* Lista clientes */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="sp-spinner" />
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 24px',
          color: 'var(--text-3)', fontSize: 14,
        }}>
          {buscar ? 'No hay clientes que coincidan.' : 'No hay clientes con teléfono en este filtro.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 16px' }}>
          {clientesFiltrados.map(c => {
            const yaEnviado = enviados[c.id]
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 14,
                background: 'var(--card)', border: '1px solid var(--border)',
                marginBottom: 6,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `${col}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Outfit', fontWeight: 800, fontSize: 16, color: col,
                }}>
                  {c.nombre[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 14, color: 'var(--text)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {c.nombre}
                    {c.tipo_precio === 'mayorista' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px',
                        borderRadius: 4, background: `${col}20`, color: col,
                        letterSpacing: 0.5,
                      }}>MAYOR</span>
                    )}
                    {isCumpleProximo(c.fecha_nacimiento) && (
                      <span style={{ fontSize: 13 }}>🎂</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
                    {c.telefono}
                    {c.ultima_visita && (
                      <span style={{ marginLeft: 6 }}>
                        · última visita {formatFecha(c.ultima_visita)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón WA */}
                <button
                  onClick={() => abrirSheet(c)}
                  style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: 11,
                    background: yaEnviado ? 'rgba(34,197,94,0.12)' : `${col}18`,
                    border: `1.5px solid ${yaEnviado ? 'rgba(34,197,94,0.3)' : `${col}40`}`,
                    color: yaEnviado ? '#22c55e' : col,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  title="Enviar mensaje WA"
                >
                  <Ico d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" size={18} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Sheet: Campaña masiva */}
      {campanaOpen && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setCampanaOpen(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">📢 Campaña masiva</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
              Elige una plantilla para enviar a los{' '}
              <strong style={{ color: col }}>{clientesFiltrados.length} clientes</strong>{' '}
              del filtro activo vía WhatsApp API.
            </p>

            {enviandoCampana ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                <div className="sp-spinner" />
                <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Enviando mensajes…</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(plantillas.length ? plantillas : TEMPLATES).map((t, idx) => (
                  <button
                    key={t.id || idx}
                    onClick={() => enviarCampanaMasiva(t)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                      background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.12)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{t.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{t.titulo}</span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {t.texto.replace(/{{nombre}}/g, 'Cliente').replace(/{{negocio}}/g, tenant?.nombre || 'el salón')}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setCampanaOpen(false)}
              style={{
                marginTop: 14, width: '100%', padding: '13px', borderRadius: 14,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-3)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Sheet plantillas */}
      {sheetOpen && clienteSel && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setSheetOpen(false); setEditMode(false) }} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />

            {/* ── Vista: editar plantillas ──────────────────────────────────── */}
            {editMode ? (<>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <p className="sp-sheet-title" style={{ margin:0 }}>Personalizar plantillas</p>
                <button onClick={() => setEditMode(false)}
                  style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:13 }}>
                  ← Volver
                </button>
              </div>
              <p style={{ fontSize:12, color:'var(--text-3)', margin:'0 0 14px' }}>
                Variables: <code style={{ background:'rgba(128,128,128,0.1)', borderRadius:4, padding:'1px 4px' }}>{'{{nombre}}'}</code>{' '}
                <code style={{ background:'rgba(128,128,128,0.1)', borderRadius:4, padding:'1px 4px' }}>{'{{negocio}}'}</code>{' '}
                <code style={{ background:'rgba(128,128,128,0.1)', borderRadius:4, padding:'1px 4px' }}>{'{{direccion}}'}</code>
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {draftPl.map((p, i) => (
                  <div key={i} style={{
                    background:'rgba(128,128,128,0.05)', border:'1px solid var(--border)',
                    borderRadius:14, padding:'12px 14px',
                  }}>
                    <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                      <input
                        value={p.emoji}
                        onChange={e => setDraftPl(d => d.map((x,j) => j===i ? {...x,emoji:e.target.value} : x))}
                        style={{ width:40, textAlign:'center', background:'var(--bg)', border:'1px solid var(--border)',
                          borderRadius:8, padding:'6px 4px', fontSize:16 }}
                      />
                      <input
                        value={p.titulo}
                        onChange={e => setDraftPl(d => d.map((x,j) => j===i ? {...x,titulo:e.target.value} : x))}
                        placeholder="Título"
                        style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)',
                          borderRadius:8, padding:'6px 10px', fontSize:13, color:'var(--text)' }}
                      />
                      <button onClick={() => setDraftPl(d => d.filter((_,j) => j!==i))}
                        style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:'0 4px', fontSize:18, lineHeight:1 }}>
                        ×
                      </button>
                    </div>
                    <textarea
                      value={p.texto}
                      onChange={e => setDraftPl(d => d.map((x,j) => j===i ? {...x,texto:e.target.value} : x))}
                      rows={3}
                      style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)',
                        borderRadius:8, padding:'8px 10px', fontSize:12, color:'var(--text)',
                        resize:'vertical', boxSizing:'border-box', lineHeight:1.5 }}
                    />
                  </div>
                ))}

                <button onClick={() => setDraftPl(d => [...d, { emoji:'💬', titulo:'Nueva plantilla', texto:'Hola {{nombre}}!' }])}
                  style={{ padding:'11px', borderRadius:12, border:`1.5px dashed ${col}60`,
                    background:'transparent', color:col, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  + Nueva plantilla
                </button>
              </div>

              <button onClick={guardarPlantillas} disabled={savingPl}
                style={{ marginTop:14, width:'100%', padding:'14px', borderRadius:14, border:'none',
                  background:`linear-gradient(135deg, ${col}, ${col}bb)`, color:'#fff',
                  fontWeight:700, fontSize:15, cursor:'pointer', opacity:savingPl ? 0.7 : 1 }}>
                {savingPl ? 'Guardando…' : 'Guardar plantillas'}
              </button>
            </>) : (<>

              {/* ── Vista: elegir plantilla ───────────────────────────────────── */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <p className="sp-sheet-title" style={{ margin:0 }}>
                  Mensaje para {clienteSel.nombre.split(' ')[0]}
                </p>
                <button
                  onClick={() => { setDraftPl(plantillas.length ? plantillas.map(p => ({...p})) : TEMPLATES.map(t => ({...t}))); setEditMode(true) }}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:12,
                    color:col, fontWeight:600, padding:'4px 8px' }}>
                  ✏️ Editar
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
                Elige una plantilla para enviar por WhatsApp
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(plantillas.length ? plantillas : TEMPLATES).map((t, idx) => (
                  <button
                    key={t.id || idx}
                    onClick={() => enviarWA(t)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      padding: '14px 16px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                      background: 'rgba(128,128,128,0.06)',
                      border: '1px solid rgba(128,128,128,0.12)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = col + '60'
                      e.currentTarget.style.background = col + '10'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(128,128,128,0.12)'
                      e.currentTarget.style.background = 'rgba(128,128,128,0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{t.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                        {t.titulo}
                      </span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: 'var(--text-3)',
                      lineHeight: 1.5,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {sustituir(t.texto, clienteSel)}
                    </p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSheetOpen(false)}
                style={{
                  marginTop: 14, width: '100%', padding: '13px',
                  borderRadius: 14, background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-3)', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </>)}
          </div>
        </>
      )}
    </div>
  )
}
