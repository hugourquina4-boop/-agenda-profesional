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
          padding:'7px 12px', borderRadius:9, border:'1px solid var(--border)',
          background:'transparent', color:'var(--text-2)', fontSize:12, fontWeight:700,
          cursor:'pointer', whiteSpace:'nowrap', textDecoration:'none',
          display:'flex', alignItems:'center',
        }}>
          Ver
        </a>
      </div>
    </div>
  )
}

export default function SalonDashboard({ onNavigate }) {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'
  const isDemo = !tenant

  const [citas,       setCitas]       = useState(isDemo ? DEMO_CITAS  : [])
  const [equipo,      setEquipo]      = useState(isDemo ? DEMO_EQUIPO : [])
  const [ingresosHoy, setIngresosHoy] = useState(isDemo ? 235000 : 0)
  const [loading,     setLoading]     = useState(!isDemo)
  const [stockAlertas,   setStockAlertas]   = useState(0)
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

      const [citasRes, equipoRes, stockRes, servRes, gastosRes, ingresosMesRes, citasMananaRes, cumplRes] = await Promise.all([
        supabase.from('citas')
          .select('id,fecha_inicio,fecha_fin,estado,clientes_agenda(nombre,telefono),servicios(nombre,precio,duracion_min),profesionales(id,nombre,foto_url)')
          .eq('tenant_id', tenant.id)
          .gte('fecha_inicio', `${fecha}T00:00:00`).lte('fecha_inicio', `${fecha}T23:59:59`).order('fecha_inicio'),
        supabase.from('profesionales')
          .select('id,nombre,foto_url,especialidad,activo')
          .eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
        supabase.from('productos_salon')
          .select('id,stock,stock_minimo')
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
          .select('id,nombre,telefono')
          .eq('tenant_id', tenant.id).eq('activo', true)
          .like('fecha_nacimiento', `%-${fecha.slice(5)}`),
      ])
      const citasList  = citasRes.data  || []
      const equipoList = equipoRes.data || []
      const ingresos = citasList.filter(c=>c.estado==='completada')
        .reduce((s,c) => s+(c.servicios?.precio||0), 0)
      const alertas = (stockRes.data || []).filter(p => p.stock <= p.stock_minimo).length
      const totalGastos   = (gastosRes.data || []).reduce((s,g) => s + Number(g.monto), 0)
      const totalIngresos = (ingresosMesRes.data || []).reduce((s,p) => s + Number(p.monto), 0)
      setCitas(citasList)
      setEquipo(equipoList)
      setIngresosHoy(ingresos)
      setStockAlertas(alertas)
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
    } catch(e) {
      console.error('[SalonDashboard]', e)
    } finally {
      setLoading(false)
    }
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

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

      {/* ── Alerta cumpleaños ────────────────────────────── */}
      {cumpleaneros.length > 0 && (
        <div className="sp-alert rose" style={{ marginTop:16 }}>
          <span style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>🎂</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
              {cumpleaneros.length === 1
                ? `¡Hoy es el cumpleaños de ${cumpleaneros[0].nombre}!`
                : `¡${cumpleaneros.length} clientes cumplen años hoy!`}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {cumpleaneros.map(c => {
                const tel = c.telefono?.replace(/\D/g,'')
                const msg = encodeURIComponent(`¡Feliz cumpleaños ${c.nombre.split(' ')[0]}! 🎉 En ${tenant?.nombre || 'el salón'} te deseamos un día increíble. ¡Queremos celebrarlo contigo — tienes un descuento especial hoy! 💅`)
                return tel ? (
                  <a key={c.id} href={`https://wa.me/57${tel}?text=${msg}`} target="_blank" rel="noopener noreferrer"
                    style={{
                      fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:7,
                      background:'rgba(236,72,153,0.12)', border:'1px solid rgba(236,72,153,0.35)',
                      color:'#ec4899', textDecoration:'none', whiteSpace:'nowrap',
                    }}>
                    🎁 WA {cumpleaneros.length > 1 ? c.nombre.split(' ')[0] : 'Saludar'}
                  </a>
                ) : (
                  <span key={c.id} style={{ fontSize:11, color:'var(--text-3)' }}>{c.nombre}</span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Onboarding: primer acceso con salón vacío ── */}
      {!isDemo && serviciosCount === 0 && equipo.length === 0 && (
        <div style={{
          margin:'16px 16px 0', borderRadius:18,
          background:`linear-gradient(135deg,${col}12,${col}06)`,
          border:`1px solid ${col}30`, overflow:'hidden',
        }}>
          <div style={{ padding:'20px 20px 4px' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', marginBottom:4 }}>
              🎉 ¡Bienvenido a Salón Pro!
            </div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>
              Configura tu salón en 3 pasos para empezar a recibir reservas.
            </div>
          </div>
          {[
            {
              num:1, label:'Agrega tus servicios', done: false,
              icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
              page:'servicios', desc:'Cortes, tintes, tratamientos…',
            },
            {
              num:2, label:'Agrega tu equipo', done: false,
              icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
              page:'equipo', desc:'Profesionales y sus horarios.',
            },
            {
              num:3, label:'Comparte tu link de reservas', done: false,
              icon:'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
              page:'config', desc:'QR + link en Configuración.',
            },
          ].map((step, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 20px',
              borderTop: i === 0 ? `1px solid ${col}20` : `1px solid ${col}15`,
            }}>
              <div style={{
                width:28, height:28, borderRadius:8, flexShrink:0,
                background:`${col}20`, display:'flex', alignItems:'center',
                justifyContent:'center', color:col,
              }}>
                <Ico d={step.icon} size={14} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{step.label}</div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>{step.desc}</div>
              </div>
              <div style={{
                fontSize:11, fontWeight:700, color:col,
                padding:'5px 12px', borderRadius:8,
                background:`${col}15`, border:`1px solid ${col}30`,
                cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
              }}
                onClick={() => onNavigate?.(step.page)}>
                Ir →
              </div>
            </div>
          ))}
          <div style={{ height:8 }} />
        </div>
      )}

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

      {/* ── Alerta stock bajo ───────────────────────────── */}
      {stockAlertas > 0 && (
        <div className="sp-alert warn" style={{ marginBottom:4 }}>
          <Ico d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" size={18} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
              {stockAlertas} producto{stockAlertas !== 1 ? 's' : ''} bajo stock mínimo
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
              Revisa el módulo de Inventario
            </div>
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

                <div className="sp-tl-card">
                  <div className="sp-tl-card-accent" style={{ background:profColor }} />
                  <div style={{ paddingLeft:8 }}>
                    <div className="sp-tl-top">
                      <span className="sp-tl-client">{cita.clientes_agenda?.nombre||'Cliente'}</span>
                      <span className="sp-tl-badge" style={{ background:est.bg, color:est.color }}>{est.label}</span>
                    </div>
                    <p className="sp-tl-service">{cita.servicios?.nombre||'Servicio'}</p>
                    <div className="sp-tl-meta">
                      <span className="sp-tl-meta-item">
                        <Ico d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" size={13} />
                        {cita.profesionales?.nombre?.split(' ')[0]||'—'}
                      </span>
                      {cita.servicios?.duracion_min && (
                        <span className="sp-tl-meta-item">
                          <Ico d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" size={13} />
                          {cita.servicios.duracion_min}min
                        </span>
                      )}
                      {cita.servicios?.precio && (
                        <span className="sp-tl-meta-item">
                          <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} />
                          {fmtCOP(cita.servicios.precio)}
                        </span>
                      )}
                    </div>
                    <div className="sp-tl-actions">
                      <button className="sp-tl-action wa" onClick={()=>enviarWA(cita)}>
                        <Ico d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" size={13} />
                        WA
                      </button>
                      {canDone && (
                        <button className="sp-tl-action ok"
                          onClick={() => setCobrando(cobrando?.citaId===cita.id ? null : { citaId:cita.id, metodo:'efectivo' })}>
                          <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={13} />
                          {fmtCOP(cita.servicios?.precio||0)}
                        </button>
                      )}
                    </div>
                    {cobrando?.citaId === cita.id && (
                      <div style={{
                        marginTop:10, padding:'12px 14px', borderRadius:14,
                        background:`linear-gradient(135deg, ${col}10, ${col}05)`,
                        boxShadow:`0 4px 20px ${col}12`,
                        display:'flex', flexDirection:'column', gap:10,
                      }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', marginBottom:2 }}>
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
                          <button onClick={() => registrarCobro(cita, cobrando.metodo)} style={{
                            flex:2, padding:'8px', borderRadius:9, cursor:'pointer',
                            background:`linear-gradient(135deg, ${col}, ${col}cc)`,
                            border:'none', color:'#fff', fontWeight:700, fontSize:13,
                            boxShadow:`0 4px 16px ${col}40`,
                          }}>✓ Cobrar</button>
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
