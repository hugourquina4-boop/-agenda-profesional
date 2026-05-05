import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const ESTADO_STYLE = {
  pendiente:  { dot: '#f59e0b', bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400' },
  confirmada: { dot: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-500/10',     text: 'text-blue-700 dark:text-blue-400' },
  completada: { dot: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-500/10',text: 'text-emerald-700 dark:text-emerald-400' },
  cancelada:  { dot: '#ef4444', bg: 'bg-red-50 dark:bg-red-500/10',        text: 'text-red-600 dark:text-red-400' },
  no_asistio: { dot: '#94a3b8', bg: 'bg-gray-100 dark:bg-slate-800',       text: 'text-gray-500 dark:text-slate-400' },
}

function hhmm(d) {
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function fechaCorta(d) {
  return new Date(d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function MiAgenda() {
  const { tenant, profesionalId } = useTenant()
  const [tab,     setTab]     = useState('hoy')   // 'hoy' | 'semana'
  const [citas,   setCitas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sel,     setSel]     = useState(null)     // cita seleccionada
  const [notas,   setNotas]   = useState([])       // historial técnico del cliente
  const [nuevaNota, setNuevaNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)
  const [prof,    setProf]    = useState(null)

  useEffect(() => {
    if (tenant?.id && profesionalId) { cargarPerfil(); cargar() }
  }, [tenant, profesionalId, tab])

  async function cargarPerfil() {
    const { data } = await supabase
      .from('profesionales').select('*').eq('id', profesionalId).single()
    setProf(data)
  }

  async function cargar() {
    if (!profesionalId) return
    setLoading(true)
    const ahora = new Date()
    const hoy   = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    const desde = hoy.toISOString()
    const hasta = tab === 'hoy'
      ? new Date(hoy.getTime() + 86400000).toISOString()
      : new Date(hoy.getTime() + 7 * 86400000).toISOString()

    const { data } = await supabase
      .from('citas')
      .select(`id, fecha_inicio, fecha_fin, estado, notas,
               cliente:clientes_agenda(id, nombre, telefono, whatsapp, notas, fecha_nacimiento),
               servicio:servicios(nombre, duracion_min, categoria),
               cita_servicios(servicio:servicios(nombre), variante:variantes_servicio(nombre), duracion, precio)`)
      .eq('tenant_id', tenant.id)
      .eq('profesional_id', profesionalId)
      .gte('fecha_inicio', desde)
      .lt('fecha_inicio', hasta)
      .neq('estado', 'cancelada')
      .order('fecha_inicio')
    setCitas(data || [])
    setLoading(false)
  }

  async function abrirCita(cita) {
    setSel(cita)
    setNuevaNota('')
    if (!cita.cliente?.id) return
    const { data } = await supabase
      .from('historial_tecnico')
      .select('*')
      .eq('cliente_id', cita.cliente.id)
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setNotas(data || [])
  }

  async function guardarNota() {
    if (!nuevaNota.trim() || !sel) return
    setSavingNota(true)
    await supabase.from('historial_tecnico').insert({
      tenant_id:      tenant.id,
      cliente_id:     sel.cliente.id,
      cita_id:        sel.id,
      profesional_id: profesionalId,
      notas:          { observaciones: nuevaNota },
    })
    setSavingNota(false)
    setNuevaNota('')
    abrirCita(sel)
  }

  async function marcarCompletada(cita) {
    await supabase.rpc('completar_cita', { p_cita_id: cita.id })
    cargar()
    if (sel?.id === cita.id) setSel(prev => prev ? { ...prev, estado: 'completada' } : null)
  }

  const ahora     = new Date()
  const hoy       = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const col       = prof?.color || tenant?.color_primario || '#3b82f6'
  const pendientes = citas.filter(c => c.estado !== 'completada').length
  const completadas= citas.filter(c => c.estado === 'completada').length

  const greeting = ahora.getHours() < 12 ? 'Buenos días' : ahora.getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

  if (!profesionalId) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
      <div className="text-4xl">🔗</div>
      <p className="text-gray-500 dark:text-slate-400 text-sm">
        Tu usuario no está vinculado a un perfil profesional.<br />
        Pide al administrador que te asigne en el panel de Equipo.
      </p>
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header del profesional */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
            style={{ background: prof?.foto_url ? undefined : `linear-gradient(135deg, ${col}, ${col}99)` }}>
            {prof?.foto_url
              ? <img src={prof.foto_url} className="w-full h-full object-cover" alt="" />
              : prof?.nombre?.[0]?.toUpperCase()
            }
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500">{greeting},</p>
            <p className="font-bold text-gray-900 dark:text-white leading-tight">{prof?.nombre}</p>
          </div>
          <div className="ml-auto flex gap-3 text-right">
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{pendientes}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">pendientes</p>
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: col }}>{completadas}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">listas</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {[['hoy','Hoy'],['semana','Esta semana']].map(([v,l]) => (
            <button key={v} onClick={() => { setTab(v); setSel(null) }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === v
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-hidden flex">

        {/* Lista de citas */}
        <div className={`flex-shrink-0 overflow-y-auto transition-all ${sel ? 'hidden sm:flex sm:flex-col w-full sm:w-72 border-r border-gray-100 dark:border-slate-800' : 'flex flex-col w-full'}`}>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: col, borderTopColor: 'transparent' }} />
            </div>
          ) : citas.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="text-4xl mb-2">✨</div>
              <p className="text-gray-400 dark:text-slate-500 text-sm">
                {tab === 'hoy' ? 'No tienes citas hoy' : 'No tienes citas esta semana'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-800/60">
              {citas.map(c => {
                const est   = ESTADO_STYLE[c.estado] || ESTADO_STYLE.pendiente
                const inicio = new Date(c.fecha_inicio)
                const fin    = new Date(c.fecha_fin)
                const activa = inicio <= ahora && fin >= ahora
                const esHoy  = inicio >= hoy && inicio < new Date(hoy.getTime() + 86400000)
                return (
                  <button key={c.id} onClick={() => abrirCita(c)}
                    className={`w-full text-left px-4 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/40 ${
                      sel?.id === c.id ? 'bg-gray-100 dark:bg-slate-800' : ''
                    } ${activa ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Indicador estado */}
                      <div className="mt-1 flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: est.dot }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{c.cliente?.nombre}</p>
                          <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0 font-medium">
                            {hhmm(c.fecha_inicio)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {c.servicio?.nombre}
                          {c.cita_servicios?.length > 1 && ` +${c.cita_servicios.length - 1}`}
                        </p>
                        {!esHoy && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{fechaCorta(c.fecha_inicio)}</p>
                        )}
                        {activa && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${col}18`, color: col }}>
                            En curso
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel detalle de cita */}
        {sel && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900 sm:bg-transparent">
            {/* Header panel */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
              <button onClick={() => setSel(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-500 dark:text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white truncate">{sel.cliente?.nombre}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {hhmm(sel.fecha_inicio)} — {hhmm(sel.fecha_fin)}
                </p>
              </div>
              {sel.estado !== 'completada' && (
                <button onClick={() => marcarCompletada(sel)}
                  className="text-xs px-3 py-2 rounded-xl text-white font-medium shadow transition-all hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
                  Completar ✓
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Info cita */}
              <div className="px-4 py-4 space-y-3 border-b border-gray-100 dark:border-slate-800">
                {sel.cita_servicios?.length > 0
                  ? sel.cita_servicios.map((cs, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {cs.servicio?.nombre}
                        {cs.variante?.nombre && <span className="text-gray-400 dark:text-slate-500 font-normal"> · {cs.variante.nombre}</span>}
                      </p>
                      <div className="text-right text-xs text-gray-400 dark:text-slate-500">
                        {cs.duracion} min{cs.precio > 0 && ` · $${Number(cs.precio).toLocaleString('es-CO')}`}
                      </div>
                    </div>
                  ))
                  : (
                    <p className="text-sm text-gray-700 dark:text-slate-300">{sel.servicio?.nombre}</p>
                  )
                }
                {sel.notas && (
                  <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">📋 Nota de la cita</p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">{sel.notas}</p>
                  </div>
                )}
              </div>

              {/* Info cliente */}
              <div className="px-4 py-4 border-b border-gray-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Cliente</p>
                <div className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
                  {sel.cliente?.telefono && <p>📱 {sel.cliente.telefono}</p>}
                  {sel.cliente?.fecha_nacimiento && (
                    <p>🎂 {new Date().getFullYear() - new Date(sel.cliente.fecha_nacimiento).getFullYear()} años</p>
                  )}
                  {sel.cliente?.notas && (
                    <div className="mt-2 bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                      <p className="text-xs text-gray-500 dark:text-slate-400">{sel.cliente.notas}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Historial técnico */}
              <div className="px-4 py-4 border-b border-gray-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                  Historial técnico ({notas.length})
                </p>
                {notas.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Primera vez — sin historial</p>
                ) : (
                  <div className="space-y-3">
                    {notas.map(n => (
                      <div key={n.id} className="bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-3">
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
                          {new Date(n.created_at).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' })}
                        </p>
                        {Object.entries(n.notas || {}).filter(([,v]) => v).map(([k, v]) => (
                          <p key={k} className="text-xs text-gray-700 dark:text-slate-300">
                            <span className="text-gray-400 dark:text-slate-500 capitalize">{k.replace(/_/g,' ')}: </span>{v}
                          </p>
                        ))}
                        {n.proxima_visita && (
                          <p className="text-xs mt-1" style={{ color: col }}>
                            📆 Próxima: {new Date(n.proxima_visita).toLocaleDateString('es-CO', { day:'numeric', month:'short' })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agregar nota rápida */}
              <div className="px-4 py-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Agregar observación</p>
                <textarea
                  value={nuevaNota}
                  onChange={e => setNuevaNota(e.target.value)}
                  placeholder="Fórmula, resultado, observación..."
                  rows={3}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors resize-none placeholder-gray-400 dark:placeholder-slate-500"
                />
                <button onClick={guardarNota} disabled={savingNota || !nuevaNota.trim()}
                  className="w-full mt-2 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 shadow"
                  style={{ background: `linear-gradient(135deg, ${col}, ${col}bb)` }}>
                  {savingNota ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
