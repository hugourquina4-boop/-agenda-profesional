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

const ESTADO_CFG = {
  pendiente:  { label:'Pendiente',  bg:'rgba(245,158,11,0.15)',  color:'#fbbf24' },
  confirmada: { label:'Confirmada', bg:'rgba(59,130,246,0.15)',  color:'#60a5fa' },
  completada: { label:'Completada', bg:'rgba(34,197,94,0.15)',   color:'#4ade80' },
  cancelada:  { label:'Cancelada',  bg:'rgba(239,68,68,0.15)',   color:'#f87171' },
  no_asistio: { label:'No asistió', bg:'rgba(113,113,122,0.2)', color:'#a1a1aa' },
}
const PROF_COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
function fmtCOP(n) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${n}`
}
function fmtHora(iso) {
  if (!iso) return ''
  const [h, m] = iso.substring(11,16).split(':')
  const hh = parseInt(h)
  return `${hh>12?hh-12:hh||12}:${m} ${hh<12?'am':'pm'}`
}
function hoy() { return new Date().toISOString().slice(0,10) }

/* ── Datos demo ─────────────────────────────────────────────────── */
const D = hoy()
const DEMO_CITAS = [
  { id:'d1', fecha_inicio:`${D}T09:00:00`, fecha_fin:`${D}T10:00:00`, estado:'completada',
    clientes_agenda:{nombre:'Andrea Martínez',  telefono:'3001234567'},
    servicios:{nombre:'Mechas + Tinte',      precio:180000, duracion_min:120},
    profesionales:{id:'p1', nombre:'Valentina Cruz'} },
  { id:'d2', fecha_inicio:`${D}T10:30:00`, fecha_fin:`${D}T11:00:00`, estado:'completada',
    clientes_agenda:{nombre:'Sofía Ramírez',    telefono:'3109876543'},
    servicios:{nombre:'Corte y secado',      precio:55000,  duracion_min:45},
    profesionales:{id:'p2', nombre:'Carlos Herrera'} },
  { id:'d3', fecha_inicio:`${D}T11:30:00`, fecha_fin:`${D}T13:00:00`, estado:'confirmada',
    clientes_agenda:{nombre:'María González',   telefono:'3156789012'},
    servicios:{nombre:'Tratamiento keratina', precio:220000, duracion_min:90},
    profesionales:{id:'p1', nombre:'Valentina Cruz'} },
  { id:'d4', fecha_inicio:`${D}T14:00:00`, fecha_fin:`${D}T14:45:00`, estado:'confirmada',
    clientes_agenda:{nombre:'Laura Jiménez',    telefono:'3187654321'},
    servicios:{nombre:'Manicure gel',        precio:60000,  duracion_min:45},
    profesionales:{id:'p3', nombre:'Isabella Torres'} },
  { id:'d5', fecha_inicio:`${D}T16:00:00`, fecha_fin:`${D}T17:00:00`, estado:'pendiente',
    clientes_agenda:{nombre:'Camila Vargas',    telefono:'3214567890'},
    servicios:{nombre:'Peinado para evento', precio:90000,  duracion_min:60},
    profesionales:{id:'p2', nombre:'Carlos Herrera'} },
]
const DEMO_EQUIPO = [
  { id:'p1', nombre:'Valentina Cruz',   especialidad:'Colorista & Estilista',  activo:true, foto_url:null },
  { id:'p2', nombre:'Carlos Herrera',   especialidad:'Barbero & Estilista',    activo:true, foto_url:null },
  { id:'p3', nombre:'Isabella Torres',  especialidad:'Manicurista & Nail Art', activo:true, foto_url:null },
]

const DEMO_ANALYTICS = {
  topServicios: [
    { nombre:'Mechas + Tinte', count:8 },
    { nombre:'Corte y secado', count:6 },
    { nombre:'Manicure gel',   count:5 },
    { nombre:'Keratina',       count:3 },
  ],
  diasSemana: [2, 8, 6, 7, 9, 11, 5], // Dom→Sáb
  topProf: [
    { nombre:'Valentina Cruz',  count:16 },
    { nombre:'Carlos Herrera',  count:11 },
    { nombre:'Isabella Torres', count:8  },
  ],
}

function LinkReservas({ slug, col, showToast }) {
  const url = `${window.location.origin}/reservar/${slug}`

  function copiar() {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copiado ✓'))
      .catch(() => showToast('No se pudo copiar', '#ef4444'))
  }

  return (
    <div style={{
      margin:'12px 16px 0', padding:'14px 16px', borderRadius:16,
      background:`linear-gradient(135deg, ${col}14, ${col}06)`,
      boxShadow:`0 4px 24px ${col}10`,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{
        width:38, height:38, borderRadius:11, background:`${col}20`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        <Ico d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" size={17} style={{ color: col }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, marginBottom:2 }}>
          TU LINK DE RESERVAS
        </p>
        <p style={{ fontSize:12, color:'var(--text-2)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          {url}
        </p>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button onClick={copiar} style={{
          padding:'7px 12px', borderRadius:9, border:`1px solid ${col}40`,
          background:`${col}15`, color:col, fontSize:12, fontWeight:700, cursor:'pointer',
          whiteSpace:'nowrap',
        }}>
          Copiar
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          padding:'7px 12px', borderRadius:9, border:'none',
          background:'var(--card)', color:'var(--text-2)', fontSize:12, fontWeight:700,
          cursor:'pointer', whiteSpace:'nowrap', textDecoration:'none',
          display:'flex', alignItems:'center', boxShadow:'0 1px 6px rgba(0,0,0,0.1)',
        }}>
          Ver
        </a>
      </div>
    </div>
  )
}

export default function SalonDashboard({ onNavigate }) {
  const { tenant, suscripcion, esSuperadmin } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'
  const isDemo = !tenant

  const [citas,       setCitas]       = useState(isDemo ? DEMO_CITAS  : [])
  const [equipo,      setEquipo]      = useState(isDemo ? DEMO_EQUIPO : [])
  const [ingresosHoy, setIngresosHoy] = useState(isDemo ? 235000 : 0)
  const [loading,     setLoading]     = useState(!isDemo)
  const [stockAlertas,   setStockAlertas]   = useState([])
  const [serviciosCount, setServiciosCount] = useState(null)
  const [gastosMes,      setGastosMes]      = useState(isDemo ? 890000 : 0)
  const [ingresosMes,    setIngresosMes]    = useState(isDemo ? 7252000 : 0)
  const [manana,         setManana]         = useState(isDemo ? { count:3, citas:[
    { nombre:'Laura González', servicio:'Mechas', hora:'09:00' },
    { nombre:'Sofía Pérez',    servicio:'Corte',  hora:'10:30' },
    { nombre:'Andrea Ruiz',    servicio:'Tinte',  hora:'14:00' },
  ]} : null)
  const [cumpleaneros,   setCumpleaneros]   = useState(isDemo ? [
    { nombre:'Valentina Cruz', telefono:'3001234567' }
  ] : [])
  const [toast,          setToast]          = useState(null)
  const [analyticsData,  setAnalyticsData]  = useState(isDemo ? DEMO_ANALYTICS : null)
  const [tendencia14,    setTendencia14]    = useState(null)
  const [listaEsperaHoy, setListaEsperaHoy] = useState(isDemo ? 2 : 0)
  const [topClientes,    setTopClientes]    = useState(isDemo ? [
    { nombre:'Laura González', total:320000 },
    { nombre:'Sofía Pérez',    total:175000 },
    { nombre:'Andrea Ruiz',    total:95000  },
  ] : [])
  const [sinCobrar,      setSinCobrar]      = useState([])
  const [proximos7,      setProximos7]      = useState([])

  const [cobrando, setCobrando] = useState(null)  // { citaId, metodo }

  const showToast = (msg, color='#22c55e') => {
    setToast({msg,color})
    setTimeout(() => setToast(null), 2800)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    try {
      const fecha = hoy()
      const mesInicio = fecha.slice(0, 7) + '-01'
      const mesFin    = new Date(new Date(mesInicio).getFullYear(), new Date(mesInicio).getMonth() + 1, 0)
        .toISOString().slice(0, 10)

      const mananaFecha = (() => {
        const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10)
      })()

      const hace14iso = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return d.toISOString().slice(0,10) })()
      const [citasRes, equipoRes, stockRes, servRes, gastosRes, ingresosMesRes, citasMananaRes, cumplRes, analyticsMesRes, pagos14Res, esperaRes, pagosCltRes, pagosHoyRes] = await Promise.all([
        supabase.from('citas')
          .select('id,fecha_inicio,fecha_fin,estado,clientes_agenda(nombre,telefono),servicios(nombre,precio,duracion_min),profesionales(id,nombre,foto_url)')
          .eq('tenant_id', tenant.id)
          .gte('fecha_inicio', `${fecha}T00:00:00`).lte('fecha_inicio', `${fecha}T23:59:59`).order('fecha_inicio'),
        supabase.from('profesionales')
          .select('id,nombre,foto_url,especialidad,activo')
          .eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
        supabase.from('productos_salon')
          .select('id,nombre,stock,stock_minimo')
          .eq('tenant_id', tenant.id).eq('activo', true).gt('stock_minimo', 0),
        supabase.from('servicios')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id).eq('activo', true),
        supabase.from('gastos')
          .select('monto')
          .eq('tenant_id', tenant.id)
          .gte('fecha', mesInicio).lte('fecha', mesFin),
        supabase.from('pagos')
          .select('monto')
          .eq('tenant_id', tenant.id)
          .gte('created_at', `${mesInicio}T00:00:00`).lte('created_at', `${mesFin}T23:59:59`),
        supabase.from('citas')
          .select('id,fecha_inicio,clientes_agenda(nombre),servicios(nombre)')
          .eq('tenant_id', tenant.id)
          .gte('fecha_inicio', `${mananaFecha}T00:00:00`).lte('fecha_inicio', `${mananaFecha}T23:59:59`)
          .neq('estado', 'cancelada').order('fecha_inicio').limit(5),
        supabase.from('clientes_agenda')
          .select('id,nombre,telefono,fecha_nacimiento')
          .eq('tenant_id', tenant.id).eq('activo', true)
          .or(Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return `fecha_nacimiento.like.%-${d.toISOString().slice(5,10)}`}).join(',')),
        supabase.from('citas')
          .select('fecha_inicio,servicios(id,nombre),profesionales(id,nombre)')
          .eq('tenant_id', tenant.id)
          .in('estado', ['completada','confirmada','pendiente'])
          .gte('fecha_inicio', `${mesInicio}T00:00:00`)
          .lte('fecha_inicio', `${mesFin}T23:59:59`),
        supabase.from('pagos')
          .select('monto, created_at')
          .eq('tenant_id', tenant.id)
          .eq('estado', 'pagado')
          .gte('created_at', `${hace14iso}T00:00:00`)
          .lte('created_at', `${fecha}T23:59:59`),
        supabase.from('lista_espera')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('activo', true)
          .eq('fecha_preferida', fecha),
        supabase.from('pagos')
          .select('monto, citas(clientes_agenda(id,nombre))')
          .eq('tenant_id', tenant.id)
          .eq('estado', 'pagado')
          .gte('created_at', `${mesInicio}T00:00:00`)
          .lte('created_at', `${mesFin}T23:59:59`),
        supabase.from('pagos')
          .select('cita_id')
          .eq('tenant_id', tenant.id)
          .gte('created_at', `${fecha}T00:00:00`)
          .lte('created_at', `${fecha}T23:59:59`),
      ])
      const citasList  = citasRes.data  || []
      const equipoList = equipoRes.data || []
      const ingresos = citasList.filter(c=>c.estado==='completada')
        .reduce((s,c) => s+(c.servicios?.precio||0), 0)
      const alertasList = (stockRes.data || []).filter(p => p.stock <= p.stock_minimo)
      const totalGastos   = (gastosRes.data || []).reduce((s,g) => s + Number(g.monto), 0)
      const totalIngresos = (ingresosMesRes.data || []).reduce((s,p) => s + Number(p.monto), 0)
      setCitas(citasList)
      setEquipo(equipoList)
      setIngresosHoy(ingresos)
      setStockAlertas(alertasList)
      setServiciosCount(servRes.count ?? 0)
      setGastosMes(totalGastos)
      setIngresosMes(totalIngresos)
      const citasM = citasMananaRes.data || []
      setManana({
        count: citasM.length,
        citas: citasM.map(c => ({
          nombre:  c.clientes_agenda?.nombre || 'Cliente',
          servicio: c.servicios?.nombre || '',
          hora:    fmtHora(c.fecha_inicio),
        })),
      })
      setCumpleaneros(cumplRes?.data || [])
      setListaEsperaHoy(esperaRes?.count || 0)

      // Top 3 clientes por ingresos del mes
      const cltMap = {}
      ;(pagosCltRes.data || []).forEach(p => {
        const c = p.citas?.clientes_agenda
        if (!c?.id) return
        cltMap[c.id] = { nombre: c.nombre, total: (cltMap[c.id]?.total || 0) + Number(p.monto) }
      })
      setTopClientes(Object.values(cltMap).sort((a, b) => b.total - a.total).slice(0, 3))

      // Citas completadas sin cobrar hoy
      const citasIdsCobradas = new Set((pagosHoyRes.data || []).map(p => p.cita_id).filter(Boolean))
      setSinCobrar(citasList.filter(c => c.estado === 'completada' && !citasIdsCobradas.has(c.id)))

      // Analytics del mes
      const citasMes = analyticsMesRes.data || []
      const svcCount = {}
      const profCount = {}
      const diasSemana = [0,0,0,0,0,0,0]
      citasMes.forEach(c => {
        const svcNombre = c.servicios?.nombre
        if (svcNombre) svcCount[svcNombre] = (svcCount[svcNombre] || 0) + 1
        const profNombre = c.profesionales?.nombre
        if (profNombre) profCount[profNombre] = (profCount[profNombre] || 0) + 1
        const dow = new Date(c.fecha_inicio).getDay()
        diasSemana[dow]++
      })
      setAnalyticsData({
        topServicios: Object.entries(svcCount).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([nombre,count])=>({nombre,count})),
        topProf:      Object.entries(profCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([nombre,count])=>({nombre,count})),
        diasSemana,
      })

      // Próximos 7 días: count de citas por fecha
      const p7Map = {}
      citasMes.forEach(c => {
        const d = c.fecha_inicio?.slice(0, 10)
        if (d >= fecha) p7Map[d] = (p7Map[d] || 0) + 1
      })
      const DIAS_CORTOS = ['Do','Lu','Ma','Mi','Ju','Vi','Sa']
      setProximos7(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() + i)
        const iso = d.toISOString().slice(0, 10)
        return { iso, diaNom: DIAS_CORTOS[d.getDay()], diaNum: d.getDate(), count: p7Map[iso] || 0, esHoy: i === 0 }
      }))

      // Tendencia 14 días: semana anterior (0-6) + semana actual (7-13)
      const pagos14Data = pagos14Res.data || []
      const porDia14 = {}
      pagos14Data.forEach(p => {
        const d = p.created_at.slice(0, 10)
        porDia14[d] = (porDia14[d] || 0) + Number(p.monto)
      })
      const hace14base = new Date(); hace14base.setDate(hace14base.getDate() - 13)
      const dias14 = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(hace14base); d.setDate(hace14base.getDate() + i); return d.toISOString().slice(0, 10)
      })
      setTendencia14(dias14.map(d => porDia14[d] || 0))
    } catch(e) {
      console.error('[SalonDashboard]', e)
    } finally {
      setLoading(false)
    }
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('nuevo') === 'true') {
      showToast('¡Bienvenido! Tienes 14 días gratis para explorar todo 🎉', '#8b5cf6')
      const url = new URL(window.location)
      url.searchParams.delete('nuevo')
      window.history.replaceState({}, '', url)
    }
  }, [])

  async function marcarCompletada(citaId) {
    if (isDemo) { showToast('Demo — conecta Supabase para guardar', '#f59e0b'); return }
    await supabase.from('citas').update({estado:'completada'}).eq('id', citaId)
    showToast('Cita completada ✓')
    cargar()
  }

  async function registrarCobro(cita, metodo) {
    if (isDemo) { showToast('Demo — conecta Supabase para guardar', '#f59e0b'); setCobrando(null); return }
    const monto = cita.servicios?.precio
    if (!monto) { showToast('Servicio sin precio', '#f59e0b'); return }
    try {
      const { data: pago, error: e1 } = await supabase.from('pagos')
        .insert({ tenant_id: tenant.id, cita_id: cita.id, monto, metodo, estado: 'pendiente' })
        .select('id').single()
      if (e1) throw e1
      const { error: e2 } = await supabase.from('pagos').update({ estado:'pagado' }).eq('id', pago.id)
      if (e2) throw e2
      await supabase.from('citas').update({ estado:'completada' }).eq('id', cita.id)
      setCobrando(null)
      showToast(`Cobro registrado — ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(monto)}`)
      cargar()
    } catch (err) {
      showToast('Error al registrar cobro', '#ef4444')
      console.error('[cobro]', err)
    }
  }

  async function registrarAnticipo(cita, metodo, monto) {
    if (isDemo) { showToast('Demo — conecta Supabase para guardar', '#f59e0b'); setCobrando(null); return }
    const precio = cita.servicios?.precio || 0
    if (!monto || monto <= 0) { showToast('Ingresa un monto válido', '#f59e0b'); return }
    if (monto >= precio) { showToast('Para cobro completo usa "Cobro total"', '#f59e0b'); return }
    try {
      const { error: e1 } = await supabase.from('pagos')
        .insert({ tenant_id: tenant.id, cita_id: cita.id, monto, metodo, estado: 'pagado' })
      if (e1) throw e1
      const { error: e2 } = await supabase.from('citas').update({ anticipo: monto }).eq('id', cita.id)
      if (e2) throw e2
      setCobrando(null)
      showToast(`Anticipo de ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(monto)} registrado`)
      cargar()
    } catch (err) {
      showToast('Error al registrar anticipo', '#ef4444')
      console.error('[anticipo]', err)
    }
  }

  function enviarWA(cita) {
    const tel = cita.clientes?.telefono?.replace(/\D/g,'')
    if (!tel) return showToast('Sin teléfono registrado', '#f59e0b')
    const msg = encodeURIComponent(
      `Hola ${cita.clientes_agenda?.nombre||'Cliente'} 👋 Te recordamos tu cita de ${cita.servicios?.nombre||'servicio'} hoy a las ${fmtHora(cita.fecha_inicio)}. ¡Te esperamos!`
    )
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank')
  }

  const total      = citas.length
  const completadas= citas.filter(c=>c.estado==='completada').length
  const pendientes = citas.filter(c=>['pendiente','confirmada'].includes(c.estado)).length
  const proxima    = citas.find(c=>['pendiente','confirmada'].includes(c.estado) && c.fecha_inicio>=new Date().toISOString())
  const ahora      = new Date().toISOString()
  const profOcupados = new Set(
    citas.filter(c=>c.estado!=='cancelada'&&c.fecha_inicio<=ahora&&c.fecha_fin>=ahora)
      .map(c=>c.profesionales?.id).filter(Boolean)
  )

  // Minutos agendados por profesional hoy (para barra de ocupación)
  const profMinutos = {}
  citas.filter(c=>!['cancelada','no_asistio'].includes(c.estado)).forEach(c => {
    const id = c.profesionales?.id
    if (id) profMinutos[id] = (profMinutos[id] || 0) + (c.servicios?.duracion_min || 0)
  })
  // Ocupación global: total minutos agendados / (profs × 8h)
  const totalMin  = Object.values(profMinutos).reduce((s,m)=>s+m, 0)
  const capMin    = equipo.length * 480  // 8h por profesional
  const ocupPct   = capMin > 0 ? Math.min(100, Math.round(totalMin / capMin * 100)) : 0

  if (loading) return (
    <div className="sp-loader">
      <div className="sp-spinner" style={{ borderTopColor:col }} />
      <p className="sp-loader-label">Cargando</p>
    </div>
  )

  return (
    <>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {isDemo && (
        <div className="sp-alert warn" style={{ marginTop:16, fontSize:12, color:'#fbbf24', fontWeight:600 }}>
          <Ico d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={15} style={{ flexShrink:0 }} />
          <span>Modo demo — datos de ejemplo. Conecta Supabase para ver tu negocio real.</span>
        </div>
      )}

      {/* ── Alerta suscripción ───────────────────────────── */}
      {(() => {
        if (esSuperadmin || !suscripcion) return null
        const dias = suscripcion.dias_restantes
        if (dias === null || dias > 10) return null
        const metodos = [
          { label:'Nequi',     value:'3155734848', color:'#a855f7' },
          { label:'Transfiya', value:'3155734848', color:'#3b82f6' },
          { label:'Bancolombia', value:'Cta Ahorros 45492209477 · Hugo F. Urquina', color:'#f59e0b' },
        ]
        const vencida = dias <= 0
        const critica = dias !== null && dias <= 2 && dias > 0
        const alerta  = dias !== null && dias > 2 && dias <= 5
        const ok      = dias !== null && dias > 5

        let bg, border, titleColor, icon, title, sub
        if (vencida) {
          bg = 'rgba(239,68,68,0.10)'; border = 'rgba(239,68,68,0.4)'
          titleColor = '#f87171'; icon = '🔴'
          title = `Plan vencido hace ${Math.abs(dias)} día${Math.abs(dias)!==1?'s':''}`
          sub = 'Renueva tu plan para continuar usando todas las funciones.'
        } else if (critica) {
          bg = 'rgba(239,68,68,0.08)'; border = 'rgba(239,68,68,0.35)'
          titleColor = '#f87171'; icon = '⚠️'
          title = `${dias} día${dias!==1?'s':''} para vencer el plan`
          sub = 'Renueva hoy para evitar interrupciones.'
        } else if (alerta) {
          bg = 'rgba(251,191,36,0.10)'; border = 'rgba(251,191,36,0.4)'
          titleColor = '#fbbf24'; icon = '⏰'
          title = `${dias} días para vencer el plan`
          sub = 'Renueva pronto para continuar sin interrupciones.'
        } else {
          bg = 'rgba(34,197,94,0.08)'; border = 'rgba(34,197,94,0.3)'
          titleColor = '#4ade80'; icon = '✅'
          title = `Plan activo — ${dias} días restantes`
          sub = suscripcion.plan_nombre || null
          return (
            <div style={{
              margin:'12px 16px 0', padding:'10px 14px', borderRadius:12,
              background:bg, border:`1px solid ${border}`,
              display:'flex', alignItems:'center', gap:10,
            }}>
              <span style={{ fontSize:16 }}>{icon}</span>
              <span style={{ fontSize:12, fontWeight:700, color:titleColor }}>{title}</span>
              {sub && <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:4 }}>{sub}</span>}
            </div>
          )
        }

        return (
          <div style={{
            margin:'12px 16px 0', padding:'14px 16px', borderRadius:14,
            background:bg, border:`1px solid ${border}`,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:18 }}>{icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:titleColor }}>{title}</div>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>{sub}</div>
              </div>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', marginBottom:6 }}>
              Métodos de pago:
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {metodos.map(m => (
                <div key={m.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'var(--card)', borderRadius:8, padding:'7px 10px', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:m.color }}>{m.label}</span>
                    <span style={{ fontSize:11, color:'var(--text-2)' }}>{m.value}</span>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(m.value.replace(/\D/g,'') || m.value); showToast(`${m.label} copiado ✓`) }}
                    style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, cursor:'pointer',
                      border:`1px solid ${m.color}40`, background:`${m.color}15`, color:m.color }}>
                    Copiar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Alerta cumpleaños ────────────────────────────── */}
      {cumpleaneros.length > 0 && (() => {
        const hoyStr = new Date().toISOString().slice(5, 10) // MM-DD
        const conDias = cumpleaneros.map(c => {
          const nacMMDD = c.fecha_nacimiento?.slice(5, 10) || ''
          const esHoy = nacMMDD === hoyStr
          let dias = 0
          if (!esHoy) {
            for (let i = 1; i < 7; i++) {
              const d = new Date(); d.setDate(d.getDate() + i)
              if (d.toISOString().slice(5, 10) === nacMMDD) { dias = i; break }
            }
          }
          return { ...c, esHoy, dias }
        }).sort((a, b) => a.dias - b.dias)
        const hoy = conDias.filter(c => c.esHoy)
        const prox = conDias.filter(c => !c.esHoy)
        return (
          <div className="sp-alert rose" style={{ marginTop:16 }}>
            <span style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>🎂</span>
            <div style={{ flex:1, minWidth:0 }}>
              {hoy.length > 0 && (
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:6 }}>
                  {hoy.length === 1 ? `¡Hoy cumple años ${hoy[0].nombre.split(' ')[0]}!` : `¡${hoy.length} clientes cumplen hoy!`}
                </div>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {conDias.map(c => {
                  const tel = c.telefono?.replace(/\D/g,'')
                  const msg = encodeURIComponent(c.esHoy
                    ? `¡Feliz cumpleaños ${c.nombre.split(' ')[0]}! 🎉 En ${tenant?.nombre || 'el salón'} te deseamos un día increíble. ¡Queremos celebrarlo contigo! 💅`
                    : `Hola ${c.nombre.split(' ')[0]} 👋 Queríamos recordarte que en ${tenant?.nombre || 'el salón'} estamos pensando en ti para tu cumpleaños. ¡Te esperamos! 🎂`)
                  const label = c.esHoy ? `🎁 ${c.nombre.split(' ')[0]}` : `📅 ${c.nombre.split(' ')[0]} (en ${c.dias}d)`
                  return tel ? (
                    <a key={c.id} href={`https://wa.me/57${tel}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:7,
                        background: c.esHoy ? 'rgba(236,72,153,0.15)' : 'rgba(236,72,153,0.07)',
                        border:`1px solid ${c.esHoy ? 'rgba(236,72,153,0.4)' : 'rgba(236,72,153,0.2)'}`,
                        color:'#ec4899', textDecoration:'none', whiteSpace:'nowrap',
                      }}>
                      {label}
                    </a>
                  ) : (
                    <span key={c.id} style={{ fontSize:11, color:'var(--text-3)' }}>
                      {c.nombre.split(' ')[0]}{!c.esHoy ? ` (${c.dias}d)` : ''}
                    </span>
                  )
                })}
              </div>
              {prox.length > 0 && hoy.length === 0 && (
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>Cumpleaños próximos — recuerda saludar</div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Onboarding: checklist de configuración inicial ── */}
      {!isDemo && !loading && (() => {
        const steps = [
          {
            label: 'Agrega tus servicios',
            desc:  'Cortes, tintes, tratamientos…',
            done:  (serviciosCount ?? 0) > 0,
            page:  'servicios',
            icon:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
          },
          {
            label: 'Añade tu equipo',
            desc:  'Profesionales y sus horarios.',
            done:  equipo.length > 0,
            page:  'equipo',
            icon:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
          },
          {
            label: 'Registra tu primer cliente',
            desc:  'Agrega nombre y teléfono WhatsApp.',
            done:  citas.length > 0 || (serviciosCount ?? 0) > 0,
            page:  'clientes',
            icon:  'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
          },
          {
            label: 'Configura tu WhatsApp',
            desc:  'Para enviar recordatorios automáticos.',
            done:  !!(tenant?.telefono || tenant?.whatsapp),
            page:  'config',
            icon:  'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
          },
          {
            label: 'Crea tu primera cita',
            desc:  '¡El sistema ya funciona!',
            done:  citas.length > 0,
            page:  'agenda',
            icon:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
          },
        ]
        const doneCount = steps.filter(s => s.done).length
        if (doneCount === steps.length) return null
        return (
          <div style={{ margin:'16px 16px 0', borderRadius:20,
            background:`linear-gradient(135deg,${col}10,${col}05)`,
            border:`1.5px solid ${col}25`, overflow:'hidden' }}>

            {/* Header */}
            <div style={{ padding:'18px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', marginBottom:2 }}>
                  Configura tu negocio
                </div>
                <div style={{ fontSize:12, color:'var(--text-3)' }}>
                  {doneCount} de {steps.length} pasos completados
                </div>
              </div>
              <div style={{
                width:44, height:44, borderRadius:'50%', flexShrink:0,
                background: doneCount === 0 ? 'var(--border)' : `${col}20`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Outfit', fontWeight:900, fontSize:15,
                color: doneCount === 0 ? 'var(--text-3)' : col,
              }}>
                {doneCount}/{steps.length}
              </div>
            </div>

            {/* Barra de progreso */}
            <div style={{ margin:'0 20px 14px', height:5, borderRadius:5, background:'var(--border)' }}>
              <div style={{
                height:'100%', borderRadius:5,
                background:`linear-gradient(90deg, ${col}, ${col}bb)`,
                width:`${(doneCount/steps.length)*100}%`,
                transition:'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            </div>

            {/* Steps */}
            {steps.map((step, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'11px 20px',
                borderTop:`1px solid ${col}15`,
                opacity: step.done ? 0.6 : 1,
              }}>
                {/* Check / ícono */}
                <div style={{
                  width:30, height:30, borderRadius:9, flexShrink:0,
                  background: step.done ? '#22c55e' : `${col}18`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {step.done
                    ? <Ico d="M5 13l4 4L19 7" size={14} />
                    : <Ico d={step.icon} size={14} />
                  }
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{
                    fontSize:13, fontWeight: step.done ? 500 : 700,
                    color: step.done ? 'var(--text-3)' : 'var(--text)',
                    textDecoration: step.done ? 'line-through' : 'none',
                  }}>{step.label}</div>
                  {!step.done && (
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>{step.desc}</div>
                  )}
                </div>

                {!step.done && (
                  <button onClick={() => onNavigate?.(step.page)} style={{
                    fontSize:11, fontWeight:700, color:col,
                    padding:'5px 12px', borderRadius:8,
                    background:`${col}15`, border:`1px solid ${col}30`,
                    cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
                  }}>
                    Ir →
                  </button>
                )}
              </div>
            ))}
            <div style={{ height:10 }} />
          </div>
        )
      })()}

      {/* ── Tarjeta: link de reservas ── */}
      {tenant?.slug && (
        <LinkReservas slug={tenant.slug} col={col} showToast={showToast} />
      )}

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="sp-hero" style={{ background:`linear-gradient(135deg,${col}ee,${col}77)` }}>
        <div style={{ position:'absolute', right:-30, top:-30, width:180, height:180,
          borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', right:60, bottom:-40, width:120, height:120,
          borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ position:'relative' }}>
          <p className="sp-hero-eyebrow">{saludo()}</p>
          <h1 className="sp-hero-title">{tenant?.nombre || 'Glamour Studio'}</h1>
          <p className="sp-hero-sub">
            {proxima
              ? `Próxima: ${proxima.clientes_agenda?.nombre} a las ${fmtHora(proxima.fecha_inicio)}`
              : total===0 ? 'Sin citas para hoy' : '¡Todo listo por hoy!'}
          </p>
        </div>
        <div className="sp-hero-stats">
          <div className="sp-hero-stat">
            <span className="sp-hero-stat-val">{total}</span>
            <span className="sp-hero-stat-lbl">Citas hoy</span>
          </div>
          <div className="sp-hero-stat">
            <span className="sp-hero-stat-val">{completadas}</span>
            <span className="sp-hero-stat-lbl">Listas</span>
          </div>
          <div className="sp-hero-stat">
            <span className="sp-hero-stat-val">{fmtCOP(ingresosHoy)}</span>
            <span className="sp-hero-stat-lbl">Ingresado</span>
          </div>
        </div>
      </div>

      {/* ── Bento stats ──────────────────────────────────── */}
      <div className="sp-bento">

        <div className="sp-bento-card c-rose">
          <div className="sp-bento-icon" style={{ background:'rgba(244,63,94,0.2)' }}>
            <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={18} />
          </div>
          <div className="sp-bento-val" style={{ color:'#fb7185' }}>{total}</div>
          <div className="sp-bento-lbl">Citas hoy</div>
          {pendientes>0 && (
            <div className="sp-bento-trend" style={{ background:'rgba(251,113,133,0.15)', color:'#fb7185' }}>
              {pendientes} pendientes
            </div>
          )}
        </div>

        <div className="sp-bento-card c-green">
          <div className="sp-bento-icon" style={{ background:'rgba(34,197,94,0.18)' }}>
            <Ico d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={18} />
          </div>
          <div className="sp-bento-val" style={{ color:'#4ade80' }}>{completadas}</div>
          <div className="sp-bento-lbl">Completadas</div>
          {total>0 && (
            <div className="sp-bento-trend" style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80' }}>
              {Math.round(completadas/total*100)}%
            </div>
          )}
        </div>

        <div className="sp-bento-card c-purple">
          <div className="sp-bento-icon" style={{ background:'rgba(168,85,247,0.18)' }}>
            <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={18} />
          </div>
          <div className="sp-bento-val" style={{ color:'#c084fc' }}>{fmtCOP(ingresosHoy)}</div>
          <div className="sp-bento-lbl">Ingresos del día</div>
        </div>

        <div className="sp-bento-card c-blue">
          <div className="sp-bento-icon" style={{ background:'rgba(59,130,246,0.18)' }}>
            <Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" size={18} />
          </div>
          <div className="sp-bento-val" style={{ color:'#60a5fa' }}>{ocupPct}%</div>
          <div className="sp-bento-lbl">Ocupación hoy</div>
          <div style={{ marginTop:8, height:4, borderRadius:2, background:'rgba(96,165,250,0.15)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${ocupPct}%`, background:'#60a5fa', borderRadius:2, transition:'width 0.5s' }} />
          </div>
        </div>

      </div>

      {/* ── Ocupación por profesional hoy ───────────────── */}
      {!isDemo && equipo.length > 1 && Object.keys(profMinutos).length > 0 && (
        <div style={{ margin:'0 16px 14px' }}>
          <div className="sp-kpi-card" style={{ padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5,
              textTransform:'uppercase', marginBottom:10 }}>
              Carga del equipo hoy
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {equipo.filter(p => profMinutos[p.id] != null).map(p => {
                const min = profMinutos[p.id] || 0
                const pct = Math.min(100, Math.round(min / 480 * 100))
                const barColor = pct >= 80 ? '#f87171' : pct >= 50 ? col : '#4ade80'
                return (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:80, fontSize:11, fontWeight:600, color:'var(--text-2)',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flexShrink:0 }}>
                      {p.nombre?.split(' ')[0]}
                    </div>
                    <div style={{ flex:1, height:7, borderRadius:4, background:'var(--border)', overflow:'hidden' }}>
                      <div style={{
                        height:'100%', borderRadius:4,
                        width:`${pct}%`,
                        background: barColor,
                        transition:'width 0.5s',
                      }} />
                    </div>
                    <div style={{ width:34, fontSize:11, fontWeight:700, color:'var(--text-3)',
                      textAlign:'right', flexShrink:0 }}>
                      {pct}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de espera del día ─────────────────────── */}
      {listaEsperaHoy > 0 && (
        <button onClick={() => onNavigate('agenda')} style={{
          display:'flex', alignItems:'center', gap:10,
          margin:'0 16px 14px', padding:'12px 16px', borderRadius:14, cursor:'pointer',
          background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.35)',
          width:'calc(100% - 32px)', textAlign:'left',
        }}>
          <span style={{ fontSize:20, flexShrink:0 }}>⏳</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#fbbf24' }}>
              {listaEsperaHoy} en lista de espera hoy
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
              Toca para ver la agenda y asignar turnos
            </div>
          </div>
          <Ico d="M9 5l7 7-7 7" size={15} style={{ color:'#fbbf24', flexShrink:0 }} />
        </button>
      )}

      {/* ── Resumen del mes ─────────────────────────────── */}
      {(ingresosMes > 0 || gastosMes > 0) && (
        <div style={{ margin:'0 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="sp-kpi-card" style={{
            background:'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.04) 100%)',
            boxShadow:'0 4px 24px rgba(34,197,94,0.09)',
          }}>
            <div className="sp-kpi-lbl" style={{ color:'#4ade80' }}>Ingresos mes</div>
            <div className="sp-kpi-val" style={{ color:'#4ade80', fontSize:22 }}>{fmtCOP(ingresosMes)}</div>
          </div>
          <div className="sp-kpi-card" style={{
            background:'linear-gradient(135deg, rgba(239,68,68,0.13) 0%, rgba(239,68,68,0.04) 100%)',
            boxShadow:'0 4px 24px rgba(239,68,68,0.08)',
          }}>
            <div className="sp-kpi-lbl" style={{ color:'#f87171' }}>Gastos mes</div>
            <div className="sp-kpi-val" style={{ color:'#f87171', fontSize:22 }}>{fmtCOP(gastosMes)}</div>
            {gastosMes > 0 && ingresosMes > 0 && (
              <div className="sp-kpi-sub" style={{ color:'rgba(248,113,113,0.65)' }}>
                {Math.round(gastosMes / ingresosMes * 100)}% de ingresos
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Meta de ingresos del mes ── */}
      {(() => {
        const meta = Number(tenant?.config_vertical?.meta_ingresos_mes || 0)
        if (!meta) return null
        const pct = Math.min(ingresosMes / meta * 100, 100)
        const alcanzado = ingresosMes >= meta
        return (
          <div style={{ margin:'10px 16px', padding:'12px 14px', borderRadius:14,
            background:'var(--card)', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase' }}>
                🎯 Meta del mes
              </span>
              <span style={{ fontSize:12, fontWeight:800, fontFamily:'Outfit',
                color: alcanzado ? '#22c55e' : col }}>
                {alcanzado ? '✓ Alcanzada!' : `${Math.round(pct)}%`}
              </span>
            </div>
            <div style={{ height:7, borderRadius:4, background:'var(--border)', overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:4, width:`${pct}%`, transition:'width 0.5s',
                background: alcanzado ? '#22c55e' : `linear-gradient(90deg,${col},${col}cc)`,
              }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:10, color:'var(--text-3)' }}>
              <span>{fmtCOP(ingresosMes)}</span>
              <span>Meta: {fmtCOP(meta)}</span>
            </div>
          </div>
        )
      })()}

      {/* ── Tendencia ingresos: semana actual vs anterior ── */}
      {tendencia14 && tendencia14.some(v => v > 0) && (() => {
        const semAnt = tendencia14.slice(0, 7)
        const semAct = tendencia14.slice(7)
        const totAnt = semAnt.reduce((s, v) => s + v, 0)
        const totAct = semAct.reduce((s, v) => s + v, 0)
        const pctCambio = totAnt > 0 ? Math.round((totAct - totAnt) / totAnt * 100) : null
        const maxVal = Math.max(...tendencia14, 1)
        const dias = ['D','L','M','X','J','V','S']
        const hoyD = new Date()
        return (
          <div style={{ margin:'10px 16px 0' }}>
            <div className="sp-kpi-card" style={{ padding:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:0.5 }}>
                  Esta semana vs semana anterior
                </div>
                {pctCambio !== null && (
                  <span style={{
                    fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:6,
                    background: pctCambio >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                    color: pctCambio >= 0 ? '#4ade80' : '#f87171',
                  }}>
                    {pctCambio >= 0 ? '+' : ''}{pctCambio}%
                  </span>
                )}
              </div>
              <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:56 }}>
                {[0,1,2,3,4,5,6].map(i => {
                  const d = new Date(hoyD); d.setDate(hoyD.getDate() - (6 - i))
                  const dow = d.getDay()
                  const vAct = semAct[i] || 0
                  const vAnt = semAnt[i] || 0
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                      <div style={{ width:'100%', display:'flex', gap:1, alignItems:'flex-end', height:40 }}>
                        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', height:40 }}>
                          <div style={{ width:'100%', borderRadius:3,
                            height:`${Math.max(vAnt > 0 ? 8 : 0, vAnt / maxVal * 100)}%`,
                            background:'rgba(128,128,128,0.25)',
                          }} />
                        </div>
                        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', height:40 }}>
                          <div style={{ width:'100%', borderRadius:3,
                            height:`${Math.max(vAct > 0 ? 8 : 0, vAct / maxVal * 100)}%`,
                            background: col,
                          }} />
                        </div>
                      </div>
                      <span style={{ fontSize:8, fontWeight:600, color:'var(--text-3)' }}>{dias[dow]}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'flex', gap:14, marginTop:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:'rgba(128,128,128,0.3)', flexShrink:0 }} />
                  <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:600 }}>Ant. {fmtCOP(totAnt)}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:col, flexShrink:0 }} />
                  <span style={{ fontSize:10, color:'var(--text-2)', fontWeight:700 }}>Actual {fmtCOP(totAct)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Analytics del mes ───────────────────────────── */}
      {analyticsData && (analyticsData.topServicios.length > 0 || analyticsData.topProf.length > 0) && (
        <div style={{ margin:'16px 16px 0', display:'flex', flexDirection:'column', gap:10 }}>

          {/* Top servicios + Más activos — 2 columnas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>

            {/* Top servicios */}
            <div className="sp-kpi-card" style={{ padding:'14px 14px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>
                Top servicios
              </div>
              {analyticsData.topServicios.slice(0,4).map((s, i) => {
                const max = analyticsData.topServicios[0]?.count || 1
                return (
                  <div key={i} style={{ marginBottom: i < 3 ? 8 : 0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, paddingRight:4 }}>
                        {s.nombre}
                      </span>
                      <span style={{ fontSize:10, fontWeight:800, color:col, flexShrink:0 }}>{s.count}</span>
                    </div>
                    <div style={{ height:3, borderRadius:2, background:'var(--border)' }}>
                      <div style={{ height:'100%', width:`${s.count/max*100}%`, background:col, borderRadius:2 }} />
                    </div>
                  </div>
                )
              })}
              {analyticsData.topServicios.length === 0 && (
                <div style={{ fontSize:11, color:'var(--text-3)' }}>Sin datos aún</div>
              )}
            </div>

            {/* Más activos */}
            <div className="sp-kpi-card" style={{ padding:'14px 14px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>
                Más activos
              </div>
              {analyticsData.topProf.slice(0,3).map((p, i) => {
                const max = analyticsData.topProf[0]?.count || 1
                const clr = PROF_COLORS[i % PROF_COLORS.length]
                return (
                  <div key={i} style={{ marginBottom: i < 2 ? 8 : 0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, paddingRight:4 }}>
                        {p.nombre.split(' ')[0]}
                      </span>
                      <span style={{ fontSize:10, fontWeight:800, color:clr, flexShrink:0 }}>{p.count}</span>
                    </div>
                    <div style={{ height:3, borderRadius:2, background:'var(--border)' }}>
                      <div style={{ height:'100%', width:`${p.count/max*100}%`, background:clr, borderRadius:2 }} />
                    </div>
                  </div>
                )
              })}
              {analyticsData.topProf.length === 0 && (
                <div style={{ fontSize:11, color:'var(--text-3)' }}>Sin datos aún</div>
              )}
            </div>
          </div>

          {/* Top clientes del mes */}
          {topClientes.length > 0 && (
            <div className="sp-kpi-card" style={{ padding:'14px 14px 12px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>
                Top clientes del mes
              </div>
              {topClientes.map((c, i) => {
                const max = topClientes[0]?.total || 1
                const medal = ['🥇','🥈','🥉'][i] || ''
                return (
                  <div key={i} style={{ marginBottom: i < topClientes.length - 1 ? 8 : 0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, paddingRight:4 }}>
                        {medal} {c.nombre}
                      </span>
                      <span style={{ fontSize:10, fontWeight:800, color:col, flexShrink:0 }}>{fmtCOP(c.total)}</span>
                    </div>
                    <div style={{ height:3, borderRadius:2, background:'var(--border)' }}>
                      <div style={{ height:'100%', width:`${c.total/max*100}%`, background:col, borderRadius:2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Heatmap días de la semana */}
          <div className="sp-kpi-card" style={{ padding:'14px' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', marginBottom:12, textTransform:'uppercase', letterSpacing:0.5 }}>
              Días más concurridos
            </div>
            <div style={{ display:'flex', gap:5, alignItems:'flex-end', height:60 }}>
              {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((dia, i) => {
                const count = analyticsData.diasSemana[i] || 0
                const max   = Math.max(...analyticsData.diasSemana, 1)
                const pct   = count / max
                const isTop = count === max && count > 0
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <span style={{ fontSize:9, fontWeight:800, color: isTop ? col : 'var(--text-3)', opacity: count ? 1 : 0.3 }}>
                      {count || ''}
                    </span>
                    <div style={{ width:'100%', height:36, borderRadius:6, background:'var(--border)', display:'flex', alignItems:'flex-end', overflow:'hidden' }}>
                      <div style={{
                        width:'100%', borderRadius:6,
                        height:`${Math.max(pct > 0 ? 14 : 0, pct * 100)}%`,
                        background: pct > 0.75 ? col : pct > 0.4 ? `${col}99` : `${col}44`,
                        transition:'height 0.5s',
                      }} />
                    </div>
                    <span style={{ fontSize:9, fontWeight:600, color:'var(--text-3)' }}>{dia}</span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── Alerta stock bajo ───────────────────────────── */}
      {stockAlertas.length > 0 && (
        <div className="sp-alert warn" style={{ marginBottom:4, alignItems:'flex-start' }}>
          <Ico d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" size={18} style={{ flexShrink:0, marginTop:1 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
              {stockAlertas.length} producto{stockAlertas.length !== 1 ? 's' : ''} bajo stock mínimo
            </div>
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
              {stockAlertas.slice(0, 5).map(p => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:'var(--text-2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#f59e0b', flexShrink:0 }}>
                    {p.stock} / mín {p.stock_minimo}
                  </span>
                </div>
              ))}
              {stockAlertas.length > 5 && (
                <div style={{ fontSize:11, color:'var(--text-3)' }}>+{stockAlertas.length - 5} más…</div>
              )}
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:6 }}>
              Revisa el módulo de Inventario
            </div>
          </div>
        </div>
      )}


      {/* ── Citas sin cobrar ──────────────────────────────── */}
      {sinCobrar.length > 0 && (
        <div style={{ margin:'0 16px 8px' }}>
          <div style={{
            padding:'12px 14px', borderRadius:14,
            background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:15 }}>💳</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#f87171' }}>
                {sinCobrar.length} cita{sinCobrar.length !== 1 ? 's' : ''} completada{sinCobrar.length !== 1 ? 's' : ''} sin cobrar
              </span>
            </div>
            {sinCobrar.map(c => (
              <div key={c.id} style={{ fontSize:11, color:'var(--text-3)', marginBottom:2 }}>
                · {fmtHora(c.fecha_inicio)} — {c.clientes_agenda?.nombre?.split(' ')[0] || 'Cliente'} ({c.servicios?.nombre || 'servicio'})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Próximos 7 días ──────────────────────────────── */}
      {proximos7.length > 0 && (
        <div style={{ margin:'0 16px 12px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.8,
            textTransform:'uppercase', marginBottom:8 }}>Esta semana</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
            {proximos7.map(d => (
              <div key={d.iso} style={{
                textAlign:'center', padding:'8px 4px', borderRadius:10,
                background: d.esHoy ? `${col}20` : 'var(--card)',
                border: d.esHoy ? `1.5px solid ${col}50` : '1px solid var(--border)',
                boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize:9, fontWeight:700, color: d.esHoy ? col : 'var(--text-3)',
                  textTransform:'uppercase', letterSpacing:0.5 }}>{d.diaNom}</div>
                <div style={{ fontSize:14, fontWeight:800, color: d.esHoy ? col : 'var(--text)',
                  lineHeight:1.2, marginTop:2 }}>{d.diaNum}</div>
                {d.count > 0
                  ? <div style={{ marginTop:3, fontSize:11, fontWeight:700, color: d.esHoy ? col : 'var(--text-2)',
                      background: d.esHoy ? `${col}18` : 'var(--bg)', borderRadius:6, padding:'1px 0' }}>
                      {d.count}
                    </div>
                  : <div style={{ marginTop:3, fontSize:10, color:'var(--text-3)', lineHeight:1 }}>—</div>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Equipo strip ─────────────────────────────────── */}
      {equipo.length>0 && (
        <>
          <div className="sp-section">
            <span className="sp-section-title">Equipo hoy</span>
          </div>
          <div className="sp-team-strip">
            {equipo.map((prof,i) => {
              const color = PROF_COLORS[i%PROF_COLORS.length]
              const ocupado = profOcupados.has(prof.id)
              const citasN  = citas.filter(c=>c.profesionales?.id===prof.id).length
              return (
                <div key={prof.id} className="sp-team-member">
                  <div className="sp-team-avatar-wrap">
                    <div className="sp-team-avatar" style={{ background:`${color}28` }}>
                      {prof.foto_url
                        ? <img src={prof.foto_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                        : <span style={{ color, fontFamily:'Outfit', fontWeight:800 }}>{prof.nombre[0]}</span>
                      }
                    </div>
                    <div className="sp-team-ring" style={{ borderColor:`${color}55` }} />
                    <span className={`sp-team-status ${ocupado?'ocupado':'libre'}`} />
                  </div>
                  <span className="sp-team-name">{prof.nombre.split(' ')[0]}</span>
                  <span className="sp-team-specialty">{citasN} cita{citasN!==1?'s':''}</span>
                  {profMinutos[prof.id] > 0 && (
                    <div style={{ width:'100%', height:3, borderRadius:2, background:'rgba(128,128,128,0.15)', marginTop:4, overflow:'hidden' }}>
                      <div style={{
                        height:'100%',
                        width:`${Math.min(100, Math.round((profMinutos[prof.id]||0)/480*100))}%`,
                        background: color, borderRadius:2,
                      }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Timeline ─────────────────────────────────────── */}
      <div className="sp-section" style={{ marginBottom:16 }}>
        <span className="sp-section-title">Agenda del día</span>
        <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>
          {new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}
        </span>
      </div>

      {citas.length===0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">🗓️</span>
          <p className="sp-empty-title">Sin citas para hoy</p>
          <p className="sp-empty-sub">Usa el botón + para agendar</p>
        </div>
      ) : (
        <div className="sp-timeline">
          {citas.map((cita,i) => {
            const est      = ESTADO_CFG[cita.estado] || ESTADO_CFG.pendiente
            const profIdx  = equipo.findIndex(p=>p.id===cita.profesionales?.id)
            const profColor= PROF_COLORS[profIdx>=0 ? profIdx%PROF_COLORS.length : i%PROF_COLORS.length]
            const canDone  = ['pendiente','confirmada'].includes(cita.estado)

            return (
              <div key={cita.id} className="sp-tl-item">
                <div className="sp-tl-left">
                  <span className="sp-tl-time">
                    {fmtHora(cita.fecha_inicio).replace(' am','').replace(' pm','')}
                    <br /><span style={{ fontSize:9, color:'var(--text-3)' }}>{fmtHora(cita.fecha_inicio).slice(-2)}</span>
                  </span>
                  <span className="sp-tl-dot" style={{ borderColor:profColor, background:`${profColor}22` }} />
                </div>

                <div className="sp-tl-card" style={{
                  background:`linear-gradient(135deg, ${profColor}10 0%, var(--card) 55%)`,
                  borderColor:`${profColor}28`,
                }}>
                  <div style={{ paddingLeft:2 }}>
                    <div className="sp-tl-top">
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <span className="sp-tl-client">{cita.clientes_agenda?.nombre||'Cliente'}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:4,
                            fontSize:11, fontWeight:700,
                            padding:'2px 8px', borderRadius:20,
                            background:`${profColor}20`, color:profColor,
                          }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:profColor, flexShrink:0 }} />
                            {cita.profesionales?.nombre?.split(' ')[0]||'—'}
                          </span>
                          {cita.servicios?.duracion_min && (
                            <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:500 }}>
                              {cita.servicios.duracion_min} min
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="sp-tl-badge" style={{ background:est.bg, color:est.color }}>{est.label}</span>
                    </div>
                    <p className="sp-tl-service" style={{ marginTop:6 }}>{cita.servicios?.nombre||'Servicio'}</p>
                    <div className="sp-tl-actions">
                      <button className="sp-tl-action wa" onClick={()=>enviarWA(cita)} style={{ flex:'0 0 44px' }}>
                        <Ico d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" size={15} />
                      </button>
                      {canDone && (
                        <button className="sp-tl-action ok" style={{
                          flex:1,
                          background:`linear-gradient(135deg, ${profColor}22, ${profColor}08)`,
                          borderColor:`${profColor}35`, color:profColor, fontWeight:700,
                        }}
                          onClick={() => setCobrando(cobrando?.citaId===cita.id ? null : { citaId:cita.id, metodo:'efectivo', esAnticipo:false, montoAnticipo:'' })}>
                          <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} />
                          Cobrar {fmtCOP(cita.servicios?.precio||0)}
                        </button>
                      )}
                    </div>
                    {cobrando?.citaId === cita.id && (
                      <div style={{
                        marginTop:10, padding:'12px 14px', borderRadius:14,
                        background:`linear-gradient(135deg, ${col}10, ${col}05)`,
                        boxShadow:`0 4px 20px ${col}12`,
                        display:'flex', flexDirection:'column', gap:8,
                      }}>
                        {/* Tipo toggle */}
                        <div style={{ display:'flex', gap:5 }}>
                          {[{k:false,label:'Cobro total'},{k:true,label:'Anticipo'}].map(({k,label}) => (
                            <button key={String(k)} onClick={() => setCobrando(c => ({...c, esAnticipo:k}))} style={{
                              flex:1, padding:'7px 6px', borderRadius:9, fontSize:11, fontWeight:700,
                              cursor:'pointer', border:'none', transition:'all 0.15s',
                              background: cobrando.esAnticipo===k
                                ? k ? 'linear-gradient(135deg,#f59e0bcc,#f59e0b88)' : `linear-gradient(135deg,${col}cc,${col}88)`
                                : 'rgba(255,255,255,0.07)',
                              color: cobrando.esAnticipo===k ? '#fff' : 'var(--text-3)',
                            }}>{label}</button>
                          ))}
                        </div>
                        {cobrando.esAnticipo && (
                          <input
                            type="number"
                            placeholder={`Monto anticipo (servicio: ${fmtCOP(cita.servicios?.precio||0)})`}
                            value={cobrando.montoAnticipo}
                            onChange={e => setCobrando(c => ({...c, montoAnticipo:e.target.value}))}
                            style={{
                              width:'100%', padding:'8px 10px', borderRadius:9, fontSize:13,
                              border:'1px solid rgba(255,255,255,0.12)', boxSizing:'border-box',
                              background:'rgba(255,255,255,0.07)', color:'var(--text)', outline:'none',
                            }}
                          />
                        )}
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase' }}>
                          Método de cobro
                        </div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {['efectivo','nequi','daviplata','tarjeta'].map(m => (
                            <button key={m} onClick={() => setCobrando(c => ({...c, metodo:m}))} style={{
                              padding:'7px 13px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer',
                              border:'none',
                              background: cobrando.metodo===m
                                ? `linear-gradient(135deg, ${col}cc, ${col}88)`
                                : 'rgba(255,255,255,0.07)',
                              color: cobrando.metodo===m ? '#fff' : 'var(--text-2)',
                              boxShadow: cobrando.metodo===m ? `0 2px 12px ${col}40` : 'none',
                              transition:'all 0.15s',
                            }}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => setCobrando(null)} style={{
                            padding:'8px 12px', borderRadius:9, cursor:'pointer',
                            background:'rgba(255,255,255,0.06)', border:'none',
                            color:'var(--text-3)', fontSize:12, fontWeight:600,
                          }}>✕</button>
                          <button onClick={() => { marcarCompletada(cita.id); setCobrando(null) }} style={{
                            flex:1, padding:'8px', borderRadius:9, cursor:'pointer',
                            background:'rgba(255,255,255,0.06)', border:'none',
                            color:'var(--text-2)', fontSize:12, fontWeight:600,
                          }}>Sin cobro</button>
                          <button onClick={() => cobrando.esAnticipo
                            ? registrarAnticipo(cita, cobrando.metodo, parseFloat(cobrando.montoAnticipo)||0)
                            : registrarCobro(cita, cobrando.metodo)
                          } style={{
                            flex:2, padding:'8px', borderRadius:9, cursor:'pointer',
                            background: cobrando.esAnticipo
                              ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                              : `linear-gradient(135deg, ${col}, ${col}cc)`,
                            border:'none', color:'#fff', fontWeight:700, fontSize:13,
                            boxShadow: cobrando.esAnticipo ? '0 4px 16px #f59e0b40' : `0 4px 16px ${col}40`,
                          }}>
                            {cobrando.esAnticipo
                              ? `✓ Anticipo ${cobrando.montoAnticipo ? fmtCOP(parseFloat(cobrando.montoAnticipo)) : ''}`
                              : '✓ Cobrar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* ── Vista previa mañana ─────────────────────────── */}
      {manana && manana.count > 0 && (
        <div style={{ margin:'16px 16px 0' }}>
          <div style={{ borderRadius:18, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.18)' }}>
            <div style={{
              padding:'14px 18px',
              background:`linear-gradient(135deg, ${col}22, ${col}0a)`,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                <div style={{
                  width:34, height:34, borderRadius:10, flexShrink:0,
                  background:`${col}30`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={16} style={{ color:col }} />
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', letterSpacing:-0.2 }}>Mañana</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                    {manana.count} cita{manana.count !== 1 ? 's' : ''} agendada{manana.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button onClick={() => onNavigate?.('agenda')} style={{
                fontSize:12, fontWeight:700, color:col, padding:'6px 12px',
                borderRadius:9, border:'none',
                background:`${col}22`, cursor:'pointer', whiteSpace:'nowrap',
              }}>
                Ver →
              </button>
            </div>
            <div style={{ background:'rgba(255,255,255,0.025)' }}>
              {manana.citas.map((c, i) => (
                <div key={i} style={{
                  padding:'11px 18px', display:'flex', alignItems:'center', gap:12,
                  borderTop:'1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{
                    fontSize:12, fontWeight:700, color:col,
                    minWidth:46, fontFamily:'Outfit, monospace',
                    letterSpacing:-0.3,
                  }}>{c.hora}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                      {c.nombre}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>{c.servicio}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ height:20 }} />
    </>
  )
}
