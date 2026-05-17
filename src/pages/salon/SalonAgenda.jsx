import { useState, useEffect, useCallback } from 'react'
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
  const [nowOffset,    setNowOffset]    = useState(null)

  useEffect(() => {
    if (!tenant) return
    supabase.from('profesionales')
      .select('id,nombre,color,foto_url')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setProfesionales(data || []))
  }, [tenant])

  const cargarMes = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const y = viewDate.getFullYear()
    const m = String(viewDate.getMonth() + 1).padStart(2, '0')
    try {
      const { data } = await supabase
        .from('citas')
        .select('id, fecha_inicio, fecha_fin, estado, clientes_agenda(nombre,telefono), servicios(nombre,precio,duracion_min), profesionales(nombre)')
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

  useEffect(() => {
    if (!selCita) { setPago(null); setPagoForm(false); return }
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
      setNowOffset(((now.getHours() - 7) * 60 + now.getMinutes()) / 30 * 44)
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
      <div style={{ overflowX:'auto', paddingBottom:80 }}>
        <div style={{ display:'flex', minWidth: 7 * 78 }}>
          {diasSemana.map(iso => {
            const dc     = citasPorDia[iso] || []
            const fecha  = new Date(iso + 'T12:00:00')
            const esHoy  = iso === hoyIso
            const esSel  = iso === selDay
            const diaNom = DIAS[fecha.getDay()]
            const diaNum = fecha.getDate()
            return (
              <div key={iso} style={{ flex:1, minWidth:78, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column' }}>
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
                          <button key={c.id} onClick={() => setSelCita(c)} style={{
                            width:'100%', padding:'5px 4px', borderRadius:6, textAlign:'left',
                            background:`${clr}18`, border:`1px solid ${clr}40`, cursor:'pointer',
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
    const H_START = 7
    const H_END   = 21
    const SLOT_H  = 44  // px per 30min
    const COL_W   = 110
    const PROFS_BASE = profesionales.length > 0 ? profesionales
      : [...new Map(citasDia.map(c => [c.profesionales?.nombre, { id: c.profesionales?.nombre, nombre: c.profesionales?.nombre, color: col }])).values()]
    const PROFS = filtroProf ? PROFS_BASE.filter(p => p.id === filtroProf) : PROFS_BASE

    function minOffset(iso) {
      const [h, m] = iso.substring(11, 16).split(':').map(Number)
      return ((h - H_START) * 60 + m) / 30 * SLOT_H
    }
    function durPx(c) {
      if (c.fecha_fin) {
        const dur = (new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / 60000
        return Math.max(SLOT_H, dur / 30 * SLOT_H)
      }
      return Math.max(SLOT_H, (c.servicios?.duracion_min || 60) / 30 * SLOT_H)
    }

    const TOTAL_H = (H_END - H_START) * 2 * SLOT_H

    return (
      <div style={{ overflowX:'auto', paddingBottom:80 }}>
        <div style={{ minWidth: 56 + PROFS.length * COL_W, position:'relative' }}>
          {/* Header profesionales */}
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
            {nowOffset !== null && nowOffset >= 0 && nowOffset <= TOTAL_H && (
              <div style={{ position:'absolute', left:56, right:0, top:nowOffset, zIndex:6, pointerEvents:'none', display:'flex', alignItems:'center' }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'#ef4444', flexShrink:0, marginLeft:-1 }} />
                <div style={{ flex:1, height:2, background:'linear-gradient(90deg, #ef4444 70%, transparent)' }} />
              </div>
            )}

            {/* Bloques de citas */}
            {PROFS.map((prof, pi) => {
              const profCitas = citasDia.filter(c => c.profesionales?.nombre === prof.nombre)
              return profCitas.map(c => {
                const top    = minOffset(c.fecha_inicio)
                const height = durPx(c)
                const clr    = ESTADO_COLOR[c.estado] || col
                if (top < 0 || top > TOTAL_H) return null
                return (
                  <div key={c.id} onClick={() => setSelCita(c)} style={{
                    position:'absolute',
                    top, left: 56 + pi * COL_W + 3,
                    width: COL_W - 6, height: height - 2,
                    borderRadius:8, cursor:'pointer',
                    background:`${clr}18`, border:`1.5px solid ${clr}55`,
                    padding:'4px 7px', overflow:'hidden',
                    boxShadow:`0 1px 4px ${clr}22`,
                  }}>
                    <div style={{ fontSize:10, fontWeight:800, color:clr, lineHeight:1.3 }}>
                      {fmtHora(c.fecha_inicio)}
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
          style={{ width:38, height:38, borderRadius:12, border:'1px solid var(--border)',
            background:'var(--card)', color:'var(--text-2)', cursor:'pointer',
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
          style={{ width:38, height:38, borderRadius:12, border:'1px solid var(--border)',
            background:'var(--card)', color:'var(--text-2)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Ico d="M9 5l7 7-7 7" size={18} />
        </button>
      </div>

      {/* ── Toggle Mes / Semana / Día ── */}
      <div style={{ display:'flex', gap:4, margin:'0 16px 12px',
        background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:4 }}>
        {[['mes','Mes'],['semana','Sem'],['dia','Día']].map(([v,label]) => (
          <button key={v} onClick={() => { setVistaAgenda(v); if (v !== 'dia') setFiltroProf(null) }} style={{
            flex:1, padding:'8px 0', borderRadius:8, cursor:'pointer', border:'none',
            background: vistaAgenda === v ? col : 'transparent',
            color: vistaAgenda === v ? '#fff' : 'var(--text-3)',
            fontWeight:700, fontSize:13, transition:'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {vistaAgenda === 'semana' && <VistaSemana />}
      {vistaAgenda === 'dia' && (<>
        {profesionales.length > 1 && (
          <div style={{ display:'flex', gap:6, padding:'0 16px 10px', overflowX:'auto' }}>
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
              {citasDia.length} cita{citasDia.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:74, borderRadius:14 }} />)}
          </div>
        ) : citasDia.length === 0 ? (
          <div className="sp-empty">
            <span className="sp-empty-icon">📅</span>
            <p className="sp-empty-title">Sin citas</p>
            <p className="sp-empty-sub">No hay citas agendadas para este día</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {citasDia.map(c => (
              <button key={c.id} onClick={() => setSelCita(c)} style={{
                padding:'14px 16px', borderRadius:14, width:'100%', textAlign:'left',
                background:'var(--card)', border:'1px solid var(--border)',
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

      {/* ── Sheet detalle + cambio de estado ── */}
      {selCita && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSelCita(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <p className="sp-sheet-title" style={{ margin:0 }}>Detalle cita</p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{
                  fontSize:12, fontWeight:700, padding:'5px 12px', borderRadius:8,
                  background:`${ESTADO_COLOR[selCita.estado] || col}20`,
                  color: ESTADO_COLOR[selCita.estado] || col,
                }}>
                  {ESTADO_LABEL[selCita.estado] || selCita.estado}
                </span>
                <button onClick={() => setSelCita(null)} style={{
                  width:30, height:30, borderRadius:8, border:'1px solid var(--border)',
                  background:'transparent', color:'var(--text-3)', cursor:'pointer',
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
                  borderRadius:12, background:'var(--card)', border:'1px solid var(--border)',
                }}>
                  <div style={{ color:col, flexShrink:0 }}><Ico d={row.ico} size={17} /></div>
                  <div>
                    <div style={{ fontSize:14, color:'var(--text)', fontWeight:600 }}>{row.txt}</div>
                    {row.sub && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{row.sub}</div>}
                  </div>
                </div>
              ))}
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
    </div>
  )
}
