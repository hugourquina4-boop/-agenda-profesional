import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../context/TenantContext'
import ImageUploader from '../../components/ImageUploader'
import HorarioGrid, { rangeToSlots, slotsToRange } from '../../components/HorarioGrid'

function Ico({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']

function MiniCalendar({ year, month, excepciones, onDayTap, accentColor }) {
  const firstDow  = new Date(year, month - 1, 1).getDay()
  const startOff  = (firstDow + 6) % 7
  const daysTotal = new Date(year, month, 0).getDate()
  const today     = new Date().toISOString().split('T')[0]
  const excMap    = {}
  excepciones.forEach(e => { excMap[e.fecha] = e })

  const cells = []
  for (let i = 0; i < startOff; i++) cells.push(null)
  for (let d = 1; d <= daysTotal; d++) cells.push(d)

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--text-3)', padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const exc     = excMap[dateStr]
          const isToday = dateStr === today
          let bg = 'transparent', color = 'var(--text-2)', border = isToday ? accentColor : 'transparent', fontW = isToday ? 800 : 500
          if (exc) {
            bg     = exc.activo ? 'rgba(34,197,94,0.18)'  : 'rgba(239,68,68,0.14)'
            color  = exc.activo ? '#4ade80'               : '#f87171'
            border = exc.activo ? 'rgba(34,197,94,0.4)'   : 'rgba(239,68,68,0.4)'
            fontW  = 700
          }
          return (
            <button key={dateStr} onClick={() => onDayTap(dateStr, exc || null)}
              style={{
                aspectRatio:'1', borderRadius:8, minHeight:36,
                border:`1px solid ${border}`, background:bg,
                color, fontSize:13, fontWeight:fontW,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0,
              }}>
              {day}
            </button>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:16, marginTop:10, justifyContent:'center' }}>
        <span style={{ fontSize:10, color:'#4ade80', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:'rgba(34,197,94,0.18)', border:'1px solid rgba(34,197,94,0.4)', display:'inline-block' }} />
          Horario especial
        </span>
        <span style={{ fontSize:10, color:'#f87171', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:8, height:8, borderRadius:2, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.4)', display:'inline-block' }} />
          Ausente
        </span>
      </div>
    </div>
  )
}

const DIAS_SEMANA = [
  { key:'lunes',     label:'Lunes' },
  { key:'martes',    label:'Martes' },
  { key:'miercoles', label:'Miércoles' },
  { key:'jueves',    label:'Jueves' },
  { key:'viernes',   label:'Viernes' },
  { key:'sabado',    label:'Sábado' },
  { key:'domingo',   label:'Domingo' },
]

function initHorarios(dbData) {
  const dbMap = {}
  ;(dbData || []).forEach(h => { dbMap[h.dia] = h })
  return DIAS_SEMANA.map(d => {
    const inicio = dbMap[d.key] ? dbMap[d.key].hora_inicio.slice(0, 5) : '09:00'
    const fin    = dbMap[d.key] ? dbMap[d.key].hora_fin.slice(0, 5)    : '19:00'
    return {
      dia:         d.key,
      activo:      dbMap[d.key] !== undefined ? dbMap[d.key].activo : d.key !== 'domingo',
      hora_inicio: inicio,
      hora_fin:    fin,
      slots:       rangeToSlots(inicio, fin),
    }
  })
}

