import { useState, useEffect, useMemo } from 'react'
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

const MESES_CAL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function CalendarioPicker({ value, onChange, col }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [nav, setNav] = useState(() => {
    const [y, m] = value.split('-')
    return { y: parseInt(y), m: parseInt(m) }
  })

  function changeNav(delta) {
    setNav(p => {
      let m = p.m + delta, y = p.y
      if (m > 12) { m = 1; y++ }
      if (m < 1)  { m = 12; y-- }
      return { y, m }
    })
  }

  const daysInMonth = new Date(nav.y, nav.m, 0).getDate()
  const firstDow    = new Date(nav.y, nav.m - 1, 1).getDay()
  const startOff    = (firstDow + 6) % 7

  const cells = []
  for (let i = 0; i < startOff; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const chev = (dir) => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'l' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button type="button" onClick={() => changeNav(-1)} style={{
          width:36, height:36, borderRadius:10, border:'none',
          background:`${col}12`, color:col, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>{chev('l')}</button>
        <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>
          {MESES_CAL[nav.m - 1]} {nav.y}
        </span>
        <button type="button" onClick={() => changeNav(1)} style={{
          width:36, height:36, borderRadius:10, border:'none',
          background:`${col}12`, color:col, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>{chev('r')}</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text-3)', padding:'2px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr    = `${nav.y}-${String(nav.m).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isPast     = dateStr < hoy
          const isSelected = dateStr === value
          const isToday    = dateStr === hoy
          return (
            <button key={dateStr} type="button" disabled={isPast}
              onClick={() => onChange(dateStr)}
              style={{
                aspectRatio:'1', minHeight:36, borderRadius:8, border:'none',
                cursor: isPast ? 'default' : 'pointer',
                background: isSelected ? col : isToday ? `${col}18` : 'transparent',
                outline: isToday && !isSelected ? `1.5px solid ${col}60` : 'none',
                color: isSelected ? '#fff' : isPast ? 'var(--text-3)' : 'var(--text)',
                fontSize:13, fontWeight: isSelected || isToday ? 700 : 400,
                opacity: isPast ? 0.3 : 1,
              }}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const STEP_LABELS = ['Profesional', 'Servicios', 'Fecha y hora', 'Cliente']
const DIA_KEY = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']

function fmtCOP(n) {
  if (!n || n <= 0) return null
  return '$' + Number(n).toLocaleString('es-CO')
}

export default function SalonNuevaCita({ onClose, onCreada, clientePreId, clientePreNombre, profPreId, fechaPre }) {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [step,       setStep]       = useState(0)
  const [profs,      setProfs]      = useState([])
  const [sedes,      setSedes]      = useState([])
  const [filtroSede, setFiltroSede] = useState(null)
  const [servs,      setServs]      = useState([])
  const [slots,      setSlots]      = useState([])
  const [sinHorario, setSinHorario] = useState(false)
  const [clientes,   setClientes]   = useState([])

  const [profId,      setProfId]      = useState(null)
  const [servIds,     setServIds]     = useState([])   // multi-select
  const [fecha,       setFecha]       = useState(new Date().toISOString().slice(0,10))
  const [slot,        setSlot]        = useState(null)
  const [clienteId,   setClienteId]   = useState(null)
  const [busqCliente, setBusqCliente] = useState('')
  const [nuevoCliente,setNuevoCliente]= useState({ nombre:'', telefono:'' })
  const [modoNuevo,   setModoNuevo]   = useState(false)
  const [notasCita,   setNotasCita]   = useState('')

  useEffect(() => {
    if (clientePreId) {
      setClienteId(clientePreId)
      setBusqCliente(clientePreNombre || '')
    }
  }, [clientePreId]) // eslint-disable-line

  useEffect(() => {
    if (profPreId) {
      setProfId(profPreId)
      if (fechaPre) setFecha(fechaPre)
      setStep(1)
    }
  }, [profPreId]) // eslint-disable-line

  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState(null)

  const showToast = (msg, color = '#ef4444') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  // Derivados de servicios seleccionados
  const selectedServs  = useMemo(() => servs.filter(s => servIds.includes(s.id)), [servs, servIds])
  const duracionTotal  = useMemo(() => selectedServs.reduce((sum, s) => sum + (s.duracion_min || 0), 0), [selectedServs])
  const precioTotal    = useMemo(() => selectedServs.reduce((sum, s) => sum + (Number(s.precio) || 0), 0), [selectedServs])

  // Servicios agrupados por categoría
  const porCategoria = useMemo(() => {
    const map = {}
    servs.forEach(s => {
      const cat = s.categoria || 'General'
      if (!map[cat]) map[cat] = []
      map[cat].push(s)
    })
    return map
  }, [servs])

  function toggleServ(id) {
    setServIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setSlot(null)
  }

  // Carga profesionales + sedes
  useEffect(() => {
    if (!tenant) return
    Promise.all([
      supabase.from('profesionales').select('id, nombre, especialidad, foto_url, activo, sede_id')
        .eq('tenant_id', tenant.id).order('nombre'),
      supabase.from('sedes').select('id, nombre')
        .eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
    ]).then(([pr, sr]) => {
      setProfs((pr.data || []).filter(p => p.activo))
      setSedes(sr.data || [])
    })
  }, [tenant])

  // Carga servicios al elegir profesional — filtra por profesional_servicios si hay filas
  useEffect(() => {
    if (!profId || !tenant) return
    setServIds([])
    setSlot(null)
    ;(async () => {
      const [{ data: todos }, { data: ps }] = await Promise.all([
        supabase.from('servicios').select('id, nombre, precio, duracion_min, categoria')
          .eq('tenant_id', tenant.id).eq('activo', true).order('categoria').order('nombre'),
        supabase.from('profesional_servicios').select('servicio_id')
          .eq('tenant_id', tenant.id).eq('profesional_id', profId).eq('activo', true),
      ])
      const habilitados = ps || []
      // Si el profesional no tiene filas → puede hacer todos los servicios
      if (habilitados.length === 0) {
        setServs(todos || [])
      } else {
        const ids = new Set(habilitados.map(r => r.servicio_id))
        setServs((todos || []).filter(s => ids.has(s.id)))
      }
    })()
  }, [profId, tenant])

  // Regenera slots cuando cambia duración total, fecha o profesional
  useEffect(() => {
    if (!profId || duracionTotal === 0 || !fecha || !tenant) { setSlots([]); return }
    setSinHorario(false)
    setSlots([])
    setSlot(null)
    generarSlots(profId, fecha, duracionTotal)
  }, [profId, fecha, duracionTotal])

  async function generarSlots(pId, f, durMin) {
    const diaSemana = DIA_KEY[new Date(f + 'T12:00:00').getDay()]
    const { data: horario } = await supabase
      .from('horarios')
      .select('hora_inicio, hora_fin')
      .eq('profesional_id', pId).eq('dia', diaSemana).eq('activo', true)
      .maybeSingle()

    if (!horario) { setSinHorario(true); return }

    const [hI, mI] = horario.hora_inicio.slice(0, 5).split(':').map(Number)
    const [hF, mF] = horario.hora_fin.slice(0, 5).split(':').map(Number)
    const inicioMin = hI * 60 + mI
    const finMin    = hF * 60 + mF

    const { data: citasOcup } = await supabase
      .from('citas')
      .select('fecha_inicio, fecha_fin')
      .eq('profesional_id', pId)
      .gte('fecha_inicio', `${f}T00:00:00`)
      .lte('fecha_inicio', `${f}T23:59:59`)
      .neq('estado', 'cancelada')

    const generados = []
    for (let h = inicioMin; h + durMin <= finMin; h += 15) {
      const hh     = String(Math.floor(h / 60)).padStart(2, '0')
      const mm     = String(h % 60).padStart(2, '0')
      const inicio = `${f}T${hh}:${mm}:00`
      // Calcular fin en tiempo local (sin conversión UTC) para evitar desfase timezone
      const finDate = new Date(new Date(inicio).getTime() + durMin * 60000)
      const pad2 = n => String(n).padStart(2, '0')
      const fin = `${f}T${pad2(finDate.getHours())}:${pad2(finDate.getMinutes())}:00`
      const ocupado = (citasOcup || []).some(c => c.fecha_inicio < fin && c.fecha_fin > inicio)
      if (!ocupado) generados.push({ inicio, fin, label: `${hh}:${mm}` })
    }
    setSlots(generados)
  }

  // Búsqueda de clientes (nombre o teléfono)
  useEffect(() => {
    if (!tenant || busqCliente.length < 2) { setClientes([]); return }
    supabase.from('clientes_agenda')
      .select('id, nombre, telefono, tags, notas')
      .eq('tenant_id', tenant.id)
      .or(`nombre.ilike.%${busqCliente}%,telefono.ilike.%${busqCliente}%`)
      .limit(8)
      .then(({ data }) => setClientes(data || []))
  }, [busqCliente, tenant])

  async function guardar() {
    setSaving(true)
    try {
      let cliId = clienteId
      if (modoNuevo) {
        if (!nuevoCliente.nombre.trim()) { showToast('Ingresa el nombre del cliente'); setSaving(false); return }
        const { data, error } = await supabase.from('clientes_agenda')
          .insert({ tenant_id: tenant.id, nombre: nuevoCliente.nombre.trim(), telefono: nuevoCliente.telefono })
          .select('id').single()
        if (error) throw error
        cliId = data.id
      }
      if (!cliId)          { showToast('Selecciona un cliente'); setSaving(false); return }
      if (!slot)           { showToast('Selecciona un horario'); setSaving(false); return }
      if (!servIds.length) { showToast('Selecciona al menos un servicio'); setSaving(false); return }

      const { data: citaNew, error } = await supabase.from('citas').insert({
        tenant_id:      tenant.id,
        profesional_id: profId,
        servicio_id:    servIds[0],
        servicios_ids:  servIds,
        cliente_id:     cliId,
        fecha_inicio:   slot.inicio,
        fecha_fin:      slot.fin,
        estado:         'confirmada',
        precio_cobrado: precioTotal || null,
        sede_id:        profs.find(p => p.id === profId)?.sede_id || null,
        notas:          notasCita.trim() || null,
      }).select('id').single()
      if (error) throw error
      if (citaNew?.id) supabase.functions.invoke('notificacion-cita', { body: { cita_id: citaNew.id } }).catch(() => {})
      onCreada?.()
      onClose()
    } catch (e) {
      showToast(e.message || 'Error al guardar')
    }
    setSaving(false)
  }

  const prof     = profs.find(p => p.id === profId)
  const canNext  = [
    !!profId,
    servIds.length > 0,
    !!slot,
    modoNuevo ? !!nuevoCliente.nombre.trim() : !!clienteId,
  ]

  return (
    <>
      {toast && <div className="sp-toast show" style={{ background: toast.color }}>{toast.msg}</div>}

      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet" style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Handle — fuera del scroll */}
        <div className="sp-sheet-handle" style={{ flexShrink: 0, margin: '12px auto 0' }} />

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 20px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, marginTop:8 }}>
          <p className="sp-sheet-title" style={{ margin:0 }}>Nueva cita</p>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:10, border:'none',
            background:'rgba(255,255,255,0.08)', color:'var(--text-2)', display:'flex',
            alignItems:'center', justifyContent:'center', cursor:'pointer',
          }}>
            <Ico d="M6 18L18 6M6 6l12 12" size={16} />
          </button>
        </div>

        {/* Barra de progreso */}
        <div style={{ display:'flex', gap:6, marginBottom:24 }}>
          {STEP_LABELS.map((lbl, i) => (
            <div key={i} style={{
              flex:1, height:3, borderRadius:2,
              background: i <= step ? col : 'var(--border)',
              transition:'background 0.3s',
            }} />
          ))}
        </div>

        <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:16, fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>
          {STEP_LABELS[step]}
        </p>

        {/* ── Step 0 — Profesional ── */}
        {step === 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {/* Filtro de sede — solo cuando hay múltiples sedes */}
            {sedes.length > 1 && (
              <div style={{ display:'flex', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                <button onClick={() => { setFiltroSede(null); if (filtroSede) setProfId(null) }} style={{
                  padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
                  background: filtroSede === null ? col : 'var(--card)',
                  color: filtroSede === null ? '#fff' : 'var(--text-3)',
                  fontSize:12, fontWeight:700, transition:'all 0.15s',
                }}>Todas</button>
                {sedes.map(s => (
                  <button key={s.id} onClick={() => { setFiltroSede(filtroSede === s.id ? null : s.id); setProfId(null) }} style={{
                    padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
                    background: filtroSede === s.id ? col : 'var(--card)',
                    color: filtroSede === s.id ? '#fff' : 'var(--text-3)',
                    fontSize:12, fontWeight:700, transition:'all 0.15s',
                  }}>📍 {s.nombre}</button>
                ))}
              </div>
            )}
            {(filtroSede ? profs.filter(p => p.sede_id === filtroSede) : profs).map(p => (
              <button key={p.id} onClick={() => setProfId(p.id)} style={{
                display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                borderRadius:14, cursor:'pointer', textAlign:'left',
                background: profId === p.id ? `${col}15` : 'var(--card)',
                border: `1px solid ${profId === p.id ? col + '55' : 'var(--border)'}`,
                color:'var(--text)',
              }}>
                <div style={{
                  width:42, height:42, borderRadius:13, background:`${col}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:18, color:col, flexShrink:0,
                }}>
                  {p.foto_url
                    ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                    : p.nombre[0]
                  }
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{p.nombre}</div>
                  {p.especialidad && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:1 }}>{p.especialidad}</div>}
                </div>
                {profId === p.id && <div style={{ marginLeft:'auto', color:col }}><Ico d="M5 13l4 4L19 7" size={18} /></div>}
              </button>
            ))}
          </div>
        )}

        {/* ── Step 1 — Servicios (multi-select) ── */}
        {step === 1 && (
          <div>
            {/* Contador de selección */}
            {servIds.length > 0 && (
              <div style={{
                padding:'10px 14px', borderRadius:12, marginBottom:14,
                background:`${col}12`, border:`1px solid ${col}30`,
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <span style={{ fontSize:13, fontWeight:700, color:col }}>
                  {servIds.length} servicio{servIds.length > 1 ? 's' : ''} · {duracionTotal} min
                </span>
                {precioTotal > 0 && (
                  <span style={{ fontSize:14, fontWeight:800, color:col, fontFamily:'Outfit' }}>
                    {fmtCOP(precioTotal)}
                  </span>
                )}
              </div>
            )}

            {/* Lista agrupada por categoría */}
            {Object.entries(porCategoria).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom:16 }}>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', letterSpacing:1,
                  textTransform:'uppercase', marginBottom:8, marginTop:4,
                  borderBottom:'1px solid var(--border)', paddingBottom:4 }}>
                  {cat}
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {items.map(s => {
                    const sel = servIds.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => toggleServ(s.id)} style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'13px 14px', borderRadius:13, cursor:'pointer', textAlign:'left',
                        background: sel ? `${col}15` : 'var(--card)',
                        border: `2px solid ${sel ? col : 'var(--border)'}`,
                        color:'var(--text)',
                        transition:'border-color 0.15s, background 0.15s',
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:14, color: sel ? col : 'var(--text)' }}>
                            {s.nombre}
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                            {s.duracion_min}min
                            {s.categoria ? ` · ${s.categoria}` : ''}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                          {s.precio > 0 && (
                            <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:14, color: sel ? col : 'var(--text-2)' }}>
                              {fmtCOP(s.precio)}
                            </span>
                          )}
                          {/* Checkbox visual */}
                          <div style={{
                            width:22, height:22, borderRadius:7, flexShrink:0,
                            background: sel ? col : 'transparent',
                            border: `2px solid ${sel ? col : 'var(--border)'}`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'all 0.15s',
                          }}>
                            {sel && <Ico d="M5 13l4 4L19 7" size={12} />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Step 2 — Fecha y hora ── */}
        {step === 2 && (
          <div>
            <CalendarioPicker value={fecha} col={col} onChange={d => { setFecha(d); setSlot(null) }} />
            {sinHorario ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <p style={{ fontSize:22, marginBottom:8 }}>😴</p>
                <p style={{ color:'var(--text-3)', fontSize:14, fontWeight:600 }}>
                  {prof?.nombre?.split(' ')[0] || 'El profesional'} no trabaja este día
                </p>
                <p style={{ color:'var(--text-3)', fontSize:12, marginTop:4 }}>
                  Elige otra fecha o configura sus horarios en Equipo
                </p>
              </div>
            ) : slots.length === 0 ? (
              <p style={{ color:'var(--text-3)', fontSize:14, textAlign:'center', padding:'20px 0' }}>
                Sin disponibilidad — todos los horarios están ocupados
              </p>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {slots.map(s => (
                  <button key={s.inicio} onClick={() => setSlot(s)} style={{
                    padding:'12px 8px', borderRadius:12, cursor:'pointer',
                    background: slot?.inicio === s.inicio ? col : 'var(--card)',
                    border: `1px solid ${slot?.inicio === s.inicio ? col : 'var(--border)'}`,
                    color: slot?.inicio === s.inicio ? '#fff' : 'var(--text-2)',
                    fontFamily:'Outfit', fontWeight:700, fontSize:14,
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3 — Cliente ── */}
        {step === 3 && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <button onClick={() => setModoNuevo(false)} style={{
                flex:1, padding:'10px', borderRadius:12, cursor:'pointer',
                background: !modoNuevo ? `${col}20` : 'var(--card)',
                border: `1px solid ${!modoNuevo ? col + '55' : 'var(--border)'}`,
                color: !modoNuevo ? col : 'var(--text-2)', fontWeight:600, fontSize:13,
              }}>Buscar cliente</button>
              <button onClick={() => setModoNuevo(true)} style={{
                flex:1, padding:'10px', borderRadius:12, cursor:'pointer',
                background: modoNuevo ? `${col}20` : 'var(--card)',
                border: `1px solid ${modoNuevo ? col + '55' : 'var(--border)'}`,
                color: modoNuevo ? col : 'var(--text-2)', fontWeight:600, fontSize:13,
              }}>Nuevo cliente</button>
            </div>

            {!modoNuevo ? (
              <>
                <input className="sp-input" placeholder="Buscar por nombre o teléfono…"
                  value={busqCliente} onChange={e => setBusqCliente(e.target.value)}
                  style={{ marginBottom:10 }} />
                {clientes.map(c => (
                  <button key={c.id} onClick={() => { setClienteId(c.id); setBusqCliente(c.nombre) }} style={{
                    width:'100%', display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', borderRadius:12, cursor:'pointer', textAlign:'left', marginBottom:6,
                    background: clienteId === c.id ? `${col}15` : 'var(--card)',
                    border: `1px solid ${clienteId === c.id ? col + '55' : 'var(--border)'}`,
                    color:'var(--text)',
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:10, background:`${col}25`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, color:col, fontSize:16, flexShrink:0,
                    }}>{c.nombre[0]}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, fontSize:14 }}>{c.nombre}</span>
                        {c.tags?.includes('dificil') && (
                          <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:5,
                            background:'rgba(239,68,68,0.12)', color:'#f87171', letterSpacing:0.4 }}>⚠ DIFÍCIL</span>
                        )}
                        {c.tags?.includes('vip') && (
                          <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:5,
                            background:'rgba(251,191,36,0.12)', color:'#fbbf24', letterSpacing:0.4 }}>VIP</span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-3)' }}>{c.telefono}</div>
                      {c.tags?.includes('dificil') && c.notas && clienteId !== c.id && (
                        <div style={{ fontSize:11, color:'#f87171', marginTop:2, fontStyle:'italic' }}>
                          ⚠ {c.notas.slice(0, 60)}{c.notas.length > 60 ? '…' : ''}
                        </div>
                      )}
                    </div>
                    {clienteId === c.id && <div style={{ marginLeft:'auto', color:col, flexShrink:0 }}><Ico d="M5 13l4 4L19 7" size={16} /></div>}
                  </button>
                ))}
                {busqCliente.length > 1 && clientes.length === 0 && (
                  <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'12px 0' }}>Sin resultados</p>
                )}
              </>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input className="sp-input" placeholder="Nombre completo *"
                  value={nuevoCliente.nombre} onChange={e => setNuevoCliente(p => ({...p, nombre:e.target.value}))} />
                <input className="sp-input" placeholder="Teléfono (WhatsApp)" type="tel"
                  value={nuevoCliente.telefono} onChange={e => setNuevoCliente(p => ({...p, telefono:e.target.value}))} />
              </div>
            )}
          </div>
        )}

        {/* ── Notas de la cita (solo en paso 3) ── */}
        {step === 3 && (
          <div style={{ marginTop:16, marginBottom:0 }}>
            <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5,
              display:'block', marginBottom:6, textTransform:'uppercase' }}>
              Notas internas (opcional)
            </label>
            <textarea className="sp-input" rows={2} placeholder="Alergias, preferencias, indicaciones especiales…"
              value={notasCita} onChange={e => setNotasCita(e.target.value)}
              style={{ resize:'none', lineHeight:1.5 }} />
          </div>
        )}

        {/* ── Resumen ── */}
        {step > 0 && (
          <div style={{
            marginTop:16, padding:'12px 14px', borderRadius:14,
            background:'var(--card)', boxShadow:'0 2px 12px rgba(0,0,0,0.1)', marginBottom:16,
          }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase' }}>
              Resumen
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {prof && <span style={{ fontSize:13, color:'var(--text-2)' }}>👤 {prof.nombre}</span>}
              {selectedServs.length > 0 && selectedServs.map(s => (
                <span key={s.id} style={{ fontSize:13, color:'var(--text-2)' }}>✂️ {s.nombre}</span>
              ))}
              {duracionTotal > 0 && (
                <span style={{ fontSize:13, color:'var(--text-2)' }}>⏱ {duracionTotal} min total</span>
              )}
              {precioTotal > 0 && (
                <span style={{ fontSize:13, fontWeight:700, color:col }}>💰 {fmtCOP(precioTotal)} total</span>
              )}
              {slot && <span style={{ fontSize:13, color:'var(--text-2)' }}>🕐 {fecha} · {slot.label}</span>}
            </div>
          </div>
        )}

        {/* Espaciado final del área scrollable */}
        <div style={{ height: 16 }} />
        </div>{/* fin body scrollable */}

        {/* Footer fijo — fuera del scroll, siempre visible */}
        <div style={{
          flexShrink: 0,
          padding: '12px 20px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)',
          background: 'var(--sheet-bg)',
        }}>
          <div style={{ display:'flex', gap:10 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                flex:1, padding:'15px', borderRadius:14, cursor:'pointer',
                background:'var(--card)', border:'none', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
                color:'var(--text-2)', fontWeight:700, fontSize:15,
              }}>Atrás</button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext[step]} style={{
                flex:2, padding:'15px', borderRadius:14,
                cursor: canNext[step] ? 'pointer' : 'not-allowed',
                background: canNext[step] ? col : 'var(--card)',
                border:'none', color: canNext[step] ? '#fff' : 'var(--text-3)',
                fontWeight:700, fontSize:15,
                opacity: canNext[step] ? 1 : 0.5, fontFamily:'Outfit',
              }}>Siguiente</button>
            ) : (
              <button onClick={guardar} disabled={saving || !canNext[3]} style={{
                flex:2, padding:'15px', borderRadius:14, cursor:'pointer',
                background:col, border:'none', color:'#fff', fontWeight:700, fontSize:15,
                opacity: saving ? 0.7 : 1, fontFamily:'Outfit',
              }}>{saving ? 'Guardando…' : 'Confirmar cita'}</button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
