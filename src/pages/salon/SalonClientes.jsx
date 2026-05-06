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

const SEGMENTO = {
  vip:        { label:'VIP',        color:'#f59e0b', bg:'rgba(245,158,11,0.14)'  },
  recurrente: { label:'Recurrente', color:'#22c55e', bg:'rgba(34,197,94,0.12)'   },
  en_riesgo:  { label:'En riesgo',  color:'#f43f5e', bg:'rgba(244,63,94,0.12)'   },
  inactivo:   { label:'Inactivo',   color:'#94a3b8', bg:'rgba(148,163,184,0.12)' },
  nuevo:      { label:'Nuevo',      color:'#3b82f6', bg:'rgba(59,130,246,0.12)'  },
}

const TIER = {
  oro:    { label:'Oro',    color:'#f59e0b', emoji:'🥇' },
  plata:  { label:'Plata',  color:'#9ca3af', emoji:'🥈' },
  bronce: { label:'Bronce', color:'#cd7f32', emoji:'🥉' },
}

const FILTROS = [
  { key:'todos',      label:'Todos'      },
  { key:'vip',        label:'VIP'        },
  { key:'recurrente', label:'Recurrentes'},
  { key:'en_riesgo',  label:'En riesgo'  },
  { key:'inactivo',   label:'Inactivos'  },
  { key:'nuevo',      label:'Nuevos'     },
]

function SegBadge({ segmento }) {
  const cfg = SEGMENTO[segmento]
  if (!cfg) return null
  return (
    <span style={{
      padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700,
      background: cfg.bg, color: cfg.color, whiteSpace:'nowrap', flexShrink:0,
    }}>
      {cfg.label}
    </span>
  )
}

function cumpleProximo(fechaNac) {
  if (!fechaNac) return false
  const hoy = new Date()
  const cumple = new Date(fechaNac + 'T12:00:00')
  const esteAnio = new Date(hoy.getFullYear(), cumple.getMonth(), cumple.getDate())
  const diff = (esteAnio - hoy) / 86400000
  return diff >= 0 && diff <= 7
}

function fmtCOP(n) {
  if (!n || n <= 0) return '—'
  return '$' + Number(n).toLocaleString('es-CO')
}

