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

function fmtCOP(n) {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const PROF_COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']

/* ── Demo data ─────────────────────────────────────────────────────── */
const DEMO_PROFESIONALES = [
  { id:'p1', nombre:'Valentina Cruz',  especialidad:'Colorista & Estilista' },
  { id:'p2', nombre:'Carlos Herrera',  especialidad:'Barbero & Estilista'   },
  { id:'p3', nombre:'Isabella Torres', especialidad:'Manicurista'           },
]
const DEMO_RULES = {
  p1: { id:'r1', porcentaje:45 },
  p2: { id:'r2', porcentaje:40 },
  p3: { id:'r3', porcentaje:35 },
}
const DEMO_COMISIONES = [
  { id:'c1', profesional_id:'p1', monto_servicio:180000, monto_comision:81000,  liquidado:false, created_at:'2026-04-20T09:00:00' },
  { id:'c2', profesional_id:'p2', monto_servicio:55000,  monto_comision:22000,  liquidado:false, created_at:'2026-04-21T10:00:00' },
  { id:'c3', profesional_id:'p1', monto_servicio:220000, monto_comision:99000,  liquidado:false, created_at:'2026-04-22T11:00:00' },
  { id:'c4', profesional_id:'p3', monto_servicio:60000,  monto_comision:21000,  liquidado:false, created_at:'2026-04-23T12:00:00' },
  { id:'c5', profesional_id:'p2', monto_servicio:90000,  monto_comision:36000,  liquidado:false, created_at:'2026-04-24T14:00:00' },
]

export default function SalonComisiones() {
  const { tenant } = useTenant()
  const isDemo = !tenant
  const col = tenant?.color_primario || '#f43f5e'

  const [profesionales, setProfesionales] = useState(isDemo ? DEMO_PROFESIONALES : [])
  const [rules,         setRules]         = useState(isDemo ? DEMO_RULES         : {})
  const [comisiones,    setComisiones]    = useState(isDemo ? DEMO_COMISIONES    : [])
  const [loading,       setLoading]       = useState(!isDemo)
  const [saving,        setSaving]        = useState(null) // profesional_id siendo guardado
  const [liquidando,    setLiquidando]    = useState(false)
  const [editPct,       setEditPct]       = useState({})  // { [profId]: string }
  const [toast,         setToast]         = useState(null)
  const [seleccionados, setSeleccionados] = useState(new Set())

  const showToast = (msg, color = '#22c55e') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2800)
  }

  const cargar = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    try {
      const [profRes, rulesRes, comRes] = await Promise.all([
        supabase.from('profesionales').select('id,nombre,especialidad').eq('tenant_id', tenant.id).eq('activo', true).order('nombre'),
        supabase.from('commission_rules').select('*').eq('tenant_id', tenant.id).eq('activo', true),
        supabase.from('comisiones').select('*').eq('tenant_id', tenant.id).eq('liquidado', false).order('created_at', { ascending: false }),
      ])
      setProfesionales(profRes.data || [])
      const rulesMap = {}
      for (const r of (rulesRes.data || [])) rulesMap[r.profesional_id] = r
      setRules(rulesMap)
      setComisiones(comRes.data || [])
    } catch (e) {
      console.error('[SalonComisiones]', e)
    } finally {
      setLoading(false)
    }
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  async function guardarPorcentaje(profId) {
    const pct = parseFloat(editPct[profId])
    if (isNaN(pct) || pct < 0 || pct > 100) { showToast('Porcentaje inválido (0-100)', '#f87171'); return }
    if (isDemo) { showToast('Demo — conecta Supabase para guardar', '#f59e0b'); return }
    setSaving(profId)
    const existente = rules[profId]
    if (existente) {
      await supabase.from('commission_rules').update({ porcentaje: pct }).eq('id', existente.id)
    } else {
      await supabase.from('commission_rules').insert({ tenant_id: tenant.id, profesional_id: profId, porcentaje: pct })
    }
    setSaving(null)
    setEditPct(p => { const n = { ...p }; delete n[profId]; return n })
    showToast('Comisión guardada ✓')
    cargar()
  }

  async function liquidarSeleccionados() {
    if (seleccionados.size === 0) { showToast('Selecciona comisiones a liquidar', '#f59e0b'); return }
    if (isDemo) { showToast('Demo — conecta Supabase para guardar', '#f59e0b'); return }
    setLiquidando(true)
    const ids = [...seleccionados]
    await supabase.from('comisiones')
      .update({ liquidado: true, fecha_liquidacion: new Date().toISOString().slice(0,10) })
      .in('id', ids)
    setSeleccionados(new Set())
    showToast(`${ids.length} comisión${ids.length > 1 ? 'es' : ''} liquidada${ids.length > 1 ? 's' : ''} ✓`)
    setLiquidando(false)
    cargar()
  }

  // Agrupar comisiones pendientes por profesional
  const pendientesPorProf = {}
  for (const c of comisiones) {
    if (!pendientesPorProf[c.profesional_id]) pendientesPorProf[c.profesional_id] = []
    pendientesPorProf[c.profesional_id].push(c)
  }

  const totalSeleccionado = comisiones
    .filter(c => seleccionados.has(c.id))
    .reduce((s, c) => s + (c.monto_comision || 0), 0)

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
      <div className="sp-spinner" style={{ borderTopColor:col }} />
    </div>
  )

  return (
    <>
      {toast && <div className="sp-toast show" style={{ background:toast.color }}>{toast.msg}</div>}

      {isDemo && (
        <div style={{ margin:'16px 16px 0', padding:'10px 16px', borderRadius:12,
          background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)',
          fontSize:12, color:'#fbbf24', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
          <Ico d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={15} />
          Modo demo — datos de ejemplo
        </div>
      )}

      {/* ── Sección 1: Configurar porcentajes ─────────────── */}
      <div className="sp-section" style={{ marginTop:20 }}>
        <span className="sp-section-title">Configurar comisiones</span>
      </div>

      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
        {profesionales.map((prof, i) => {
          const color   = PROF_COLORS[i % PROF_COLORS.length]
          const rule    = rules[prof.id]
          const pctBase = rule?.porcentaje ?? 0
          const editing = editPct[prof.id] !== undefined
          const valor   = editing ? editPct[prof.id] : String(pctBase)

          return (
            <div key={prof.id} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'14px 16px', borderRadius:16,
              background:'var(--card)', border:'1px solid var(--border)',
            }}>
              <div style={{ width:42, height:42, borderRadius:12, background:`${color}22`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Outfit', fontWeight:800, fontSize:16, color, flexShrink:0 }}>
                {prof.nombre[0]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
                  {prof.nombre.split(' ')[0]}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:500 }}>
                  {prof.especialidad || '—'}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={valor}
                    onChange={e => setEditPct(p => ({ ...p, [prof.id]: e.target.value }))}
                    style={{
                      width:68, padding:'8px 28px 8px 10px', borderRadius:10,
                      border:`1px solid ${editing ? col : 'var(--border)'}`,
                      background:'var(--bg)', color:'var(--text)',
                      fontSize:14, fontWeight:700, fontFamily:'Outfit',
                      outline:'none', appearance:'textfield',
                    }}
                  />
                  <span style={{ position:'absolute', right:8, fontSize:12,
                    color:'var(--text-3)', pointerEvents:'none', fontWeight:600 }}>%</span>
                </div>
                {editing && (
                  <button
                    onClick={() => guardarPorcentaje(prof.id)}
                    disabled={saving === prof.id}
                    style={{
                      padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer',
                      background:col, color:'#fff', fontWeight:700, fontSize:13, fontFamily:'Outfit',
                      opacity: saving === prof.id ? 0.7 : 1,
                    }}>
                    {saving === prof.id ? '…' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Sección 2: Liquidación pendiente ──────────────── */}
      <div className="sp-section" style={{ marginTop:24 }}>
        <span className="sp-section-title">Pendiente de liquidar</span>
        {comisiones.length > 0 && (
          <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>
            {comisiones.length} registro{comisiones.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {comisiones.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">✓</span>
          <p className="sp-empty-title">Todo liquidado</p>
          <p className="sp-empty-sub">No hay comisiones pendientes de pago</p>
        </div>
      ) : (
        <>
          {/* Barra de acción flotante cuando hay seleccionados */}
          {seleccionados.size > 0 && (
            <div style={{
              margin:'0 16px 12px', padding:'12px 16px', borderRadius:14,
              background:`${col}18`, border:`1px solid ${col}40`,
              display:'flex', alignItems:'center', gap:12,
            }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                  {seleccionados.size} seleccionada{seleccionados.size !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize:12, color:col, fontWeight:700 }}>
                  {fmtCOP(totalSeleccionado)} a liquidar
                </div>
              </div>
              <button
                onClick={() => setSeleccionados(new Set())}
                style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:12 }}>
                Cancelar
              </button>
              <button
                onClick={liquidarSeleccionados}
                disabled={liquidando}
                style={{
                  padding:'9px 18px', borderRadius:10, border:'none', cursor:'pointer',
                  background:col, color:'#fff', fontWeight:700, fontSize:13, fontFamily:'Outfit',
                  opacity: liquidando ? 0.7 : 1,
                }}>
                {liquidando ? 'Liquidando…' : 'Marcar liquidado'}
              </button>
            </div>
          )}

          <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
            {profesionales.filter(p => pendientesPorProf[p.id]?.length > 0).map((prof, i) => {
              const color  = PROF_COLORS[i % PROF_COLORS.length]
              const items  = pendientesPorProf[prof.id] || []
              const total  = items.reduce((s, c) => s + (c.monto_comision || 0), 0)
              const allSel = items.every(c => seleccionados.has(c.id))

              function toggleProf() {
                setSeleccionados(prev => {
                  const next = new Set(prev)
                  if (allSel) items.forEach(c => next.delete(c.id))
                  else        items.forEach(c => next.add(c.id))
                  return next
                })
              }

              return (
                <div key={prof.id} style={{
                  borderRadius:16, background:'var(--card)', border:`1px solid var(--border)`, overflow:'hidden',
                }}>
                  {/* Header del profesional */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                    borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                    onClick={toggleProf}>
                    <div style={{ width:38, height:38, borderRadius:10, background:`${color}22`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, fontSize:15, color, flexShrink:0 }}>
                      {prof.nombre[0]}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{prof.nombre.split(' ')[0]}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>{items.length} cita{items.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:16, fontWeight:800, color, fontFamily:'Outfit' }}>{fmtCOP(total)}</div>
                      <div style={{ fontSize:10, color:'var(--text-3)', fontWeight:600 }}>pendiente</div>
                    </div>
                    <div style={{
                      width:20, height:20, borderRadius:6, border:`2px solid ${allSel ? col : 'var(--border)'}`,
                      background: allSel ? col : 'transparent', flexShrink:0, marginLeft:4,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {allSel && <Ico d="M5 13l4 4L19 7" size={11} />}
                    </div>
                  </div>

                  {/* Lista de comisiones individuales */}
                  {items.map(com => {
                    const sel = seleccionados.has(com.id)
                    const fecha = new Date(com.created_at).toLocaleDateString('es-CO', { day:'numeric', month:'short' })
                    return (
                      <div key={com.id}
                        onClick={() => setSeleccionados(prev => {
                          const next = new Set(prev)
                          sel ? next.delete(com.id) : next.add(com.id)
                          return next
                        })}
                        style={{
                          display:'flex', alignItems:'center', gap:12, padding:'11px 16px',
                          cursor:'pointer', background: sel ? `${col}08` : 'transparent',
                          borderBottom:'1px solid var(--border)', transition:'background 0.15s',
                        }}>
                        <div style={{
                          width:18, height:18, borderRadius:5, border:`2px solid ${sel ? col : 'var(--border)'}`,
                          background: sel ? col : 'transparent', flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          {sel && <Ico d="M5 13l4 4L19 7" size={10} />}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:'var(--text-2)', fontWeight:600 }}>{fecha}</div>
                          <div style={{ fontSize:11, color:'var(--text-3)' }}>
                            Servicio: {fmtCOP(com.monto_servicio)}
                          </div>
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', fontFamily:'Outfit' }}>
                          {fmtCOP(com.monto_comision)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </>
      )}
      <div style={{ height:24 }} />
    </>
  )
}
