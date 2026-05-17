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

const METODOS = [
  { key:'efectivo',      label:'Efectivo' },
  { key:'nequi',         label:'Nequi' },
  { key:'daviplata',     label:'Daviplata' },
  { key:'transferencia', label:'Transferencia' },
  { key:'tarjeta',       label:'Tarjeta' },
]

const METODO_COLORS = {
  efectivo:      '#22c55e',
  nequi:         '#a855f7',
  daviplata:     '#f59e0b',
  transferencia: '#3b82f6',
  tarjeta:       '#06b6d4',
}

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
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n/1_000).toFixed(0)}K`
  return `$${Math.round(n)}`
}

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day:'numeric', month:'short' })
}

export default function SalonCaja() {
  const { tenant } = useTenant()
  const col = tenant?.color_primario || '#f43f5e'

  const [periodo,      setPeriodo]      = useState('hoy')
  const [vista,        setVista]        = useState('cobrar')
  const [pendientes,   setPendientes]   = useState([])
  const [historial,    setHistorial]    = useState([])
  const [totalCobrado, setTotalCobrado] = useState(0)
  const [loading,      setLoading]      = useState(true)

  const [modalCita,    setModalCita]    = useState(null)
  const [monto,        setMonto]        = useState('')
  const [metodo,       setMetodo]       = useState('efectivo')
  const [referencia,   setReferencia]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState(null)
  const [confirmAnular, setConfirmAnular] = useState(null)
  const [anulNota,      setAnulNota]      = useState('')
  const [paginaHist,    setPaginaHist]    = useState(20)

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  async function descargarPDF() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' })
    const [r, g, b] = [
      parseInt(col.slice(1,3),16),
      parseInt(col.slice(3,5),16),
      parseInt(col.slice(5,7),16),
    ]

    // Header
    doc.setFillColor(r, g, b)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(255,255,255)
    doc.setFontSize(16); doc.setFont('helvetica','bold')
    doc.text(tenant?.nombre || 'Salón', 14, 12)
    doc.setFontSize(10); doc.setFont('helvetica','normal')
    doc.text(`Reporte de Caja · ${PERIODOS.find(p => p.key === periodo)?.label} · ${new Date().toLocaleDateString('es-CO',{dateStyle:'long'})}`, 14, 20)

    // KPI
    doc.setTextColor(0,0,0)
    doc.setFontSize(22); doc.setFont('helvetica','bold')
    doc.text(`Total: $${totalCobrado.toLocaleString('es-CO')}`, 14, 44)
    doc.setFontSize(10); doc.setFont('helvetica','normal')
    doc.setTextColor(100,100,100)
    doc.text(`${historial.length} cobros · ${pendientes.length} pendientes`, 14, 52)

    // Por método
    const porMetodo = {}
    historial.forEach(c => { porMetodo[c.pago.metodo] = (porMetodo[c.pago.metodo]||0) + Number(c.pago.monto) })
    let xm = 14
    Object.entries(porMetodo).forEach(([m, t]) => {
      doc.setTextColor(r,g,b); doc.setFont('helvetica','bold')
      doc.text(`${m}: $${t.toLocaleString('es-CO')}`, xm, 60)
      xm += 55
    })

    // Tabla
    let y = 72
    doc.setFillColor(245,245,245)
    doc.rect(10, y-5, 190, 9, 'F')
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
    doc.text('Cliente', 14, y); doc.text('Servicio', 68, y)
    doc.text('Método', 130, y); doc.text('Monto', 170, y)
    y += 8

    doc.setFont('helvetica','normal')
    historial.forEach((c, i) => {
      if (y > 270) { doc.addPage(); y = 20 }
      if (i % 2 === 0) { doc.setFillColor(252,252,252); doc.rect(10, y-4, 190, 7, 'F') }
      doc.setTextColor(0,0,0)
      doc.text((c.clientes_agenda?.nombre||'—').substring(0,24), 14, y)
      doc.text((c.servicios?.nombre||'—').substring(0,22), 68, y)
      doc.text(c.pago.metodo, 130, y)
      doc.setTextColor(34,197,94)
      doc.text(`$${Number(c.pago.monto).toLocaleString('es-CO')}`, 170, y)
      y += 7
    })

    doc.save(`caja-${periodo}-${new Date().toISOString().slice(0,10)}.pdf`)
  }

  const cargar = useCallback(async () => {
    if (!tenant) { setLoading(false); return }
    setLoading(true)
    const { desde, hasta } = rango(periodo)

    const { data: todasCitas } = await supabase
      .from('citas')
      .select('id, fecha_inicio, tenant_id, servicios(id, nombre, precio), profesionales(nombre), clientes_agenda(nombre)')
      .eq('tenant_id', tenant.id)
      .eq('estado', 'completada')
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)
      .order('fecha_inicio', { ascending: false })

    const citas = todasCitas || []
    const citaIds = citas.map(c => c.id)

    let pagosMap = {}
    if (citaIds.length > 0) {
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('id, cita_id, monto, metodo, referencia, created_at')
        .in('cita_id', citaIds)
        .eq('estado', 'pagado')
      ;(pagosData || []).forEach(p => { pagosMap[p.cita_id] = p })
    }

    const sinPago = citas.filter(c => !pagosMap[c.id])
    const conPago = citas
      .filter(c => pagosMap[c.id])
      .map(c => ({ ...c, pago: pagosMap[c.id] }))
      .sort((a, b) => new Date(b.pago.created_at) - new Date(a.pago.created_at))

    setPendientes(sinPago)
    setHistorial(conPago)
    setTotalCobrado(conPago.reduce((s, c) => s + Number(c.pago.monto || 0), 0))
    setLoading(false)
  }, [tenant, periodo])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setPaginaHist(20) }, [periodo])

  function abrirModal(cita) {
    setModalCita(cita)
    setMonto(String(cita.servicios?.precio || ''))
    setMetodo('efectivo')
    setReferencia('')
  }

  async function anularPago(pago) {
    await supabase.from('pagos').update({ estado: 'anulado', notas: anulNota.trim() || null }).eq('id', pago.id)
    setConfirmAnular(null)
    setAnulNota('')
    showToast('Pago anulado')
    cargar()
  }

  async function handleCobrar(e) {
    e.preventDefault()
    if (!modalCita || !monto) return
    setSaving(true)
    try {
      const { data: pago, error: errIns } = await supabase
        .from('pagos')
        .insert({
          tenant_id:  tenant.id,
          cita_id:    modalCita.id,
          monto:      parseFloat(monto),
          metodo,
          referencia: referencia || null,
          estado:     'pendiente',
        })
        .select('id')
        .single()

      if (errIns) throw errIns

      // UPDATE a pagado → dispara trigger trg_comision_al_pagar
      const { error: errUpd } = await supabase
        .from('pagos')
        .update({ estado: 'pagado' })
        .eq('id', pago.id)

      if (errUpd) throw errUpd

      showToast('Cobro registrado ✓')
      setModalCita(null)
      cargar()
    } catch (err) {
      console.error('[SalonCaja]', err)
      showToast('Error al registrar cobro', false)
    }
    setSaving(false)
  }

  return (
    <div style={{ padding:'0 16px 16px' }}>
      {toast && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', zIndex:200,
          background: toast.ok ? '#22c55e' : '#ef4444',
          color:'#fff', padding:'12px 20px', borderRadius:14, fontSize:14, fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.2)', whiteSpace:'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
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
          {/* KPI strip — 3 cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div className="sp-kpi-card" style={{
              gridColumn:'1 / -1', flexDirection:'row', alignItems:'center', justifyContent:'space-between',
              background:`linear-gradient(135deg, ${col}28 0%, ${col}08 100%)`,
              boxShadow:`0 4px 24px ${col}18`,
            }}>
              <div>
                <div className="sp-kpi-val" style={{ color:col, fontSize:34 }}>{fmtCOP(totalCobrado)}</div>
                <div className="sp-kpi-lbl" style={{ color:col, opacity:0.7 }}>
                  Ingresos · {PERIODOS.find(p => p.key === periodo)?.label}
                </div>
              </div>
              {historial.length > 0 && (
                <button onClick={descargarPDF} style={{
                  padding:'8px 14px', borderRadius:10, border:'none', cursor:'pointer',
                  background:`${col}20`, color:col, fontWeight:700, fontSize:12, flexShrink:0,
                }}>↓ PDF</button>
              )}
            </div>
            <div className="sp-kpi-card" style={{ background:'linear-gradient(135deg, rgba(245,158,11,0.13) 0%, transparent 100%)' }}>
              <div className="sp-kpi-val" style={{ color:'#f59e0b', fontSize:26 }}>{pendientes.length}</div>
              <div className="sp-kpi-lbl" style={{ color:'#f59e0b', opacity:0.8 }}>Por cobrar</div>
              <div className="sp-kpi-sub">servicios</div>
            </div>
            <div className="sp-kpi-card" style={{ background:'linear-gradient(135deg, rgba(34,197,94,0.13) 0%, transparent 100%)' }}>
              <div className="sp-kpi-val" style={{ color:'#22c55e', fontSize:26 }}>{historial.length}</div>
              <div className="sp-kpi-lbl" style={{ color:'#22c55e', opacity:0.8 }}>Cobros</div>
              <div className="sp-kpi-sub">registrados</div>
            </div>
          </div>

          {/* Métodos */}
          {historial.length > 0 && (() => {
            const porM = {}
            historial.forEach(c => { porM[c.pago.metodo] = (porM[c.pago.metodo]||0) + Number(c.pago.monto) })
            return (
              <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:14, paddingBottom:2 }}>
                {Object.entries(porM).map(([m, total]) => (
                  <div key={m} style={{
                    flexShrink:0, padding:'9px 13px', borderRadius:12,
                    background:`linear-gradient(135deg, ${METODO_COLORS[m]||col}18, ${METODO_COLORS[m]||col}06)`,
                    minWidth:90,
                  }}>
                    <div style={{ fontSize:9, fontWeight:700, color: METODO_COLORS[m]||col, textTransform:'uppercase', letterSpacing:0.6, marginBottom:3 }}>
                      {m}
                    </div>
                    <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color:'var(--text)' }}>
                      {fmtCOP(total)}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:16,
            background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:4 }}>
            {[
              { key:'cobrar',    label:`Por cobrar${pendientes.length > 0 ? ` (${pendientes.length})` : ''}` },
              { key:'historial', label:`Cobrado (${historial.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setVista(t.key)} style={{
                flex:1, padding:'9px 0', borderRadius:10, cursor:'pointer', border:'none',
                background: vista === t.key ? col : 'transparent',
                color: vista === t.key ? '#fff' : 'var(--text-3)',
                fontWeight:700, fontSize:13, transition:'all 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {vista === 'cobrar' && (
            pendientes.length === 0 ? (
              <div className="sp-empty">
                <span className="sp-empty-icon">✅</span>
                <p className="sp-empty-title">Todo al día</p>
                <p className="sp-empty-sub">No hay servicios pendientes de cobro</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {pendientes.map(c => (
                  <div key={c.id} className="sp-tbl-row" style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:'#f59e0b', boxShadow:'0 0 6px rgba(245,158,11,0.5)' }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {c.clientes_agenda?.nombre || '—'}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                        {c.servicios?.nombre || '—'}
                        {c.profesionales?.nombre ? ` · ${c.profesionales.nombre.split(' ')[0]}` : ''}
                        {' · '}{fmtFecha(c.fecha_inicio)} {fmtHora(c.fecha_inicio)}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      {c.servicios?.precio > 0 && (
                        <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13, color:'var(--text-2)' }}>
                          ${Number(c.servicios.precio).toLocaleString('es-CO')}
                        </span>
                      )}
                      <button onClick={() => abrirModal(c)} style={{
                        padding:'7px 14px', borderRadius:10, border:'none', cursor:'pointer',
                        background:col, color:'#fff', fontWeight:700, fontSize:12,
                      }}>Cobrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {vista === 'historial' && (
            historial.length === 0 ? (
              <div className="sp-empty">
                <span className="sp-empty-icon">💰</span>
                <p className="sp-empty-title">Sin cobros</p>
                <p className="sp-empty-sub">No hay pagos registrados en este período</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {historial.slice(0, paginaHist).map((c, idx) => (
                  <div key={c.id} className="sp-tbl-row">
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:'#22c55e', boxShadow:'0 0 6px rgba(34,197,94,0.45)' }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {c.clientes_agenda?.nombre || '—'}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                          {c.servicios?.nombre || '—'}
                          {c.profesionales?.nombre ? ` · ${c.profesionales.nombre.split(' ')[0]}` : ''}
                          {' · '}
                          <span style={{ color: METODO_COLORS[c.pago.metodo] || col, fontWeight:700 }}>{c.pago.metodo}</span>
                          {' · '}{fmtFecha(c.pago.created_at)} {fmtHora(c.pago.created_at)}
                        </div>
                        {c.pago.referencia && (
                          <div style={{ fontSize:10, color:'var(--text-3)', fontStyle:'italic', marginTop:1 }}>Ref: {c.pago.referencia}</div>
                        )}
                        {c.pago.notas && (
                          <div style={{ fontSize:10, color:'#ef4444', marginTop:1 }}>Anulado: {c.pago.notas}</div>
                        )}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                        <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color:'#22c55e' }}>
                          ${Number(c.pago.monto).toLocaleString('es-CO')}
                        </span>
                        {confirmAnular?.id !== c.pago.id && (
                          <button onClick={() => { setConfirmAnular(c.pago); setAnulNota('') }} style={{
                            background:'none', border:'none', cursor:'pointer', color:'var(--text-3)',
                            fontSize:11, fontWeight:600, padding:'2px 4px', borderRadius:6,
                          }}>Anular</button>
                        )}
                      </div>
                    </div>
                    {confirmAnular?.id === c.pago.id && (
                      <div style={{ marginTop:10, paddingLeft:18, display:'flex', flexDirection:'column', gap:7 }}>
                        <input
                          className="sp-input"
                          placeholder="Motivo de anulación (opcional)"
                          value={anulNota}
                          onChange={e => setAnulNota(e.target.value)}
                          style={{ fontSize:12, padding:'8px 12px' }}
                          autoFocus
                        />
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => anularPago(c.pago)} style={{
                            flex:1, padding:'8px', borderRadius:9, border:'none', cursor:'pointer',
                            background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontWeight:700, fontSize:12,
                          }}>Confirmar anulación</button>
                          <button onClick={() => { setConfirmAnular(null); setAnulNota('') }} style={{
                            padding:'8px 14px', borderRadius:9, border:'1px solid var(--border)',
                            background:'transparent', color:'var(--text-3)', fontWeight:700, fontSize:12, cursor:'pointer',
                          }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {historial.length > paginaHist && (
                  <button onClick={() => setPaginaHist(p => p + 20)} style={{
                    width:'100%', padding:'12px', borderRadius:14, border:'1px solid var(--border)',
                    background:'var(--card)', color:'var(--text-3)', fontWeight:700, fontSize:13, cursor:'pointer',
                    marginTop:6,
                  }}>
                    Ver {Math.min(historial.length - paginaHist, 20)} más · {historial.length - paginaHist} restantes
                  </button>
                )}
              </div>
            )
          )}
        </>
      )}

      {/* Modal cobrar */}
      {modalCita && (
        <div
          style={{
            position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'flex-end',
            background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setModalCita(null) }}
        >
          <div style={{
            width:'100%', maxWidth:480, margin:'0 auto',
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            padding:'20px 20px 32px', maxHeight:'90dvh', overflowY:'auto',
          }}>
            <div style={{ width:40, height:4, borderRadius:2,
              background:'var(--border)', margin:'0 auto 20px' }} />

            <h3 style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18,
              color:'var(--text)', marginBottom:4 }}>Registrar cobro</h3>
            <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:20 }}>
              {modalCita.clientes_agenda?.nombre} · {modalCita.servicios?.nombre}
            </p>

            <form onSubmit={handleCobrar} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>MONTO</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
                    color:'var(--text-3)', fontWeight:700, fontSize:14, pointerEvents:'none' }}>$</span>
                  <input
                    type="number" min="0" step="100" required
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                    className="sp-input"
                    style={{ paddingLeft:28 }}
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>MÉTODO DE PAGO</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {METODOS.map(m => (
                    <button key={m.key} type="button" onClick={() => setMetodo(m.key)} style={{
                      padding:'9px 14px', borderRadius:12, cursor:'pointer',
                      border:`2px solid ${metodo === m.key ? col : 'var(--border)'}`,
                      background: metodo === m.key ? `${col}15` : 'var(--card)',
                      color: metodo === m.key ? col : 'var(--text-2)',
                      fontWeight:700, fontSize:13, transition:'all 0.15s',
                    }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-3)',
                  letterSpacing:0.5, display:'block', marginBottom:8 }}>
                  REFERENCIA <span style={{ fontWeight:400 }}>(opcional)</span>
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  className="sp-input"
                  placeholder="Nro. de transacción, voucher…"
                />
              </div>

              <button type="submit" disabled={saving || !monto} style={{
                marginTop:4, padding:'16px', borderRadius:16, border:'none', cursor:'pointer',
                background: saving || !monto ? 'var(--border)' : col,
                color: saving || !monto ? 'var(--text-3)' : '#fff',
                fontFamily:'Outfit', fontWeight:800, fontSize:16,
                transition:'all 0.2s',
              }}>
                {saving ? 'Guardando…' : `Cobrar $${Number(monto||0).toLocaleString('es-CO')}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
