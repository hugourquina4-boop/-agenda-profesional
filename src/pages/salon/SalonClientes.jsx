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

const COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']

function cumpleProximo(fechaNac) {
  if (!fechaNac) return false
  const hoy = new Date()
  const cumple = new Date(fechaNac + 'T12:00:00')
  const esteAnio = new Date(hoy.getFullYear(), cumple.getMonth(), cumple.getDate())
  const diff = (esteAnio - hoy) / 86400000
  return diff >= 0 && diff <= 7
}

export default function SalonClientes() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [clientes, setClientes]   = useState([])
  const [busq,     setBusq]       = useState('')
  const [loading,  setLoading]    = useState(true)
  const [sel,      setSel]        = useState(null)
  const [historial,setHistorial]  = useState([])
  const [loadHist, setLoadHist]   = useState(false)

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const q = supabase.from('clientes_agenda')
      .select('id, nombre, telefono, email, notas, puntos_fidelizacion, fecha_nacimiento, created_at')
      .eq('tenant_id', tenant.id)
      .order('nombre')
    if (busq.trim()) q.ilike('nombre', `%${busq}%`)
    const { data } = await q.limit(50)
    setClientes(data || [])
    setLoading(false)
  }, [tenant, busq])

  useEffect(() => { cargar() }, [cargar])

  async function abrirCliente(cli) {
    setSel(cli)
    setLoadHist(true)
    const { data } = await supabase
      .from('citas')
      .select('id, fecha_inicio, estado, servicios(nombre, precio), profesionales(nombre)')
      .eq('cliente_id', cli.id)
      .order('fecha_inicio', { ascending: false })
      .limit(10)
    setHistorial(data || [])
    setLoadHist(false)
  }

  function fmtFecha(iso) {
    return new Date(iso).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' })
  }

  return (
    <div style={{ padding:'0 0 16px' }}>

      {/* Search */}
      <div style={{ padding:'0 16px 16px', position:'sticky', top:0, background:'var(--bg)', zIndex:10, paddingTop:4 }}>
        <div style={{ position:'relative' }}>
          <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={17} />
          </div>
          <input className="sp-input" placeholder="Buscar cliente…"
            value={busq} onChange={e => setBusq(e.target.value)}
            style={{ paddingLeft:42 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="sp-skeleton" style={{ height:70, borderRadius:16 }} />
          ))}
        </div>
      ) : clientes.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">👥</span>
          <p className="sp-empty-title">Sin clientes</p>
          <p className="sp-empty-sub">{busq ? 'No se encontraron resultados' : 'Aún no hay clientes registrados'}</p>
        </div>
      ) : (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:8 }}>
          {clientes.map((c, i) => {
            const color = COLORS[i % COLORS.length]
            const cumple = cumpleProximo(c.fecha_nacimiento)
            return (
              <button key={c.id} onClick={() => abrirCliente(c)}
                style={{
                  width:'100%', display:'flex', alignItems:'center', gap:14,
                  padding:'14px 16px', borderRadius:16, cursor:'pointer', textAlign:'left',
                  background:'var(--card)', border:`1px solid ${cumple ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`,
                  transition:'all 0.15s',
                }}>
                <div style={{
                  width:46, height:46, borderRadius:14, background:`${color}25`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'Outfit', fontWeight:800, fontSize:20, color, flexShrink:0,
                }}>
                  {c.nombre[0]}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:2, display:'flex', alignItems:'center', gap:6 }}>
                    {c.nombre}
                    {cumple && <span title="Cumpleaños próximo">🎂</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>
                    {c.telefono || c.email || 'Sin contacto'}
                  </div>
                </div>
                {c.puntos_fidelizacion > 0 && (
                  <div style={{
                    padding:'4px 10px', borderRadius:8, background:`${col}20`,
                    fontSize:12, fontWeight:700, color:col,
                  }}>
                    ⭐ {c.puntos_fidelizacion}
                  </div>
                )}
                <Ico d="M9 5l7 7-7 7" size={16} />
              </button>
            )
          })}
        </div>
      )}

      {/* Sheet detalle cliente */}
      {sel && (
        <>
          <div className="sp-sheet-overlay" onClick={() => setSel(null)} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />

            {/* Avatar + nombre */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
              <div style={{
                width:56, height:56, borderRadius:18, background:`${col}25`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Outfit', fontWeight:800, fontSize:24, color:col,
              }}>
                {sel.nombre[0]}
              </div>
              <div>
                <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>{sel.nombre}</div>
                <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2 }}>
                  Cliente desde {fmtFecha(sel.created_at)}
                </div>
              </div>
            </div>

            {/* Info */}
            <div style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:16, padding:'14px 16px', marginBottom:16,
              display:'flex', flexDirection:'column', gap:10,
            }}>
              {sel.telefono && (
                <a href={`tel:${sel.telefono}`} style={{
                  display:'flex', alignItems:'center', gap:10,
                  fontSize:14, color:'var(--text-2)', textDecoration:'none',
                }}>
                  <Ico d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" size={16} />
                  {sel.telefono}
                </a>
              )}
              {sel.email && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <Ico d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" size={16} />
                  {sel.email}
                </div>
              )}
              {sel.puntos_fidelizacion > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'#fbbf24' }}>
                  <Ico d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" size={16} />
                  {sel.puntos_fidelizacion} puntos de fidelización
                </div>
              )}
              {sel.fecha_nacimiento && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <span style={{ fontSize:16 }}>🎂</span>
                  Cumpleaños: {new Date(sel.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-CO', { day:'numeric', month:'long' })}
                  {cumpleProximo(sel.fecha_nacimiento) && (
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:6,
                      background:'rgba(251,191,36,0.15)', color:'#fbbf24' }}>Próximo</span>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp CTA */}
            {sel.telefono && (
              <button onClick={() => window.open(`https://wa.me/${sel.telefono.replace(/\D/g,'')}`, '_blank')}
                style={{
                  width:'100%', padding:'14px', borderRadius:14, marginBottom:16,
                  background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)',
                  color:'#4ade80', fontWeight:700, fontSize:14, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  fontFamily:'Plus Jakarta Sans',
                }}>
                <Ico d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" size={16} />
                Enviar mensaje
              </button>
            )}

            {/* Historial */}
            <p style={{ fontFamily:'Outfit', fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:12 }}>
              Historial de citas
            </p>
            {loadHist ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[1,2,3].map(i => <div key={i} className="sp-skeleton" style={{ height:56, borderRadius:12 }} />)}
              </div>
            ) : historial.length === 0 ? (
              <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>Sin citas anteriores</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {historial.map(c => (
                  <div key={c.id} style={{
                    padding:'12px 14px', borderRadius:12,
                    background:'var(--card)', border:'1px solid var(--border)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>
                        {c.servicios?.nombre || '—'}
                      </span>
                      <span style={{ fontSize:11, color:'var(--text-3)' }}>
                        {new Date(c.fecha_inicio).toLocaleDateString('es-CO', { day:'numeric', month:'short' })}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3 }}>
                      {c.profesionales?.nombre?.split(' ')[0] || '—'}
                      {c.servicios?.precio > 0 ? ` · $${Number(c.servicios.precio).toLocaleString('es-CO')}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
