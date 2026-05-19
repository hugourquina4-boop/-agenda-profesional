import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'

function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
               'Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ESTADO_COLOR = {
  pendiente:  '#f59e0b',
  confirmada: '#3b82f6',
  completada: '#22c55e',
  cancelada:  '#ef4444',
  no_asistio: '#71717a',
}
const ESTADO_LABEL = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada',
  cancelada: 'Cancelada', no_asistio: 'No asistió',
}

const ACCIONES = {
  pendiente:  [
    { estado:'confirmada', label:'Confirmar',  color:'#3b82f6' },
    { estado:'completada', label:'Completar',  color:'#22c55e' },
    { estado:'cancelada',  label:'Cancelar',   color:'#ef4444' },
    { estado:'no_asistio', label:'No asistió', color:'#71717a' },
  ],
  confirmada: [
    { estado:'completada', label:'Completar',  color:'#22c55e' },
    { estado:'cancelada',  label:'Cancelar',   color:'#ef4444' },
    { estado:'no_asistio', label:'No asistió', color:'#71717a' },
  ],
  completada: [],
  cancelada:  [],
  no_asistio: [],
}

function fmtHora(iso) {
  if (!iso) return ''
  const [h, m] = iso.substring(11, 16).split(':')
  const hh = parseInt(h)
  return `${hh > 12 ? hh - 12 : hh || 12}:${m}${hh < 12 ? 'am' : 'pm'}`
}

