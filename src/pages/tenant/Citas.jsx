import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

// ─── helpers ──────────────────────────────────────────────────────────────────
const DIAS_ES  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(date, opts) { return new Date(date).toLocaleString('es-CO', opts) }
function hhmm(date) { return fmt(date, { hour: '2-digit', minute: '2-digit' }) }
function fechaLocal(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function diasEnMes(y, m) { return new Date(y, m+1, 0).getDate() }
function primerDia(y, m) { return new Date(y, m, 1).getDay() }

const ESTADO_COLOR = {
  pendiente:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300',
  confirmada: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  completada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  cancelada:  'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
  no_asistio: 'bg-gray-100 text-gray-500 dark:bg-slate-600/30 dark:text-slate-400',
}

const ESTADOS = ['pendiente','confirmada','completada','cancelada','no_asistio']

// ─── componente principal ──────────────────────────────────────────────────────
export default function Citas() {
  const { tenant } = useTenant()
  const [vista, setVista]       = useState('semana')   // 'dia' | 'semana' | 'mes'
  const [hoy]                   = useState(new Date())
  const [fechaSel, setFechaSel] = useState(new Date())
  const [citas, setCitas]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [detalle, setDetalle]   = useState(null)  // cita en detalle

  // catálogos
  const [profs, setProfs]   = useState([])
  const [servs, setServs]   = useState([])
  const [horarios, setHorarios] = useState([])

  useEffect(() => { if (tenant?.id) { cargarCatalogos(); cargarCitas() } }, [tenant])
  useEffect(() => { if (tenant?.id) cargarCitas() }, [fechaSel, vista])

  async function cargarCatalogos() {
    const [{ data: ps }, { data: ss }, { data: hs }] = await Promise.all([
      supabase.from('profesionales').select('id,nombre,color').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      supabase.from('servicios').select('id,nombre,duracion_min,precio,profesional_servicios(profesional_id)').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      supabase.from('horarios').select('*').eq('tenant_id', tenant.id).eq('activo', true),
    ])
    setProfs(ps || [])
    setServs(ss || [])
    setHorarios(hs || [])
  }

  async function cargarCitas() {
    setLoading(true)
    let desde, hasta
    const y = fechaSel.getFullYear(), m = fechaSel.getMonth(), d = fechaSel.getDate()

    if (vista === 'dia') {
      desde = new Date(y, m, d, 0, 0, 0).toISOString()
      hasta = new Date(y, m, d, 23, 59, 59).toISOString()
    } else if (vista === 'semana') {
      const dow = fechaSel.getDay()
      const lunes = new Date(y, m, d - (dow === 0 ? 6 : dow - 1))
      const dom   = new Date(lunes); dom.setDate(lunes.getDate() + 6)
      desde = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate()).toISOString()
      hasta = new Date(dom.getFullYear(), dom.getMonth(), dom.getDate(), 23, 59, 59).toISOString()
    } else {
      desde = new Date(y, m, 1).toISOString()
      hasta = new Date(y, m+1, 0, 23, 59, 59).toISOString()
    }

    const { data } = await supabase
      .from('citas')
      .select(`id, fecha_inicio, fecha_fin, estado, notas_profesional, precio_cobrado, pago_estado,
               cliente:clientes_agenda(id, nombre, telefono, whatsapp),
               profesional:profesionales(id, nombre, color),
               servicio:servicios(id, nombre, duracion_min, precio)`)
      .eq('tenant_id', tenant.id)
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)
      .order('fecha_inicio')
    setCitas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id, estado) {
    await supabase.from('citas').update({ estado }).eq('id', id)
    setDetalle(d => d ? { ...d, estado } : null)
    cargarCitas()
  }

  function navegar(delta) {
    const f = new Date(fechaSel)
    if (vista === 'dia')    f.setDate(f.getDate() + delta)
    if (vista === 'semana') f.setDate(f.getDate() + delta * 7)
    if (vista === 'mes')    f.setMonth(f.getMonth() + delta)
    setFechaSel(f)
  }

  function tituloNav() {
    const y = fechaSel.getFullYear(), m = fechaSel.getMonth(), d = fechaSel.getDate()
    if (vista === 'dia')    return `${d} de ${MESES_ES[m]} ${y}`
    if (vista === 'mes')    return `${MESES_ES[m]} ${y}`
    const dow = fechaSel.getDay()
    const lunes = new Date(y, m, d - (dow === 0 ? 6 : dow - 1))
    const dom   = new Date(lunes); dom.setDate(lunes.getDate() + 6)
    return `${lunes.getDate()} ${MESES_ES[lunes.getMonth()]} – ${dom.getDate()} ${MESES_ES[dom.getMonth()]} ${y}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => navegar(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button onClick={() => setFechaSel(new Date())} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
            Hoy
          </button>
          <button onClick={() => navegar(1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white ml-1">{tituloNav()}</span>
        </div>

        <div className="flex gap-1 ml-auto">
          {['dia','semana','mes'].map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`text-xs px-3 py-1.5 rounded-lg capitalize transition-colors ${
                vista === v ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >{v}</button>
          ))}
        </div>

        <button
          onClick={() => setModal(true)}
          className="text-xs px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
        >
          + Nueva cita
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : vista === 'mes' ? (
          <VistaMes fechaSel={fechaSel} citas={citas} hoy={hoy} onDia={d => { setFechaSel(d); setVista('dia') }} onCita={setDetalle} />
        ) : vista === 'semana' ? (
          <VistaSemana fechaSel={fechaSel} citas={citas} hoy={hoy} onDia={d => { setFechaSel(d); setVista('dia') }} onCita={setDetalle} />
        ) : (
          <VistaDia fechaSel={fechaSel} citas={citas} onCita={setDetalle} />
        )}
      </div>

      {/* Modal nueva cita */}
      {modal && (
        <ModalNuevaCita
          tenant={tenant} profs={profs} servs={servs} horarios={horarios}
          fechaInicial={fechaSel}
          onClose={() => setModal(false)}
          onGuardado={() => { setModal(false); cargarCitas() }}
        />
      )}

      {/* Detalle cita */}
      {detalle && (
        <DetalleModal cita={detalle} onClose={() => setDetalle(null)} onEstado={cambiarEstado} />
      )}
    </div>
  )
}