export default function SalonEquipo() {
  const { tenant, recargar } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [profs,       setProfs]       = useState([])
  const [profStats,   setProfStats]   = useState({})
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState(null)

  // Sheet editar propietario
  const [editOwner,    setEditOwner]    = useState(false)
  const [ownerForm,    setOwnerForm]    = useState({})
  const [savingOwner,  setSavingOwner]  = useState(false)

  // Sheet editar profesional
  const [sel,         setSel]         = useState(null)
  const [form,        setForm]        = useState({})
  const [saving,      setSaving]      = useState(false)
  const [nuevo,       setNuevo]       = useState(false)
  const [elimTarget,  setElimTarget]  = useState(null)

  // Servicios del profesional (profesional_servicios)
  const [allServs,    setAllServs]    = useState([])   // todos los servicios del tenant
  const [profServs,   setProfServs]   = useState([])   // filas de profesional_servicios para el prof actual
  const [savingServs, setSavingServs] = useState(false)

  // Sheet horarios
  const [profH,       setProfH]       = useState(null)
  const [horarios,    setHorarios]    = useState([])
  const [savingH,     setSavingH]     = useState(false)
  const [expandedDia, setExpandedDia] = useState(null)

  const [ausentesHoy, setAusentesHoy] = useState(new Set())  // profesional_ids ausentes hoy
  const [marcandoAus, setMarcandoAus] = useState(null)      // profesional_id en proceso

  // Sheet excepciones
  const [excProf,     setExcProf]     = useState(null)
  const [excepciones, setExcepciones] = useState([])
  const [excMes,      setExcMes]      = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  const [excForm,     setExcForm]     = useState(null)
  const [savingExc,   setSavingExc]   = useState(false)

  const showToast = (msg, ok = true) => {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), ok ? 2500 : 6000)
  }

  async function verificarAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Sesión expirada — recarga e inicia sesión', false)
      return false
    }
    return true
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const inicio = `${y}-${String(m).padStart(2,'0')}-01`
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const fin = `${nextY}-${String(nextM).padStart(2,'0')}-01`
    const todayISO = new Date().toISOString().slice(0, 10)
    const [{ data: profsData }, { data: citasData }, { data: excHoyData }, { data: noShowData }] = await Promise.all([
      supabase.from('profesionales').select('*').eq('tenant_id', tenant.id).order('nombre'),
      supabase.from('citas')
        .select('profesional_id, precio_cobrado')
        .eq('tenant_id', tenant.id)
        .not('estado', 'in', '("cancelada","no_asistio")')
        .gte('fecha_inicio', inicio)
        .lt('fecha_inicio', fin),
      supabase.from('horarios_excepcion')
        .select('profesional_id, activo')
        .eq('tenant_id', tenant.id)
        .eq('fecha', todayISO)
        .eq('activo', false),
      supabase.from('citas')
        .select('profesional_id')
        .eq('tenant_id', tenant.id)
        .eq('estado', 'no_asistio')
        .gte('fecha_inicio', inicio)
        .lt('fecha_inicio', fin),
    ])
    setProfs(profsData || [])
    const stats = {}
    ;(citasData || []).forEach(c => {
      if (!stats[c.profesional_id]) stats[c.profesional_id] = { citas: 0, ingresos: 0, noShows: 0 }
      stats[c.profesional_id].citas++
      stats[c.profesional_id].ingresos += Number(c.precio_cobrado) || 0
    })
    ;(noShowData || []).forEach(c => {
      if (!stats[c.profesional_id]) stats[c.profesional_id] = { citas: 0, ingresos: 0, noShows: 0 }
      stats[c.profesional_id].noShows = (stats[c.profesional_id].noShows || 0) + 1
    })
    setProfStats(stats)
    setAusentesHoy(new Set((excHoyData || []).map(e => e.profesional_id)))
    setLoading(false)
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  function cerrarSheet() {
    setSel(null)
    setAllServs([])
    setProfServs([])
  }

  async function marcarAusenteHoy(p) {
    const todayISO = new Date().toISOString().slice(0, 10)
    setMarcandoAus(p.id)
    const yaAusente = ausentesHoy.has(p.id)
    if (yaAusente) {
      await supabase.from('horarios_excepcion')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('profesional_id', p.id)
        .eq('fecha', todayISO)
        .eq('activo', false)
      setAusentesHoy(s => { const n = new Set(s); n.delete(p.id); return n })
      showToast(`${p.nombre.split(' ')[0]} — disponible hoy`)
    } else {
      await supabase.from('horarios_excepcion').upsert({
        tenant_id: tenant.id,
        profesional_id: p.id,
        fecha: todayISO,
        activo: false,
        nota: 'Ausente',
      }, { onConflict: 'tenant_id,profesional_id,fecha' })
      setAusentesHoy(s => new Set([...s, p.id]))
      showToast(`${p.nombre.split(' ')[0]} — marcado/a ausente hoy`)
    }
    setMarcandoAus(null)
  }

  // ── Horarios ─────────────────────────────────────────────────
  async function abrirHorarios(prof) {
    const { data } = await supabase.from('horarios')
      .select('dia, hora_inicio, hora_fin, activo')
      .eq('profesional_id', prof.id)
    setProfH(prof)
    setHorarios(initHorarios(data))
    setExpandedDia(null)
  }

  function toggleDia(dia) {
    setHorarios(hs => hs.map(h => h.dia === dia ? { ...h, activo: !h.activo } : h))
    setExpandedDia(null)
  }

  function activarLunesViernes() {
    const laboral = new Set(['lunes','martes','miercoles','jueves','viernes'])
    setHorarios(hs => hs.map(h => ({ ...h, activo: laboral.has(h.dia) })))
    setExpandedDia(null)
  }

  function activarTodos() {
    setHorarios(hs => hs.map(h => ({ ...h, activo: true })))
    setExpandedDia(null)
  }

  function desactivarTodos() {
    setHorarios(hs => hs.map(h => ({ ...h, activo: false })))
    setExpandedDia(null)
  }

  function setDiaSlots(dia, newSlots) {
    setHorarios(hs => hs.map(h => {
      if (h.dia !== dia) return h
      const { hora_inicio, hora_fin } = slotsToRange(newSlots)
      return { ...h, slots: newSlots, hora_inicio, hora_fin }
    }))
  }

  // ── Excepciones ───────────────────────────────────────────────
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  function formatFecha(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number)
    const fecha = new Date(y, m - 1, d)
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    return `${dias[fecha.getDay()]} ${d} ${MESES[m - 1].slice(0, 3)}`
  }

  async function cargarExcepciones(profId, year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const nextM = month === 12 ? 1 : month + 1
    const nextY = month === 12 ? year + 1 : year
    const end   = `${nextY}-${String(nextM).padStart(2, '0')}-01`
    const { data } = await supabase
      .from('horarios_excepcion')
      .select('id, fecha, activo, hora_inicio, hora_fin, nota')
      .eq('profesional_id', profId)
      .gte('fecha', start)
      .lt('fecha', end)
      .order('fecha')
    setExcepciones(data || [])
  }

  async function abrirExcepciones(prof) {
    setExcProf(prof)
    setExcForm(null)
    await cargarExcepciones(prof.id, excMes.year, excMes.month)
  }

  function cambiarMes(delta) {
    setExcMes(prev => {
      let m = prev.month + delta
      let y = prev.year
      if (m > 12) { m = 1; y++ }
      if (m < 1)  { m = 12; y-- }
      if (excProf) cargarExcepciones(excProf.id, y, m)
      return { year: y, month: m }
    })
  }

  function abrirNuevaExcepcion(fecha) {
    const dateStr = fecha || new Date().toISOString().split('T')[0]
    setExcForm({ id: null, fecha: dateStr, activo: true, slots: rangeToSlots('09:00', '19:00'), hora_inicio: '09:00', hora_fin: '19:00', nota: '', isNew: true })
  }

  function onDayTap(dateStr, existingExc) {
    if (existingExc) {
      abrirEditarExcepcion(existingExc)
    } else {
      abrirNuevaExcepcion(dateStr)
    }
  }

  function abrirEditarExcepcion(exc) {
    const inicio = exc.hora_inicio ? exc.hora_inicio.slice(0, 5) : '09:00'
    const fin    = exc.hora_fin    ? exc.hora_fin.slice(0, 5)    : '19:00'
    setExcForm({ id: exc.id, fecha: exc.fecha, activo: exc.activo, slots: exc.activo ? rangeToSlots(inicio, fin) : [], hora_inicio: inicio, hora_fin: fin, nota: exc.nota || '', isNew: false })
  }

  function setExcSlots(newSlots) {
    const { hora_inicio, hora_fin } = slotsToRange(newSlots)
    setExcForm(f => ({ ...f, slots: newSlots, hora_inicio, hora_fin }))
  }

  async function guardarExcepcion() {
    setSavingExc(true)
    const payload = {
      tenant_id:      tenant.id,
      profesional_id: excProf.id,
      fecha:          excForm.fecha,
      activo:         excForm.activo,
      hora_inicio:    excForm.activo ? excForm.hora_inicio : null,
      hora_fin:       excForm.activo ? excForm.hora_fin    : null,
      nota:           excForm.nota || null,
    }
    const { error } = excForm.isNew
      ? await supabase.from('horarios_excepcion').insert(payload)
      : await supabase.from('horarios_excepcion').update(payload).eq('id', excForm.id)
    setSavingExc(false)
    if (error) { showToast(error.message, false); return }
    showToast(excForm.isNew ? 'Excepción creada' : 'Excepción actualizada')
    setExcForm(null)
    cargarExcepciones(excProf.id, excMes.year, excMes.month)
  }

  async function eliminarExcepcion(id) {
    const { error } = await supabase.from('horarios_excepcion').delete().eq('id', id)
    if (error) { showToast(error.message, false); return }
    showToast('Excepción eliminada')
    cargarExcepciones(excProf.id, excMes.year, excMes.month)
  }

  async function guardarHorarios() {
    setSavingH(true)
    const { error } = await supabase.from('horarios').upsert(
      horarios.map(h => ({
        tenant_id:      tenant.id,
        profesional_id: profH.id,
        dia:            h.dia,
        hora_inicio:    h.hora_inicio,
        hora_fin:       h.hora_fin,
        activo:         h.activo,
      })),
      { onConflict: 'profesional_id,dia' }
    )
    setSavingH(false)
    if (error) { showToast(error.message, false); return }
    showToast('Horarios guardados')
    setProfH(null)
  }

  // ── Profesional edit ─────────────────────────────────────────
  async function abrir(prof) {
    setSel(prof)
    setForm({ nombre: prof.nombre, especialidad: prof.especialidad || '', telefono: prof.telefono || '', foto_url: prof.foto_url || '', color: prof.color || COLORS[0], activo: prof.activo })
    setNuevo(false)
    setAllServs([])
    setProfServs([])
    const [{ data: servs }, { data: ps }] = await Promise.all([
      supabase.from('servicios').select('id, nombre, categoria, precio, duracion_min').eq('tenant_id', tenant.id).eq('activo', true).order('categoria').order('nombre'),
      supabase.from('profesional_servicios').select('*').eq('tenant_id', tenant.id).eq('profesional_id', prof.id),
    ])
    setAllServs(servs || [])
    setProfServs(ps || [])
  }

  function abrirNuevo() {
    setSel({ id: null })
    setForm({ nombre:'', especialidad:'', telefono:'', foto_url:'', color: COLORS[profs.length % COLORS.length], activo:true })
    setNuevo(true)
    setAllServs([])
    setProfServs([])
  }

  async function toggleProfServ(servId) {
    if (!sel?.id || !tenant) return
    const existing = profServs.find(ps => ps.servicio_id === servId)
    if (existing) {
      setProfServs(prev => prev.filter(ps => ps.servicio_id !== servId))
    } else {
      const row = { tenant_id: tenant.id, profesional_id: sel.id, servicio_id: servId, activo: true, tipo_comision: 'ninguna', valor_comision: 0 }
      setProfServs(prev => [...prev, row])
    }
  }

  function updateProfServComision(servId, campo, valor) {
    setProfServs(prev => prev.map(ps =>
      ps.servicio_id === servId ? { ...ps, [campo]: valor } : ps
    ))
  }

  async function guardarServicios() {
    if (!sel?.id || !tenant) return
    setSavingServs(true)
    try {
      // Borrar todas las filas actuales y re-insertar (upsert por UNIQUE)
      await supabase.from('profesional_servicios')
        .delete().eq('profesional_id', sel.id).eq('tenant_id', tenant.id)
      if (profServs.length > 0) {
        const rows = profServs.map(ps => ({
          tenant_id:      tenant.id,
          profesional_id: sel.id,
          servicio_id:    ps.servicio_id,
          activo:         true,
          tipo_comision:  ps.tipo_comision || 'ninguna',
          valor_comision: Number(ps.valor_comision) || 0,
        }))
        const { error } = await supabase.from('profesional_servicios').insert(rows)
        if (error) { showToast(error.message, false); setSavingServs(false); return }
      }
      showToast('Servicios guardados')
    } catch (e) {
      showToast('Error: ' + e.message, false)
    }
    setSavingServs(false)
  }

  async function toggleActivo(prof) {
    const { error } = await supabase.from('profesionales')
      .update({ activo: !prof.activo }).eq('id', prof.id)
    if (error) { showToast(error.message, false); return }
    showToast(prof.activo ? 'Marcado inactivo' : 'Marcado activo')
    cargar()
  }

  async function guardar() {
    if (!form.nombre?.trim()) { showToast('Nombre requerido', false); return }
    if (!tenant?.id) { showToast('Error de sesión — recarga la página', false); return }
    setSaving(true)
    try {
      const payload = {
        nombre:      form.nombre.trim(),
        especialidad: form.especialidad || null,
        telefono:    form.telefono || null,
        foto_url:    form.foto_url?.trim() || null,
        color:       form.color || col,
        activo:      form.activo,
      }
      const { error } = nuevo
        ? await supabase.from('profesionales').insert({ ...payload, tenant_id: tenant.id })
        : await supabase.from('profesionales').update(payload).eq('id', sel.id)
      if (error) { showToast(error.message, false); return }
      showToast(nuevo ? 'Profesional creado' : 'Cambios guardados')
      cerrarSheet()
      cargar()
    } catch (e) {
      showToast('Error inesperado: ' + e.message, false)
    } finally {
      setSaving(false)
    }
  }

  async function eliminar() {
    if (!elimTarget) return
    if (!await verificarAuth()) { setElimTarget(null); return }
    setSaving(true)
    const id  = elimTarget.id
    const tid = tenant.id
    await supabase.from('lista_espera').delete().eq('profesional_id', id).eq('tenant_id', tid)
    await supabase.from('horarios').delete().eq('profesional_id', id).eq('tenant_id', tid)
    await supabase.from('citas').delete().eq('profesional_id', id).eq('tenant_id', tid)
    const { error, count } = await supabase
      .from('profesionales')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('tenant_id', tid)
    setSaving(false)
    if (error) { showToast('Error: ' + error.message, false); return }
    if (!count || count === 0) {
      showToast('No se eliminó — sin permisos o sesión expirada', false)
      setElimTarget(null)
      return
    }
    showToast('Profesional eliminado')
    setElimTarget(null)
    if (sel?.id === id) cerrarSheet()
    cargar()
  }

  // ── Propietario ──────────────────────────────────────────────
  function abrirEditOwner() {
    setOwnerForm({
      nombre_representante: tenant?.nombre_representante || '',
      foto_representante:   tenant?.foto_representante   || '',
    })
    setEditOwner(true)
  }

  async function guardarOwner() {
    if (!tenant) return
    setSavingOwner(true)
    const { error } = await supabase.from('tenants')
      .update({
        nombre_representante: ownerForm.nombre_representante.trim() || null,
        foto_representante:   ownerForm.foto_representante.trim()   || null,
      })
      .eq('id', tenant.id)
    setSavingOwner(false)
    if (error) { showToast(error.message, false); return }
    await recargar()
    setEditOwner(false)
    showToast('Datos del propietario actualizados')
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ padding:'0 16px 16px' }}>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>Equipo</h2>
        <button onClick={abrirNuevo} style={{
          display:'flex', alignItems:'center', gap:6, padding:'9px 16px', borderRadius:12,
          background:col, border:'none', color:'#fff', fontWeight:700, fontSize:13,
          cursor:'pointer', fontFamily:'Plus Jakarta Sans',
        }}>
          <Ico d="M12 4v16m8-8H4" size={15} />
          Agregar
        </button>
      </div>

      {/* Lista */}
      {/* ── Card propietario ─────────────────────────────── */}
      {(tenant?.nombre_representante || tenant?.admin_email) && (
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'14px 16px', borderRadius:16, marginBottom:8,
          background:`linear-gradient(135deg,${col}10,${col}06)`,
          border:`1px solid ${col}35`,
        }}>
          {/* Avatar */}
          <div style={{
            width:46, height:46, borderRadius:14, background:`${col}25`, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Outfit', fontWeight:800, fontSize:19, color:col, overflow:'hidden',
          }}>
            {tenant?.foto_representante
              ? <img src={tenant.foto_representante} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
              : (tenant?.nombre_representante?.[0] || '?').toUpperCase()
            }
          </div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <span style={{ fontWeight:700, fontSize:15, color:'var(--text)',
                overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {tenant?.nombre_representante || tenant?.admin_email || 'Propietario'}
              </span>
              <span style={{
                padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:700,
                background:`${col}20`, color:col, flexShrink:0,
              }}>Propietario</span>
            </div>
            {tenant?.admin_email && (
              <div style={{ fontSize:12, color:'var(--text-3)',
                overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {tenant.admin_email}
              </div>
            )}
          </div>

          {/* Editar */}
          <button onClick={abrirEditOwner} title="Editar propietario" style={{
            width:34, height:34, borderRadius:10, border:`1px solid ${col}35`,
            background:`${col}10`, color:col, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:74, borderRadius:16 }} />)}
        </div>
      ) : profs.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">💇</span>
          <p className="sp-empty-title">Sin profesionales</p>
          <p className="sp-empty-sub">Agrega el equipo de tu salón</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {profs.map((p, i) => {
            const color = p.color || COLORS[i % COLORS.length]
            const st = profStats[p.id]
            const fmtK = n => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n/1_000)}K` : `$${Math.round(n)}`
            const isAusente = ausentesHoy.has(p.id)
            const btnBase = { width:30, height:30, borderRadius:9, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--card)', color:'var(--text-2)' }
            return (
              <div key={p.id} style={{
                padding:'11px 13px', borderRadius:16,
                background:`linear-gradient(135deg,${color}09,${color}04)`,
                border:`1px solid ${color}22`,
                boxShadow:'0 2px 8px rgba(0,0,0,0.07)',
              }}>
                {/* Fila 1: Avatar + Nombre/Rol + Acciones */}
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{
                    width:42, height:42, borderRadius:13, background:`${color}22`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Outfit', fontWeight:800, fontSize:18, color, flexShrink:0, overflow:'hidden',
                  }}>
                    {p.foto_url
                      ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                      : p.nombre[0]
                    }
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
                      <span style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', flex:1, minWidth:0 }}>
                        {p.nombre}
                      </span>
                      {isAusente && (
                        <span style={{ flexShrink:0, padding:'1px 7px', borderRadius:20, fontSize:10, fontWeight:700, background:'rgba(239,68,68,0.1)', color:'#f87171' }}>
                          Ausente
                        </span>
                      )}
                    </div>
                    {p.especialidad && (
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                        {p.especialidad}
                      </div>
                    )}
                  </div>

                  {/* Botones compactos — no se solapan con el texto */}
                  <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                    <button
                      onClick={() => marcarAusenteHoy(p)} disabled={marcandoAus === p.id}
                      title={isAusente ? 'Marcar disponible' : 'Marcar ausente hoy'}
                      style={{ ...btnBase, background: isAusente ? 'rgba(239,68,68,0.1)' : 'var(--card)', color: isAusente ? '#f87171' : 'var(--text-3)', opacity: marcandoAus === p.id ? 0.5 : 1 }}>
                      <Ico d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" size={13} />
                    </button>
                    <button onClick={() => toggleActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'} style={{
                      padding:'3px 8px', borderRadius:7, fontSize:10, fontWeight:700,
                      background: p.activo ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                      color:       p.activo ? '#4ade80' : '#f87171',
                      border:'none', cursor:'pointer', whiteSpace:'nowrap',
                    }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button onClick={() => abrirHorarios(p)} title="Horarios" style={btnBase}>
                      <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={13} />
                    </button>
                    <button onClick={() => abrir(p)} title="Editar" style={btnBase}>
                      <Ico d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" size={13} />
                    </button>
                    <button onClick={() => setElimTarget(p)} title="Eliminar" style={{ ...btnBase, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.06)', color:'#ef4444' }}>
                      <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={13} />
                    </button>
                  </div>
                </div>

                {/* Fila 2: badges de estadísticas del mes — siempre en su propia línea */}
                {st && st.citas > 0 && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:9, paddingTop:8, borderTop:`1px solid ${color}18` }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:`${color}16`, color }}>
                      {st.citas} {st.citas === 1 ? 'cita' : 'citas'}
                    </span>
                    {st.ingresos > 0 && (
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(34,197,94,0.1)', color:'#22c55e' }}>
                        {fmtK(st.ingresos)}
                      </span>
                    )}
                    {st.citas > 0 && st.ingresos > 0 && (
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(99,102,241,0.1)', color:'#818cf8' }}>
                        {fmtK(Math.round(st.ingresos / st.citas))} avg
                      </span>
                    )}
                    {st.noShows > 0 && (
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'rgba(239,68,68,0.08)', color:'#f87171' }}>
                        {st.noShows} no-show
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Sheet editar profesional ── */}
      {sel && (
        <>
          <div className="sp-sheet-overlay" onClick={cerrarSheet} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">{nuevo ? 'Nuevo profesional' : 'Editar profesional'}</p>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
              {[
                { key:'nombre',       label:'NOMBRE *',    placeholder:'' },
                { key:'especialidad', label:'ESPECIALIDAD',placeholder:'Ej: Colorista, Barbero…' },
                { key:'telefono',     label:'TELÉFONO',    placeholder:'', type:'tel' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>
                    {f.label}
                  </label>
                  <input className="sp-input" type={f.type || 'text'} placeholder={f.placeholder}
                    value={form[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}

              <ImageUploader
                label="FOTO"
                value={form.foto_url || ''}
                onChange={url => setForm(p => ({ ...p, foto_url: url }))}
                shape="circle"
                size={72}
                folder="profesionales"
                accent={col}
              />

              {/* Selector de color */}
              <div>
                <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:8 }}>COLOR</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width:32, height:32, borderRadius:9, cursor:'pointer', flexShrink:0,
                        background: c, border:'none',
                        boxShadow: form.color === c
                          ? `0 0 0 2px var(--card), 0 0 0 4px ${c}`
                          : '0 1px 3px rgba(0,0,0,0.3)',
                        transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                        transition:'all 0.15s',
                      }} />
                  ))}
                </div>
              </div>

              {/* Toggle activo */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'14px 16px', borderRadius:14, background:`linear-gradient(135deg,${col}08,transparent)`,
                boxShadow:'0 1px 8px rgba(0,0,0,0.08)' }}>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Activo</span>
                <button onClick={() => setForm(f => ({ ...f, activo: !f.activo }))} style={{
                  width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                  background: form.activo ? col : 'var(--border)',
                  position:'relative', transition:'background 0.2s',
                }}>
                  <span style={{
                    position:'absolute', top:3, width:20, height:20, borderRadius:'50%',
                    background:'#fff', transition:'left 0.2s',
                    left: form.activo ? 25 : 4,
                  }} />
                </button>
              </div>
            </div>

            {/* ── Servicios habilitados (solo profesionales existentes) ── */}
            {!nuevo && allServs.length > 0 && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5 }}>
                    SERVICIOS HABILITADOS
                  </label>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>
                    {profServs.length === 0 ? 'Todos' : `${profServs.length} seleccionado${profServs.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:10, lineHeight:1.5 }}>
                  Sin selección = puede hacer todos. Selecciona para restringir.
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {allServs.map(s => {
                    const ps    = profServs.find(r => r.servicio_id === s.id)
                    const activo = !!ps
                    return (
                      <div key={s.id} style={{
                        borderRadius:12,
                        background: activo ? `${col}10` : 'var(--card)',
                        boxShadow: activo ? `0 0 0 1.5px ${col}40` : '0 1px 6px rgba(0,0,0,0.08)',
                        overflow:'hidden',
                        transition:'all 0.15s',
                      }}>
                        {/* Fila principal */}
                        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
                          <button onClick={() => toggleProfServ(s.id)} style={{
                            width:22, height:22, borderRadius:6, border:'none', cursor:'pointer', flexShrink:0,
                            background: activo ? col : 'var(--border)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            transition:'background 0.15s',
                          }}>
                            {activo && (
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                              {s.nombre}
                            </div>
                            {s.categoria && (
                              <div style={{ fontSize:11, color:'var(--text-3)' }}>{s.categoria}</div>
                            )}
                          </div>
                        </div>

                        {/* Fila comisión (solo si activo) */}
                        {activo && (
                          <div style={{ padding:'0 12px 10px', display:'flex', alignItems:'center', gap:8 }}>
                            <select
                              value={ps.tipo_comision || 'ninguna'}
                              onChange={e => updateProfServComision(s.id, 'tipo_comision', e.target.value)}
                              style={{
                                fontSize:11, padding:'4px 6px', borderRadius:7, border:'none',
                                background:'var(--bg)', color:'var(--text-2)', cursor:'pointer',
                              }}>
                              <option value="ninguna">Sin comisión</option>
                              <option value="porcentaje">% Porcentaje</option>
                              <option value="fijo">$ Valor fijo</option>
                            </select>
                            {ps.tipo_comision !== 'ninguna' && (
                              <input
                                type="number" min={0} step={ps.tipo_comision === 'porcentaje' ? 1 : 1000}
                                value={ps.valor_comision || 0}
                                onChange={e => updateProfServComision(s.id, 'valor_comision', e.target.value)}
                                style={{
                                  width:80, fontSize:11, padding:'4px 8px', borderRadius:7, border:'none',
                                  background:'var(--bg)', color:'var(--text)', textAlign:'right',
                                }}
                                placeholder={ps.tipo_comision === 'porcentaje' ? '%' : '$'}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={guardarServicios} disabled={savingServs} style={{
                  marginTop:12, width:'100%', padding:'11px', borderRadius:12,
                  background:`${col}12`, color:col, border:'none', fontWeight:700, fontSize:13,
                  cursor:'pointer', opacity: savingServs ? 0.7 : 1,
                }}>
                  {savingServs ? 'Guardando…' : 'Guardar servicios'}
                </button>
              </div>
            )}

            {/* Eliminar — ANTES de Guardar para que siempre sea visible */}
            {!nuevo && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                <button onClick={() => { setElimTarget(sel); cerrarSheet() }} style={{
                  width:'100%', padding:'13px', borderRadius:14, cursor:'pointer',
                  background:'rgba(239,68,68,0.08)', border:'1.5px solid rgba(239,68,68,0.4)',
                  color:'#ef4444', fontFamily:'Outfit', fontWeight:700, fontSize:15,
                }}>
                  🗑 Eliminar profesional
                </button>
              </div>
            )}

            <button onClick={guardar} disabled={saving} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background:col, border:'none', color:'#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15, opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      )}

      {/* Confirmar eliminación */}
      {elimTarget && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setElimTarget(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <div style={{ textAlign:'center', padding:'8px 0 20px' }}>
              <div style={{ fontSize:44, marginBottom:12 }}>🗑️</div>
              <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'var(--text)', marginBottom:8 }}>
                ¿Eliminar a {elimTarget.nombre}?
              </p>
              <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
                Se borrarán sus citas y horarios.<br />Esta acción es irreversible.
              </p>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setElimTarget(null)} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'var(--card)', border:'none',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
                boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
              }}>Cancelar</button>
              <button onClick={eliminar} disabled={saving} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#ef4444', border:'none', color:'#fff', fontWeight:700, fontSize:14,
                opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Eliminando…' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </>
      )}

      {/* ── Sheet horarios ── */}
      {profH && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setProfH(null)} />
          <div className="sp-sheet" style={{ paddingBottom:80 }}>
            {/* Header pegajoso */}
            <div className="sp-sheet-hdr">
              <div className="sp-sheet-handle" />
              <p className="sp-sheet-title" style={{ marginBottom:4 }}>
                Horarios · {profH.nombre.split(' ')[0]}
              </p>
              <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:10 }}>
                Días y horarios de atención
              </p>
              {/* Presets de días */}
              <div style={{ display:'flex', gap:6, marginBottom:4 }}>
                {[
                  { label:'Lun–Vie', fn: activarLunesViernes },
                  { label:'Todos',   fn: activarTodos },
                  { label:'Ninguno', fn: desactivarTodos },
                ].map(p => (
                  <button key={p.label} onClick={p.fn} style={{
                    padding:'5px 11px', borderRadius:8, border:`1px solid ${col}40`,
                    background:`${col}12`, color:col, fontSize:11, fontWeight:700,
                    cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif',
                  }}>{p.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
              {DIAS_SEMANA.map(d => {
                const h = horarios.find(x => x.dia === d.key) || { activo:false, hora_inicio:'09:00', hora_fin:'19:00' }
                return (
                  <div key={d.key} style={{
                    borderRadius:14, background:'var(--card)',
                    boxShadow: h.activo ? `0 2px 12px ${col}18` : '0 1px 6px rgba(0,0,0,0.08)',
                    overflow:'hidden',
                  }}>
                    {/* Fila día + toggle */}
                    <div style={{ display:'flex', alignItems:'center', padding:'12px 14px', gap:12 }}>
                      <span style={{
                        flex:1, fontWeight:600, fontSize:14,
                        color: h.activo ? 'var(--text)' : 'var(--text-3)',
                      }}>
                        {d.label}
                      </span>
                      {/* Toggle */}
                      <button onClick={() => toggleDia(d.key)} style={{
                        width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                        background: h.activo ? col : 'rgba(128,128,128,0.2)',
                        position:'relative', transition:'background 0.2s', flexShrink:0,
                      }}>
                        <span style={{
                          position:'absolute', top:2, width:20, height:20, borderRadius:'50%',
                          background:'#fff', transition:'left 0.2s',
                          left: h.activo ? 22 : 2,
                        }} />
                      </button>
                    </div>

                    {/* Selector táctil de horario */}
                    {h.activo && (
                      <div>
                        {/* Expand button — shows range and toggles grid */}
                        <button
                          onClick={() => setExpandedDia(expandedDia === d.key ? null : d.key)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', padding: '8px 14px',
                            background: 'none', border: 'none', borderTop: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
                            {h.slots.length > 0 ? `${h.hora_inicio} — ${h.hora_fin}` : 'Sin horario'}
                          </span>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                            stroke="var(--text-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: expandedDia === d.key ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>

                        {/* Tactile grid — only rendered when expanded */}
                        {expandedDia === d.key && (
                          <div style={{ padding: '4px 14px 14px', maxHeight: 380, overflowY: 'auto' }}>
                            <HorarioGrid
                              value={h.slots}
                              onChange={slots => setDiaSlots(d.key, slots)}
                              accentColor={col}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => { const p = profH; setProfH(null); abrirExcepciones(p) }}
              style={{
                width:'100%', padding:'12px', borderRadius:14, cursor:'pointer',
                marginBottom:10, background:`${col}12`,
                border:'none', color:col,
                fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}
            >
              <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={15} />
              Excepciones por fecha
            </button>

            <button onClick={guardarHorarios} disabled={savingH} style={{
              width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
              background:col, border:'none', color:'#fff',
              fontFamily:'Outfit', fontWeight:700, fontSize:15, opacity: savingH ? 0.7 : 1,
            }}>
              {savingH ? 'Guardando…' : 'Guardar horarios'}
            </button>
          </div>
        </>
      )}

      {/* ── Sheet excepciones ── */}
      {excProf && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setExcProf(null); setExcForm(null) }} />
          <div className="sp-sheet" style={{ paddingBottom:80 }}>
            {/* Header pegajoso */}
            <div className="sp-sheet-hdr">
              <div className="sp-sheet-handle" />
              <p className="sp-sheet-title" style={{ marginBottom:4 }}>
                {excForm
                  ? (excForm.isNew ? 'Nueva excepción' : 'Editar excepción')
                  : `Excepciones · ${excProf.nombre.split(' ')[0]}`
                }
              </p>
              <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:4 }}>
                {excForm
                  ? <strong style={{ color:'var(--text-2)', fontWeight:700 }}>{formatFecha(excForm.fecha)}</strong>
                  : 'Toca un día para modificar su horario'
                }
              </p>
            </div>

            {!excForm ? (
              <>
                {/* Navegador de mes */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <button onClick={() => cambiarMes(-1)} style={{
                    width:36, height:36, borderRadius:10, border:'none',
                    background:`${col}12`, color:col, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M15 18l-6-6 6-6" size={16} />
                  </button>
                  <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>
                    {MESES[excMes.month - 1]} {excMes.year}
                  </span>
                  <button onClick={() => cambiarMes(1)} style={{
                    width:36, height:36, borderRadius:10, border:'none',
                    background:`${col}12`, color:col, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <Ico d="M9 18l6-6-6-6" size={16} />
                  </button>
                </div>

                {/* Calendario visual — tap en cualquier día */}
                <MiniCalendar
                  year={excMes.year}
                  month={excMes.month}
                  excepciones={excepciones}
                  onDayTap={onDayTap}
                  accentColor={col}
                />

                {/* Lista compacta de excepciones del mes */}
                {excepciones.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:8 }}>
                      Excepciones registradas
                    </p>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {excepciones.map(exc => (
                        <div key={exc.id} className="sp-tbl-row" style={{
                          display:'flex', alignItems:'center', gap:10,
                          padding:'9px 12px', borderRadius:10,
                          background:'var(--card)',
                        }}>
                          <div style={{
                            width:6, height:6, borderRadius:'50%', flexShrink:0,
                            background: exc.activo ? '#4ade80' : '#f87171',
                          }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <span style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>
                              {formatFecha(exc.fecha)}
                            </span>
                            <span style={{ fontSize:12, color: exc.activo ? '#4ade80' : '#f87171', marginLeft:8 }}>
                              {exc.activo ? `${exc.hora_inicio?.slice(0,5)}–${exc.hora_fin?.slice(0,5)}` : 'Ausente'}
                            </span>
                            {exc.nota && <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:6 }}>{exc.nota}</span>}
                          </div>
                          <button onClick={() => eliminarExcepcion(exc.id)} style={{
                            width:26, height:26, borderRadius:7,
                            border:'1px solid rgba(239,68,68,0.3)',
                            background:'rgba(239,68,68,0.06)', color:'#ef4444', cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          }}>
                            <Ico d="M6 18L18 6M6 6l12 12" size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', marginBottom:4 }}>
                  Toca cualquier día del calendario para añadir o editar
                </p>
              </>
            ) : (
              /* Formulario de excepción */
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
                  {/* Fecha */}
                  <div>
                    <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>FECHA</label>
                    <input type="date" className="sp-input"
                      value={excForm.fecha}
                      onChange={e => setExcForm(f => ({ ...f, fecha: e.target.value }))} />
                  </div>

                  {/* Toggle trabaja ese día */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'14px 16px', borderRadius:14,
                    background:`linear-gradient(135deg,${col}08,transparent)`,
                    boxShadow:'0 1px 8px rgba(0,0,0,0.08)' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>Trabaja ese día</div>
                      <div style={{ fontSize:12, color:'var(--text-3)' }}>Desactivar = ausencia completa</div>
                    </div>
                    <button onClick={() => setExcForm(f => ({ ...f, activo: !f.activo }))} style={{
                      width:48, height:26, borderRadius:13, border:'none', cursor:'pointer',
                      background: excForm.activo ? col : 'var(--border)',
                      position:'relative', transition:'background 0.2s',
                    }}>
                      <span style={{
                        position:'absolute', top:3, width:20, height:20, borderRadius:'50%',
                        background:'#fff', transition:'left 0.2s',
                        left: excForm.activo ? 25 : 4,
                      }} />
                    </button>
                  </div>

                  {/* Grid horario si trabaja */}
                  {excForm.activo && (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5 }}>
                          HORARIO
                        </span>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)' }}>
                          {excForm.slots.length > 0 ? `${excForm.hora_inicio} — ${excForm.hora_fin}` : 'Sin selección'}
                        </span>
                      </div>
                      <div style={{ maxHeight:280, overflowY:'auto' }}>
                        <HorarioGrid
                          value={excForm.slots}
                          onChange={setExcSlots}
                          accentColor={col}
                        />
                      </div>
                    </div>
                  )}

                  {/* Nota */}
                  <div>
                    <label style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5, display:'block', marginBottom:6 }}>NOTA (opcional)</label>
                    <input type="text" className="sp-input" placeholder="Ej: Vacaciones, cita médica…"
                      value={excForm.nota}
                      onChange={e => setExcForm(f => ({ ...f, nota: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setExcForm(null)} style={{
                    flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                    background:'var(--card)', border:'none',
                    color:'var(--text-2)', fontWeight:600, fontSize:14,
                    boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
                  }}>Cancelar</button>
                  <button onClick={guardarExcepcion} disabled={savingExc} style={{
                    flex:2, padding:'14px', borderRadius:14, cursor:'pointer',
                    background:col, border:'none', color:'#fff',
                    fontFamily:'Outfit', fontWeight:700, fontSize:14,
                    opacity: savingExc ? 0.7 : 1,
                  }}>{savingExc ? 'Guardando…' : 'Guardar'}</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {/* ── Sheet editar propietario ─────────────────────── */}
      {editOwner && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setEditOwner(false)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />
            <p className="sp-sheet-title">Propietario del negocio</p>

            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:16 }}>
              {/* Foto */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                <div style={{
                  width:72, height:72, borderRadius:20, background:`${col}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:28, color:col,
                  overflow:'hidden', flexShrink:0,
                }}>
                  {ownerForm.foto_representante
                    ? <img src={ownerForm.foto_representante} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : (ownerForm.nombre_representante?.[0] || '?').toUpperCase()
                  }
                </div>
                <ImageUploader
                  label="FOTO"
                  value={ownerForm.foto_representante || ''}
                  onChange={url => setOwnerForm(f => ({ ...f, foto_representante: url }))}
                  folder="propietarios"
                  accent={col}
                />
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', display:'block', marginBottom:6 }}>
                  NOMBRE DEL PROPIETARIO
                </label>
                <input
                  autoFocus
                  className="sp-input"
                  placeholder="María García"
                  value={ownerForm.nombre_representante}
                  onChange={e => setOwnerForm(f => ({ ...f, nombre_representante: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setEditOwner(false)} style={{
                flex:1, padding:'13px', borderRadius:14, cursor:'pointer',
                background:'var(--card)', border:'none',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
                boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
              }}>Cancelar</button>
              <button onClick={guardarOwner} disabled={savingOwner} style={{
                flex:2, padding:'13px', borderRadius:14, cursor:'pointer',
                background:`linear-gradient(135deg,${col},${col}cc)`,
                border:'none', color:'#fff', fontFamily:'Outfit', fontWeight:700, fontSize:15,
                opacity: savingOwner ? 0.7 : 1,
              }}>{savingOwner ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
