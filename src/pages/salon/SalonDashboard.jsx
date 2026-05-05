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

export default function SalonDashboard() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'
  const isDemo = !tenant

  const [citas,       setCitas]       = useState(isDemo ? DEMO_CITAS  : [])
  const [equipo,      setEquipo]      = useState(isDemo ? DEMO_EQUIPO : [])
  const [ingresosHoy, setIngresosHoy] = useState(isDemo ? 235000 : 0)
  const [loading,     setLoading]     = useState(!isDemo)
  const [toast,       setToast]       = useState(null)

  const showToast = (msg, color='#22c55e') => {
    setToast({msg,color})
    setTimeout(() => setToast(null), 2800)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    try {
      const fecha = hoy()
      const [citasRes, equipoRes] = await Promise.all([
        supabase.from('citas')
          .select('id,fecha_inicio,fecha_fin,estado,clientes_agenda(nombre,telefono),servicios(nombre,precio,duracion_min),profesionales(id,nombre,foto_url)')
          .eq('tenant_id', tenant.id)
          .gte('fecha_inicio', `${fecha}T00:00:00`).lte('fecha_inicio', `${fecha}T23:59:59`).order('fecha_inicio'),
        supabase.from('profesionales')
          .select('id,nombre,foto_url,especialidad,activo')
          .eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
      ])
      const citasList  = citasRes.data  || []
      const equipoList = equipoRes.data || []
      const ingresos = citasList.filter(c=>c.estado==='completada')
        .reduce((s,c) => s+(c.servicios?.precio||0), 0)
      setCitas(citasList)
      setEquipo(equipoList)
      setIngresosHoy(ingresos)
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
        <div style={{
          margin:'16px 16px 0', padding:'10px 16px', borderRadius:12,
          background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)',
          fontSize:12, color:'#fbbf24', fontWeight:600,
          display:'flex', alignItems:'center', gap:8,
        }}>
          <Ico d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={15} />
          Modo demo — datos de ejemplo. Conecta Supabase para ver tu negocio real.
        </div>
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

      {/* ── Link portal público ─────────────────────────── */}
      {tenant?.slug && (
        <div style={{ margin:'0 16px 4px' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:16,
            background:`${col}10`, border:`1px solid ${col}30`,
          }}>
            <div style={{ width:38, height:38, borderRadius:12, background:`${col}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Ico d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" size={18} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Portal de reservas</div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                /reservar/{tenant.slug}
              </div>
            </div>
            <button
              onClick={() => {
                const url = `${window.location.origin}/reservar/${tenant.slug}`
                navigator.clipboard?.writeText(url)
                  .then(() => setToast({ msg:'Link copiado', color:'#22c55e' }))
                setTimeout(() => setToast(null), 2000)
              }}
              style={{ padding:'8px 14px', borderRadius:10, border:`1px solid ${col}40`, background:`${col}18`, color:col, fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
              Copiar
            </button>
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
                        WhatsApp
                      </button>
                      {canDone && (
                        <button className="sp-tl-action ok" onClick={()=>marcarCompletada(cita.id)}>
                          <Ico d="M5 13l4 4L19 7" size={13} />
                          Completar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ height:20 }} />
    </>
  )
}
