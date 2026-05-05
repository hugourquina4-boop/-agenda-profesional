import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

const ESTADO_CONFIG = {
  pendiente:  { label:'Pendiente',   color:'#f59e0b', bg:'#fef3c7', ring:'#fcd34d' },
  confirmada: { label:'Confirmada',  color:'#10b981', bg:'#d1fae5', ring:'#6ee7b7' },
  completada: { label:'Completada',  color:'#6366f1', bg:'#ede9fe', ring:'#a5b4fc' },
  cancelada:  { label:'Cancelada',   color:'#ef4444', bg:'#fee2e2', ring:'#fca5a5' },
  no_asistio: { label:'No asistió',  color:'#94a3b8', bg:'#f1f5f9', ring:'#cbd5e1' },
}

const TIPO_LABELS = {
  estilista: 'Estilista', colorista: 'Colorista', manicura: 'Manicura',
  pedicura: 'Pedicura', barbero: 'Barbero', esteticista: 'Esteticista', otro: 'Otro',
}

function Icon({ d, size = 18, className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}>
      <path d={d}/>
    </svg>
  )
}

function fmtHora(ts) {
  return new Date(ts).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12: false })
}
function fmtDur(min) {
  if (!min) return ''
  if (min < 60) return `${min}m`
  const h = Math.floor(min/60), m = min%60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}
function fmtPrecio(n) {
  if (!n) return ''
  return `$${Number(n).toLocaleString('es-CO')}`
}

