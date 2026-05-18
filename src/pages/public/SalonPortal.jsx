import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const DIA_KEY = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
const MESES_P = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function timeToMin(t) {
  const [h, m] = (t || '00:00').slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
function fmtHora(iso) {
  if (!iso) return ''
  const [h, m] = iso.substring(11, 16).split(':')
  const hh = parseInt(h)
  return `${hh > 12 ? hh - 12 : hh || 12}:${m}${hh < 12 ? 'am' : 'pm'}`
}
function fmtCOP(n) {
  if (!n || n <= 0) return null
  return '$' + Number(n).toLocaleString('es-CO')
}

// ── Helpers de tema (dark / light) ──────────────────────────────
function makeTheme(dark, col) {
  if (dark) return {
    rootBg:    '#08080f',
    text:      '#fff',
    muted:     'rgba(255,255,255,0.40)',
    faint:     'rgba(255,255,255,0.25)',
    card:      (e={}) => ({ background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.09)', backdropFilter:'blur(24px) saturate(180%)', WebkitBackdropFilter:'blur(24px) saturate(180%)', boxShadow:'0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)', ...e }),
    cardSel:   (c,e={}) => ({ background:`${c}18`, border:`1px solid ${c}55`, backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', boxShadow:`0 0 24px ${c}30, 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 ${c}20`, ...e }),
    input:     { width:'100%', padding:'15px 18px', borderRadius:16, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" },
    ghost:     { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', color:'rgba(255,255,255,0.55)', fontWeight:600, fontSize:14, borderRadius:12, padding:'10px 20px', cursor:'pointer' },
    dayText:   'rgba(255,255,255,0.85)',
    headerGlass: { background:'rgba(255,255,255,0.04)', border:'none', borderBottom:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', boxShadow:`0 1px 0 ${col}25, 0 8px 32px rgba(0,0,0,0.4)` },
    showOrbs: true,
    calNavBg: `${col}15`,
    calNavBorder: 'none',
  }
  return {
    rootBg:    '#f5f5f8',
    text:      '#1a1a2e',
    muted:     'rgba(26,26,46,0.50)',
    faint:     'rgba(26,26,46,0.35)',
    card:      (e={}) => ({ background:'rgba(255,255,255,0.95)', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', ...e }),
    cardSel:   (c,e={}) => ({ background:`${c}10`, border:`1.5px solid ${c}60`, boxShadow:`0 4px 20px ${c}18`, ...e }),
    input:     { width:'100%', padding:'15px 18px', borderRadius:16, background:'#fff', border:'1.5px solid rgba(0,0,0,0.12)', color:'#1a1a2e', fontSize:15, outline:'none', boxSizing:'border-box', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" },
    ghost:     { background:'rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.08)', color:'rgba(26,26,46,0.55)', fontWeight:600, fontSize:14, borderRadius:12, padding:'10px 20px', cursor:'pointer' },
    dayText:   '#1a1a2e',
    headerGlass: { background:'rgba(255,255,255,0.92)', border:'none', borderBottom:'1px solid rgba(0,0,0,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' },
    showOrbs: false,
    calNavBg: `${col}18`,
    calNavBorder: 'none',
  }
}

const primaryBtn = (col, disabled = false) => ({
  background: disabled ? 'rgba(128,128,128,0.15)' : `linear-gradient(135deg, ${col} 0%, ${col}bb 100%)`,
  border: 'none',
  boxShadow: disabled ? 'none' : `0 0 40px ${col}45, 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
  color: disabled ? 'rgba(128,128,128,0.6)' : '#fff',
  fontFamily: 'Outfit, system-ui, sans-serif',
  fontWeight: 700, fontSize: 16, borderRadius: 18,
  padding: '17px 24px', width: '100%',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.2s ease',
})

function Spinner({ col = '#f43f5e' }) {
  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#08080f' }}>
      <div style={{ width:40, height:40, border:`3px solid rgba(255,255,255,0.06)`, borderTopColor:col, borderRadius:'50%', animation:'sp 0.8s linear infinite' }} />
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Orbs({ col }) {
  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none' }}>
      <div style={{ position:'absolute', top:'-15%', left:'-15%', width:'70vw', height:'70vw', maxWidth:600, maxHeight:600, borderRadius:'50%', background:`radial-gradient(circle at 40% 40%, ${col}40 0%, ${col}18 40%, transparent 70%)`, animation:'orb1 14s ease-in-out infinite', filter:'blur(1px)' }} />
      <div style={{ position:'absolute', bottom:'-20%', right:'-20%', width:'65vw', height:'65vw', maxWidth:560, maxHeight:560, borderRadius:'50%', background:`radial-gradient(circle at 60% 60%, ${col}28 0%, ${col}10 45%, transparent 70%)`, animation:'orb2 18s ease-in-out infinite', filter:'blur(2px)' }} />
      <div style={{ position:'absolute', top:'35%', right:'5%', width:'40vw', height:'40vw', maxWidth:320, maxHeight:320, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)', animation:'orb3 22s ease-in-out infinite reverse', filter:'blur(2px)' }} />
      <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:`linear-gradient(90deg, transparent, ${col}60, transparent)`, boxShadow:`0 0 20px 2px ${col}40` }} />
    </div>
  )
}

// ── Calendario del portal con días de trabajo visibles ──────────
function PortalCalendario({ value, onChange, col, diasTrabaja, T }) {
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
  const startOff    = (new Date(nav.y, nav.m - 1, 1).getDay() + 6) % 7
  const cells = []
  for (let i = 0; i < startOff; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ ...T.card({ borderRadius:20 }), padding:'20px 16px', marginBottom:24 }}>
      {/* Nav mes */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <button type="button" onClick={() => changeNav(-1)} style={{ width:36, height:36, borderRadius:10, border:T.calNavBorder, background:T.calNavBg, color:col, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>‹</button>
        <span style={{ fontWeight:700, fontSize:15, color:T.text }}>{MESES_P[nav.m - 1]} {nav.y}</span>
        <button type="button" onClick={() => changeNav(1)} style={{ width:36, height:36, borderRadius:10, border:T.calNavBorder, background:T.calNavBg, color:col, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>›</button>
      </div>

      {/* Cabecera días */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:T.faint, padding:'2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Días */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr = `${nav.y}-${String(nav.m).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isPast  = dateStr < hoy
          const isSel   = dateStr === value
          const isToday = dateStr === hoy
          const dow     = new Date(dateStr + 'T12:00:00').getDay()
          const trabaja = diasTrabaja.size === 0 || diasTrabaja.has(DIA_KEY[dow])
          const disabled = isPast || !trabaja

          let bg = 'transparent', color = T.dayText, opacity = 1, outline = 'none'
          if (isSel && !disabled) { bg = `linear-gradient(135deg,${col},${col}cc)`; color = '#fff' }
          else if (isToday && !disabled) { outline = `1.5px solid ${col}` }
          else if (!trabaja && !isPast) { opacity = 0.25 }
          else if (isPast) { opacity = 0.18 }

          return (
            <button key={dateStr} type="button" disabled={disabled} onClick={() => onChange(dateStr)}
              title={!trabaja && !isPast ? 'No trabaja este día' : undefined}
              style={{
                aspectRatio:'1', minHeight:38, borderRadius:9, border:'none', outline,
                cursor: disabled ? 'default' : 'pointer', background: bg, color,
                fontSize:13, fontWeight: isSel || isToday ? 700 : 400,
                opacity, transition:'all 0.15s',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                boxShadow: isSel ? `0 0 16px ${col}50` : 'none',
              }}>
              {day}
              {/* Punto verde = disponible */}
              {trabaja && !isPast && !isSel && (
                <span style={{ width:3, height:3, borderRadius:'50%', background:`${col}80`, display:'block' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display:'flex', gap:20, marginTop:12, justifyContent:'center' }}>
        <span style={{ fontSize:10, color:T.muted, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:`${col}80`, display:'inline-block' }} />
          Disponible
        </span>
        <span style={{ fontSize:10, color:T.muted, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:T.faint, display:'inline-block', opacity:0.4 }} />
          No trabaja
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
export default function SalonPortal() {
  const { slug } = useParams()

  const [tenant,    setTenant]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [darkMode,  setDarkMode]  = useState(true)

  const [profs,         setProfs]         = useState([])
  const [servs,         setServs]         = useState([])     // todos los servicios del tenant
  const [profServMap,   setProfServMap]   = useState({})    // { profId: [servId,...] }
  const [diasTrabaja,   setDiasTrabaja]   = useState(new Set())
  const [slots,         setSlots]         = useState([])
  const [sinHorario,    setSinHorario]    = useState(false)
  const [cargandoSlots, setCargandoSlots] = useState(false)

  // Flujo: 0=Servicios → 1=Profesional → 2=Fecha/hora → 3=Datos → 4=Confirmado
  const [step,    setStep]    = useState(0)
  const [profId,  setProfId]  = useState(null)
  const [servIds, setServIds] = useState([])
  const [fecha,   setFecha]   = useState(new Date().toISOString().slice(0, 10))
  const [slot,    setSlot]    = useState(null)

  const [nombre,     setNombre]    = useState('')
  const [telefono,   setTelefono]  = useState('')
  const [saving,     setSaving]    = useState(false)
  const [error,      setError]     = useState(null)
  const [confirmada, setConfirmada]= useState(null)

  const [wlMode,   setWlMode]   = useState(false)
  const [wlOk,     setWlOk]     = useState(false)
  const [wlNombre, setWlNombre] = useState('')
  const [wlTel,    setWlTel]    = useState('')
  const [wlSaving, setWlSaving] = useState(false)

  const [reglas, setReglas] = useState([])

  const stepRef = useRef(step)
  useEffect(() => { stepRef.current = step }, [step])

  // ── Botón atrás del navegador → retroceder paso sin salir de la app ──
  useEffect(() => {
    // Empujar estado inicial al historial para interceptar el primer "atrás"
    window.history.pushState({ portalStep: 0 }, '', window.location.href)

    function handlePop() {
      const curr = stepRef.current
      if (curr <= 0) {
        // Ya estamos en el inicio — re-empujar para no salir
        window.history.pushState({ portalStep: 0 }, '', window.location.href)
        return
      }
      const prev = curr - 1
      setStep(prev)
      if (prev === 0) { setProfId(null); setServIds([]); setSlot(null) }
      if (prev === 1) { setProfId(null); setSlot(null) }
      if (prev === 2) { setSlot(null) }
      window.history.pushState({ portalStep: prev }, '', window.location.href)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  // Empujar al historial cuando avanza de paso
  function avanzar(nuevoStep) {
    setStep(nuevoStep)
    window.history.pushState({ portalStep: nuevoStep }, '', window.location.href)
  }

  // ── Carga inicial: tenant + profs + servs + profServMap + reglas ──
  useEffect(() => {
    async function load() {
      try {
        const { data: t } = await supabase.from('tenants')
          .select('*').eq('slug', slug).eq('activo', true).maybeSingle()
        if (!t) { setNotFound(true); setLoading(false); return }
        setTenant(t)
        const [profsRes, servsRes, psRes, reglasRes] = await Promise.all([
          supabase.from('profesionales').select('id, nombre, especialidad, foto_url').eq('tenant_id', t.id).eq('activo', true).order('nombre'),
          supabase.from('servicios').select('id, nombre, precio, duracion_min, categoria').eq('tenant_id', t.id).eq('activo', true).order('categoria').order('nombre'),
          supabase.from('profesional_servicios').select('profesional_id, servicio_id').eq('tenant_id', t.id).eq('activo', true),
          supabase.from('reglas_precio_dinamico').select('*').eq('tenant_id', t.id).eq('activo', true),
        ])
        setProfs(profsRes.data || [])
        setServs(servsRes.data || [])
        setReglas(reglasRes.data || [])
        const map = {}
        ;(psRes.data || []).forEach(r => {
          if (!map[r.profesional_id]) map[r.profesional_id] = []
          map[r.profesional_id].push(r.servicio_id)
        })
        setProfServMap(map)
      } catch (err) {
        console.error('[SalonPortal] load error', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // ── Cargar días de trabajo del profesional al seleccionarlo ──
  useEffect(() => {
    if (!profId) { setDiasTrabaja(new Set()); return }
    supabase.from('horarios').select('dia, activo').eq('profesional_id', profId)
      .then(({ data }) => {
        const dias = new Set((data || []).filter(h => h.activo).map(h => h.dia))
        setDiasTrabaja(dias)
      })
  }, [profId])

  // ── Regenerar slots al cambiar prof / fecha / duración ──
  useEffect(() => {
    if (!profId || duracionTotal === 0 || !fecha) { setSlots([]); return }
    setSinHorario(false); setSlots([]); setSlot(null)
    generarSlots(profId, fecha, duracionTotal)
  }, [profId, fecha, duracionTotal])

  // Profesionales que pueden hacer TODOS los servicios seleccionados
  const profsParaServicios = useMemo(() => {
    if (servIds.length === 0) return profs
    return profs.filter(p => {
      const psIds = profServMap[p.id]
      if (!psIds || psIds.length === 0) return true // sin restricción → puede todo
      return servIds.every(sid => psIds.includes(sid))
    })
  }, [profs, servIds, profServMap])

  const selectedServs = useMemo(() => servs.filter(s => servIds.includes(s.id)), [servs, servIds])
  const duracionTotal = useMemo(() => selectedServs.reduce((s, x) => s + (x.duracion_min || 0), 0), [selectedServs])
  const precioBase    = useMemo(() => selectedServs.reduce((s, x) => s + (Number(x.precio) || 0), 0), [selectedServs])

  const reglaActiva = useMemo(() => {
    if (!slot || !reglas.length) return null
    const dia     = new Date(slot.inicio).getDay()
    const minSlot = parseInt(slot.inicio.slice(11,13)) * 60 + parseInt(slot.inicio.slice(14,16))
    return reglas.find(r => r.activo && r.dias_semana.includes(dia) && timeToMin(r.hora_inicio) <= minSlot && timeToMin(r.hora_fin) > minSlot) || null
  }, [slot, reglas])

  const precioTotal = useMemo(() => {
    if (!reglaActiva || !precioBase) return precioBase
    return Math.round(precioBase * reglaActiva.multiplicador)
  }, [precioBase, reglaActiva])

  function slotEsPremium(s) {
    if (!reglas.length) return false
    const dia     = new Date(s.inicio).getDay()
    const minSlot = parseInt(s.inicio.slice(11,13)) * 60 + parseInt(s.inicio.slice(14,16))
    return reglas.some(r => r.activo && r.dias_semana.includes(dia) && timeToMin(r.hora_inicio) <= minSlot && timeToMin(r.hora_fin) > minSlot)
  }

  const porCategoria = useMemo(() => {
    const map = {}
    servs.forEach(s => { const c = s.categoria || 'General'; if (!map[c]) map[c] = []; map[c].push(s) })
    return map
  }, [servs])

  function toggleServ(id) {
    setServIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
    setSlot(null)
  }

  async function generarSlots(pId, f, durMin) {
    setCargandoSlots(true)
    const dia = DIA_KEY[new Date(f + 'T12:00:00').getDay()]
    const { data: h } = await supabase.from('horarios').select('hora_inicio, hora_fin').eq('profesional_id', pId).eq('dia', dia).eq('activo', true).maybeSingle()
    if (!h) { setSinHorario(true); setCargandoSlots(false); return }
    const [hI, mI] = h.hora_inicio.slice(0,5).split(':').map(Number)
    const [hF, mF] = h.hora_fin.slice(0,5).split(':').map(Number)
    const iMin = hI*60+mI, fMin = hF*60+mF
    const { data: occ } = await supabase.from('citas').select('fecha_inicio, fecha_fin').eq('profesional_id', pId).gte('fecha_inicio', `${f}T00:00:00`).lte('fecha_inicio', `${f}T23:59:59`).neq('estado', 'cancelada')
    const gen = []
    for (let t = iMin; t + durMin <= fMin; t += 15) {
      const hh = String(Math.floor(t/60)).padStart(2,'0')
      const mm = String(t%60).padStart(2,'0')
      const ini = `${f}T${hh}:${mm}:00`
      const fin = new Date(new Date(ini).getTime()+durMin*60000).toISOString().slice(0,19)
      const busy = (occ||[]).some(c => c.fecha_inicio < fin && c.fecha_fin > ini)
      if (!busy) gen.push({ inicio:ini, fin, label:`${hh}:${mm}` })
    }
    setSlots(gen); setCargandoSlots(false)
  }

  async function confirmar() {
    if (!nombre.trim())  { setError('Ingresa tu nombre'); return }
    if (!slot)           { setError('Selecciona un horario'); return }
    if (!servIds.length) { setError('Selecciona al menos un servicio'); return }
    setSaving(true); setError(null)
    let cliId
    if (telefono.trim()) {
      const { data: ex } = await supabase.from('clientes_agenda').select('id').eq('tenant_id', tenant.id).eq('telefono', telefono.trim()).maybeSingle()
      if (ex) cliId = ex.id
    }
    if (!cliId) {
      const { data: nc, error: e } = await supabase.from('clientes_agenda').insert({ tenant_id: tenant.id, nombre: nombre.trim(), telefono: telefono.trim()||null }).select('id').single()
      if (e) { setError('Error al registrar. Intenta de nuevo.'); setSaving(false); return }
      cliId = nc.id
    }
    const { data: cita, error: eCita } = await supabase.from('citas').insert({ tenant_id: tenant.id, profesional_id: profId, servicio_id: servIds[0], servicios_ids: servIds, cliente_id: cliId, fecha_inicio: slot.inicio, fecha_fin: slot.fin, estado: 'confirmada', precio_cobrado: precioTotal||null }).select('id').single()
    if (eCita) { setError('Error al agendar. Intenta de nuevo.'); setSaving(false); return }
    supabase.functions.invoke('notificacion-cita', { body: { cita_id: cita.id } }).catch(()=>{})
    setConfirmada({ prof: profs.find(p=>p.id===profId), servs: selectedServs, duracionTotal, precioTotal, slot, fecha, nombre: nombre.trim() })
    avanzar(4); setSaving(false)
  }

  async function unirseEspera() {
    if (!wlNombre.trim()) return
    setWlSaving(true)
    let cliId = null
    if (wlTel.trim()) {
      const { data: ex } = await supabase.from('clientes_agenda').select('id').eq('tenant_id', tenant.id).eq('telefono', wlTel.trim()).maybeSingle()
      if (ex) cliId = ex.id
    }
    if (!cliId) {
      const { data: nc } = await supabase.from('clientes_agenda').insert({ tenant_id: tenant.id, nombre: wlNombre.trim(), telefono: wlTel.trim()||null }).select('id').single()
      if (nc) cliId = nc.id
    }
    await supabase.from('lista_espera').insert({ tenant_id: tenant.id, profesional_id: profId, servicio_id: servIds[0]||null, servicios_ids: servIds, cliente_id: cliId, nombre_temporal: cliId?null:wlNombre.trim(), telefono_temporal: cliId?null:wlTel.trim()||null, fecha_preferida: fecha||null })
    setWlSaving(false); setWlOk(true)
  }

  function resetAll() {
    setStep(0); setProfId(null); setServIds([]); setSlot(null)
    setFecha(new Date().toISOString().slice(0,10))
    setNombre(''); setTelefono(''); setError(null); setConfirmada(null)
    setWlMode(false); setWlOk(false); setWlNombre(''); setWlTel('')
    window.history.replaceState({ portalStep: 0 }, '', window.location.href)
  }

  const col  = tenant?.color_primario || '#f43f5e'
  const T    = makeTheme(darkMode, col)
  const prof = profs.find(p => p.id === profId)

  if (loading)  return <Spinner col={col || '#f43f5e'} />
  if (notFound) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#08080f', padding:24 }}>
      <div style={{ textAlign:'center', color:'#fff' }}>
        <p style={{ fontSize:48, marginBottom:16 }}>🔍</p>
        <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22 }}>Salón no encontrado</p>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', marginTop:8 }}>Verifica el link que te compartieron</p>
      </div>
    </div>
  )

  const backBtn = (toStep, extraReset = () => {}) => (
    <button onClick={() => { extraReset(); avanzar(toStep) }} style={{ ...T.ghost, marginBottom:24, display:'flex', alignItems:'center', gap:6, padding:'6px 0', background:'none', boxShadow:'none', border:'none' }}>
      <span style={{ fontSize:18 }}>‹</span> Volver
    </button>
  )

  return (
    <div style={{ minHeight:'100dvh', background:T.rootBg, color:T.text, fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", position:'relative' }}>
      {T.showOrbs && <Orbs col={col} />}

      {/* ── Header ── */}
      <div style={{ ...T.headerGlass, padding:'16px 20px', position:'sticky', top:0, zIndex:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, maxWidth:540, margin:'0 auto' }}>
          <div style={{ width:44, height:44, borderRadius:13, overflow:'hidden', flexShrink:0, background:`linear-gradient(135deg, ${col}, ${col}88)`, boxShadow:`0 0 16px ${col}40`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit', fontWeight:900, fontSize:19, color:'#fff' }}>
            {tenant.logo_url ? <img src={tenant.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : tenant.nombre[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:16, color:T.text, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{tenant.nombre}</div>
            {(tenant.descripcion || tenant.ciudad) && (
              <div style={{ fontSize:11, color:T.muted, marginTop:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{tenant.descripcion || `📍 ${tenant.ciudad}`}</div>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            {step > 0 && step < 4 && (
              <div style={{ fontSize:12, fontWeight:800, color:col, background:`${col}18`, padding:'4px 10px', borderRadius:8, border:`1px solid ${col}35` }}>{step}/3</div>
            )}
            {/* Toggle modo día/noche */}
            <button onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Modo día' : 'Modo noche'} style={{ width:34, height:34, borderRadius:9, border:'none', cursor:'pointer', background:`${col}15`, color:col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      {/* Promo banner */}
      {tenant.config_vertical?.promo && step < 4 && (
        <div style={{ background:`linear-gradient(90deg,${col}20,${col}10,${col}20)`, borderBottom:`1px solid ${col}20`, padding:'10px 20px', position:'relative', zIndex:10 }}>
          <p style={{ maxWidth:540, margin:'0 auto', fontSize:13, color:`${col}ee`, fontWeight:700, textAlign:'center', letterSpacing:0.3 }}>✨ {tenant.config_vertical.promo}</p>
        </div>
      )}

      {/* Barra de progreso */}
      {step > 0 && step < 4 && (
        <div style={{ display:'flex', gap:5, padding:'0 20px', position:'relative', zIndex:10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i <= step ? `linear-gradient(90deg, ${col}, ${col}99)` : (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'), boxShadow: i <= step ? `0 0 8px ${col}70` : 'none', transition:'all 0.35s ease' }} />
          ))}
        </div>
      )}

      {/* ── Contenido ── */}
      <div style={{ maxWidth:540, margin:'0 auto', padding:'28px 20px 60px', position:'relative', zIndex:10 }}>

        {/* ════ STEP 4: Confirmación ════ */}
        {step === 4 && confirmada && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:90, height:90, borderRadius:28, margin:'0 auto 28px', background:`linear-gradient(135deg, ${col}30, ${col}10)`, border:`1.5px solid ${col}50`, boxShadow:`0 0 50px ${col}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:42 }}>✅</div>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:28, marginBottom:8, letterSpacing:-0.5, color:T.text }}>¡Cita confirmada!</h2>
            <p style={{ color:T.muted, marginBottom:36, fontSize:15 }}>Te esperamos, {confirmada.nombre.split(' ')[0]} 🙌</p>
            <div style={{ ...T.card({ borderRadius:24 }), padding:'22px', textAlign:'left', marginBottom:28 }}>
              {[
                { emoji:'👤', txt: confirmada.prof?.nombre },
                ...confirmada.servs.map(s => ({ emoji:'✂️', txt: s.nombre })),
                { emoji:'⏱', txt: `${confirmada.duracionTotal} min en total` },
                { emoji:'📅', txt: new Date(confirmada.fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'}) },
                { emoji:'🕐', txt: fmtHora(confirmada.slot.inicio) },
                ...(confirmada.precioTotal > 0 ? [{ emoji:'💰', txt: fmtCOP(confirmada.precioTotal) }] : []),
              ].map((row, i, arr) => (
                <div key={i} style={{ display:'flex', gap:14, padding:'12px 0', borderBottom: i < arr.length-1 ? `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none', alignItems:'center' }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{row.emoji}</span>
                  <span style={{ fontSize:14, color:T.muted, lineHeight:1.5 }}>{row.txt}</span>
                </div>
              ))}
            </div>
            {tenant.whatsapp && (
              <a href={`https://wa.me/57${tenant.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${tenant.nombre}, acabo de confirmar una cita para el ${new Date(confirmada.fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})} a las ${confirmada.slot.label}. Servicios: ${confirmada.servs.map(s=>s.nombre).join(', ')}. Mi nombre es ${confirmada.nombre}.`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'17px', borderRadius:18, marginBottom:12, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.25)', color:'#25d166', fontFamily:'Outfit', fontWeight:700, fontSize:15, textDecoration:'none', boxSizing:'border-box' }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#25d166"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.126 1.527 5.857L0 24l6.305-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.687-.512-5.217-1.406l-.374-.222-3.744.982.999-3.648-.244-.375A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
                Confirmar por WhatsApp
              </a>
            )}
            <button onClick={resetAll} style={{ ...T.card({ borderRadius:18 }), width:'100%', padding:'16px', color:col, fontFamily:'Outfit', fontWeight:700, fontSize:15, cursor:'pointer', border:`1px solid ${col}30` }}>
              Agendar otra cita
            </button>
          </div>
        )}

        {/* ════ STEP 0: Servicios ════ */}
        {step === 0 && (
          <>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:6, letterSpacing:-0.5, color:T.text }}>
              ¿Qué servicio necesitas?
            </h2>
            <p style={{ color:T.muted, fontSize:14, marginBottom:28 }}>Puedes elegir varios servicios</p>

            {servs.length === 0 ? (
              <div style={{ ...T.card({ borderRadius:24 }), padding:'48px 24px', textAlign:'center' }}>
                <p style={{ fontSize:36, marginBottom:12 }}>✂️</p>
                <p style={{ color:T.muted, fontSize:15 }}>Sin servicios disponibles</p>
              </div>
            ) : (
              <>
                {/* Resumen selección */}
                {servIds.length > 0 && (
                  <div style={{ ...T.cardSel(col, { borderRadius:16 }), padding:'13px 18px', marginBottom:22, display:'flex', alignItems:'center', justifyContent:'space-between', animation:'fadeIn 0.2s ease' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:col }}>{servIds.length} servicio{servIds.length > 1 ? 's' : ''} · {duracionTotal} min</div>
                    {precioBase > 0 && <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:T.text }}>{fmtCOP(precioBase)}</div>}
                  </div>
                )}

                {Object.entries(porCategoria).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom:22 }}>
                    <p style={{ fontSize:11, fontWeight:700, color:T.faint, letterSpacing:1.2, textTransform:'uppercase', marginBottom:11 }}>{cat}</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                      {items.map(s => {
                        const sel = servIds.includes(s.id)
                        return (
                          <button key={s.id} onClick={() => toggleServ(s.id)} style={{ ...(sel ? T.cardSel(col, { borderRadius:18 }) : T.card({ borderRadius:18 })), display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, padding:'16px 18px', cursor:'pointer', textAlign:'left', width:'100%', transition:'all 0.18s ease' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:15, color: sel ? col : T.text }}>{s.nombre}</div>
                              <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{s.duracion_min}min{s.categoria ? ` · ${s.categoria}` : ''}</div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                              {s.precio > 0 && <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color: sel ? col : T.muted }}>{fmtCOP(s.precio)}</span>}
                              <div style={{ width:26, height:26, borderRadius:8, flexShrink:0, background: sel ? `linear-gradient(135deg, ${col}, ${col}cc)` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'), border: `1.5px solid ${sel ? col : (darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)')}`, boxShadow: sel ? `0 0 16px ${col}50` : 'none', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.18s ease' }}>
                                {sel && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <button onClick={() => avanzar(1)} disabled={servIds.length === 0} style={primaryBtn(col, servIds.length === 0)}>
                  {servIds.length === 0 ? 'Elige al menos un servicio' : `Continuar · ${servIds.length} servicio${servIds.length>1?'s':''} · ${duracionTotal}min`}
                </button>
              </>
            )}
          </>
        )}

        {/* ════ STEP 1: Profesional (filtrado por servicios) ════ */}
        {step === 1 && (
          <>
            {backBtn(0, () => { setServIds([]); setProfId(null) })}
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:6, letterSpacing:-0.5, color:T.text }}>¿Con quién?</h2>
            <p style={{ color:T.muted, fontSize:14, marginBottom:28 }}>
              {selectedServs.map(s=>s.nombre).join(' + ')} · {duracionTotal}min
              {profsParaServicios.length < profs.length && <span style={{ color:col, fontWeight:700 }}> · {profsParaServicios.length} disponible{profsParaServicios.length !== 1 ? 's' : ''}</span>}
            </p>

            {profsParaServicios.length === 0 ? (
              <div style={{ ...T.card({ borderRadius:24 }), padding:'48px 24px', textAlign:'center' }}>
                <p style={{ fontSize:36, marginBottom:12 }}>🚧</p>
                <p style={{ color:T.muted, fontSize:15 }}>Sin profesionales disponibles para estos servicios</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {profsParaServicios.map(p => (
                  <button key={p.id} onClick={() => { setProfId(p.id); avanzar(2) }} style={{ ...T.card({ borderRadius:22 }), display:'flex', alignItems:'center', gap:16, padding:'18px 20px', cursor:'pointer', textAlign:'left', width:'100%', transition:'all 0.2s ease' }}>
                    <div style={{ width:54, height:54, borderRadius:17, flexShrink:0, overflow:'hidden', background:`${col}28`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Outfit', fontWeight:800, fontSize:22, color:col }}>
                      {p.foto_url ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : p.nombre[0]}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:16, color:T.text }}>{p.nombre}</div>
                      {p.especialidad && <div style={{ fontSize:13, color:T.muted, marginTop:3 }}>{p.especialidad}</div>}
                    </div>
                    <div style={{ width:32, height:32, borderRadius:10, flexShrink:0, background:`${col}15`, border:`1px solid ${col}30`, display:'flex', alignItems:'center', justifyContent:'center', color:col, fontSize:18 }}>›</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════ STEP 2: Fecha y hora con calendario propio ════ */}
        {step === 2 && (
          <>
            {backBtn(1, () => { setProfId(null); setSlot(null) })}
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:4, letterSpacing:-0.5, color:T.text }}>¿Cuándo?</h2>
            <p style={{ color:T.muted, fontSize:14, marginBottom:24 }}>
              Con {prof?.nombre?.split(' ')[0]} · {selectedServs.map(s=>s.nombre).join(' + ')} · {duracionTotal}min
            </p>

            {/* Calendario con días de trabajo visibles */}
            <PortalCalendario
              value={fecha}
              onChange={v => { setFecha(v); setSlot(null) }}
              col={col}
              diasTrabaja={diasTrabaja}
              T={T}
            />

            {cargandoSlots ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 0', gap:16 }}>
                <div style={{ width:32, height:32, border:`3px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderTopColor:col, borderRadius:'50%', animation:'sp 0.8s linear infinite' }} />
                <p style={{ fontSize:13, color:T.muted }}>Buscando disponibilidad…</p>
              </div>
            ) : sinHorario ? (
              <div style={{ ...T.card({ borderRadius:24 }), padding:'32px 24px', textAlign:'center' }}>
                <p style={{ fontSize:40, marginBottom:12 }}>😴</p>
                <p style={{ fontWeight:700, fontSize:17, color:T.text }}>{prof?.nombre?.split(' ')[0]} no trabaja este día</p>
                <p style={{ fontSize:13, color:T.muted, marginTop:8 }}>Elige otra fecha en el calendario</p>
              </div>
            ) : slots.length === 0 && fecha ? (
              wlOk ? (
                <div style={{ ...T.card({ borderRadius:24 }), padding:'48px 24px', textAlign:'center' }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>🔔</div>
                  <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, marginBottom:8, color:T.text }}>¡Te anotamos!</p>
                  <p style={{ fontSize:14, color:T.muted, marginBottom:28, lineHeight:1.6 }}>Cuando haya un espacio libre te enviamos un WhatsApp.</p>
                  <button onClick={() => { setWlMode(false); setWlOk(false); setWlNombre(''); setWlTel('') }} style={T.ghost}>Buscar otra fecha</button>
                </div>
              ) : wlMode ? (
                <div>
                  <button onClick={() => setWlMode(false)} style={{ ...T.ghost, marginBottom:24, display:'flex', alignItems:'center', gap:6, padding:'6px 0', background:'none', border:'none' }}>
                    <span style={{ fontSize:18 }}>‹</span> Volver
                  </button>
                  <div style={{ ...T.card({ borderRadius:24 }), padding:'28px 24px' }}>
                    <div style={{ fontSize:44, marginBottom:16, textAlign:'center' }}>🔔</div>
                    <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, marginBottom:8, textAlign:'center', color:T.text }}>Lista de espera</h3>
                    <p style={{ fontSize:13, color:T.muted, marginBottom:28, textAlign:'center', lineHeight:1.6 }}>Te avisamos cuando {prof?.nombre?.split(' ')[0]} tenga un espacio libre.</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:24 }}>
                      <div><label style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:1, display:'block', marginBottom:8 }}>TU NOMBRE *</label><input value={wlNombre} onChange={e => setWlNombre(e.target.value)} placeholder="Nombre completo" style={T.input} /></div>
                      <div><label style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:1, display:'block', marginBottom:8 }}>WHATSAPP</label><input value={wlTel} onChange={e => setWlTel(e.target.value)} placeholder="Ej: 3001234567" type="tel" style={T.input} /></div>
                    </div>
                    <button onClick={unirseEspera} disabled={!wlNombre.trim()||wlSaving} style={primaryBtn(col, !wlNombre.trim()||wlSaving)}>{wlSaving ? 'Guardando…' : '🔔 Avisarme cuando haya espacio'}</button>
                  </div>
                </div>
              ) : (
                <div style={{ ...T.card({ borderRadius:24 }), padding:'40px 24px', textAlign:'center' }}>
                  <p style={{ fontSize:44, marginBottom:14 }}>😕</p>
                  <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:18, marginBottom:8, color:T.text }}>Sin disponibilidad este día</p>
                  <p style={{ fontSize:13, color:T.muted, marginBottom:28, lineHeight:1.6 }}>Todos los horarios están ocupados.<br />Elige otra fecha en el calendario.</p>
                  <button onClick={() => setWlMode(true)} style={primaryBtn(col)}>🔔 Avisarme cuando haya espacio</button>
                </div>
              )
            ) : slots.length > 0 ? (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <p style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', margin:0 }}>Horarios disponibles</p>
                  {reglas.length > 0 && <p style={{ fontSize:11, color:T.faint, margin:0 }}>⚡ precio premium</p>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:28 }}>
                  {slots.map(s => {
                    const sel     = slot?.inicio === s.inicio
                    const premium = slotEsPremium(s)
                    return (
                      <button key={s.inicio} onClick={() => setSlot(s)} style={{ ...(sel ? T.cardSel(col, { borderRadius:14 }) : T.card({ borderRadius:14 })), padding:'12px 4px 10px', cursor:'pointer', color: sel ? col : T.muted, fontFamily:'Outfit', fontWeight:700, fontSize:14, transition:'all 0.15s ease', display:'flex', flexDirection:'column', alignItems:'center', gap:3, border: premium && !sel ? `1px solid ${col}35` : undefined }}>
                        {s.label}
                        {premium && <span style={{ fontSize:9, opacity:0.7 }}>⚡</span>}
                      </button>
                    )
                  })}
                </div>
                {slot && (
                  <>
                    {reglaActiva && precioBase > 0 && (
                      <div style={{ ...T.card({ borderRadius:14 }), padding:'12px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10, border:`1px solid ${col}30` }}>
                        <span style={{ fontSize:16 }}>⚡</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{reglaActiva.nombre}</div>
                          <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>+{Math.round((reglaActiva.multiplicador - 1) * 100)}% · precio ajustado por alta demanda</div>
                        </div>
                        <div style={{ fontFamily:'Outfit', fontWeight:900, fontSize:16, color:col }}>{fmtCOP(precioTotal)}</div>
                      </div>
                    )}
                    <button onClick={() => avanzar(3)} style={primaryBtn(col)}>
                      Continuar con las {slot.label}{reglaActiva && precioBase > 0 ? ` · ${fmtCOP(precioTotal)}` : ''}
                    </button>
                  </>
                )}
              </>
            ) : null}
          </>
        )}

        {/* ════ STEP 3: Datos del cliente ════ */}
        {step === 3 && (
          <>
            {backBtn(2, () => setSlot(null))}
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:6, letterSpacing:-0.5, color:T.text }}>Tus datos</h2>
            <p style={{ color:T.muted, fontSize:14, marginBottom:28 }}>Para confirmar tu cita</p>

            {/* Resumen */}
            <div style={{ ...T.cardSel(col, { borderRadius:22 }), padding:'20px', marginBottom:28 }}>
              <div style={{ fontSize:11, color:col, fontWeight:800, letterSpacing:1.2, marginBottom:14, textTransform:'uppercase' }}>TU RESERVA</div>
              {[
                { emoji:'👤', txt: prof?.nombre },
                ...selectedServs.map(s => ({ emoji:'✂️', txt: s.nombre })),
                { emoji:'⏱', txt: `${duracionTotal} min en total` },
                { emoji:'📅', txt: new Date(fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})+' a las '+slot?.label },
                ...(precioTotal > 0 ? [{ emoji:'💰', txt: fmtCOP(precioTotal) }] : []),
              ].map((r, i, arr) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'9px 0', borderBottom: i<arr.length-1 ? `1px solid ${col}18` : 'none', alignItems:'center' }}>
                  <span>{r.emoji}</span>
                  <span style={{ fontSize:14, color:T.muted, lineHeight:1.4 }}>{r.txt}</span>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:28 }}>
              {[
                { label:'TU NOMBRE *', value:nombre, setter:setNombre, placeholder:'Nombre completo', type:'text' },
                { label:'TELÉFONO / WHATSAPP', value:telefono, setter:setTelefono, placeholder:'Ej: 3001234567', type:'tel' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize:11, color:T.faint, fontWeight:700, letterSpacing:1, display:'block', marginBottom:9 }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} type={f.type} style={T.input} />
                </div>
              ))}
            </div>

            {error && (
              <div style={{ ...T.card({ borderRadius:12 }), padding:'12px 16px', marginBottom:20, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(239,68,68,0.08)' }}>
                <p style={{ color:'#f87171', fontSize:13, margin:0, textAlign:'center' }}>{error}</p>
              </div>
            )}
            <button onClick={confirmar} disabled={saving || !nombre.trim()} style={primaryBtn(col, saving || !nombre.trim())}>
              {saving ? 'Confirmando…' : '¡Confirmar cita!'}
            </button>
            <p style={{ fontSize:11, color:T.faint, textAlign:'center', marginTop:18, lineHeight:1.6 }}>
              Al confirmar aceptas que el salón guarde tus datos de contacto
            </p>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      {(tenant.direccion || tenant.ciudad || tenant.whatsapp || tenant.telefono) && (
        <div style={{ ...T.card({ borderRadius:0 }), padding:'24px 20px 32px', textAlign:'center', position:'relative', zIndex:10, borderLeft:'none', borderRight:'none', borderBottom:'none' }}>
          <div style={{ maxWidth:540, margin:'0 auto', display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
            <div style={{ width:40, height:1, background:`linear-gradient(90deg, transparent, ${col}50, transparent)`, marginBottom:4 }} />
            {tenant.config_vertical?.horario_texto && (
              <p style={{ fontSize:12, color:T.muted, letterSpacing:0.3 }}>🕐 {tenant.config_vertical.horario_texto}</p>
            )}
            {(tenant.direccion || tenant.ciudad) && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:15 }}>📍</span>
                <span style={{ fontSize:13, color:T.muted, lineHeight:1.5 }}>{[tenant.direccion, tenant.ciudad].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {tenant.whatsapp ? (
              <a href={`https://wa.me/57${tenant.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'12px 22px', borderRadius:14, background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.22)', color:'#25d166', textDecoration:'none', fontWeight:700, fontSize:14 }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="#25d166"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.126 1.527 5.857L0 24l6.305-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.687-.512-5.217-1.406l-.374-.222-3.744.982.999-3.648-.244-.375A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
                {tenant.whatsapp}
              </a>
            ) : tenant.telefono ? (
              <a href={`tel:${tenant.telefono.replace(/\D/g,'')}`}
                style={{ display:'inline-flex', alignItems:'center', gap:9, padding:'12px 22px', borderRadius:14, background:`${col}0d`, border:`1px solid ${col}28`, color:col, textDecoration:'none', fontWeight:700, fontSize:14 }}>
                📞 {tenant.telefono}
              </a>
            ) : null}
          </div>
        </div>
      )}

      <style>{`
        @keyframes sp    { to { transform: rotate(360deg) } }
        @keyframes orb1  { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(4%,-3%) scale(1.06)} 75%{transform:translate(-3%,2%) scale(0.94)} }
        @keyframes orb2  { 0%,100%{transform:translate(0,0) scale(1)} 35%{transform:translate(-3%,2%) scale(1.08)} 70%{transform:translate(3%,-2%) scale(0.93)} }
        @keyframes orb3  { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-2%,3%) scale(1.04)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        input::placeholder { color:rgba(150,150,160,0.5); }
        button { transition: all 0.18s ease; }
        button:active { transform: scale(0.97); }
        a:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}
