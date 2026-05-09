import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const DIA_KEY = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']

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

// ── Estilos base ────────────────────────────────────────────────
const glass = (extra = {}) => ({
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
  ...extra,
})

const glassSelected = (col, extra = {}) => ({
  background: `${col}18`,
  border: `1px solid ${col}55`,
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  boxShadow: `0 0 24px ${col}30, 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 ${col}20`,
  ...extra,
})

const primaryBtn = (col, disabled = false) => ({
  background: disabled
    ? 'rgba(255,255,255,0.07)'
    : `linear-gradient(135deg, ${col} 0%, ${col}bb 100%)`,
  border: 'none',
  boxShadow: disabled
    ? 'none'
    : `0 0 40px ${col}45, 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
  color: '#fff',
  fontFamily: 'Outfit, system-ui, sans-serif',
  fontWeight: 700,
  fontSize: 16,
  borderRadius: 18,
  padding: '17px 24px',
  width: '100%',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  transition: 'all 0.2s ease',
})

const ghostBtn = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  color: 'rgba(255,255,255,0.55)',
  fontWeight: 600,
  fontSize: 14,
  borderRadius: 12,
  padding: '10px 20px',
  cursor: 'pointer',
}

function Spinner({ col = '#f43f5e' }) {
  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#08080f' }}>
      <div style={{ width:40, height:40, border:`3px solid rgba(255,255,255,0.06)`, borderTopColor:col, borderRadius:'50%', animation:'sp 0.8s linear infinite', boxShadow:`0 0 20px ${col}50` }} />
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Fondo con orbes animados ────────────────────────────────────
function Orbs({ col }) {
  return (
    <div style={{ position:'fixed', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none' }}>
      <div style={{
        position:'absolute', top:'-15%', left:'-15%',
        width:'70vw', height:'70vw', maxWidth:600, maxHeight:600,
        borderRadius:'50%',
        background:`radial-gradient(circle at 40% 40%, ${col}40 0%, ${col}18 40%, transparent 70%)`,
        animation:'orb1 14s ease-in-out infinite',
        filter:'blur(1px)',
      }} />
      <div style={{
        position:'absolute', bottom:'-20%', right:'-20%',
        width:'65vw', height:'65vw', maxWidth:560, maxHeight:560,
        borderRadius:'50%',
        background:`radial-gradient(circle at 60% 60%, ${col}28 0%, ${col}10 45%, transparent 70%)`,
        animation:'orb2 18s ease-in-out infinite',
        filter:'blur(2px)',
      }} />
      <div style={{
        position:'absolute', top:'35%', right:'5%',
        width:'40vw', height:'40vw', maxWidth:320, maxHeight:320,
        borderRadius:'50%',
        background:'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)',
        animation:'orb3 22s ease-in-out infinite reverse',
        filter:'blur(2px)',
      }} />
      {/* Línea de luz superior */}
      <div style={{
        position:'absolute', top:0, left:'10%', right:'10%', height:1,
        background:`linear-gradient(90deg, transparent, ${col}60, transparent)`,
        boxShadow:`0 0 20px 2px ${col}40`,
      }} />
    </div>
  )
}

export default function SalonPortal() {
  const { slug } = useParams()

  const [tenant,    setTenant]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)

  const [profs,         setProfs]         = useState([])
  const [servs,         setServs]         = useState([])
  const [slots,         setSlots]         = useState([])
  const [sinHorario,    setSinHorario]    = useState(false)
  const [cargandoSlots, setCargandoSlots] = useState(false)

  const [step,    setStep]   = useState(0)
  const [profId,  setProfId] = useState(null)
  const [servIds, setServIds]= useState([])
  const [fecha,   setFecha]  = useState(new Date().toISOString().slice(0, 10))
  const [slot,    setSlot]   = useState(null)

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

  const selectedServs = useMemo(() => servs.filter(s => servIds.includes(s.id)), [servs, servIds])
  const duracionTotal = useMemo(() => selectedServs.reduce((s, x) => s + (x.duracion_min || 0), 0), [selectedServs])
  const precioBase    = useMemo(() => selectedServs.reduce((s, x) => s + (Number(x.precio) || 0), 0), [selectedServs])

  const reglaActiva = useMemo(() => {
    if (!slot || !reglas.length) return null
    const dia    = new Date(slot.inicio).getDay()
    const minSlot = parseInt(slot.inicio.slice(11, 13)) * 60 + parseInt(slot.inicio.slice(14, 16))
    return reglas.find(r =>
      r.activo &&
      r.dias_semana.includes(dia) &&
      timeToMin(r.hora_inicio) <= minSlot &&
      timeToMin(r.hora_fin) > minSlot
    ) || null
  }, [slot, reglas])

  const precioTotal = useMemo(() => {
    if (!reglaActiva || !precioBase) return precioBase
    return Math.round(precioBase * reglaActiva.multiplicador)
  }, [precioBase, reglaActiva])

  function slotEsPremium(s) {
    if (!reglas.length) return false
    const dia     = new Date(s.inicio).getDay()
    const minSlot = parseInt(s.inicio.slice(11, 13)) * 60 + parseInt(s.inicio.slice(14, 16))
    return reglas.some(r =>
      r.activo &&
      r.dias_semana.includes(dia) &&
      timeToMin(r.hora_inicio) <= minSlot &&
      timeToMin(r.hora_fin) > minSlot
    )
  }

  const porCategoria = useMemo(() => {
    const map = {}
    servs.forEach(s => {
      const c = s.categoria || 'General'
      if (!map[c]) map[c] = []
      map[c].push(s)
    })
    return map
  }, [servs])

  function toggleServ(id) {
    setServIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
    setSlot(null)
  }

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tenants')
        .select('*').eq('slug', slug).eq('activo', true).maybeSingle()
      if (!t) { setNotFound(true); setLoading(false); return }
      setTenant(t)
      const [profsRes, reglasRes] = await Promise.all([
        supabase.from('profesionales')
          .select('id, nombre, especialidad, foto_url')
          .eq('tenant_id', t.id).eq('activo', true).order('nombre'),
        supabase.from('reglas_precio_dinamico')
          .select('*')
          .eq('tenant_id', t.id).eq('activo', true),
      ])
      setProfs(profsRes.data || [])
      setReglas(reglasRes.data || [])
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!profId || !tenant) return
    setServIds([]); setSlot(null)
    supabase.from('servicios')
      .select('id, nombre, precio, duracion_min, categoria')
      .eq('tenant_id', tenant.id).eq('activo', true).order('categoria').order('nombre')
      .then(({ data }) => setServs(data || []))
  }, [profId, tenant])

  useEffect(() => {
    if (!profId || duracionTotal === 0 || !fecha) { setSlots([]); return }
    setSinHorario(false); setSlots([]); setSlot(null)
    generarSlots(profId, fecha, duracionTotal)
  }, [profId, fecha, duracionTotal])

  async function generarSlots(pId, f, durMin) {
    setCargandoSlots(true)
    const dia = DIA_KEY[new Date(f + 'T12:00:00').getDay()]
    const { data: h } = await supabase.from('horarios')
      .select('hora_inicio, hora_fin')
      .eq('profesional_id', pId).eq('dia', dia).eq('activo', true).maybeSingle()
    if (!h) { setSinHorario(true); setCargandoSlots(false); return }
    const [hI, mI] = h.hora_inicio.slice(0,5).split(':').map(Number)
    const [hF, mF] = h.hora_fin.slice(0,5).split(':').map(Number)
    const iMin = hI*60+mI, fMin = hF*60+mF
    const { data: occ } = await supabase.from('citas')
      .select('fecha_inicio, fecha_fin')
      .eq('profesional_id', pId)
      .gte('fecha_inicio', `${f}T00:00:00`).lte('fecha_inicio', `${f}T23:59:59`)
      .neq('estado', 'cancelada')
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
      const { data: ex } = await supabase.from('clientes_agenda')
        .select('id').eq('tenant_id', tenant.id).eq('telefono', telefono.trim()).maybeSingle()
      if (ex) cliId = ex.id
    }
    if (!cliId) {
      const { data: nc, error: e } = await supabase.from('clientes_agenda')
        .insert({ tenant_id: tenant.id, nombre: nombre.trim(), telefono: telefono.trim()||null })
        .select('id').single()
      if (e) { setError('Error al registrar. Intenta de nuevo.'); setSaving(false); return }
      cliId = nc.id
    }
    const { data: cita, error: eCita } = await supabase.from('citas').insert({
      tenant_id: tenant.id, profesional_id: profId,
      servicio_id: servIds[0], servicios_ids: servIds,
      cliente_id: cliId, fecha_inicio: slot.inicio, fecha_fin: slot.fin,
      estado: 'confirmada', precio_cobrado: precioTotal||null,
    }).select('id').single()
    if (eCita) { setError('Error al agendar. Intenta de nuevo.'); setSaving(false); return }
    supabase.functions.invoke('notificacion-cita', { body: { cita_id: cita.id } }).catch(()=>{})
    setConfirmada({ prof: profs.find(p=>p.id===profId), servs: selectedServs, duracionTotal, precioTotal, slot, fecha, nombre: nombre.trim() })
    setStep(4); setSaving(false)
  }

  async function unirseEspera() {
    if (!wlNombre.trim()) return
    setWlSaving(true)
    let cliId = null
    if (wlTel.trim()) {
      const { data: ex } = await supabase.from('clientes_agenda')
        .select('id').eq('tenant_id', tenant.id).eq('telefono', wlTel.trim()).maybeSingle()
      if (ex) cliId = ex.id
    }
    if (!cliId) {
      const { data: nc } = await supabase.from('clientes_agenda')
        .insert({ tenant_id: tenant.id, nombre: wlNombre.trim(), telefono: wlTel.trim()||null })
        .select('id').single()
      if (nc) cliId = nc.id
    }
    await supabase.from('lista_espera').insert({
      tenant_id: tenant.id, profesional_id: profId,
      servicio_id: servIds[0]||null, servicios_ids: servIds,
      cliente_id: cliId, nombre_temporal: cliId?null:wlNombre.trim(),
      telefono_temporal: cliId?null:wlTel.trim()||null, fecha_preferida: fecha||null,
    })
    setWlSaving(false); setWlOk(true)
  }

  function resetAll() {
    setStep(0); setProfId(null); setServIds([]); setSlot(null)
    setFecha(new Date().toISOString().slice(0,10))
    setNombre(''); setTelefono(''); setError(null); setConfirmada(null)
    setWlMode(false); setWlOk(false); setWlNombre(''); setWlTel('')
  }

  const col  = tenant?.color_primario || '#f43f5e'
  const prof = profs.find(p => p.id === profId)

  const inputStyle = {
    width:'100%', padding:'15px 18px', borderRadius:16,
    background:'rgba(255,255,255,0.06)',
    border:'1px solid rgba(255,255,255,0.1)',
    backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
    color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box',
    fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",
    boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)',
    transition:'border-color 0.2s, box-shadow 0.2s',
  }

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

  return (
    <div style={{ minHeight:'100dvh', background:'#08080f', color:'#fff', fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", position:'relative' }}>
      <Orbs col={col} />

      {/* ── Header flotante ── */}
      <div style={{
        ...glass({ borderRadius:0, borderLeft:'none', borderRight:'none', borderTop:'none' }),
        padding:'18px 20px 16px', position:'sticky', top:0, zIndex:20,
        boxShadow:`0 1px 0 ${col}25, 0 8px 32px rgba(0,0,0,0.4)`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, maxWidth:540, margin:'0 auto' }}>
          {/* Logo */}
          <div style={{
            width:46, height:46, borderRadius:14, overflow:'hidden', flexShrink:0,
            background:`linear-gradient(135deg, ${col}, ${col}88)`,
            boxShadow:`0 0 20px ${col}50, 0 4px 12px rgba(0,0,0,0.4)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Outfit', fontWeight:900, fontSize:20, color:'#fff',
          }}>
            {tenant.logo_url
              ? <img src={tenant.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : tenant.nombre[0]
            }
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:17, color:'#fff', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              {tenant.nombre}
            </div>
            {(tenant.descripcion || tenant.ciudad) && (
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {tenant.descripcion || `📍 ${tenant.ciudad}`}
              </div>
            )}
          </div>
          {step > 0 && step < 4 && (
            <div style={{
              fontSize:12, fontWeight:800, color:col, flexShrink:0,
              background:`${col}18`, padding:'4px 10px', borderRadius:8,
              border:`1px solid ${col}35`,
            }}>{step}/3</div>
          )}
        </div>
      </div>

      {/* ── Banner promo ── */}
      {tenant.config_vertical?.promo && step < 4 && (
        <div style={{ background:`linear-gradient(90deg,${col}20,${col}10,${col}20)`, borderBottom:`1px solid ${col}20`, padding:'10px 20px', position:'relative', zIndex:10 }}>
          <p style={{ maxWidth:540, margin:'0 auto', fontSize:13, color:`${col}ee`, fontWeight:700, textAlign:'center', letterSpacing:0.3 }}>
            ✨ {tenant.config_vertical.promo}
          </p>
        </div>
      )}

      {/* ── Barra de progreso ── */}
      {step > 0 && step < 4 && (
        <div style={{ display:'flex', gap:5, padding:'0 20px', position:'relative', zIndex:10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              flex:1, height:3, borderRadius:2,
              background: i <= step
                ? `linear-gradient(90deg, ${col}, ${col}99)`
                : 'rgba(255,255,255,0.07)',
              boxShadow: i <= step ? `0 0 8px ${col}70` : 'none',
              transition:'all 0.35s ease',
            }} />
          ))}
        </div>
      )}

      {/* ── Contenido ── */}
      <div style={{ maxWidth:540, margin:'0 auto', padding:'28px 20px 60px', position:'relative', zIndex:10 }}>

        {/* ════ STEP 4: Confirmación ════ */}
        {step === 4 && confirmada && (
          <div style={{ textAlign:'center' }}>
            {/* Círculo de éxito con glow */}
            <div style={{
              width:90, height:90, borderRadius:28, margin:'0 auto 28px',
              background:`linear-gradient(135deg, ${col}30, ${col}10)`,
              border:`1.5px solid ${col}50`,
              boxShadow:`0 0 50px ${col}40, 0 0 80px ${col}20, inset 0 1px 0 ${col}30`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:42,
              backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
            }}>✅</div>

            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:28, marginBottom:8, letterSpacing:-0.5 }}>
              ¡Cita confirmada!
            </h2>
            <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:36, fontSize:15 }}>
              Te esperamos, {confirmada.nombre.split(' ')[0]} 🙌
            </p>

            {/* Card resumen */}
            <div style={{ ...glass({ borderRadius:24 }), padding:'22px', textAlign:'left', marginBottom:28 }}>
              {[
                { emoji:'👤', txt: confirmada.prof?.nombre },
                ...confirmada.servs.map(s => ({ emoji:'✂️', txt: s.nombre })),
                { emoji:'⏱', txt: `${confirmada.duracionTotal} min en total` },
                { emoji:'📅', txt: new Date(confirmada.fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'}) },
                { emoji:'🕐', txt: fmtHora(confirmada.slot.inicio) },
                ...(confirmada.precioTotal > 0 ? [{ emoji:'💰', txt: fmtCOP(confirmada.precioTotal) }] : []),
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display:'flex', gap:14, padding:'12px 0',
                  borderBottom: i < arr.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  alignItems:'center',
                }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{row.emoji}</span>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,0.8)', lineHeight:1.5 }}>{row.txt}</span>
                </div>
              ))}
            </div>

            {tenant.whatsapp && (
              <a href={`https://wa.me/57${tenant.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${tenant.nombre}, acabo de confirmar una cita para el ${new Date(confirmada.fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})} a las ${confirmada.slot.label}. Servicios: ${confirmada.servs.map(s=>s.nombre).join(', ')}. Mi nombre es ${confirmada.nombre}.`)}`}
                target="_blank" rel="noopener noreferrer" style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  width:'100%', padding:'17px', borderRadius:18, marginBottom:12,
                  background:'rgba(37,211,102,0.1)',
                  border:'1px solid rgba(37,211,102,0.25)',
                  backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
                  boxShadow:'0 0 24px rgba(37,211,102,0.15)',
                  color:'#25d166', fontFamily:'Outfit', fontWeight:700, fontSize:15,
                  textDecoration:'none', boxSizing:'border-box',
                }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="#25d166"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.126 1.527 5.857L0 24l6.305-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.687-.512-5.217-1.406l-.374-.222-3.744.982.999-3.648-.244-.375A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
                Confirmar por WhatsApp
              </a>
            )}
            <button onClick={resetAll} style={{
              ...glass({ borderRadius:18 }),
              width:'100%', padding:'16px', color:col,
              fontFamily:'Outfit', fontWeight:700, fontSize:15, cursor:'pointer',
              border:`1px solid ${col}30`,
            }}>
              Agendar otra cita
            </button>
          </div>
        )}

        {/* ════ STEP 0: Profesional ════ */}
        {step === 0 && (
          <>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:6, letterSpacing:-0.5 }}>
              ¿Con quién quieres<br />tu cita?
            </h2>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginBottom:32 }}>
              Elige tu profesional favorito
            </p>

            {profs.length === 0 ? (
              <div style={{ ...glass({ borderRadius:24 }), padding:'48px 24px', textAlign:'center' }}>
                <p style={{ fontSize:36, marginBottom:12 }}>🚧</p>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:15 }}>Sin profesionales disponibles</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {profs.map(p => (
                  <button key={p.id} onClick={() => { setProfId(p.id); setStep(1) }} style={{
                    ...glass({ borderRadius:22 }),
                    display:'flex', alignItems:'center', gap:16,
                    padding:'18px 20px', cursor:'pointer', textAlign:'left', width:'100%',
                    transition:'all 0.2s ease',
                  }}>
                    <div style={{
                      width:54, height:54, borderRadius:17, flexShrink:0, overflow:'hidden',
                      background:`${col}28`,
                      boxShadow:`0 0 20px ${col}30, inset 0 1px 0 rgba(255,255,255,0.1)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, fontSize:22, color:col,
                    }}>
                      {p.foto_url
                        ? <img src={p.foto_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : p.nombre[0]
                      }
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:16, color:'#fff' }}>{p.nombre}</div>
                      {p.especialidad && <div style={{ fontSize:13, color:'rgba(255,255,255,0.38)', marginTop:3 }}>{p.especialidad}</div>}
                    </div>
                    <div style={{
                      width:32, height:32, borderRadius:10, flexShrink:0,
                      background:`${col}15`, border:`1px solid ${col}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:col, fontSize:18, fontWeight:300,
                    }}>›</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════ STEP 1: Servicios ════ */}
        {step === 1 && (
          <>
            <button onClick={() => { setStep(0); setServIds([]) }} style={{ ...ghostBtn, marginBottom:24, display:'flex', alignItems:'center', gap:6, border:'none', padding:'6px 0', background:'none', boxShadow:'none' }}>
              <span style={{ fontSize:18 }}>‹</span> Volver
            </button>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:4, letterSpacing:-0.5 }}>
              ¿Qué servicios quieres?
            </h2>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginBottom:24 }}>
              Con {prof?.nombre?.split(' ')[0]} · Puedes elegir varios
            </p>

            {/* Barra de selección flotante */}
            {servIds.length > 0 && (
              <div style={{
                ...glassSelected(col, { borderRadius:16 }),
                padding:'13px 18px', marginBottom:22,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                animation:'fadeIn 0.2s ease',
              }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:col }}>
                    {servIds.length} servicio{servIds.length > 1 ? 's' : ''} · {duracionTotal} min
                  </div>
                </div>
                {precioTotal > 0 && (
                  <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:'#fff', textShadow:`0 0 20px ${col}80` }}>
                    {fmtCOP(precioTotal)}
                  </div>
                )}
              </div>
            )}

            {servs.length === 0 ? (
              <div style={{ ...glass({ borderRadius:24 }), padding:'48px 24px', textAlign:'center' }}>
                <p style={{ fontSize:36, marginBottom:12 }}>✂️</p>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:15 }}>Sin servicios disponibles</p>
              </div>
            ) : (
              <>
                {Object.entries(porCategoria).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom:22 }}>
                    <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.28)', letterSpacing:1.2, textTransform:'uppercase', marginBottom:11 }}>
                      {cat}
                    </p>
                    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                      {items.map(s => {
                        const sel = servIds.includes(s.id)
                        return (
                          <button key={s.id} onClick={() => toggleServ(s.id)} style={{
                            ...(sel ? glassSelected(col, { borderRadius:18 }) : glass({ borderRadius:18 })),
                            display:'flex', alignItems:'center', justifyContent:'space-between', gap:14,
                            padding:'16px 18px', cursor:'pointer', textAlign:'left', width:'100%',
                            transition:'all 0.18s ease',
                          }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:15, color: sel ? '#fff' : 'rgba(255,255,255,0.82)' }}>{s.nombre}</div>
                              <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginTop:3 }}>
                                {s.duracion_min}min{s.categoria ? ` · ${s.categoria}` : ''}
                              </div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                              {s.precio > 0 && (
                                <span style={{
                                  fontFamily:'Outfit', fontWeight:800, fontSize:15,
                                  color: sel ? '#fff' : 'rgba(255,255,255,0.55)',
                                  textShadow: sel ? `0 0 14px ${col}80` : 'none',
                                }}>
                                  {fmtCOP(s.precio)}
                                </span>
                              )}
                              {/* Checkbox iOS-style */}
                              <div style={{
                                width:26, height:26, borderRadius:8, flexShrink:0,
                                background: sel ? `linear-gradient(135deg, ${col}, ${col}cc)` : 'rgba(255,255,255,0.06)',
                                border: `1.5px solid ${sel ? col : 'rgba(255,255,255,0.15)'}`,
                                boxShadow: sel ? `0 0 16px ${col}50` : 'none',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                transition:'all 0.18s ease',
                              }}>
                                {sel && (
                                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <button onClick={() => setStep(2)} disabled={servIds.length === 0} style={primaryBtn(col, servIds.length === 0)}>
                  {servIds.length === 0
                    ? 'Elige al menos un servicio'
                    : `Continuar · ${servIds.length} servicio${servIds.length>1?'s':''} · ${duracionTotal}min`
                  }
                </button>
              </>
            )}
          </>
        )}

        {/* ════ STEP 2: Fecha y hora ════ */}
        {step === 2 && (
          <>
            <button onClick={() => setStep(1)} style={{ ...ghostBtn, marginBottom:24, display:'flex', alignItems:'center', gap:6, border:'none', padding:'6px 0', background:'none', boxShadow:'none' }}>
              <span style={{ fontSize:18 }}>‹</span> Volver
            </button>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:4, letterSpacing:-0.5 }}>¿Cuándo?</h2>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginBottom:24 }}>
              {selectedServs.map(s=>s.nombre).join(' + ')} · {duracionTotal}min
            </p>

            <input type="date" value={fecha} min={new Date().toISOString().slice(0,10)}
              onChange={e => { setFecha(e.target.value); setSlot(null) }}
              style={{ ...inputStyle, marginBottom:24 }}
            />

            {cargandoSlots ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 0', gap:16 }}>
                <div style={{ width:32, height:32, border:`3px solid rgba(255,255,255,0.06)`, borderTopColor:col, borderRadius:'50%', animation:'sp 0.8s linear infinite', boxShadow:`0 0 20px ${col}50` }} />
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>Buscando disponibilidad…</p>
              </div>
            ) : sinHorario ? (
              <div style={{ ...glass({ borderRadius:24 }), padding:'40px 24px', textAlign:'center' }}>
                <p style={{ fontSize:40, marginBottom:12 }}>😴</p>
                <p style={{ fontWeight:700, fontSize:17 }}>{prof?.nombre?.split(' ')[0]} no trabaja este día</p>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginTop:8 }}>Elige otra fecha</p>
              </div>
            ) : slots.length === 0 && fecha ? (
              wlOk ? (
                <div style={{ ...glass({ borderRadius:24 }), padding:'48px 24px', textAlign:'center' }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>🔔</div>
                  <p style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, marginBottom:8 }}>¡Te anotamos!</p>
                  <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', marginBottom:28, lineHeight:1.6 }}>
                    Cuando haya un espacio libre te enviamos un WhatsApp.
                  </p>
                  <button onClick={() => { setWlMode(false); setWlOk(false); setWlNombre(''); setWlTel('') }} style={ghostBtn}>
                    Buscar otra fecha
                  </button>
                </div>
              ) : wlMode ? (
                <div>
                  <button onClick={() => setWlMode(false)} style={{ ...ghostBtn, marginBottom:24, display:'flex', alignItems:'center', gap:6, border:'none', padding:'6px 0', background:'none', boxShadow:'none' }}>
                    <span style={{ fontSize:18 }}>‹</span> Volver
                  </button>
                  <div style={{ ...glass({ borderRadius:24 }), padding:'28px 24px' }}>
                    <div style={{ fontSize:44, marginBottom:16, textAlign:'center' }}>🔔</div>
                    <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:22, marginBottom:8, textAlign:'center' }}>Lista de espera</h3>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:28, textAlign:'center', lineHeight:1.6 }}>
                      Te avisamos cuando {prof?.nombre?.split(' ')[0]} tenga un espacio libre.
                    </p>
                    <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:24 }}>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:700, letterSpacing:1, display:'block', marginBottom:8 }}>TU NOMBRE *</label>
                        <input value={wlNombre} onChange={e => setWlNombre(e.target.value)} placeholder="Nombre completo" style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:700, letterSpacing:1, display:'block', marginBottom:8 }}>WHATSAPP</label>
                        <input value={wlTel} onChange={e => setWlTel(e.target.value)} placeholder="Ej: 3001234567" type="tel" style={inputStyle} />
                      </div>
                    </div>
                    <button onClick={unirseEspera} disabled={!wlNombre.trim()||wlSaving} style={primaryBtn(col, !wlNombre.trim()||wlSaving)}>
                      {wlSaving ? 'Guardando…' : '🔔 Avisarme cuando haya espacio'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ ...glass({ borderRadius:24 }), padding:'40px 24px', textAlign:'center' }}>
                  <p style={{ fontSize:44, marginBottom:14 }}>😕</p>
                  <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:18, marginBottom:8 }}>Sin disponibilidad</p>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.38)', marginBottom:28, lineHeight:1.6 }}>
                    Todos los horarios están ocupados.<br />Elige otra fecha o te avisamos.
                  </p>
                  <button onClick={() => setWlMode(true)} style={primaryBtn(col)}>
                    🔔 Avisarme cuando haya espacio
                  </button>
                </div>
              )
            ) : slots.length > 0 ? (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.28)', fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', margin:0 }}>
                    Horarios disponibles
                  </p>
                  {reglas.length > 0 && (
                    <p style={{ fontSize:11, color:'rgba(255,255,255,0.28)', margin:0 }}>
                      ⚡ precio premium
                    </p>
                  )}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:28 }}>
                  {slots.map(s => {
                    const sel     = slot?.inicio === s.inicio
                    const premium = slotEsPremium(s)
                    return (
                      <button key={s.inicio} onClick={() => setSlot(s)} style={{
                        ...(sel ? glassSelected(col, { borderRadius:14 }) : glass({ borderRadius:14 })),
                        padding:'12px 4px 10px', cursor:'pointer',
                        color: sel ? '#fff' : premium ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.55)',
                        fontFamily:'Outfit', fontWeight:700, fontSize:14,
                        transition:'all 0.15s ease',
                        textShadow: sel ? `0 0 12px ${col}` : 'none',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        border: premium && !sel ? `1px solid ${col}35` : undefined,
                      }}>
                        {s.label}
                        {premium && <span style={{ fontSize:9, opacity:0.7 }}>⚡</span>}
                      </button>
                    )
                  })}
                </div>
                {slot && (
                  <>
                    {reglaActiva && precioBase > 0 && (
                      <div style={{
                        ...glass({ borderRadius:14 }),
                        padding:'12px 16px', marginBottom:14,
                        display:'flex', alignItems:'center', gap:10,
                        border:`1px solid ${col}30`,
                      }}>
                        <span style={{ fontSize:16 }}>⚡</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.8)' }}>
                            {reglaActiva.nombre}
                          </div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>
                            +{Math.round((reglaActiva.multiplicador - 1) * 100)}% · precio ajustado por alta demanda
                          </div>
                        </div>
                        <div style={{ fontFamily:'Outfit', fontWeight:900, fontSize:16, color:col }}>
                          {fmtCOP(precioTotal)}
                        </div>
                      </div>
                    )}
                    <button onClick={() => setStep(3)} style={primaryBtn(col)}>
                      Continuar con las {slot.label}
                      {reglaActiva && precioBase > 0 ? ` · ${fmtCOP(precioTotal)}` : ''}
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
            <button onClick={() => setStep(2)} style={{ ...ghostBtn, marginBottom:24, display:'flex', alignItems:'center', gap:6, border:'none', padding:'6px 0', background:'none', boxShadow:'none' }}>
              <span style={{ fontSize:18 }}>‹</span> Volver
            </button>
            <h2 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:26, marginBottom:6, letterSpacing:-0.5 }}>Tus datos</h2>
            <p style={{ color:'rgba(255,255,255,0.35)', fontSize:14, marginBottom:28 }}>Para confirmar tu cita</p>

            {/* Resumen card */}
            <div style={{
              ...glassSelected(col, { borderRadius:22 }),
              padding:'20px 20px', marginBottom:28,
            }}>
              <div style={{ fontSize:11, color:col, fontWeight:800, letterSpacing:1.2, marginBottom:14, textTransform:'uppercase' }}>
                TU RESERVA
              </div>
              {[
                { emoji:'👤', txt: prof?.nombre },
                ...selectedServs.map(s => ({ emoji:'✂️', txt: s.nombre })),
                { emoji:'⏱', txt: `${duracionTotal} min en total` },
                { emoji:'📅', txt: new Date(fecha+'T12:00:00').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})+' a las '+slot?.label },
                ...(precioTotal > 0 ? [{ emoji:'💰', txt: fmtCOP(precioTotal) }] : []),
              ].map((r, i, arr) => (
                <div key={i} style={{ display:'flex', gap:12, padding:'9px 0', borderBottom: i<arr.length-1 ? `1px solid ${col}18` : 'none', alignItems:'center' }}>
                  <span>{r.emoji}</span>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,0.78)', lineHeight:1.4 }}>{r.txt}</span>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:28 }}>
              {[
                { label:'TU NOMBRE *', value:nombre, setter:setNombre, placeholder:'Nombre completo', type:'text' },
                { label:'TELÉFONO / WHATSAPP', value:telefono, setter:setTelefono, placeholder:'Ej: 3001234567', type:'tel' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:700, letterSpacing:1, display:'block', marginBottom:9 }}>{f.label}</label>
                  <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} type={f.type} style={inputStyle} />
                </div>
              ))}
            </div>

            {error && (
              <div style={{ ...glass({ borderRadius:12 }), padding:'12px 16px', marginBottom:20, border:'1px solid rgba(248,113,113,0.3)', background:'rgba(239,68,68,0.08)' }}>
                <p style={{ color:'#f87171', fontSize:13, margin:0, textAlign:'center' }}>{error}</p>
              </div>
            )}

            <button onClick={confirmar} disabled={saving || !nombre.trim()} style={primaryBtn(col, saving || !nombre.trim())}>
              {saving ? 'Confirmando…' : '¡Confirmar cita!'}
            </button>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.2)', textAlign:'center', marginTop:18, lineHeight:1.6 }}>
              Al confirmar aceptas que el salón guarde tus datos de contacto
            </p>
          </>
        )}
      </div>

      {/* ── Footer — siempre visible ── */}
      {(tenant.direccion || tenant.ciudad || tenant.whatsapp || tenant.telefono) && (
        <div style={{
          ...glass({ borderRadius:0, borderLeft:'none', borderRight:'none', borderBottom:'none' }),
          padding:'24px 20px 32px', textAlign:'center', position:'relative', zIndex:10,
        }}>
          <div style={{ maxWidth:540, margin:'0 auto', display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>

            {/* Separador con glow */}
            <div style={{ width:40, height:1, background:`linear-gradient(90deg, transparent, ${col}50, transparent)`, marginBottom:4 }} />

            {/* Horario opcional */}
            {tenant.config_vertical?.horario_texto && (
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.3)', letterSpacing:0.3 }}>
                🕐 {tenant.config_vertical.horario_texto}
              </p>
            )}

            {/* Dirección */}
            {(tenant.direccion || tenant.ciudad) && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:15 }}>📍</span>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.45)', lineHeight:1.5, textAlign:'left' }}>
                  {[tenant.direccion, tenant.ciudad].filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            {/* Contacto — WhatsApp o teléfono */}
            {tenant.whatsapp ? (
              <a href={`https://wa.me/57${tenant.whatsapp.replace(/\D/g,'')}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display:'inline-flex', alignItems:'center', gap:9,
                  padding:'12px 22px', borderRadius:14,
                  background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.22)',
                  backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
                  boxShadow:'0 0 20px rgba(37,211,102,0.12)',
                  color:'#25d166', textDecoration:'none', fontWeight:700, fontSize:14,
                }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="#25d166"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.556 4.126 1.527 5.857L0 24l6.305-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.687-.512-5.217-1.406l-.374-.222-3.744.982.999-3.648-.244-.375A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
                {tenant.whatsapp}
              </a>
            ) : tenant.telefono ? (
              <a href={`tel:${tenant.telefono.replace(/\D/g,'')}`}
                style={{
                  display:'inline-flex', alignItems:'center', gap:9,
                  padding:'12px 22px', borderRadius:14,
                  background:`${col}0d`, border:`1px solid ${col}28`,
                  backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
                  color:col, textDecoration:'none', fontWeight:700, fontSize:14,
                }}>
                📞 {tenant.telefono}
              </a>
            ) : null}

          </div>
        </div>
      )}

      <style>{`
        @keyframes sp   { to { transform: rotate(360deg) } }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(4%,-3%) scale(1.06)} 75%{transform:translate(-3%,2%) scale(0.94)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 35%{transform:translate(-3%,2%) scale(1.08)} 70%{transform:translate(3%,-2%) scale(0.93)} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-2%,3%) scale(1.04)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(0.55); cursor:pointer; }
        input::placeholder { color:rgba(255,255,255,0.22); }
        input:focus { border-color:rgba(255,255,255,0.22)!important; box-shadow:0 0 0 3px rgba(255,255,255,0.04)!important; }
        button { transition:all 0.18s ease; }
        button:active { transform:scale(0.97); }
        a:hover { opacity:0.85; }
      `}</style>
    </div>
  )
}