export default function SalonAgenda() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selDay,   setSelDay]   = useState(today.toISOString().slice(0, 10))
  const [citas,    setCitas]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [selCita,  setSelCita]  = useState(null)
  const [actualizando, setActualizando] = useState(false)
  const [esperaDia, setEsperaDia] = useState(0)

  // Pagos
  const [vistaAgenda,  setVistaAgenda]  = useState('mes')
  const [profesionales,setProfesionales]= useState([])
  const [pago,         setPago]         = useState(null)
  const [loadPago,     setLoadPago]     = useState(false)
  const [pagoForm,     setPagoForm]     = useState(false)
  const [pagoMonto,    setPagoMonto]    = useState('')
  const [pagoMetodo,   setPagoMetodo]   = useState('efectivo')
  const [pagoRef,      setPagoRef]      = useState('')
  const [guardandoPago,setGuardandoPago]= useState(false)
  const [filtroProf,   setFiltroProf]   = useState(null)
  const [sedes,        setSedes]        = useState([])
  const [filtroSede,   setFiltroSede]   = useState(null)
  const [nowOffset,    setNowOffset]    = useState(null)
  const [nota,             setNota]             = useState('')
  const [guardandoNota,    setGuardandoNota]    = useState(false)
  const [anticoInput,      setAnticoInput]      = useState('')
  const [guardandoAnticipo,setGuardandoAnticipo]= useState(false)
  const [dupMode,          setDupMode]          = useState(false)
  const [dupFecha,         setDupFecha]         = useState('')
  const [serieMode,        setSerieMode]        = useState(false)
  const [serieFreq,        setSerieFreq]        = useState('semanal')
  const [serieReps,        setSerieReps]        = useState(4)
  const [creandoSerie,     setCreandoSerie]     = useState(false)
  const [busqAgenda,       setBusqAgenda]       = useState('')

  // Bloquear franja horaria
  const [bloqueoModal, setBloqueoModal] = useState(false)
  const [bloqueoProf,  setBloqueoProf]  = useState('')
  const [bloqueoHIni,  setBloqueoHIni]  = useState('09:00')
  const [bloqueoHFin,  setBloqueoHFin]  = useState('10:00')
  const [bloqueoNote,  setBloqueoNote]  = useState('')
  const [guardandoBlq, setGuardandoBlq] = useState(false)

  // Drag & drop en VistaDia
  const draggingRef = useRef(null)          // estado de drag sin re-render
  const [ghostPos,  setGhostPos]  = useState(null) // posición visual del ghost

  // Drag & drop en VistaSemana (mover cita a otro día)
  const [semDragOver, setSemDragOver] = useState(null) // iso del día hover
  const [moviendo,    setMoviendo]    = useState(false)

  useEffect(() => {
    if (!tenant) return
    Promise.all([
      supabase.from('profesionales')
        .select('id,nombre,color,foto_url,sede_id')
        .eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      supabase.from('sedes')
        .select('id,nombre')
        .eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
    ]).then(([pr, sr]) => {
      setProfesionales(pr.data || [])
      setSedes(sr.data || [])
    })
  }, [tenant])

  const cargarMes = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const y = viewDate.getFullYear()
    const m = String(viewDate.getMonth() + 1).padStart(2, '0')
    try {
      const { data } = await supabase
        .from('citas')
        .select('id, fecha_inicio, fecha_fin, estado, notas, anticipo, precio_cobrado, sede_id, profesional_id, servicio_id, cliente_id, servicios_ids, clientes_agenda(nombre,telefono,tags), servicios(id,nombre,precio,duracion_min), profesionales(id,nombre,color,foto_url)')
        .eq('tenant_id', tenant.id)
        .gte('fecha_inicio', `${y}-${m}-01T00:00:00`)
        .lte('fecha_inicio', `${y}-${m}-31T23:59:59`)
        .order('fecha_inicio')
      setCitas(data || [])
    } catch (e) {
      console.error('[SalonAgenda]', e)
    } finally {
      setLoading(false)
    }
  }, [tenant, viewDate])

  useEffect(() => { cargarMes() }, [cargarMes])

  // Auto-refresh cada 60s para recepción siempre activa
  useEffect(() => {
    const id = setInterval(() => { if (!selCita && !bloqueoModal) cargarMes() }, 60_000)
    return () => clearInterval(id)
  }, [cargarMes, selCita, bloqueoModal])

  useEffect(() => {
    if (!selCita) { setPago(null); setPagoForm(false); setNota(''); setAnticoInput(''); setDupMode(false); setDupFecha(''); setSerieMode(false); return }
    setNota(selCita.notas || '')
    setAnticoInput('')
    setLoadPago(true)
    supabase.from('pagos').select('*').eq('cita_id', selCita.id).maybeSingle()
      .then(({ data }) => { setPago(data || null); setLoadPago(false) })
    setPagoMonto(selCita.servicios?.precio ? String(Math.round(selCita.servicios.precio)) : '')
    setPagoMetodo('efectivo')
    setPagoRef('')
    setPagoForm(false)
  }, [selCita])

  useEffect(() => {
    if (!tenant || !selDay) return
    supabase.from('lista_espera')
      .select('id', { count:'exact', head:true })
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .eq('notificado', false)
      .eq('fecha_preferida', selDay)
      .then(({ count }) => setEsperaDia(count || 0))
  }, [tenant, selDay])

  useEffect(() => {
    function calcOffset() {
      const now = new Date()
      if (selDay !== now.toISOString().slice(0,10)) { setNowOffset(null); return }
      setNowOffset(now.getHours() * 60 + now.getMinutes()) // minutos desde medianoche
    }
    calcOffset()
    const iv = setInterval(calcOffset, 60000)
    return () => clearInterval(iv)
  }, [selDay])

  async function cambiarEstado(nuevoEstado) {
    if (!selCita) return
    setActualizando(true)
    await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', selCita.id)
    setActualizando(false)
    setSelCita(null)
    cargarMes()
  }

  async function guardarNota() {
    if (!selCita) return
    setGuardandoNota(true)
    await supabase.from('citas').update({ notas: nota.trim() || null }).eq('id', selCita.id)
    setSelCita(c => ({ ...c, notas: nota.trim() || null }))
    setGuardandoNota(false)
  }

  async function crearSerie() {
    if (!selCita) return
    setCreandoSerie(true)
    const diasFreq = { semanal:7, quincenal:14, mensual:30 }[serieFreq]
    const horaIni  = selCita.fecha_inicio.substring(10)
    const horaFin  = selCita.fecha_fin?.substring(10) || 'T10:00:00'
    const rows = []
    for (let i = 1; i <= serieReps; i++) {
      const d = new Date(selCita.fecha_inicio)
      d.setDate(d.getDate() + i * diasFreq)
      const f = d.toISOString().slice(0, 10)
      rows.push({
        tenant_id:      tenant.id,
        profesional_id: selCita.profesional_id,
        servicio_id:    selCita.servicio_id,
        servicios_ids:  selCita.servicios_ids,
        cliente_id:     selCita.cliente_id,
        fecha_inicio:   `${f}${horaIni}`,
        fecha_fin:      `${f}${horaFin}`,
        estado:         'pendiente',
        precio_cobrado: selCita.precio_cobrado,
        sede_id:        selCita.sede_id,
      })
    }
    await supabase.from('citas').insert(rows)
    setCreandoSerie(false)
    setSerieMode(false)
    setSelCita(null)
    cargarMes()
  }

  async function duplicarCita() {
    if (!selCita || !dupFecha) return
    setActualizando(true)
    const horaIni = selCita.fecha_inicio.substring(10) // "T09:00:00"
    const horaFin = selCita.fecha_fin.substring(10)
    const { error } = await supabase.from('citas').insert({
      tenant_id:      tenant.id,
      profesional_id: selCita.profesional_id,
      servicio_id:    selCita.servicio_id,
      servicios_ids:  selCita.servicios_ids,
      cliente_id:     selCita.cliente_id,
      fecha_inicio:   `${dupFecha}${horaIni}`,
      fecha_fin:      `${dupFecha}${horaFin}`,
      estado:         'pendiente',
      precio_cobrado: selCita.precio_cobrado,
      sede_id:        selCita.sede_id,
    })
    setActualizando(false)
    if (!error) {
      setDupMode(false); setSelCita(null)
      cargarMes()
    }
  }

  async function registrarAnticipo() {
    const monto = parseFloat(anticoInput)
    if (!monto || monto <= 0 || !selCita) return
    setGuardandoAnticipo(true)
    const nuevo = (Number(selCita.anticipo) || 0) + monto
    const { error } = await supabase.from('citas').update({ anticipo: nuevo }).eq('id', selCita.id)
    if (!error) {
      setSelCita(c => ({ ...c, anticipo: nuevo }))
      setAnticoInput('')
      cargarMes()
    }
    setGuardandoAnticipo(false)
  }

  async function registrarPago() {
    if (!pagoMonto || isNaN(parseFloat(pagoMonto))) return
    setGuardandoPago(true)
    const { data, error } = await supabase.from('pagos').insert({
      tenant_id:  tenant.id,
      cita_id:    selCita.id,
      monto:      parseFloat(pagoMonto),
      metodo:     pagoMetodo,
      estado:     'pagado',
      referencia: pagoRef.trim() || null,
    }).select().single()
    if (!error && data) {
      setPago(data)
      setPagoForm(false)
      // Marcar cita como completada automáticamente
      if (['pendiente','confirmada'].includes(selCita.estado)) {
        await supabase.from('citas').update({ estado:'completada' }).eq('id', selCita.id)
        setSelCita(c => ({ ...c, estado:'completada' }))
        cargarMes()
      }
    }
    setGuardandoPago(false)
  }

  async function crearBloqueo() {
    if (!bloqueoProf || !bloqueoHIni || !bloqueoHFin) return
    setGuardandoBlq(true)
    await supabase.from('citas').insert({
      tenant_id:      tenant.id,
      profesional_id: bloqueoProf,
      fecha_inicio:   `${selDay}T${bloqueoHIni}:00`,
      fecha_fin:      `${selDay}T${bloqueoHFin}:00`,
      estado:         'cancelada',
      notas:          `__bloqueo__${bloqueoNote.trim()}`,
      precio_cobrado: 0,
    })
    setGuardandoBlq(false)
    setBloqueoModal(false)
    setBloqueoNote('')
    cargarMes()
  }

  async function eliminarBloqueo() {
    if (!selCita) return
    setActualizando(true)
    await supabase.from('citas').delete().eq('id', selCita.id)
    setActualizando(false)
    setSelCita(null)
    cargarMes()
  }

  // Mapa día → citas
  const citasPorDia = {}
  citas.forEach(c => {
    const d = c.fecha_inicio.slice(0, 10)
    if (!citasPorDia[d]) citasPorDia[d] = []
    citasPorDia[d].push(c)
  })

  // Grilla del mes
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const citasDia  = citasPorDia[selDay] || []
  const accionesCita = selCita ? (ACCIONES[selCita.estado] || []) : []

  const citasBusqueda = useMemo(() => {
    if (!busqAgenda.trim()) return []
    const q = busqAgenda.toLowerCase()
    return citas
      .filter(c =>
        (c.clientes_agenda?.nombre||'').toLowerCase().includes(q) ||
        (c.servicios?.nombre||'').toLowerCase().includes(q) ||
        (c.profesionales?.nombre||'').toLowerCase().includes(q)
      )
      .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
  }, [citas, busqAgenda])

  async function moverCitaSemana(citaId, isoDestino) {
    const cita = citas.find(c => c.id === citaId)
    if (!cita || cita.fecha_inicio.slice(0, 10) === isoDestino) return
    setMoviendo(true)
    const hIni = cita.fecha_inicio.slice(11, 16)
    const hFin = cita.fecha_fin ? cita.fecha_fin.slice(11, 16) : null
    const newIni = `${isoDestino}T${hIni}:00`
    const newFin = hFin ? `${isoDestino}T${hFin}:00` : null
    await supabase.from('citas').update({ fecha_inicio: newIni, fecha_fin: newFin }).eq('id', citaId)
    await cargarCitas()
    setMoviendo(false)
  }

  // ── Helpers de navegación semana/día ─────────────────────────────────
  function shiftDia(n) {
    const d = new Date(selDay + 'T12:00:00')
    d.setDate(d.getDate() + n)
    const iso = d.toISOString().slice(0, 10)
    setSelDay(iso)
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  function semanaLabel() {
    const pivot = new Date(selDay + 'T12:00:00')
    const dow = pivot.getDay()
    const lunes = new Date(pivot)
    lunes.setDate(pivot.getDate() - (dow === 0 ? 6 : dow - 1))
    const dom = new Date(lunes)
    dom.setDate(lunes.getDate() + 6)
    const fmtShort = d => d.toLocaleDateString('es-CO', { day:'numeric', month:'short' })
    return `${fmtShort(lunes)} – ${fmtShort(dom)}`
  }

  // ── Vista Semana: 7 columnas día ──────────────────────────────────────
  function VistaSemana() {
    const pivot = new Date(selDay + 'T12:00:00')
    const dow   = pivot.getDay()
    const lunes = new Date(pivot)
    lunes.setDate(pivot.getDate() - (dow === 0 ? 6 : dow - 1))
    const diasSemana = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes)
      d.setDate(lunes.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
    const hoyIso = today.toISOString().slice(0, 10)

    return (
      <div style={{ overflowX:'auto', overflowY:'clip', paddingBottom:80 }}>
        <div style={{ display:'flex', minWidth: 7 * 78 }}>
          {diasSemana.map(iso => {
            const dc     = citasPorDia[iso] || []
            const fecha  = new Date(iso + 'T12:00:00')
            const esHoy  = iso === hoyIso
            const esSel  = iso === selDay
            const diaNom = DIAS[fecha.getDay()]
            const diaNum = fecha.getDate()
            return (
              <div
                key={iso}
                onDragOver={e => { e.preventDefault(); setSemDragOver(iso) }}
                onDragLeave={() => setSemDragOver(s => s === iso ? null : s)}
                onDrop={e => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('citaId')
                  setSemDragOver(null)
                  if (id) moverCitaSemana(id, iso)
                }}
                style={{
                  flex:1, minWidth:78, borderRight:'1px solid var(--border)',
                  display:'flex', flexDirection:'column',
                  background: semDragOver === iso ? `${col}10` : 'transparent',
                  transition:'background 0.15s',
                }}
              >
                {/* Cabecera del día */}
                <button
                  onClick={() => { setSelDay(iso); setVistaAgenda('dia') }}
                  style={{
                    width:'100%', padding:'10px 2px 8px', textAlign:'center',
                    background:'transparent', border:'none', cursor:'pointer',
                    borderBottom:'2px solid var(--border)',
                  }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:0.5,
                    color: esHoy ? col : 'var(--text-3)', textTransform:'uppercase' }}>
                    {diaNom}
                  </div>
                  <div style={{
                    width:28, height:28, borderRadius:8, margin:'4px auto 0',
                    background: esSel ? col : esHoy ? `${col}22` : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Outfit', fontWeight:800, fontSize:15,
                    color: esSel ? '#fff' : esHoy ? col : 'var(--text)',
                  }}>{diaNum}</div>
                </button>

                {/* Citas del día */}
                <div style={{ padding:'5px 3px', display:'flex', flexDirection:'column', gap:3 }}>
                  {dc.length === 0
                    ? <div style={{ height:8 }} />
                    : dc.slice(0, 7).map(c => {
                        const clr = ESTADO_COLOR[c.estado] || col
                        return (
                          <button
                            key={c.id}
                            draggable
                            onDragStart={e => { e.dataTransfer.setData('citaId', c.id); e.dataTransfer.effectAllowed = 'move' }}
                            onClick={() => setSelCita(c)}
                            style={{
                              width:'100%', padding:'5px 4px', borderRadius:6, textAlign:'left',
                              background:`${clr}18`, border:`1px solid ${clr}40`, cursor:'grab',
                            }}>
                            <div style={{ fontSize:9, fontWeight:800, color:clr, lineHeight:1.2 }}>
                              {fmtHora(c.fecha_inicio)}
                            </div>
                            <div style={{ fontSize:10, fontWeight:600, color:'var(--text)',
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {c.clientes_agenda?.nombre?.split(' ')[0] || '—'}
                            </div>
                          </button>
                        )
                      })
                  }
                  {dc.length > 7 && (
                    <div style={{ fontSize:9, color:'var(--text-3)', textAlign:'center',
                      fontWeight:700, paddingTop:2 }}>+{dc.length - 7} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Vista Día: grid por profesional ──────────────────────────────────
  function VistaDia() {
    const SLOT_H  = 40  // px per 30min (reducido para más compacidad)
    const COL_W   = 110
    const PROFS_BASE = profesionales.length > 0 ? profesionales
      : [...new Map(citasDia.map(c => [c.profesionales?.nombre, { id: c.profesionales?.nombre, nombre: c.profesionales?.nombre, color: col }])).values()]
    const PROFS_SEDE = filtroSede ? PROFS_BASE.filter(p => p.sede_id === filtroSede) : PROFS_BASE
    const PROFS = filtroProf ? PROFS_SEDE.filter(p => p.id === filtroProf) : PROFS_SEDE

    // Rango dinámico: mostrar solo las horas con citas (±1h buffer) para compactar
    const horasCitas = citasDia.map(c => parseInt(c.fecha_inicio.substring(11, 13)))
    const H_START = citasDia.length > 0 ? Math.max(7, Math.min(...horasCitas) - 1) : 8
    const H_END   = citasDia.length > 0 ? Math.min(22, Math.max(...horasCitas) + 3) : 20

    function minOffset(iso) {
      const [h, m] = iso.substring(11, 16).split(':').map(Number)
      return ((h - H_START) * 60 + m) / 30 * SLOT_H
    }
    function durPx(c) {
      // Usar duracion_min del servicio como fuente canónica de verdad.
      // fecha_fin puede tener desfase UTC/local en citas antiguas.
      const minutos = c.servicios?.duracion_min
      if (minutos && minutos > 0) return Math.max(SLOT_H, minutos / 30 * SLOT_H)
      if (c.fecha_fin) {
        const dur = (new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / 60000
        if (dur > 0 && dur <= 480) return Math.max(SLOT_H, dur / 30 * SLOT_H)
      }
      return SLOT_H * 2 // fallback 60min
    }

    const TOTAL_H = (H_END - H_START) * 2 * SLOT_H

    // Ahora: offset en px calculado con H_START y SLOT_H dinámicos
    const nowTop = nowOffset !== null
      ? ((nowOffset / 60 - H_START) * 60 / 30) * SLOT_H
      : null

    // Color por profesional (campo color de BD, fallback a paleta)
    const PROF_CLR = {}
    PROFS.forEach((p, i) => { PROF_CLR[p.id || p.nombre] = p.color || PROF_COLORS[i % PROF_COLORS.length] })

    return (
      // Contenedor acotado con overflow:auto → position:sticky funciona dentro
      <div style={{
        overflowX:'auto', overflowY:'auto',
        maxHeight:'calc(100dvh - 210px)',
        paddingBottom:16,
      }}>
        <div style={{ minWidth: 56 + PROFS.length * COL_W, position:'relative' }}>
          {/* Header profesionales — sticky dentro del scroll container */}
          <div style={{
            display:'grid', gridTemplateColumns:`56px repeat(${PROFS.length}, ${COL_W}px)`,
            position:'sticky', top:0, zIndex:10, background:'var(--bg)',
            borderBottom:'2px solid var(--border)', paddingBottom:4,
          }}>
            <div />
            {PROFS.map(p => (
              <div key={p.id} style={{ padding:'10px 8px', textAlign:'center' }}>
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nombre?.[0]}
                    style={{ width:36, height:36, borderRadius:10, objectFit:'cover',
                    margin:'0 auto 4px', display:'block', border:`2px solid ${p.color || col}40` }} />
                ) : (
                  <div style={{ width:36, height:36, borderRadius:10, margin:'0 auto 4px',
                    background:`${p.color || col}25`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontWeight:800, fontSize:14, color:p.color || col,
                    fontFamily:'Outfit' }}>
                    {p.nombre?.[0]}
                  </div>
                )}
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {p.nombre?.split(' ')[0]}
                </div>
                {(() => {
                  const cnt = citasDia.filter(c => c.profesional_id === p.id).length
                  return cnt > 0 ? (
                    <div style={{
                      fontSize:10, fontWeight:700, color:p.color || col,
                      background:`${p.color || col}18`, borderRadius:10,
                      padding:'1px 6px', marginTop:2, display:'inline-block',
                    }}>{cnt}</div>
                  ) : null
                })()}
              </div>
            ))}
          </div>

          {/* Grid de tiempo */}
          <div style={{ position:'relative', height:TOTAL_H }}>
            {/* Líneas de hora */}
            {Array.from({ length: H_END - H_START }, (_, i) => (
              <div key={i} style={{ position:'absolute', left:0, right:0, top: i * 2 * SLOT_H, display:'flex' }}>
                <div style={{ width:56, paddingRight:8, textAlign:'right', fontSize:10,
                  color:'var(--text-3)', fontWeight:600, transform:'translateY(-6px)', flexShrink:0 }}>
                  {String(H_START + i).padStart(2,'0')}:00
                </div>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
              </div>
            ))}
            {/* Líneas de media hora */}
            {Array.from({ length: H_END - H_START }, (_, i) => (
              <div key={`m${i}`} style={{
                position:'absolute', left:56, right:0, top:(i*2+1)*SLOT_H,
                height:1, background:'var(--border)', opacity:0.35,
              }} />
            ))}

            {/* Línea hora actual */}
            {nowTop !== null && nowTop >= 0 && nowTop <= TOTAL_H && (
              <div style={{ position:'absolute', left:56, right:0, top:nowTop, zIndex:6, pointerEvents:'none', display:'flex', alignItems:'center' }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'#ef4444', flexShrink:0, marginLeft:-1 }} />
                <div style={{ flex:1, height:2, background:'linear-gradient(90deg, #ef4444 70%, transparent)' }} />
              </div>
            )}

            {/* Ghost de drag */}
            {ghostPos && (
              <div style={{
                position:'absolute', pointerEvents:'none', zIndex:20,
                top: ghostPos.top,
                left: 56 + ghostPos.profIdx * COL_W + 3,
                width: COL_W - 6, height: ghostPos.height,
                borderRadius:8,
                border:`2px dashed ${ghostPos.color}`,
                background:`${ghostPos.color}18`,
                boxShadow:`0 4px 20px ${ghostPos.color}30`,
              }} />
            )}

            {/* Bloques de citas */}
            {PROFS.map((prof, pi) => {
              const profKey   = prof.id || prof.nombre
              const profClr   = PROF_CLR[profKey] || col
              const profCitas = citasDia.filter(c =>
                (c.profesionales?.id || c.profesionales?.nombre) === profKey
              )
              // Detectar solapamientos entre citas activas del mismo profesional
              const citasActivas = profCitas.filter(c =>
                !['cancelada','no_asistio'].includes(c.estado) && !c.notas?.startsWith('__bloqueo__')
              )
              const conflictos = new Set()
              for (let a = 0; a < citasActivas.length; a++) {
                for (let b = a + 1; b < citasActivas.length; b++) {
                  const sA = new Date(citasActivas[a].fecha_inicio)
                  const eA = new Date(citasActivas[a].fecha_fin || citasActivas[a].fecha_inicio)
                  const sB = new Date(citasActivas[b].fecha_inicio)
                  const eB = new Date(citasActivas[b].fecha_fin || citasActivas[b].fecha_inicio)
                  if (sA < eB && eA > sB) { conflictos.add(citasActivas[a].id); conflictos.add(citasActivas[b].id) }
                }
              }
              return profCitas.map(c => {
                const top      = minOffset(c.fecha_inicio)
                const height   = durPx(c)
                const estColor = ESTADO_COLOR[c.estado] || '#71717a'
                const cancelada = ['cancelada','no_asistio'].includes(c.estado)
                const tags = c.clientes_agenda?.tags || []
                const isStar = tags.includes('star') || tags.includes('vip')
                const esBloqueo = c.notas?.startsWith('__bloqueo__')
                const motiBloqueo = esBloqueo ? c.notas.slice(11) : ''
                const tieneConflicto = conflictos.has(c.id)
                if (top < 0 || top > TOTAL_H) return null
                const isDragged = ghostPos && draggingRef.current?.citaId === c.id

                if (esBloqueo) return (
                  <div key={c.id} onClick={() => setSelCita(c)} style={{
                    position:'absolute',
                    top, left: 56 + pi * COL_W + 3,
                    width: COL_W - 6, height: height - 2,
                    borderRadius:8, cursor:'pointer',
                    background:'repeating-linear-gradient(45deg,rgba(113,113,122,0.12),rgba(113,113,122,0.12) 4px,rgba(113,113,122,0.04) 4px,rgba(113,113,122,0.04) 10px)',
                    border:'1.5px solid rgba(113,113,122,0.3)',
                    borderLeft:'3px solid #71717a',
                    padding:'4px 7px', overflow:'hidden',
                    userSelect:'none',
                  }}>
                    <div style={{ fontSize:10, fontWeight:800, color:'#71717a' }}>🚫 Bloqueado</div>
                    {motiBloqueo && height > SLOT_H && (
                      <div style={{ fontSize:10, color:'#71717a80', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {motiBloqueo}
                      </div>
                    )}
                  </div>
                )

                return (
                  <div key={c.id} style={{
                    position:'absolute',
                    top, left: 56 + pi * COL_W + 3,
                    width: COL_W - 6, height: height - 2,
                    borderRadius:8,
                    cursor: cancelada || c.estado === 'completada' ? 'pointer' : 'grab',
                    background: cancelada ? 'rgba(113,113,122,0.10)' : `${profClr}18`,
                    border:`1.5px solid ${cancelada ? '#71717a44' : profClr + '60'}`,
                    borderLeft:`3px solid ${cancelada ? '#71717a' : profClr}`,
                    padding:'4px 7px', overflow:'hidden',
                    boxShadow:`0 1px 4px ${profClr}20`,
                    opacity: isDragged ? 0.2 : cancelada ? 0.6 : 1,
                    userSelect:'none', touchAction:'none',
                  }}
                  onPointerDown={e => {
                    if (cancelada || c.estado === 'completada') return
                    e.currentTarget.setPointerCapture(e.pointerId)
                    draggingRef.current = { citaId:c.id, profIdx:pi, origTop:top, curTop:top, curProfIdx:pi, height:height-2, startY:e.clientY, startX:e.clientX, moved:false, cita:c }
                  }}
                  onPointerMove={e => {
                    const dr = draggingRef.current
                    if (!dr || dr.citaId !== c.id) return
                    const dY = e.clientY - dr.startY
                    const dX = e.clientX - dr.startX
                    if (!dr.moved && Math.abs(dY) < 6 && Math.abs(dX) < 6) return
                    const snapped = Math.round((dr.origTop + dY) / SLOT_H) * SLOT_H
                    const curTop = Math.max(0, Math.min(TOTAL_H - dr.height, snapped))
                    const curProfIdx = Math.max(0, Math.min(PROFS.length - 1, dr.profIdx + Math.round(dX / COL_W)))
                    draggingRef.current = { ...dr, curTop, curProfIdx, moved:true }
                    setGhostPos({ top:curTop, profIdx:curProfIdx, height:dr.height, color:profClr })
                  }}
                  onPointerUp={async e => {
                    const dr = draggingRef.current
                    if (!dr || dr.citaId !== c.id) return
                    e.currentTarget.releasePointerCapture(e.pointerId)
                    draggingRef.current = null
                    setGhostPos(null)
                    if (!dr.moved) { setSelCita(c); return }
                    const minsFromStart = (dr.curTop / SLOT_H) * 30
                    const totalMins = H_START * 60 + minsFromStart
                    const pad = n => String(Math.floor(n)).padStart(2,'0')
                    const newStart = `${selDay}T${pad(totalMins/60)}:${pad(totalMins%60)}:00`
                    const durMin = c.servicios?.duracion_min || 60
                    const endMins = totalMins + durMin
                    const newEnd = `${selDay}T${pad(endMins/60)}:${pad(endMins%60)}:00`
                    const updates = { fecha_inicio:newStart, fecha_fin:newEnd }
                    if (dr.curProfIdx !== dr.profIdx) updates.profesional_id = PROFS[dr.curProfIdx].id
                    await supabase.from('citas').update(updates).eq('id', c.id)
                    cargarMes()
                  }}
                  >
                    <div style={{ position:'absolute', top:5, right:5,
                      width:7, height:7, borderRadius:'50%', background:estColor }} />
                    {tieneConflicto && (
                      <div style={{ position:'absolute', top:3, left:4, fontSize:9, lineHeight:1 }} title="Solapamiento de horario">⚠️</div>
                    )}
                    {c.estado === 'completada' && (
                      <div style={{ position:'absolute', bottom:4, right:5, fontSize:9, opacity:0.7 }}>🔒</div>
                    )}
                    <div style={{ fontSize:10, fontWeight:800, color: cancelada ? '#71717a' : profClr, lineHeight:1.3 }}>
                      {fmtHora(c.fecha_inicio)}{isStar ? ' ⭐' : ''}
                    </div>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--text)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {c.clientes_agenda?.nombre?.split(' ')[0] || '—'}
                    </div>
                    {height > SLOT_H && (
                      <div style={{ fontSize:10, color:'var(--text-3)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.servicios?.nombre}
                      </div>
                    )}
                  </div>
                )
              })
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:'0 0 16px' }}>

      {/* ── Navegación (mes / semana / día) ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12, gap:6 }}>
        <button
          onClick={() => {
            if (vistaAgenda === 'mes')    setViewDate(new Date(year, month - 1, 1))
            if (vistaAgenda === 'semana') shiftDia(-7)
            if (vistaAgenda === 'dia')    shiftDia(-1)
          }}
          style={{ width:38, height:38, borderRadius:12, border:'none',
            background:`${col}12`, color:col, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Ico d="M15 19l-7-7 7-7" size={18} />
        </button>

        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:vistaAgenda==='dia'?15:18,
            color:'var(--text)', textAlign:'center', margin:0, lineHeight:1.2 }}>
            {vistaAgenda === 'mes'    && `${MESES[month]} ${year}`}
            {vistaAgenda === 'semana' && semanaLabel()}
            {vistaAgenda === 'dia'    && new Date(selDay+'T12:00:00').toLocaleDateString('es-CO',{ weekday:'long', day:'numeric', month:'long' })}
          </h2>
          {/* Botón Hoy — solo si no estamos ya en hoy */}
          {selDay !== today.toISOString().slice(0,10) && (
            <button
              onClick={() => {
                const hoyIso = today.toISOString().slice(0,10)
                setSelDay(hoyIso)
                setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
              }}
              style={{
                marginTop:4, padding:'2px 10px', borderRadius:6,
                background:`${col}18`, border:`1px solid ${col}40`,
                color:col, fontSize:10, fontWeight:700, cursor:'pointer',
              }}
            >
              Hoy
            </button>
          )}
        </div>

        <button
          onClick={() => {
            if (vistaAgenda === 'mes')    setViewDate(new Date(year, month + 1, 1))
            if (vistaAgenda === 'semana') shiftDia(+7)
            if (vistaAgenda === 'dia')    shiftDia(+1)
          }}
          style={{ width:38, height:38, borderRadius:12, border:'none',
            background:`${col}12`, color:col, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Ico d="M9 5l7 7-7 7" size={18} />
        </button>
      </div>

      {/* ── Toggle Mes / Semana / Día ── */}
      <div style={{ display:'flex', gap:4, margin:'0 16px 8px',
        background:'var(--card)', boxShadow:'0 1px 8px rgba(0,0,0,0.1)', borderRadius:12, padding:4 }}>
        {[['mes','Mes'],['semana','Sem'],['dia','Día']].map(([v,label]) => (
          <button key={v} onClick={() => { setVistaAgenda(v); if (v !== 'dia') { setFiltroProf(null); setFiltroSede(null) } }} style={{
            flex:1, padding:'8px 0', borderRadius:8, cursor:'pointer', border:'none',
            background: vistaAgenda === v ? col : 'transparent',
            color: vistaAgenda === v ? '#fff' : 'var(--text-3)',
            fontWeight:700, fontSize:13, transition:'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Búsqueda de citas ── */}
      <div style={{ margin:'0 16px 12px', position:'relative' }}>
        <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-3)' }}>
          <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={15} />
        </div>
        <input
          className="sp-input"
          placeholder="Buscar cliente, servicio o profesional…"
          value={busqAgenda}
          onChange={e => setBusqAgenda(e.target.value)}
          style={{ paddingLeft:34, fontSize:13 }}
        />
        {busqAgenda && (
          <button onClick={() => setBusqAgenda('')} style={{
            position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
            background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:16, lineHeight:1, padding:2,
          }}>×</button>
        )}
      </div>

      {/* ── Resultados de búsqueda ── */}
      {busqAgenda.trim() && (
        <div style={{ padding:'0 16px' }}>
          {citasBusqueda.length === 0 ? (
            <div className="sp-empty">
              <span className="sp-empty-icon">🔍</span>
              <p className="sp-empty-title">Sin resultados</p>
              <p className="sp-empty-sub">No hay citas que coincidan en el mes actual</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', marginBottom:2 }}>
                {citasBusqueda.length} resultado{citasBusqueda.length !== 1 ? 's' : ''} en {MESES[viewDate.getMonth()]}
              </p>
              {citasBusqueda.map(c => (
                <button key={c.id} onClick={() => setSelCita(c)} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                  borderRadius:14, border:`1.5px solid ${ESTADO_COLOR[c.estado] || col}22`,
                  background:'var(--card)', cursor:'pointer', textAlign:'left', width:'100%',
                }}>
                  <div style={{
                    width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background: ESTADO_COLOR[c.estado] || col,
                    boxShadow:`0 0 6px ${ESTADO_COLOR[c.estado] || col}60`,
                  }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', marginBottom:2 }}>
                      {c.clientes_agenda?.nombre || '—'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>
                      {c.servicios?.nombre || '—'} · {c.profesionales?.nombre?.split(' ')[0] || '—'}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)', flexShrink:0, textAlign:'right' }}>
                    <div style={{ fontWeight:600 }}>{new Date(c.fecha_inicio+'Z').toLocaleDateString('es-CO',{day:'numeric',month:'short'})}</div>
                    <div>{c.fecha_inicio.substring(11,16)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Vistas (ocultas durante búsqueda) ── */}
      {!busqAgenda.trim() && (<>

      {vistaAgenda === 'semana' && <VistaSemana />}
      {vistaAgenda === 'dia' && (<>
        {/* Filtro de sede — solo visible cuando hay más de una */}
        {sedes.length > 1 && (
          <div style={{ display:'flex', gap:6, padding:'0 16px 6px', overflowX:'auto', overflowY:'clip' }}>
            <button onClick={() => { setFiltroSede(null); setFiltroProf(null) }} style={{
              padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
              background: filtroSede === null ? col : 'rgba(255,255,255,0.06)',
              color: filtroSede === null ? '#fff' : 'var(--text-3)',
              fontSize:12, fontWeight:700, transition:'all 0.15s',
            }}>Todas las sedes</button>
            {sedes.map(s => (
              <button key={s.id} onClick={() => { setFiltroSede(filtroSede === s.id ? null : s.id); setFiltroProf(null) }} style={{
                padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
                background: filtroSede === s.id ? col : 'rgba(255,255,255,0.06)',
                color: filtroSede === s.id ? '#fff' : 'var(--text-3)',
                fontSize:12, fontWeight:700, transition:'all 0.15s',
              }}>📍 {s.nombre}</button>
            ))}
          </div>
        )}
        {/* Filtro de profesional */}
        {profesionales.length > 1 && (
          <div style={{ display:'flex', gap:6, padding:'0 16px 10px', overflowX:'auto', overflowY:'clip' }}>
            <button onClick={() => setFiltroProf(null)} style={{
              padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
              background: filtroProf === null ? col : 'rgba(255,255,255,0.06)',
              color: filtroProf === null ? '#fff' : 'var(--text-3)',
              fontSize:12, fontWeight:700, transition:'all 0.15s',
            }}>Todos</button>
            {profesionales.map(p => (
              <button key={p.id} onClick={() => setFiltroProf(filtroProf === p.id ? null : p.id)} style={{
                padding:'5px 14px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
                background: filtroProf === p.id ? (p.color || col) : 'rgba(255,255,255,0.06)',
                color: filtroProf === p.id ? '#fff' : 'var(--text-3)',
                fontSize:12, fontWeight:700, transition:'all 0.15s',
              }}>{p.nombre?.split(' ')[0]}</button>
            ))}
          </div>
        )}
        {/* Botón bloquear franja — visible en vista día */}
        <div style={{ display:'flex', justifyContent:'flex-end', padding:'0 16px 8px' }}>
          <button onClick={() => {
            setBloqueoProf(profesionales[0]?.id || '')
            setBloqueoHIni('09:00')
            setBloqueoHFin('10:00')
            setBloqueoNote('')
            setBloqueoModal(true)
          }} style={{
            padding:'6px 13px', borderRadius:9, border:'1px solid rgba(113,113,122,0.3)',
            background:'rgba(113,113,122,0.08)', color:'var(--text-3)',
            fontSize:12, fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', gap:5,
          }}>
            🚫 Bloquear franja
          </button>
        </div>

        <VistaDia />
      </>)}

      {vistaAgenda === 'mes' && (<>
      {/* Cabecera días semana */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'0 8px', marginBottom:6 }}>
        {DIAS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700,
            color:'var(--text-3)', padding:'4px 0', letterSpacing:0.5 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grilla días */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'0 8px', gap:2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const iso    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = iso === today.toISOString().slice(0, 10)
          const isSel   = iso === selDay
          const dc      = citasPorDia[iso] || []
          return (
            <button key={day} onClick={() => setSelDay(iso)} style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              padding:'8px 2px 10px', borderRadius:12, cursor:'pointer', border:'none',
              background: isSel ? col : isToday ? `${col}20` : 'transparent',
              color: isSel ? '#fff' : isToday ? col : 'var(--text)',
              transition:'all 0.15s',
            }}>
              <span style={{ fontFamily:'Outfit', fontWeight: isToday ? 800 : 600, fontSize:16 }}>{day}</span>
              {dc.length > 0 && (
                <div style={{ display:'flex', gap:2, marginTop:4 }}>
                  {dc.slice(0, 3).map((c, ci) => (
                    <span key={ci} style={{
                      width:5, height:5, borderRadius:'50%',
                      background: isSel ? 'rgba(255,255,255,0.7)' : (ESTADO_COLOR[c.estado] || col),
                    }} />
                  ))}
                  {dc.length > 3 && (
                    <span style={{ fontSize:8, color: isSel ? 'rgba(255,255,255,0.7)' : 'var(--text-3)', fontWeight:700 }}>
                      +{dc.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ margin:'16px 16px 0', borderTop:'1px solid var(--border)' }} />

      {/* Leyenda */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', padding:'10px 16px 0' }}>
        {Object.entries(ESTADO_LABEL).map(([e, label]) => (
          <div key={e} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-3)' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: ESTADO_COLOR[e], flexShrink:0 }} />
            {label}
          </div>
        ))}
      </div>

      {/* ── Citas del día seleccionado ── */}
      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <h3 style={{ fontFamily:'Outfit', fontWeight:700, fontSize:16, color:'var(--text)' }}>
            {new Date(selDay + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })}
          </h3>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {esperaDia > 0 && (
              <span title="Personas en lista de espera" style={{ fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:8, background:'rgba(245,158,11,0.15)', color:'#fbbf24' }}>
                🔔 {esperaDia} en espera
              </span>
            )}
            <span style={{ fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:8, background:`${col}20`, color:col }}>
              {citasDia.filter(c => !c.notas?.startsWith('__bloqueo__')).length} cita{citasDia.filter(c => !c.notas?.startsWith('__bloqueo__')).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:74, borderRadius:14 }} />)}
          </div>
        ) : citasDia.filter(c => !c.notas?.startsWith('__bloqueo__')).length === 0 ? (
          <div className="sp-empty">
            <span className="sp-empty-icon">📅</span>
            <p className="sp-empty-title">Sin citas</p>
            <p className="sp-empty-sub">No hay citas agendadas para este día</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {citasDia.filter(c => !c.notas?.startsWith('__bloqueo__')).map(c => (
              <button key={c.id} onClick={() => setSelCita(c)} style={{
                padding:'14px 16px', borderRadius:14, width:'100%', textAlign:'left',
                background:`linear-gradient(135deg,${ESTADO_COLOR[c.estado] || col}10,var(--card))`,
                boxShadow:'0 2px 12px rgba(0,0,0,0.1)',
                display:'flex', alignItems:'center', gap:14,
                position:'relative', overflow:'hidden', cursor:'pointer',
              }}>
                <div style={{
                  position:'absolute', left:0, top:0, bottom:0, width:3,
                  background: ESTADO_COLOR[c.estado] || col,
                }} />
                <div style={{ paddingLeft:8, flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:15, color:'var(--text)' }}>
                      {c.clientes_agenda?.nombre || '—'}
                    </span>
                    <span style={{
                      fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6,
                      background:`${ESTADO_COLOR[c.estado] || col}20`,
                      color: ESTADO_COLOR[c.estado] || col,
                      textTransform:'uppercase',
                    }}>
                      {ESTADO_LABEL[c.estado] || c.estado}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-3)', marginTop:3 }}>
                    {fmtHora(c.fecha_inicio)} · {c.servicios?.nombre || '—'} · {c.profesionales?.nombre?.split(' ')[0] || '—'}
                  </div>
                </div>
                <Ico d="M9 5l7 7-7 7" size={16} />
              </button>
            ))}
          </div>
        )}
      </div>

      </>)}
      </>)}

      {/* ── Sheet detalle + cambio de estado ── */}
      {selCita && selCita.notas?.startsWith('__bloqueo__') && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSelCita(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p className="sp-sheet-title" style={{ margin:0 }}>Franja bloqueada</p>
              <button onClick={() => setSelCita(null)} style={{ width:30, height:30, borderRadius:8, border:'none', background:'rgba(255,255,255,0.08)', color:'var(--text-3)', cursor:'pointer', fontSize:18, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--card)' }}>
                <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:2 }}>Profesional</div>
                <div style={{ fontWeight:700, color:'var(--text)' }}>{selCita.profesionales?.nombre || '—'}</div>
              </div>
              <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--card)' }}>
                <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:2 }}>Horario</div>
                <div style={{ fontWeight:700, color:'var(--text)' }}>
                  {selCita.fecha_inicio.substring(11,16)} – {selCita.fecha_fin?.substring(11,16) || '—'}
                </div>
              </div>
              {selCita.notas.slice(11) && (
                <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--card)' }}>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:2 }}>Motivo</div>
                  <div style={{ fontWeight:600, color:'var(--text)' }}>{selCita.notas.slice(11)}</div>
                </div>
              )}
            </div>
            <button onClick={eliminarBloqueo} disabled={actualizando} style={{
              width:'100%', padding:'14px', borderRadius:13, cursor:'pointer', border:'none',
              background:'rgba(239,68,68,0.1)', color:'#ef4444',
              fontWeight:700, fontSize:14, opacity: actualizando ? 0.6 : 1,
            }}>
              {actualizando ? '…' : '🗑 Eliminar bloqueo'}
            </button>
          </div>
        </>
      )}

      {selCita && !selCita.notas?.startsWith('__bloqueo__') && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSelCita(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <p className="sp-sheet-title" style={{ margin:0 }}>Detalle cita</p>
                {(() => {
                  const tags = selCita.clientes_agenda?.tags || []
                  if (tags.includes('vip'))  return <span style={{ fontSize:11, fontWeight:800, padding:'2px 7px', borderRadius:6, background:'rgba(251,191,36,0.15)', color:'#fbbf24' }}>VIP</span>
                  if (tags.includes('star')) return <span style={{ fontSize:13 }}>⭐</span>
                  return null
                })()}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{
                  fontSize:12, fontWeight:700, padding:'5px 12px', borderRadius:8,
                  background:`${ESTADO_COLOR[selCita.estado] || col}20`,
                  color: ESTADO_COLOR[selCita.estado] || col,
                }}>
                  {ESTADO_LABEL[selCita.estado] || selCita.estado}
                </span>
                <button onClick={() => setSelCita(null)} style={{
                  width:30, height:30, borderRadius:8, border:'none',
                  background:'rgba(255,255,255,0.08)', color:'var(--text-3)', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:18, lineHeight:1,
                }}>×</button>
              </div>
            </div>

            {/* WA rápido */}
            {selCita.clientes_agenda?.telefono && (
              <a
                href={`https://wa.me/57${selCita.clientes_agenda.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(
                  `Hola ${selCita.clientes_agenda.nombre?.split(' ')[0] || 'cliente'} 👋 Te confirmamos tu cita de ${selCita.servicios?.nombre || 'servicio'} el ${new Date(selCita.fecha_inicio).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})} a las ${fmtHora(selCita.fecha_inicio)}. ¡Te esperamos en ${tenant?.nombre || 'el salón'}! 💅`
                )}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'11px 16px', borderRadius:13, marginBottom:16,
                  background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)',
                  color:'#22c55e', fontWeight:700, fontSize:14, textDecoration:'none',
                }}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#22c55e">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.849L.054 23.45a.5.5 0 00.612.612l5.601-1.478A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.985 0-3.838-.551-5.418-1.508l-.387-.23-4.007 1.056 1.057-3.923-.252-.4A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                Enviar recordatorio por WhatsApp
              </a>
            )}

            {/* Info rows */}
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {[
                {
                  ico: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
                  txt: selCita.clientes_agenda?.nombre || '—',
                  sub: selCita.clientes_agenda?.telefono,
                },
                {
                  ico: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
                  txt: selCita.servicios?.nombre || '—',
                  sub: [
                    selCita.servicios?.duracion_min ? `${selCita.servicios.duracion_min}min` : null,
                    selCita.servicios?.precio > 0 ? `$${Number(selCita.servicios.precio).toLocaleString('es-CO')}` : null,
                  ].filter(Boolean).join(' · '),
                },
                {
                  ico: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
                  txt: selCita.profesionales?.nombre || '—',
                },
                {
                  ico: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
                  txt: `${fmtHora(selCita.fecha_inicio)}${selCita.fecha_fin ? ' – ' + fmtHora(selCita.fecha_fin) : ''}`,
                  sub: new Date(selCita.fecha_inicio).toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' }),
                },
              ].map((row, i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                  borderRadius:12, background:'var(--card)', boxShadow:'0 1px 8px rgba(0,0,0,0.08)',
                }}>
                  <div style={{ color:col, flexShrink:0 }}><Ico d={row.ico} size={17} /></div>
                  <div>
                    <div style={{ fontSize:14, color:'var(--text)', fontWeight:600 }}>{row.txt}</div>
                    {row.sub && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{row.sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Abono a reserva ── */}
            {selCita.servicios?.precio > 0 && !['cancelada','no_asistio'].includes(selCita.estado) && (() => {
              const precio = Number(selCita.servicios.precio)
              const anticipo = Number(selCita.anticipo) || 0
              const saldo = Math.max(0, precio - anticipo)
              return (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>
                    Abono a reserva
                  </div>
                  <div style={{ padding:'12px 14px', borderRadius:12, background:'var(--card)', boxShadow:'0 1px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>Precio</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>${precio.toLocaleString('es-CO')}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:12, color:'var(--text-3)' }}>Anticipo pagado</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'#22c55e' }}>${anticipo.toLocaleString('es-CO')}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--border)', paddingTop:8, marginBottom: saldo > 0 && !pago ? 10 : 0 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text-3)' }}>Saldo pendiente</span>
                      <span style={{ fontSize:14, fontWeight:800, color: saldo > 0 ? col : '#22c55e' }}>
                        ${saldo.toLocaleString('es-CO')}
                      </span>
                    </div>
                    {saldo > 0 && !pago && (
                      <div style={{ display:'flex', gap:8 }}>
                        <input className="sp-input" type="number" value={anticoInput}
                          onChange={e => setAnticoInput(e.target.value)}
                          placeholder="Registrar abono ($)" style={{ flex:1, fontSize:13 }} />
                        <button onClick={registrarAnticipo} disabled={guardandoAnticipo || !anticoInput}
                          style={{
                            padding:'10px 14px', borderRadius:9, border:'none', cursor:'pointer',
                            background: col, color:'#fff', fontWeight:700, fontSize:12, flexShrink:0,
                            opacity: (guardandoAnticipo || !anticoInput) ? 0.6 : 1,
                          }}>
                          {guardandoAnticipo ? '…' : '+ Abono'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Nota rápida */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>
                Nota interna
              </div>
              <div style={{ position:'relative' }}>
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  onBlur={guardarNota}
                  placeholder="Agregar nota sobre esta cita…"
                  rows={2}
                  style={{
                    width:'100%', padding:'10px 12px', borderRadius:10,
                    border:'1px solid var(--border)', background:'var(--card)',
                    color:'var(--text)', fontSize:13, resize:'none', outline:'none',
                    boxSizing:'border-box', fontFamily:'inherit',
                  }}
                />
                {guardandoNota && (
                  <div style={{ position:'absolute', top:8, right:8 }}>
                    <div className="sp-spinner" style={{ width:14, height:14, borderWidth:2 }} />
                  </div>
                )}
              </div>
            </div>

            {/* Acciones */}
            {accionesCita.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {accionesCita.map(a => (
                  <button key={a.estado} onClick={() => cambiarEstado(a.estado)} disabled={actualizando}
                    style={{
                      width:'100%', padding:'14px', borderRadius:13, cursor:'pointer',
                      background:`${a.color}12`, border:`1px solid ${a.color}40`,
                      color:a.color, fontWeight:700, fontSize:14,
                      opacity: actualizando ? 0.6 : 1,
                      fontFamily:'Plus Jakarta Sans',
                    }}>
                    {actualizando ? '…' : a.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginBottom:16 }} />
            )}

            {/* Duplicar / Crear serie */}
            {!dupMode && !serieMode ? (
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <button onClick={() => setDupMode(true)} style={{
                  flex:1, padding:'12px', borderRadius:13, cursor:'pointer',
                  background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.22)',
                  color:'#818cf8', fontWeight:700, fontSize:12,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                }}>
                  <Ico d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" size={14} />
                  Duplicar
                </button>
                <button onClick={() => setSerieMode(true)} style={{
                  flex:1, padding:'12px', borderRadius:13, cursor:'pointer',
                  background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.22)',
                  color:'#818cf8', fontWeight:700, fontSize:12,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                }}>
                  <Ico d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={14} />
                  Crear serie
                </button>
              </div>
            ) : dupMode ? (
              <div style={{ marginBottom:16, padding:'14px 16px', borderRadius:13,
                background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.22)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#818cf8', marginBottom:10 }}>
                  Duplicar cita — elige fecha destino
                </div>
                <input type="date" value={dupFecha} onChange={e => setDupFecha(e.target.value)}
                  className="sp-input" style={{ marginBottom:10, fontSize:13 }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={duplicarCita} disabled={!dupFecha || actualizando} style={{
                    flex:1, padding:'11px', borderRadius:11, border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff',
                    fontWeight:700, fontSize:13, opacity: (!dupFecha || actualizando) ? 0.6 : 1,
                  }}>
                    {actualizando ? '…' : 'Confirmar'}
                  </button>
                  <button onClick={() => { setDupMode(false); setDupFecha('') }} style={{
                    padding:'11px 16px', borderRadius:11, border:'none', cursor:'pointer',
                    background:'var(--card)', color:'var(--text-3)', fontWeight:700, fontSize:13,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.1)',
                  }}>Cancelar</button>
                </div>
              </div>
            ) : serieMode ? (
              <div style={{ marginBottom:16, padding:'14px 16px', borderRadius:13,
                background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.22)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#818cf8', marginBottom:12 }}>
                  Crear citas recurrentes
                </div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>Frecuencia</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {[['semanal','Semanal'],['quincenal','Quincenal'],['mensual','Mensual']].map(([v,l]) => (
                      <button key={v} onClick={() => setSerieFreq(v)} style={{
                        flex:1, padding:'8px 4px', borderRadius:9, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
                        background: serieFreq === v ? '#6366f1' : 'var(--card)',
                        color: serieFreq === v ? '#fff' : 'var(--text-3)',
                      }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>Repeticiones: {serieReps}</div>
                  <input type="range" min={2} max={24} value={serieReps}
                    onChange={e => setSerieReps(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'#6366f1' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-3)', marginTop:2 }}>
                    <span>2</span><span>24</span>
                  </div>
                </div>
                <div style={{ fontSize:11, color:'#818cf8', marginBottom:12, padding:'8px 10px',
                  background:'rgba(99,102,241,0.07)', borderRadius:8 }}>
                  Se crearán {serieReps} citas {serieFreq === 'semanal' ? 'cada semana' : serieFreq === 'quincenal' ? 'cada 2 semanas' : 'cada mes'} con el mismo horario y profesional
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={crearSerie} disabled={creandoSerie} style={{
                    flex:1, padding:'11px', borderRadius:11, border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff',
                    fontWeight:700, fontSize:13, opacity: creandoSerie ? 0.6 : 1,
                  }}>
                    {creandoSerie ? '…' : `Crear ${serieReps} citas`}
                  </button>
                  <button onClick={() => setSerieMode(false)} style={{
                    padding:'11px 14px', borderRadius:11, border:'none', cursor:'pointer',
                    background:'var(--card)', color:'var(--text-3)', fontWeight:700, fontSize:13,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.1)',
                  }}>Cancelar</button>
                </div>
              </div>
            ) : null}

            {/* ── Sección de pago ── */}
            {!['cancelada','no_asistio'].includes(selCita.estado) && (
              <div>
                <div style={{ height:1, background:'var(--border)', marginBottom:16 }} />

                {loadPago ? (
                  <div style={{ display:'flex', justifyContent:'center', padding:'12px 0' }}>
                    <div className="sp-spinner" style={{ width:20, height:20 }} />
                  </div>
                ) : pago ? (
                  /* ── Pago registrado ── */
                  <div style={{ padding:'14px 16px', borderRadius:14,
                    background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#4ade80', textTransform:'uppercase', letterSpacing:0.5 }}>
                        ✓ Pago registrado
                      </span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text-3)' }}>
                        {{efectivo:'💵 Efectivo',nequi:'📱 Nequi',daviplata:'📱 Daviplata',
                          transferencia:'🏦 Transferencia',tarjeta:'💳 Tarjeta',wompi:'🌐 Wompi'}[pago.metodo] || pago.metodo}
                      </span>
                    </div>
                    <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, color:'#4ade80' }}>
                      ${Number(pago.monto).toLocaleString('es-CO')}
                    </div>
                    {pago.referencia && (
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>Ref: {pago.referencia}</div>
                    )}
                  </div>
                ) : pagoForm ? (
                  /* ── Formulario de pago ── */
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Registrar pago</span>
                      <button onClick={() => setPagoForm(false)}
                        style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:18, lineHeight:1, padding:4 }}>×</button>
                    </div>

                    {/* Método de pago — tabs */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                      {[
                        { k:'efectivo',     label:'💵 Efectivo' },
                        { k:'nequi',        label:'📱 Nequi' },
                        { k:'daviplata',    label:'📱 Daviplata' },
                        { k:'transferencia',label:'🏦 Transf.' },
                        { k:'tarjeta',      label:'💳 Tarjeta' },
                      ].map(m => (
                        <button key={m.k} onClick={() => setPagoMetodo(m.k)} style={{
                          padding:'7px 12px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:600,
                          background: pagoMetodo === m.k ? `${col}20` : 'var(--card)',
                          border: `1px solid ${pagoMetodo === m.k ? col : 'var(--border)'}`,
                          color: pagoMetodo === m.k ? col : 'var(--text-3)',
                          transition:'all 0.12s',
                        }}>
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Monto */}
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:6, textTransform:'uppercase' }}>
                        Monto ($)
                      </label>
                      <input className="sp-input" type="number" value={pagoMonto}
                        onChange={e => setPagoMonto(e.target.value)}
                        placeholder="0" style={{ fontSize:18, fontFamily:'Outfit', fontWeight:700 }} />
                    </div>

                    {/* Referencia (opcional) */}
                    {['transferencia','tarjeta','wompi','nequi','daviplata'].includes(pagoMetodo) && (
                      <div style={{ marginBottom:14 }}>
                        <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:6, textTransform:'uppercase' }}>
                          Referencia / comprobante (opcional)
                        </label>
                        <input className="sp-input" value={pagoRef}
                          onChange={e => setPagoRef(e.target.value)}
                          placeholder="Ej: #123456" />
                      </div>
                    )}

                    <button onClick={registrarPago} disabled={guardandoPago || !pagoMonto} style={{
                      width:'100%', padding:'14px', borderRadius:13,
                      background:`linear-gradient(135deg,#22c55e,#16a34a)`,
                      border:'none', color:'#fff', fontWeight:700, fontSize:14,
                      cursor: (guardandoPago || !pagoMonto) ? 'not-allowed' : 'pointer',
                      opacity: (guardandoPago || !pagoMonto) ? 0.6 : 1,
                      fontFamily:'Plus Jakarta Sans', boxShadow:'0 4px 14px rgba(34,197,94,0.3)',
                    }}>
                      {guardandoPago ? 'Guardando…' : '✓ Confirmar pago'}
                    </button>
                  </div>
                ) : (
                  /* ── Botón abrir pago ── */
                  <button onClick={() => setPagoForm(true)} style={{
                    width:'100%', padding:'14px', borderRadius:13, cursor:'pointer',
                    background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.22)',
                    color:'#4ade80', fontWeight:700, fontSize:14,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    fontFamily:'Plus Jakarta Sans',
                  }}>
                    <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={16} />
                    Registrar pago
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal: bloquear franja horaria ── */}
      {bloqueoModal && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setBloqueoModal(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <p className="sp-sheet-title" style={{ margin:0 }}>Bloquear franja</p>
              <button onClick={() => setBloqueoModal(false)} style={{ width:30, height:30, borderRadius:8, border:'none', background:'rgba(255,255,255,0.08)', color:'var(--text-3)', cursor:'pointer', fontSize:18, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', display:'block', marginBottom:6 }}>
                Profesional
              </label>
              <select value={bloqueoProf} onChange={e => setBloqueoProf(e.target.value)} className="sp-input" style={{ fontSize:14 }}>
                {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', gap:10, marginBottom:14 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', display:'block', marginBottom:6 }}>Desde</label>
                <input type="time" value={bloqueoHIni} onChange={e => setBloqueoHIni(e.target.value)} className="sp-input" />
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', display:'block', marginBottom:6 }}>Hasta</label>
                <input type="time" value={bloqueoHFin} onChange={e => setBloqueoHFin(e.target.value)} className="sp-input" />
              </div>
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', display:'block', marginBottom:6 }}>
                Motivo (opcional)
              </label>
              <input type="text" value={bloqueoNote} onChange={e => setBloqueoNote(e.target.value)}
                placeholder="Ej: Almuerzo, Reunión, Capacitación…" className="sp-input" />
            </div>

            <button onClick={crearBloqueo} disabled={!bloqueoProf || guardandoBlq} style={{
              width:'100%', padding:'14px', borderRadius:13, border:'none', cursor:'pointer',
              background:'rgba(113,113,122,0.15)', color:'var(--text)',
              fontWeight:700, fontSize:14,
              opacity: (!bloqueoProf || guardandoBlq) ? 0.6 : 1,
            }}>
              {guardandoBlq ? '…' : '🚫 Confirmar bloqueo'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