// ── Modal de notas técnicas al completar ────────────────────────────────────
function ModalCompletar({ cita, onClose, onDone, accent }) {
  const [notas, setNotas] = useState({
    formula_color: '', marca_tinte: '', tiempo_proceso: '',
    resultado: '', alergias: '', observaciones: ''
  })
  const [proximaVisita, setProximaVisita] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function completar() {
    setSaving(true)
    const notasLimpias = Object.fromEntries(
      Object.entries(notas).filter(([,v]) => v.trim())
    )
    const { data, error } = await supabase.rpc('completar_cita', {
      p_cita_id:        cita.id,
      p_notas_tecnicas: notasLimpias,
      p_proxima_visita: proximaVisita || null,
    })
    setSaving(false)
    if (error || !data?.ok) { setErr(error?.message || data?.error || 'Error'); return }
    onDone()
  }

  const fields = [
    { key:'formula_color',   label:'Fórmula de color',    placeholder:'Ej: 6.1 + 30vol + 20ml oxi' },
    { key:'marca_tinte',     label:'Marca / producto',    placeholder:'Ej: Wella, Revlon...' },
    { key:'tiempo_proceso',  label:'Tiempo de proceso',   placeholder:'Ej: 35 min' },
    { key:'resultado',       label:'Resultado',           placeholder:'Excelente, necesita retoque...' },
    { key:'alergias',        label:'Alergias detectadas', placeholder:'Ninguna / detalle' },
    { key:'observaciones',   label:'Observaciones',       placeholder:'Cabello poroso, tinte previo...' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
         style={{ backgroundColor:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
           style={{ maxHeight:'90vh' }}>
        {/* Header */}
        <div className="px-6 py-5 flex items-start justify-between"
             style={{ background:`linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}>
          <div>
            <h3 className="font-black text-white text-lg">Completar cita</h3>
            <p className="text-white/70 text-sm mt-0.5">
              {cita.clientes_agenda?.nombre} · {fmtHora(cita.fecha_inicio)}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors mt-0.5">
            <Icon d="M6 18L18 6M6 6l12 12" size={16} />
          </button>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto p-6 space-y-4" style={{ maxHeight:'60vh' }}>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
            Notas técnicas (opcional)
          </p>
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                {f.label}
              </label>
              <input
                value={notas[f.key]}
                onChange={e => setNotas(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
              />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
              Próxima visita sugerida
            </label>
            <input type="date"
              value={proximaVisita}
              onChange={e => setProximaVisita(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
            />
          </div>
        </div>

        {err && (
          <div className="px-6 pb-2">
            <p className="text-xs text-rose-500 bg-rose-50 rounded-xl px-3 py-2">{err}</p>
          </div>
        )}

        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={completar} disabled={saving}
            className="flex-1 py-3.5 rounded-2xl text-white text-sm font-black disabled:opacity-60 transition-all active:scale-[0.98]"
            style={{ backgroundColor: accent }}>
            {saving
              ? <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </span>
              : '✓ Marcar completada'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de cita ──────────────────────────────────────────────────────────
function CitaCard({ cita, accent, onAccion, onCompletar }) {
  const cfg = ESTADO_CONFIG[cita.estado] || ESTADO_CONFIG.pendiente
  const servicioNombre = cita.cita_servicios?.length > 0
    ? cita.cita_servicios.map(cs => {
        const base = cs.servicios?.nombre || ''
        const v = cs.variantes_servicio?.nombre
        return v ? `${base} (${v})` : base
      }).join(' + ')
    : cita.servicios?.nombre || '—'

  const durTotal = cita.cita_servicios?.reduce((acc, cs) => acc + (cs.duracion || 0), 0)
    || (cita.servicios?.duracion_min || 0)

  const isPendiente = cita.estado === 'pendiente'
  const isConfirmada = cita.estado === 'confirmada'
  const isPasada = new Date(cita.fecha_fin) < new Date()

  return (
    <div className="bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md overflow-hidden"
         style={{ borderColor: `${cfg.ring}50` }}>
      {/* Banda de color por estado */}
      <div className="h-1" style={{ backgroundColor: cfg.color }} />

      <div className="p-4">
        {/* Hora + estado */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-xl font-black text-slate-800 leading-none">
              {fmtHora(cita.fecha_inicio)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              → {fmtHora(cita.fecha_fin)} · {fmtDur(durTotal)}
            </p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ color: cfg.color, backgroundColor: cfg.bg }}>
            {cfg.label}
          </span>
        </div>

        {/* Cliente */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
               style={{ backgroundColor: accent }}>
            {(cita.clientes_agenda?.nombre || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-700 truncate">
              {cita.clientes_agenda?.nombre || 'Cliente'}
            </p>
            {cita.clientes_agenda?.telefono && (
              <p className="text-[11px] text-slate-400">{cita.clientes_agenda.telefono}</p>
            )}
          </div>
          {cita.clientes_agenda?.telefono && (
            <a href={`https://wa.me/57${cita.clientes_agenda.telefono.replace(/\D/g,'')}`}
               target="_blank" rel="noopener noreferrer"
               className="ml-auto flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
              <svg width={16} height={16} fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
          )}
        </div>

        {/* Servicio */}
        <div className="bg-slate-50 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">{servicioNombre}</p>
          {cita.precio_cobrado > 0 && (
            <p className="text-xs text-emerald-600 font-bold mt-0.5">{fmtPrecio(cita.precio_cobrado)}</p>
          )}
          {cita.recursos_agenda && (
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Icon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" size={10} />
              {cita.recursos_agenda.nombre}
            </p>
          )}
        </div>

        {/* Acciones */}
        {cita.estado !== 'completada' && cita.estado !== 'cancelada' && cita.estado !== 'no_asistio' && (
          <div className="flex gap-2">
            {isPendiente && (
              <button onClick={() => onAccion(cita.id, 'confirmada')}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors active:scale-[0.97]">
                Confirmar
              </button>
            )}
            {(isPendiente || isConfirmada) && (
              <button onClick={() => onCompletar(cita)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-colors active:scale-[0.97]"
                style={{ backgroundColor: accent }}>
                {isPasada ? 'Completar' : 'Completar'}
              </button>
            )}
            <button onClick={() => onAccion(cita.id, 'cancelada')}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors active:scale-[0.97] flex-shrink-0">
              <Icon d="M6 18L18 6M6 6l12 12" size={14} />
            </button>
          </div>
        )}
        {(cita.estado === 'completada' || cita.estado === 'no_asistio' || cita.estado === 'cancelada') && (
          <div className="text-center">
            <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Columna de un profesional ────────────────────────────────────────────────
function ProfColumna({ prof, citas, accent, onAccion, onCompletar }) {
  const total = citas.length
  const completadas = citas.filter(c => c.estado === 'completada').length
  const enCurso = citas.filter(c => {
    const ahora = Date.now()
    return c.estado === 'confirmada' &&
      new Date(c.fecha_inicio) <= ahora && new Date(c.fecha_fin) >= ahora
  })

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: 280 }}>
      {/* Cabecera del profesional */}
      <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          {prof.foto_url ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
              <img src={prof.foto_url} alt={prof.nombre} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black flex-shrink-0"
                 style={{ backgroundColor: prof.color || accent }}>
              {prof.nombre[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-800 text-sm truncate">{prof.nombre}</p>
            {prof.tipo_profesional && (
              <p className="text-[10px] font-bold mt-0.5" style={{ color: accent }}>
                {TIPO_LABELS[prof.tipo_profesional] || prof.tipo_profesional}
              </p>
            )}
          </div>
        </div>
        {/* Mini stats */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 text-center bg-slate-50 rounded-xl py-1.5">
            <p className="text-lg font-black text-slate-800">{total}</p>
            <p className="text-[9px] text-slate-400 font-semibold uppercase">Total</p>
          </div>
          <div className="flex-1 text-center bg-emerald-50 rounded-xl py-1.5">
            <p className="text-lg font-black text-emerald-700">{completadas}</p>
            <p className="text-[9px] text-emerald-500 font-semibold uppercase">Listas</p>
          </div>
          <div className="flex-1 text-center rounded-xl py-1.5"
               style={{ backgroundColor: `${accent}15` }}>
            <p className="text-lg font-black" style={{ color: accent }}>{total - completadas}</p>
            <p className="text-[9px] font-semibold uppercase" style={{ color: `${accent}80` }}>Pend.</p>
          </div>
        </div>
        {enCurso.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 bg-amber-50 rounded-xl px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-bold text-amber-700">
              En atención: {enCurso[0].clientes_agenda?.nombre}
            </span>
          </div>
        )}
      </div>

      {/* Lista de citas */}
      <div className="space-y-3 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {citas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200">
            <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  size={28} className="text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-300 font-medium">Sin citas hoy</p>
          </div>
        ) : citas.map(c => (
          <CitaCard key={c.id} cita={c} accent={accent}
            onAccion={onAccion} onCompletar={onCompletar} />
        ))}
      </div>
    </div>
  )
}

// ── Monitor principal ─────────────────────────────────────────────────────────
export default function Monitor() {
  const { tenant } = useTenant()
  const [citas, setCitas]   = useState([])
  const [profs, setProfs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [profIdx, setProfIdx] = useState(0)     // índice activo en mobile
  const [modalCita, setModalCita] = useState(null)  // cita para modal completar
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const scrollRef = useRef(null)

  const accent = tenant?.color_primario || '#db2777'

  const hoyStr = new Date().toLocaleDateString('es-CO', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  })

  const cargarCitas = useCallback(async () => {
    if (!tenant?.id) return
    const hoy = new Date()
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString()
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString()

    const { data } = await supabase
      .from('citas')
      .select(`
        id, fecha_inicio, fecha_fin, estado, notas, precio_cobrado,
        clientes_agenda(id, nombre, telefono, whatsapp),
        profesionales(id, nombre, color, tipo_profesional, foto_url),
        servicios(id, nombre, duracion_min),
        cita_servicios(id, servicio_id, variante_id, duracion, precio,
          servicios(nombre),
          variantes_servicio(nombre)
        ),
        recursos_agenda(id, nombre)
      `)
      .eq('tenant_id', tenant.id)
      .gte('fecha_inicio', ini)
      .lte('fecha_inicio', fin)
      .not('estado', 'in', '(cancelada,no_asistio)')
      .order('fecha_inicio')

    setCitas(data || [])
    setLastRefresh(new Date())
  }, [tenant?.id])

  const cargarProfs = useCallback(async () => {
    if (!tenant?.id) return
    const { data } = await supabase
      .from('profesionales')
      .select('id, nombre, color, tipo_profesional, foto_url, bio')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('nombre')
    setProfs(data || [])
    setLoading(false)
  }, [tenant?.id])

  useEffect(() => {
    cargarProfs()
    cargarCitas()
  }, [cargarProfs, cargarCitas])

  // Realtime subscription
  useEffect(() => {
    if (!tenant?.id) return
    const channel = supabase
      .channel(`monitor_${tenant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'citas',
        filter: `tenant_id=eq.${tenant.id}`
      }, () => cargarCitas())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tenant?.id, cargarCitas])

  // Actualizar en background cada 2 min
  useEffect(() => {
    const interval = setInterval(cargarCitas, 120000)
    return () => clearInterval(interval)
  }, [cargarCitas])

  async function onAccion(citaId, nuevoEstado) {
    await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', citaId)
    cargarCitas()
  }

  function onCompletar(cita) {
    setModalCita(cita)
  }

  async function onModalDone() {
    setModalCita(null)
    cargarCitas()
  }

  // Agrupar citas por profesional
  const citasPorProf = profs.map(p => ({
    prof: p,
    citas: citas.filter(c => c.profesionales?.id === p.id)
  }))

  // Citas sin profesional asignado (edge case)
  const citasSinProf = citas.filter(c => !c.profesionales?.id)

  // Stats globales
  const totalHoy   = citas.length
  const completadas = citas.filter(c => c.estado === 'completada').length
  const pendientes  = citas.filter(c => c.estado === 'pendiente').length
  const confirmadas = citas.filter(c => c.estado === 'confirmada').length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
           style={{ borderColor: accent }} />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-800">Monitor del día</h1>
              <p className="text-xs text-slate-400 capitalize mt-0.5">{hoyStr}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-300 hidden sm:block">
                Actualizado {lastRefresh.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })}
              </span>
              <button onClick={cargarCitas}
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={16} />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex gap-3 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { label:'Total hoy',    value: totalHoy,    color:'#64748b', bg:'#f8fafc' },
              { label:'Confirmadas',  value: confirmadas, color:'#10b981', bg:'#f0fdf4' },
              { label:'Pendientes',   value: pendientes,  color:'#f59e0b', bg:'#fffbeb' },
              { label:'Completadas',  value: completadas, color:'#6366f1', bg:'#f5f3ff' },
            ].map(s => (
              <div key={s.label}
                   className="flex items-center gap-2 px-4 py-2 rounded-xl flex-shrink-0"
                   style={{ backgroundColor: s.bg }}>
                <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Vista mobile: tabs por profesional ──────────────────────────── */}
      <div className="sm:hidden">
        {/* Tabs de profesionales */}
        <div className="bg-white border-b border-slate-100 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 py-2" style={{ width: 'max-content' }}>
            {profs.map((p, i) => {
              const count = citasPorProf.find(x => x.prof.id === p.id)?.citas.length || 0
              return (
                <button key={p.id}
                  onClick={() => setProfIdx(i)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0"
                  style={{
                    backgroundColor: profIdx === i ? `${p.color || accent}15` : 'transparent',
                    color: profIdx === i ? (p.color || accent) : '#94a3b8',
                    outline: profIdx === i ? `2px solid ${(p.color || accent)}30` : 'none'
                  }}>
                  {p.foto_url ? (
                    <div className="w-6 h-6 rounded-lg overflow-hidden">
                      <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black"
                         style={{ backgroundColor: p.color || accent }}>
                      {p.nombre[0]}
                    </div>
                  )}
                  {p.nombre.split(' ')[0]}
                  {count > 0 && (
                    <span className="text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: p.color || accent }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Citas del profesional seleccionado */}
        <div className="p-4">
          {profs[profIdx] && (() => {
            const item = citasPorProf.find(x => x.prof.id === profs[profIdx].id)
            if (!item) return null
            return (
              <ProfColumna prof={item.prof} citas={item.citas}
                accent={item.prof.color || accent}
                onAccion={onAccion} onCompletar={onCompletar} />
            )
          })()}
        </div>
      </div>

      {/* ── Vista desktop: columnas lado a lado ────────────────────────── */}
      <div className="hidden sm:block p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-5 overflow-x-auto pb-4 items-start"
               style={{ scrollbarWidth: 'thin' }}>
            {citasPorProf.map(({ prof, citas: cc }) => (
              <ProfColumna key={prof.id} prof={prof} citas={cc}
                accent={prof.color || accent}
                onAccion={onAccion} onCompletar={onCompletar} />
            ))}
            {citasSinProf.length > 0 && (
              <ProfColumna
                prof={{ id:'__sin_asignar', nombre:'Sin asignar', color:'#94a3b8' }}
                citas={citasSinProf} accent="#94a3b8"
                onAccion={onAccion} onCompletar={onCompletar} />
            )}
          </div>
        </div>
      </div>

      {/* Mensaje vacío */}
      {totalHoy === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4"
               style={{ backgroundColor: `${accent}12` }}>
            <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  size={36} style={{ color: accent }} />
          </div>
          <h3 className="font-black text-slate-700 text-lg">Sin citas para hoy</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-xs">
            Cuando los clientes reserven aparecerán aquí en tiempo real.
          </p>
        </div>
      )}

      {/* Modal completar */}
      {modalCita && (
        <ModalCompletar
          cita={modalCita}
          accent={accent}
          onClose={() => setModalCita(null)}
          onDone={onModalDone}
        />
      )}
    </div>
  )
}