export default function SalonClientes() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [clientes,   setClientes]  = useState([])
  const [busq,       setBusq]      = useState('')
  const [loading,    setLoading]   = useState(true)
  const [filtroSeg,  setFiltroSeg] = useState('todos')
  const [sel,        setSel]       = useState(null)
  const [saldo,      setSaldo]     = useState(null)
  const [historial,  setHistorial] = useState([])
  const [loadHist,   setLoadHist]  = useState(false)
  const [elimTarget, setElimTarget] = useState(null)
  const [toast,      setToast]     = useState(null)

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const q = supabase.from('clientes_agenda')
      .select('id, nombre, telefono, email, notas, puntos_fidelizacion, fecha_nacimiento, created_at, num_visitas, total_gastado, ticket_promedio, ultima_visita, segmento')
      .eq('tenant_id', tenant.id)
      .order('nombre')
    if (busq.trim()) q.ilike('nombre', `%${busq}%`)
    const { data } = await q.limit(100)
    setClientes(data || [])
    setLoading(false)
  }, [tenant, busq])

  useEffect(() => { cargar() }, [cargar])

  const clientesFiltrados = filtroSeg === 'todos'
    ? clientes
    : clientes.filter(c => c.segmento === filtroSeg)

  // Conteo por segmento para los filtros
  const conteos = clientes.reduce((acc, c) => {
    acc[c.segmento || 'nuevo'] = (acc[c.segmento || 'nuevo'] || 0) + 1
    return acc
  }, {})

  function showToast(msg, ok = true) {
    setToast({ msg, color: ok ? '#22c55e' : '#ef4444' })
    setTimeout(() => setToast(null), 2500)
  }

  async function eliminarCliente() {
    if (!elimTarget) return
    const id = elimTarget.id
    await supabase.from('lista_espera').delete().eq('cliente_id', id)
    await supabase.from('saldo_puntos').delete().eq('cliente_id', id)
    await supabase.from('citas').delete().eq('cliente_id', id)
    const { error } = await supabase.from('clientes_agenda').delete().eq('id', id)
    if (error) { showToast('Error al eliminar cliente', false); return }
    showToast('Cliente eliminado')
    setElimTarget(null)
    if (sel?.id === id) { setSel(null); setSaldo(null) }
    cargar()
  }

  async function abrirCliente(cli) {
    setSel(cli)
    setSaldo(null)
    setElimConfirm(false)
    setLoadHist(true)
    const [{ data: hist }, { data: sp }] = await Promise.all([
      supabase.from('citas')
        .select('id, fecha_inicio, estado, precio_cobrado, servicios(nombre, precio), profesionales(nombre)')
        .eq('cliente_id', cli.id)
        .order('fecha_inicio', { ascending: false })
        .limit(10),
      supabase.from('saldo_puntos')
        .select('saldo, total_ganado, tier')
        .eq('tenant_id', tenant.id)
        .eq('cliente_id', cli.id)
        .maybeSingle(),
    ])
    setHistorial(hist || [])
    setSaldo(sp || null)
    setLoadHist(false)
  }

  function fmtFecha(iso) {
    return new Date(iso).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' })
  }

  function fmtFechaCorta(iso) {
    return new Date(iso).toLocaleDateString('es-CO', { day:'numeric', month:'short' })
  }

  const ESTADO_COLOR = {
    completada:  '#22c55e', confirmada: '#3b82f6',
    pendiente:   '#f59e0b', cancelada:  '#6b7280', no_asistio: '#f43f5e',
  }

  return (
    <div style={{ padding:'0 0 16px' }}>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {/* Search */}
      <div style={{ padding:'0 16px 12px', position:'sticky', top:0, background:'var(--bg)', zIndex:10, paddingTop:4 }}>
        <div style={{ position:'relative', marginBottom:10 }}>
          <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }}>
            <Ico d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={17} />
          </div>
          <input className="sp-input" placeholder="Buscar cliente…"
            value={busq} onChange={e => setBusq(e.target.value)}
            style={{ paddingLeft:42 }}
          />
        </div>

        {/* Filtros por segmento */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
          {FILTROS.map(f => {
            const activo = filtroSeg === f.key
            const cnt = f.key === 'todos' ? clientes.length : (conteos[f.key] || 0)
            const cfg = SEGMENTO[f.key]
            return (
              <button key={f.key} onClick={() => setFiltroSeg(f.key)}
                style={{
                  flexShrink:0, padding:'5px 11px', borderRadius:8, fontSize:12,
                  fontWeight:700, cursor:'pointer', border:'1px solid',
                  whiteSpace:'nowrap',
                  background: activo ? (cfg ? cfg.bg : `${col}18`) : 'transparent',
                  borderColor: activo ? (cfg ? cfg.color : col) : 'var(--border)',
                  color: activo ? (cfg ? cfg.color : col) : 'var(--text-3)',
                }}>
                {f.label} {cnt > 0 && <span style={{ opacity:0.7 }}>· {cnt}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="sp-skeleton" style={{ height:72, borderRadius:16 }} />
          ))}
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">👥</span>
          <p className="sp-empty-title">Sin clientes</p>
          <p className="sp-empty-sub">
            {busq ? 'No se encontraron resultados' : filtroSeg !== 'todos' ? `Sin clientes ${SEGMENTO[filtroSeg]?.label?.toLowerCase()}s` : 'Aún no hay clientes registrados'}
          </p>
        </div>
      ) : (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:8 }}>
          {clientesFiltrados.map((c, i) => {
            const color = COLORS[i % COLORS.length]
            const cumple = cumpleProximo(c.fecha_nacimiento)
            return (
              <div key={c.id} onClick={() => abrirCliente(c)}
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
                  <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:2, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    {c.nombre}
                    {cumple && <span title="Cumpleaños próximo">🎂</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-3)', display:'flex', gap:8, alignItems:'center' }}>
                    {c.num_visitas > 0
                      ? <span>{c.num_visitas} visita{c.num_visitas !== 1 ? 's' : ''} · {fmtCOP(c.ticket_promedio)} ticket</span>
                      : <span>{c.telefono || c.email || 'Sin contacto'}</span>
                    }
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                  <SegBadge segmento={c.segmento} />
                  {c.puntos_fidelizacion > 0 && (
                    <span style={{
                      padding:'2px 7px', borderRadius:6, background:`${col}20`,
                      fontSize:11, fontWeight:700, color:col,
                    }}>
                      ⭐ {c.puntos_fidelizacion}
                    </span>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); setElimTarget(c) }}
                  title="Eliminar cliente"
                  style={{
                    width:34, height:34, borderRadius:10, border:'1px solid rgba(239,68,68,0.25)',
                    background:'transparent', color:'#ef4444', cursor:'pointer', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                  <Ico d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" size={15} />
                </button>
              </div>
            )
          })}
        </div>
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
                Se borrarán todas sus citas e historial.<br />Esta acción es irreversible.
              </p>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setElimTarget(null)} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'var(--surface)', border:'1px solid var(--border)',
                color:'var(--text-2)', fontWeight:600, fontSize:14,
              }}>Cancelar</button>
              <button onClick={eliminarCliente} style={{
                flex:1, padding:'14px', borderRadius:14, cursor:'pointer',
                background:'#ef4444', border:'none', color:'#fff', fontWeight:700, fontSize:14,
              }}>Sí, eliminar</button>
            </div>
          </div>
        </>
      )}

      {/* Sheet detalle cliente */}
      {sel && (
        <>
          <div className="sp-sheet-overlay" onClick={() => { setSel(null); setSaldo(null) }} />
          <div className="sp-sheet">
            <div className="sp-sheet-handle" />

            {/* Avatar + nombre + segmento */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
              <div style={{
                width:56, height:56, borderRadius:18, background:`${col}25`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Outfit', fontWeight:800, fontSize:24, color:col,
              }}>
                {sel.nombre[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:'var(--text)' }}>{sel.nombre}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                  <SegBadge segmento={sel.segmento} />
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>
                    desde {fmtFecha(sel.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats LTV */}
            {sel.num_visitas >= 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                {[
                  { label:'Visitas',   value: sel.num_visitas || 0             },
                  { label:'Gastado',   value: fmtCOP(sel.total_gastado)        },
                  { label:'Ticket',    value: fmtCOP(sel.ticket_promedio)      },
                ].map(s => (
                  <div key={s.label} style={{
                    background:'var(--card)', border:'1px solid var(--border)',
                    borderRadius:12, padding:'10px 12px', textAlign:'center',
                  }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', fontFamily:'Outfit' }}>{s.value}</div>
                    <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, letterSpacing:0.3, marginTop:2 }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Info de contacto */}
            <div style={{
              background:'var(--card)', border:'1px solid var(--border)',
              borderRadius:16, padding:'14px 16px', marginBottom:14,
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
              {sel.ultima_visita && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" size={16} />
                  Última visita: {fmtFecha(sel.ultima_visita)}
                </div>
              )}
              {saldo && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14 }}>
                  <span style={{ fontSize:18 }}>{TIER[saldo.tier]?.emoji || '⭐'}</span>
                  <div>
                    <span style={{ fontWeight:700, color: TIER[saldo.tier]?.color || '#f59e0b' }}>
                      {TIER[saldo.tier]?.label || 'Bronce'}
                    </span>
                    <span style={{ color:'var(--text-3)', marginLeft:6 }}>
                      · {saldo.saldo} pts disponibles · {saldo.total_ganado} ganados
                    </span>
                  </div>
                </div>
              )}
              {sel.fecha_nacimiento && (
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text-2)' }}>
                  <span style={{ fontSize:16 }}>🎂</span>
                  {new Date(sel.fecha_nacimiento + 'T12:00:00').toLocaleDateString('es-CO', { day:'numeric', month:'long' })}
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
                  width:'100%', padding:'14px', borderRadius:14, marginBottom:14,
                  background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.25)',
                  color:'#4ade80', fontWeight:700, fontSize:14, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  fontFamily:'Plus Jakarta Sans',
                }}>
                <Ico d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" size={16} />
                Enviar mensaje
              </button>
            )}

            {/* Eliminar cliente */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginBottom:14 }}>
              <button onClick={() => { setElimTarget(sel); setSel(null); setSaldo(null) }} style={{
                width:'100%', padding:'12px', borderRadius:14, cursor:'pointer',
                background:'transparent', border:'1px solid rgba(239,68,68,0.35)',
                color:'#ef4444', fontFamily:'Outfit', fontWeight:600, fontSize:14,
              }}>
                Eliminar cliente
              </button>
            </div>

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
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{
                          width:7, height:7, borderRadius:'50%', flexShrink:0,
                          background: ESTADO_COLOR[c.estado] || '#6b7280',
                          display:'inline-block',
                        }} />
                        <span style={{ fontSize:11, color:'var(--text-3)' }}>
                          {fmtFechaCorta(c.fecha_inicio)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3 }}>
                      {c.profesionales?.nombre?.split(' ')[0] || '—'}
                      {c.precio_cobrado > 0 ? ` · $${Number(c.precio_cobrado).toLocaleString('es-CO')}` : ''}
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
