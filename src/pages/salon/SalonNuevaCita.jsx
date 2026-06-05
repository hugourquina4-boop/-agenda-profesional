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

const DIA_KEY = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']

function fmtCOP(n) {
  if (!n || n <= 0) return null
  return '$' + Number(n).toLocaleString('es-CO')
}

function SecLabel({ label }) {
  return (
    <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:10, fontWeight:700,
      letterSpacing:1, textTransform:'uppercase', marginTop:20,
      borderBottom:'1px solid var(--border)', paddingBottom:6 }}>
      {label}
    </p>
  )
}

export default function SalonNuevaCita({ onClose, onCreada, clientePreId, clientePreNombre, profPreId, fechaPre }) {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [profs,      setProfs]      = useState([])
  const [sedes,      setSedes]      = useState([])
  const [filtroSede, setFiltroSede] = useState(null)
  const [servs,      setServs]      = useState([])
  const [slots,      setSlots]      = useState([])
  const [sinHorario, setSinHorario] = useState(false)
  const [clientes,   setClientes]   = useState([])

  const [profId,      setProfId]      = useState(null)
  const [servIds,     setServIds]     = useState([])
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
    }
  }, [profPreId]) // eslint-disable-line

  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState(null)

  const showToast = (msg, color = '#ef4444') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  const selectedServs  = useMemo(() => servs.filter(s => servIds.includes(s.id)), [servs, servIds])
  const duracionTotal  = useMemo(() => selectedServs.reduce((sum, s) => sum + (s.duracion_min || 0), 0), [selectedServs])
  const precioTotal    = useMemo(() => selectedServs.reduce((sum, s) => sum + (Number(s.precio) || 0), 0), [selectedServs])

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
      if (habilitados.length === 0) {
        setServs(todos || [])
      } else {
        const ids = new Set(habilitados.map(r => r.servicio_id))
        setServs((todos || []).filter(s => ids.has(s.id)))
      }
    })()
  }, [profId, tenant])

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
      const finDate = new Date(new Date(inicio).getTime() + durMin * 60000)
      const pad2 = n => String(n).padStart(2, '0')
      const fin = `${f}T${pad2(finDate.getHours())}:${pad2(finDate.getMinutes())}:00`
      const ocupado = (citasOcup || []).some(c => c.fecha_inicio < fin && c.fecha_fin > inicio)
      if (!ocupado) generados.push({ inicio, fin, label: `${hh}:${mm}` })
    }
    setSlots(generados)
  }

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

  const prof    = profs.find(p => p.id === profId)
  const canSave = !!profId && servIds.length > 0 && !!slot &&
    (modoNuevo ? !!nuevoCliente.nombre.trim() : !!clienteId)

  return (
    <>
      {toast && <div className="sp-toast show" style={{ background: toast.color }}>{toast.msg}</div>}

      <div className="sp-sheet-overlay" onClick={onClose} />
      <div className="sp-sheet" style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>

        <div className="sp-sheet-handle" style={{ flexShrink:0, margin:'12px auto 0' }} />

        {/* Body scrollable */}
        <div style={{ flex:1, overflowY:'auto', overscrollBehavior:'contain', padding:'0 20px' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8, marginTop:8 }}>
            <p className="sp-sheet-title" style={{ margin:0 }}>Nueva cita</p>
            <button onClick={onClose} style={{
              width:32, height:32, borderRadius:10, border:'none',
              background:'rgba(255,255,255,0.08)', color:'var(--text-2)', display:'flex',
              alignItems:'center', justifyContent:'center', cursor:'pointer',
            }}>
              <Ico d="M6 18L18 6M6 6l12 12" size={16} />
            </button>
          </div>

          {/* Resumen compacto (aparece una vez hay datos) */}
          {(prof || servIds.length > 0 || slot) && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:4, padding:'8px 12px',
              background:'var(--card)', borderRadius:10, border:'1px solid var(--border)' }}>
              {prof && <span style={{ fontSize:12, color:'var(--text-2)', fontWeight:600 }}>👤 {prof.nombre}</span>}
              {servIds.length > 0 && (
                <span style={{ fontSize:12, color:'var(--text-2)' }}>
                  · {servIds.length} serv{servIds.length > 1 ? 's' : ''} · {duracionTotal}min
                </span>
              )}
              {precioTotal > 0 && <span style={{ fontSize:12, color:col, fontWeight:700 }}>· {fmtCOP(precioTotal)}</span>}
              {slot && <span style={{ fontSize:12, color:'var(--text-2)' }}>· {fecha} {slot.label}</span>}
            </div>
          )}

          {/* ── 1. Profesional ── */}
          <SecLabel label="Profesional" />
          {sedes.length > 1 && (
            <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
              <button onClick={() => { setFiltroSede(null); if (filtroSede) setProfId(null) }} style={{
                padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
                background: filtroSede === null ? col : 'var(--card)',
                color: filtroSede === null ? '#fff' : 'var(--text-3)',
                fontSize:12, fontWeight:700,
              }}>Todas</button>
              {sedes.map(s => (
                <button key={s.id} onClick={() => { setFiltroSede(filtroSede === s.id ? null : s.id); setProfId(null) }} style={{
                  padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer', flexShrink:0,
                  background: filtroSede === s.id ? col : 'var(--card)',
                  color: filtroSede === s.id ? '#fff' : 'var(--text-3)',
                  fontSize:12, fontWeight:700,
                }}>📍 {s.nombre}</button>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:4 }}>
            {(filtroSede ? profs.filter(p => p.sede_id === filtroSede) : profs).map(p => (
              <button key={p.id} onClick={() => setProfId(p.id)} style={{
                display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                borderRadius:12, cursor:'pointer', flexShrink:0,
                background: profId === p.id ? `${col}18` : 'var(--card)',
                border: `1.5px solid ${profId === p.id ? col : 'var(--border)'}`,
                color:'var(--text)',
              }}>
                <div style={{
                  width:30, height:30, borderRadius:9, background:`${col}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:14, color:col, flexShrink:0,
                }}>
                  {p.foto_url
                    ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                    : p.nombre[0]
                  }
                </div>
                <span style={{ fontWeight:700, fontSize:14 }}>{p.nombre}</span>
                {profId === p.id && <Ico d="M5 13l4 4L19 7" size={14} />}
              </button>
            ))}
          </div>

          {/* ── 2. Servicios (tras elegir profesional) ── */}
          {profId && (
            <>
              <SecLabel label="Servicios" />
              {servIds.length > 0 && (
                <div style={{ padding:'8px 12px', borderRadius:10, marginBottom:10,
                  background:`${col}12`, border:`1px solid ${col}30`,
                  display:'flex', alignItems:'center', justifyContent:'space-between' }}>
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
              {Object.entries(porCategoria).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom:12 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--text-2)', letterSpacing:1,
                    textTransform:'uppercase', marginBottom:6, borderBottom:'1px solid var(--border)', paddingBottom:3 }}>
                    {cat}
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {items.map(s => {
                      const sel = servIds.includes(s.id)
                      return (
                        <button key={s.id} onClick={() => toggleServ(s.id)} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'11px 12px', borderRadius:11, cursor:'pointer', textAlign:'left',
                          background: sel ? `${col}15` : 'var(--card)',
                          border: `2px solid ${sel ? col : 'var(--border)'}`,
                          color:'var(--text)',
                        }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:13, color: sel ? col : 'var(--text)' }}>{s.nombre}</div>
                            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                              {s.duracion_min}min{s.categoria ? ` · ${s.categoria}` : ''}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                            {s.precio > 0 && (
                              <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color: sel ? col : 'var(--text-2)' }}>
                                {fmtCOP(s.precio)}
                              </span>
                            )}
                            <div style={{ width:20, height:20, borderRadius:6, flexShrink:0,
                              background: sel ? col : 'transparent',
                              border: `2px solid ${sel ? col : 'var(--border)'}`,
                              display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {sel && <Ico d="M5 13l4 4L19 7" size={11} />}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── 3. Fecha y hora (tras prof + servicios) ── */}
          {profId && servIds.length > 0 && (
            <>
              <SecLabel label="Fecha y hora" />
              <CalendarioPicker value={fecha} col={col} onChange={d => { setFecha(d); setSlot(null) }} />
              {sinHorario ? (
                <div style={{ textAlign:'center', padding:'16px 0' }}>
                  <p style={{ fontSize:20, marginBottom:6 }}>😴</p>
                  <p style={{ color:'var(--text-3)', fontSize:13, fontWeight:600 }}>
                    {prof?.nombre?.split(' ')[0] || 'El profesional'} no trabaja este día
                  </p>
                  <p style={{ color:'var(--text-3)', fontSize:11, marginTop:2 }}>
                    Elige otra fecha o configura sus horarios en Equipo
                  </p>
                </div>
              ) : slots.length === 0 ? (
                <p style={{ color:'var(--text-3)', fontSize:13, textAlign:'center', padding:'14px 0' }}>
                  Sin disponibilidad — todos los horarios están ocupados
                </p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7, marginBottom:4 }}>
                  {slots.map(s => (
                    <button key={s.inicio} onClick={() => setSlot(s)} style={{
                      padding:'10px 6px', borderRadius:10, cursor:'pointer',
                      background: slot?.inicio === s.inicio ? col : 'var(--card)',
                      border: `1px solid ${slot?.inicio === s.inicio ? col : 'var(--border)'}`,
                      color: slot?.inicio === s.inicio ? '#fff' : 'var(--text-2)',
                      fontFamily:'Outfit', fontWeight:700, fontSize:13,
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 4. Cliente ── */}
          <SecLabel label="Cliente" />
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button onClick={() => setModoNuevo(false)} style={{
              flex:1, padding:'9px', borderRadius:10, cursor:'pointer',
              background: !modoNuevo ? `${col}20` : 'var(--card)',
              border: `1px solid ${!modoNuevo ? col + '55' : 'var(--border)'}`,
              color: !modoNuevo ? col : 'var(--text-2)', fontWeight:600, fontSize:12,
            }}>Buscar</button>
            <button onClick={() => setModoNuevo(true)} style={{
              flex:1, padding:'9px', borderRadius:10, cursor:'pointer',
              background: modoNuevo ? `${col}20` : 'var(--card)',
              border: `1px solid ${modoNuevo ? col + '55' : 'var(--border)'}`,
              color: modoNuevo ? col : 'var(--text-2)', fontWeight:600, fontSize:12,
            }}>Nuevo</button>
          </div>

          {!modoNuevo ? (
            <>
              <input className="sp-input" placeholder="Buscar por nombre o teléfono…"
                value={busqCliente} onChange={e => setBusqCliente(e.target.value)}
                style={{ marginBottom:8 }} />
              {clientes.map(c => (
                <button key={c.id} onClick={() => { setClienteId(c.id); setBusqCliente(c.nombre) }} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:10,
                  padding:'10px 12px', borderRadius:10, cursor:'pointer', textAlign:'left', marginBottom:5,
                  background: clienteId === c.id ? `${col}15` : 'var(--card)',
                  border: `1px solid ${clienteId === c.id ? col + '55' : 'var(--border)'}`,
                  color:'var(--text)',
                }}>
                  <div style={{ width:32, height:32, borderRadius:9, background:`${col}25`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Outfit', fontWeight:800, color:col, fontSize:14, flexShrink:0 }}>
                    {c.nombre[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:13 }}>{c.nombre}</span>
                      {c.tags?.includes('dificil') && (
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:4,
                          background:'rgba(239,68,68,0.12)', color:'#f87171' }}>⚠ DIFÍCIL</span>
                      )}
                      {c.tags?.includes('vip') && (
                        <span style={{ fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:4,
                          background:'rgba(251,191,36,0.12)', color:'#fbbf24' }}>VIP</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>{c.telefono}</div>
                    {c.tags?.includes('dificil') && c.notas && clienteId !== c.id && (
                      <div style={{ fontSize:10, color:'#f87171', marginTop:2, fontStyle:'italic' }}>
                        ⚠ {c.notas.slice(0, 60)}{c.notas.length > 60 ? '…' : ''}
                      </div>
                    )}
                  </div>
                  {clienteId === c.id && <Ico d="M5 13l4 4L19 7" size={15} />}
                </button>
              ))}
              {busqCliente.length > 1 && clientes.length === 0 && (
                <p style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'10px 0' }}>Sin resultados</p>
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

          {/* ── 5. Notas internas ── */}
          <SecLabel label="Notas internas" />
          <textarea className="sp-input" rows={2} placeholder="Alergias, preferencias, indicaciones especiales…"
            value={notasCita} onChange={e => setNotasCita(e.target.value)}
            style={{ resize:'none', lineHeight:1.5 }} />

          <div style={{ height:16 }} />
        </div>{/* fin body scrollable */}

        {/* Footer fijo */}
        <div style={{
          flexShrink:0, padding:'12px 20px',
          paddingBottom:'max(20px, env(safe-area-inset-bottom))',
          borderTop:'1px solid var(--border)',
          background:'var(--sheet-bg)',
        }}>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} style={{
              flex:1, padding:'15px', borderRadius:14, cursor:'pointer',
              background:'var(--card)', border:'none',
              color:'var(--text-2)', fontWeight:700, fontSize:15,
            }}>Cancelar</button>
            <button onClick={guardar} disabled={saving || !canSave} style={{
              flex:2, padding:'15px', borderRadius:14,
              cursor: canSave ? 'pointer' : 'not-allowed',
              background: canSave ? col : 'var(--card)',
              border:'none', color: canSave ? '#fff' : 'var(--text-3)',
              fontWeight:700, fontSize:15, fontFamily:'Outfit',
              opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Guardando…' : 'Guardar cita'}</button>
          </div>
        </div>
      </div>
    </>
  )
}
