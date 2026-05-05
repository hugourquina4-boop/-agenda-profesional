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

const PERIODOS = [
  { key:'hoy',    label:'Hoy' },
  { key:'semana', label:'Semana' },
  { key:'mes',    label:'Mes' },
]

function rango(key) {
  const hoy = new Date()
  const desde = new Date(hoy)
  if (key === 'semana') desde.setDate(hoy.getDate() - 6)
  if (key === 'mes')    desde.setDate(1)
  return {
    desde: desde.toISOString().slice(0,10) + 'T00:00:00',
    hasta: hoy.toISOString().slice(0,10) + 'T23:59:59',
  }
}

function fmtCOP(n) {
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n/1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

export default function SalonCaja() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [periodo,  setPeriodo]  = useState('hoy')
  const [citas,    setCitas]    = useState([])
  const [loading,  setLoading]  = useState(true)

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const { desde, hasta } = rango(periodo)
    const { data } = await supabase
      .from('citas')
      .select('id, fecha_inicio, estado, servicios(nombre, precio), profesionales(nombre), clientes_agenda(nombre)')
      .eq('tenant_id', tenant.id)
      .eq('estado', 'completada')
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)
      .order('fecha_inicio', { ascending: false })
    setCitas(data || [])
    setLoading(false)
  }, [tenant, periodo])

  useEffect(() => { cargar() }, [cargar])

  const total = citas.reduce((s, c) => s + (c.servicios?.precio || 0), 0)

  // Top servicios
  const porServicio = {}
  citas.forEach(c => {
    const k = c.servicios?.nombre || 'Sin servicio'
    if (!porServicio[k]) porServicio[k] = { count:0, total:0 }
    porServicio[k].count++
    porServicio[k].total += c.servicios?.precio || 0
  })
  const topServs = Object.entries(porServicio).sort((a,b) => b[1].total - a[1].total).slice(0,5)

  // Top profesionales
  const porProf = {}
  citas.forEach(c => {
    const k = c.profesionales?.nombre || 'Sin profesional'
    if (!porProf[k]) porProf[k] = { count:0, total:0 }
    porProf[k].count++
    porProf[k].total += c.servicios?.precio || 0
  })
  const topProfs = Object.entries(porProf).sort((a,b) => b[1].total - a[1].total)

  return (
    <div style={{ padding:'0 16px 16px' }}>
      {/* Selector de periodo */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {PERIODOS.map(p => (
          <button key={p.key} onClick={() => setPeriodo(p.key)} style={{
            flex:1, padding:'10px 0', borderRadius:12, cursor:'pointer', border:'none',
            background: periodo === p.key ? col : 'var(--card)',
            color: periodo === p.key ? '#fff' : 'var(--text-2)',
            fontWeight:700, fontSize:13,
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:80, borderRadius:16 }} />)}
        </div>
      ) : (
        <>
          {/* KPI principal */}
          <div style={{
            padding:'24px 20px', borderRadius:20, marginBottom:16,
            background:`linear-gradient(135deg, ${col}cc, ${col}66)`,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', right:-20, top:-20, width:120, height:120,
              borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase',
              color:'rgba(255,255,255,0.6)', marginBottom:6 }}>
              Ingresos · {PERIODOS.find(p=>p.key===periodo)?.label}
            </p>
            <p style={{ fontFamily:'Outfit', fontSize:40, fontWeight:900, color:'#fff', lineHeight:1 }}>
              {fmtCOP(total)}
            </p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginTop:6 }}>
              {citas.length} servicio{citas.length !== 1 ? 's' : ''} completado{citas.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Top servicios */}
          {topServs.length > 0 && (
            <>
              <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:10 }}>
                Por servicio
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                {topServs.map(([nombre, datos]) => {
                  const pct = total > 0 ? datos.total / total : 0
                  return (
                    <div key={nombre} style={{
                      padding:'14px 16px', borderRadius:14,
                      background:'var(--card)', border:'1px solid var(--border)',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{nombre}</span>
                        <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:14, color:col }}>
                          {fmtCOP(datos.total)}
                        </span>
                      </div>
                      <div style={{ height:4, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:2, background:col, width:`${pct*100}%`, transition:'width 0.6s' }} />
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
                        {datos.count} vez{datos.count !== 1 ? 'es' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Top profesionales */}
          {topProfs.length > 0 && (
            <>
              <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:10 }}>
                Por profesional
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                {topProfs.map(([nombre, datos]) => (
                  <div key={nombre} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'13px 16px', borderRadius:14,
                    background:'var(--card)', border:'1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{nombre.split(' ')[0]}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)' }}>{datos.count} servicio{datos.count !== 1 ? 's' : ''}</div>
                    </div>
                    <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:16, color:col }}>
                      {fmtCOP(datos.total)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Detalle de citas */}
          {citas.length > 0 && (
            <>
              <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:10 }}>
                Detalle
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {citas.map(c => (
                  <div key={c.id} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 14px', borderRadius:12,
                    background:'var(--card)', border:'1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>
                        {c.clientes_agenda?.nombre || '—'}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-3)' }}>
                        {c.servicios?.nombre || '—'} · {new Date(c.fecha_inicio).toLocaleDateString('es-CO', { day:'numeric', month:'short' })}
                      </div>
                    </div>
                    {c.servicios?.precio > 0 && (
                      <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:14, color:'var(--text)' }}>
                        ${Number(c.servicios.precio).toLocaleString('es-CO')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {citas.length === 0 && (
            <div className="sp-empty">
              <span className="sp-empty-icon">💰</span>
              <p className="sp-empty-title">Sin ingresos</p>
              <p className="sp-empty-sub">No hay servicios completados en este período</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