// ─── Vista Mes ────────────────────────────────────────────────────────────────
function VistaMes({ fechaSel, citas, hoy, onDia, onCita }) {
  const y = fechaSel.getFullYear(), m = fechaSel.getMonth()
  const total = diasEnMes(y, m)
  const inicio = primerDia(y, m)
  const offset = inicio === 0 ? 6 : inicio - 1 // lunes primero

  const citasPorDia = useMemo(() => {
    const map = {}
    citas.forEach(c => {
      const k = fechaLocal(c.fecha_inicio)
      if (!map[k]) map[k] = []
      map[k].push(c)
    })
    return map
  }, [citas])

  const celdas = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= total; d++) celdas.push(d)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
      <div className="grid grid-cols-7">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-slate-800">
        {celdas.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="min-h-24 bg-gray-50 dark:bg-slate-900/50" />
          const fecha = new Date(y, m, d)
          const key   = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const dCitas = citasPorDia[key] || []
          const esHoy  = fechaLocal(hoy) === key
          return (
            <div
              key={key}
              onClick={() => onDia(fecha)}
              className="min-h-24 p-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-colors"
            >
              <span className={`text-xs font-medium inline-flex w-6 h-6 items-center justify-center rounded-full ${
                esHoy ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-slate-300'
              }`}>{d}</span>
              <div className="mt-1 space-y-0.5">
                {dCitas.slice(0, 3).map(c => (
                  <div
                    key={c.id}
                    onClick={e => { e.stopPropagation(); onCita(c) }}
                    className="text-xs px-1.5 py-0.5 rounded truncate text-white"
                    style={{ backgroundColor: c.profesional?.color || '#3b82f6' }}
                  >
                    {hhmm(c.fecha_inicio)} {c.cliente?.nombre}
                  </div>
                ))}
                {dCitas.length > 3 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 pl-1">+{dCitas.length - 3} más</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vista Semana ─────────────────────────────────────────────────────────────
function VistaSemana({ fechaSel, citas, hoy, onDia, onCita }) {
  const y = fechaSel.getFullYear(), m = fechaSel.getMonth(), d = fechaSel.getDate()
  const dow   = fechaSel.getDay()
  const lunes = new Date(y, m, d - (dow === 0 ? 6 : dow - 1))

  const dias = Array.from({ length: 7 }, (_, i) => {
    const f = new Date(lunes); f.setDate(lunes.getDate() + i)
    return f
  })

  const citasPorDia = useMemo(() => {
    const map = {}
    citas.forEach(c => {
      const k = fechaLocal(c.fecha_inicio)
      if (!map[k]) map[k] = []
      map[k].push(c)
    })
    return map
  }, [citas])

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-slate-800 border-b border-gray-100 dark:border-slate-800">
        {dias.map(f => {
          const key   = fechaLocal(f)
          const esHoy = fechaLocal(hoy) === key
          const dCitas = citasPorDia[key] || []
          return (
            <div key={key} className="p-3 min-h-32">
              <button
                onClick={() => onDia(f)}
                className={`text-xs font-semibold mb-2 flex flex-col items-center w-full ${esHoy ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'}`}
              >
                <span>{DIAS_ES[f.getDay()]}</span>
                <span className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${esHoy ? 'bg-blue-600 text-white' : ''}`}>
                  {f.getDate()}
                </span>
              </button>
              <div className="space-y-1">
                {dCitas.map(c => (
                  <div
                    key={c.id}
                    onClick={() => onCita(c)}
                    className="text-xs p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: (c.profesional?.color || '#3b82f6') + '25', borderLeft: `3px solid ${c.profesional?.color || '#3b82f6'}` }}
                  >
                    <p className="font-medium text-gray-800 dark:text-slate-200 truncate">{hhmm(c.fecha_inicio)}</p>
                    <p className="text-gray-600 dark:text-slate-400 truncate">{c.cliente?.nombre}</p>
                    <p className="text-gray-500 dark:text-slate-500 truncate">{c.servicio?.nombre}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vista Día ────────────────────────────────────────────────────────────────
function VistaDia({ fechaSel, citas, onCita }) {
  if (citas.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-8 text-center text-gray-400 dark:text-slate-500">
        <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <p className="text-sm">Sin citas para este día</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-w-2xl mx-auto">
      {citas.map(c => (
        <div
          key={c.id}
          onClick={() => onCita(c)}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center gap-4"
        >
          <div className="text-center w-16 flex-shrink-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white">{hhmm(c.fecha_inicio)}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">{hhmm(c.fecha_fin)}</p>
          </div>
          <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: c.profesional?.color || '#3b82f6' }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white">{c.cliente?.nombre}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {c.servicio?.nombre} · {c.profesional?.nombre}
            </p>
            {c.cliente?.telefono && (
              <p className="text-xs text-gray-400 dark:text-slate-500">{c.cliente.telefono}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${ESTADO_COLOR[c.estado]}`}>
            {c.estado}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Modal nueva cita ──────────────────────────────────────────────────────────
function ModalNuevaCita({ tenant, profs, servs, horarios, fechaInicial, onClose, onGuardado }) {
  const [step, setStep] = useState(1) // 1:prof+serv, 2:fecha+hora, 3:cliente
  const [profId, setProfId]   = useState(profs[0]?.id || '')
  const [servId, setServId]   = useState('')
  const [fecha, setFecha]     = useState(fechaLocal(fechaInicial))
  const [hora, setHora]       = useState('09:00')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTel, setClienteTel]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const servsDelProf = servs.filter(s =>
    s.profesional_servicios?.some(x => x.profesional_id === profId)
  )

  const servSel = servs.find(s => s.id === servId)

  // Slots disponibles para el profesional en la fecha
  const slots = useMemo(() => {
    if (!profId || !fecha || !servSel) return []
    const DIAS_MAP = { 0:'domingo', 1:'lunes', 2:'martes', 3:'miercoles', 4:'jueves', 5:'viernes', 6:'sabado' }
    const diaSemana = DIAS_MAP[new Date(fecha + 'T12:00:00').getDay()]
    const horario = horarios.find(h => h.profesional_id === profId && h.dia === diaSemana)
    if (!horario) return []

    const [hIni, mIni] = horario.hora_inicio.split(':').map(Number)
    const [hFin, mFin] = horario.hora_fin.split(':').map(Number)
    const inicioMin = hIni * 60 + mIni
    const finMin    = hFin * 60 + mFin
    const dur       = servSel.duracion_min || 30

    const result = []
    for (let t = inicioMin; t + dur <= finMin; t += 30) {
      const h = String(Math.floor(t / 60)).padStart(2, '0')
      const m = String(t % 60).padStart(2, '0')
      result.push(`${h}:${m}`)
    }
    return result
  }, [profId, fecha, servSel, horarios])

  async function guardar() {
    if (!clienteNombre.trim()) { setError('El nombre del cliente es requerido'); return }
    setSaving(true)
    setError('')

    // Buscar o crear cliente
    let clienteId
    const { data: existente } = await supabase
      .from('clientes_agenda')
      .select('id')
      .eq('tenant_id', tenant.id)
      .ilike('nombre', clienteNombre.trim())
      .maybeSingle()

    if (existente) {
      clienteId = existente.id
    } else {
      const { data: nuevo, error: ec } = await supabase
        .from('clientes_agenda')
        .insert({ tenant_id: tenant.id, nombre: clienteNombre.trim(), telefono: clienteTel || null })
        .select('id').single()
      if (ec) { setSaving(false); setError(ec.message); return }
      clienteId = nuevo.id
    }

    // Calcular fecha_fin
    const durMin = servSel?.duracion_min || 30
    const inicio = new Date(`${fecha}T${hora}:00`)
    const fin    = new Date(inicio.getTime() + durMin * 60000)

    const { error: ecita } = await supabase.from('citas').insert({
      tenant_id:      tenant.id,
      cliente_id:     clienteId,
      profesional_id: profId,
      servicio_id:    servId,
      fecha_inicio:   inicio.toISOString(),
      fecha_fin:      fin.toISOString(),
      estado:         'confirmada',
      precio_cobrado: servSel?.precio || 0,
    })

    setSaving(false)
    if (ecita) { setError(ecita.message); return }
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-md my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900 dark:text-white">Nueva cita</h3>
          <div className="flex gap-1">
            {[1,2,3].map(s => (
              <div key={s} className={`w-2 h-2 rounded-full ${step >= s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`} />
            ))}
          </div>
        </div>

        {/* Paso 1: Profesional + Servicio */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">Profesional</label>
              <div className="space-y-2">
                {profs.map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    profId === p.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}>
                    <input type="radio" name="prof" value={p.id} checked={profId === p.id}
                      onChange={() => { setProfId(p.id); setServId('') }} className="sr-only" />
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>
                      {p.nombre[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{p.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">Servicio</label>
              {servsDelProf.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                  Este profesional no tiene servicios asignados
                </p>
              ) : (
                <div className="space-y-2">
                  {servsDelProf.map(s => (
                    <label key={s.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      servId === s.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}>
                      <input type="radio" name="serv" value={s.id} checked={servId === s.id}
                        onChange={() => setServId(s.id)} className="sr-only" />
                      <span className="text-sm text-gray-800 dark:text-slate-200">{s.nombre}</span>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-slate-400">{s.duracion_min} min</p>
                        {s.precio > 0 && <p className="text-xs text-gray-400">${Number(s.precio).toLocaleString('es-CO')}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Fecha + Hora */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => { setFecha(e.target.value); setHora('') }}
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                           rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">
                Hora {slots.length === 0 && fecha && <span className="text-red-400">(sin horario configurado para este día)</span>}
              </label>
              {slots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button
                      key={s}
                      onClick={() => setHora(s)}
                      className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                        hora === s
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              ) : (
                <input
                  type="time"
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                             rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {servSel && hora && (
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
                Duración: {servSel.duracion_min} min — termina a las{' '}
                {(() => {
                  const [h, m] = hora.split(':').map(Number)
                  const fin = new Date(0, 0, 0, h, m + servSel.duracion_min)
                  return `${String(fin.getHours()).padStart(2,'0')}:${String(fin.getMinutes()).padStart(2,'0')}`
                })()}
              </div>
            )}
          </div>
        )}

        {/* Paso 3: Cliente */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">
                Nombre del cliente *
              </label>
              <input
                value={clienteNombre}
                onChange={e => setClienteNombre(e.target.value)}
                placeholder="Nombre completo"
                autoFocus
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                           rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Si ya existe, se vincula automáticamente
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Teléfono / WhatsApp</label>
              <input
                value={clienteTel}
                onChange={e => setClienteTel(e.target.value)}
                placeholder="3001234567"
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700
                           rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Resumen */}
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 text-xs space-y-1.5 text-gray-600 dark:text-slate-400">
              <p><b className="text-gray-800 dark:text-slate-200">Profesional:</b> {profs.find(p => p.id === profId)?.nombre}</p>
              <p><b className="text-gray-800 dark:text-slate-200">Servicio:</b> {servSel?.nombre} ({servSel?.duracion_min} min)</p>
              <p><b className="text-gray-800 dark:text-slate-200">Fecha:</b> {fecha} a las {hora}</p>
              {servSel?.precio > 0 && <p><b className="text-gray-800 dark:text-slate-200">Valor:</b> ${Number(servSel.precio).toLocaleString('es-CO')}</p>}
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700
                       text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
          >
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>
          <button
            onClick={step < 3 ? () => setStep(s => s + 1) : guardar}
            disabled={
              (step === 1 && (!profId || !servId)) ||
              (step === 2 && (!fecha || !hora)) ||
              saving
            }
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                       text-white font-medium transition-colors text-sm disabled:opacity-50"
          >
            {step < 3 ? 'Siguiente' : saving ? 'Guardando...' : 'Confirmar cita'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal detalle cita ───────────────────────────────────────────────────────
function DetalleModal({ cita, onClose, onEstado }) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-white">Detalle de cita</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="space-y-3 text-sm mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-lg font-bold flex-shrink-0">
              {cita.cliente?.nombre?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{cita.cliente?.nombre}</p>
              {cita.cliente?.telefono && <p className="text-xs text-gray-400 dark:text-slate-500">{cita.cliente.telefono}</p>}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 space-y-1.5 text-xs text-gray-600 dark:text-slate-400">
            <p><b className="text-gray-800 dark:text-slate-200">Servicio:</b> {cita.servicio?.nombre}</p>
            <p><b className="text-gray-800 dark:text-slate-200">Profesional:</b> {cita.profesional?.nombre}</p>
            <p><b className="text-gray-800 dark:text-slate-200">Inicio:</b> {fmt(cita.fecha_inicio, { dateStyle:'medium', timeStyle:'short' })}</p>
            <p><b className="text-gray-800 dark:text-slate-200">Fin:</b> {hhmm(cita.fecha_fin)}</p>
            {cita.precio_cobrado > 0 && <p><b className="text-gray-800 dark:text-slate-200">Valor:</b> ${Number(cita.precio_cobrado).toLocaleString('es-CO')}</p>}
          </div>

          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Estado</p>
            <div className="flex gap-1.5 flex-wrap">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => onEstado(cita.id, e)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium capitalize transition-colors ${
                    cita.estado === e
                      ? ESTADO_COLOR[e] + ' border-transparent'
                      : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-400'
                  }`}
                >
                  {e.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-slate-700
                     text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
