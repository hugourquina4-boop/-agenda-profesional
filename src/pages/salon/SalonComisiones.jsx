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
  const [editPct,       setEditPct]       = useState({})
  const [editMeta,      setEditMeta]      = useState({})
  const [toast,         setToast]         = useState(null)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [tab,        setTab]        = useState('comisiones')
  const [desempeno,  setDesempeno]  = useState([])
  const [mesStr,     setMesStr]     = useState(() => new Date().toISOString().slice(0, 7))
  const [loadingDes, setLoadingDes] = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(null)

  // Planilla de anticipos
  const [anticipos,     setAnticipos]     = useState([])
  const [loadingAnt,    setLoadingAnt]    = useState(false)
  const [anticipoForm,  setAnticipoForm]  = useState(null) // profesional_id abierto
  const [antMonto,      setAntMonto]      = useState('')
  const [antConcepto,   setAntConcepto]   = useState('')
  const [antTipo,       setAntTipo]       = useState('anticipo')
  const [guardandoAnt,  setGuardandoAnt]  = useState(false)

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

  const cargarDesempeno = useCallback(async () => {
    if (!tenant) return
    setLoadingDes(true)
    const [y, m] = mesStr.split('-').map(Number)
    const inicio = new Date(y, m - 1, 1).toISOString()
    const fin    = new Date(y, m,     1).toISOString()
    const { data } = await supabase
      .from('v_desempeno_prof')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('mes', inicio)
      .lt('mes', fin)
    setDesempeno(data || [])
    setLoadingDes(false)
  }, [tenant, mesStr])

  useEffect(() => { if (tab === 'desempeño') cargarDesempeno() }, [cargarDesempeno, tab])

  const cargarAnticipos = useCallback(async () => {
    if (!tenant) return
    setLoadingAnt(true)
    const { data } = await supabase.from('anticipos_profesional')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('liquidado', false)
      .order('created_at', { ascending: false })
    setAnticipos(data || [])
    setLoadingAnt(false)
  }, [tenant])

  useEffect(() => { if (tab === 'planilla') cargarAnticipos() }, [cargarAnticipos, tab])

  async function registrarAnticipo(profId) {
    const m = parseFloat(antMonto)
    if (!m || m <= 0) { showToast('Monto inválido', '#f87171'); return }
    setGuardandoAnt(true)
    await supabase.from('anticipos_profesional').insert({
      tenant_id: tenant.id,
      profesional_id: profId,
      monto: m,
      concepto: antConcepto.trim() || null,
      tipo: antTipo,
    })
    setGuardandoAnt(false)
    setAnticipoForm(null)
    setAntMonto(''); setAntConcepto(''); setAntTipo('anticipo')
    showToast('Registrado ✓')
    cargarAnticipos()
  }

  async function eliminarAnticipo(id) {
    await supabase.from('anticipos_profesional').delete().eq('id', id).eq('tenant_id', tenant.id)
    showToast('Eliminado')
    cargarAnticipos()
  }

  async function descargarPDFProf(d, i) {
    setGenerandoPDF(d.profesional_id)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' })
      const color = PROF_COLORS[i % PROF_COLORS.length]
      const hex2rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]

      const mesLabel = new Date(mesStr + '-02').toLocaleDateString('es-CO', { month:'long', year:'numeric' })
      const salonNombre = tenant?.nombre || 'Salón Pro'

      // Header band
      const [r,g,b] = hex2rgb(color)
      doc.setFillColor(r, g, b)
      doc.rect(0, 0, 210, 32, 'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(18)
      doc.setFont('helvetica','bold')
      doc.text('Liquidación de Comisiones', 14, 13)
      doc.setFontSize(10)
      doc.setFont('helvetica','normal')
      doc.text(`${salonNombre}  ·  ${mesLabel}`, 14, 21)
      doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, 14, 28)

      // Professional name
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(16)
      doc.setFont('helvetica','bold')
      doc.text(d.nombre || '—', 14, 46)
      doc.setFontSize(10)
      doc.setFont('helvetica','normal')
      doc.setTextColor(100,100,100)
      doc.text(d.especialidad || '—', 14, 53)

      // Divider
      doc.setDrawColor(220,220,220)
      doc.line(14, 58, 196, 58)

      // Stats grid (2×2)
      const stats = [
        ['Citas completadas', `${d.citas_completadas ?? 0}`],
        ['Horas trabajadas',  `${d.horas_trabajadas  ?? 0} h`],
        ['Ingresos generados', fmtCOP(d.ingresos_cobrados ?? 0)],
        ['Comisión ganada',    fmtCOP(d.comision_ganada   ?? 0)],
      ]
      const cellW = 88, cellH = 22
      const startX = 14, startY = 64
      stats.forEach(([label, val], idx) => {
        const col2 = startX + (idx % 2) * (cellW + 8)
        const row2 = startY + Math.floor(idx / 2) * (cellH + 4)
        doc.setFillColor(248,248,248)
        doc.roundedRect(col2, row2, cellW, cellH, 3, 3, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica','normal')
        doc.setTextColor(120,120,120)
        doc.text(label.toUpperCase(), col2 + 4, row2 + 7)
        doc.setFontSize(13)
        doc.setFont('helvetica','bold')
        doc.setTextColor(40,40,40)
        doc.text(val, col2 + 4, row2 + 17)
      })

      // Meta progress (if exists)
      const meta = rules[d.profesional_id]?.meta_mensual
      let yPos = startY + 2 * (cellH + 4) + 12
      if (meta && meta > 0) {
        const pct = Math.min(100, Math.round((d.ingresos_cobrados || 0) / meta * 100))
        doc.setFontSize(9)
        doc.setFont('helvetica','bold')
        doc.setTextColor(80,80,80)
        doc.text('META MENSUAL', 14, yPos)
        doc.setFont('helvetica','normal')
        doc.setTextColor(120,120,120)
        doc.text(`${pct}%  ·  meta: ${fmtCOP(meta)}`, 60, yPos)
        yPos += 5
        // Bar background
        doc.setFillColor(230,230,230)
        doc.roundedRect(14, yPos, 182, 5, 2, 2, 'F')
        // Bar fill
        const barR = pct >= 100 ? [34,197,94] : pct >= 60 ? hex2rgb(color) : [245,158,11]
        doc.setFillColor(barR[0], barR[1], barR[2])
        doc.roundedRect(14, yPos, 182 * pct / 100, 5, 2, 2, 'F')
        yPos += 14
      }

      // Comisiones individuales table
      doc.setDrawColor(220,220,220)
      doc.line(14, yPos, 196, yPos)
      yPos += 6
      doc.setFontSize(10)
      doc.setFont('helvetica','bold')
      doc.setTextColor(40,40,40)
      doc.text('Detalle de comisiones pendientes', 14, yPos)
      yPos += 8

      const propias = comisiones.filter(c => c.profesional_id === d.profesional_id)
      if (propias.length === 0) {
        doc.setFontSize(9)
        doc.setFont('helvetica','italic')
        doc.setTextColor(150,150,150)
        doc.text('Sin comisiones pendientes', 14, yPos)
      } else {
        // Table header
        doc.setFillColor(245,245,245)
        doc.rect(14, yPos - 4, 182, 8, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica','bold')
        doc.setTextColor(100,100,100)
        doc.text('FECHA', 16, yPos + 1)
        doc.text('SERVICIO', 60, yPos + 1)
        doc.text('COMISIÓN', 160, yPos + 1)
        yPos += 10
        propias.forEach(com => {
          const fecha = new Date(com.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
          doc.setFontSize(9)
          doc.setFont('helvetica','normal')
          doc.setTextColor(60,60,60)
          doc.text(fecha, 16, yPos)
          doc.text(fmtCOP(com.monto_servicio), 60, yPos)
          doc.setFont('helvetica','bold')
          doc.text(fmtCOP(com.monto_comision), 160, yPos)
          yPos += 7
          if (yPos > 270) { doc.addPage(); yPos = 20 }
        })
        // Total
        doc.setDrawColor(220,220,220)
        doc.line(14, yPos, 196, yPos)
        yPos += 6
        const totalCom = propias.reduce((s,c) => s + (c.monto_comision || 0), 0)
        doc.setFontSize(11)
        doc.setFont('helvetica','bold')
        doc.setTextColor(r, g, b)
        doc.text(`Total a pagar: ${fmtCOP(totalCom)}`, 14, yPos)
      }

      // Footer
      doc.setFontSize(7)
      doc.setFont('helvetica','normal')
      doc.setTextColor(180,180,180)
      doc.text('Salón Pro · salud.vercel.app', 14, 290)
      doc.text(new Date().toISOString().slice(0,10), 170, 290)

      const nombre = (d.nombre || 'profesional').replace(/\s+/g,'-').toLowerCase()
      doc.save(`liquidacion-${nombre}-${mesStr}.pdf`)
    } catch(e) {
      console.error('[PDF]', e)
      showToast('Error generando PDF', '#f87171')
    } finally {
      setGenerandoPDF(null)
    }
  }

  async function guardarPorcentaje(profId) {
    const pct = parseFloat(editPct[profId])
    if (isNaN(pct) || pct < 0 || pct > 100) { showToast('Porcentaje inválido (0-100)', '#f87171'); return }
    if (isDemo) { showToast('Demo — conecta Supabase para guardar', '#f59e0b'); return }
    setSaving(profId)
    const existente = rules[profId]
    const updates = { porcentaje: pct }
    if (editMeta[profId] !== undefined) {
      const m = parseFloat(editMeta[profId])
      if (!isNaN(m) && m >= 0) updates.meta_mensual = m
    }
    if (existente) {
      await supabase.from('commission_rules').update(updates).eq('id', existente.id)
    } else {
      await supabase.from('commission_rules').insert({ tenant_id: tenant.id, profesional_id: profId, ...updates })
    }
    setSaving(null)
    setEditPct(p => { const n = { ...p }; delete n[profId]; return n })
    if (editMeta[profId] !== undefined) setEditMeta(p => { const n = { ...p }; delete n[profId]; return n })
    showToast('Comisión guardada ✓')
    cargar()
  }

  async function guardarMeta(profId) {
    const meta = parseFloat(editMeta[profId])
    if (isNaN(meta) || meta < 0) { showToast('Meta inválida', '#f87171'); return }
    if (isDemo) { showToast('Demo — conecta Supabase para guardar', '#f59e0b'); return }
    setSaving(profId)
    const existente = rules[profId]
    if (existente) {
      await supabase.from('commission_rules').update({ meta_mensual: meta }).eq('id', existente.id)
    } else {
      await supabase.from('commission_rules').insert({ tenant_id: tenant.id, profesional_id: profId, meta_mensual: meta, porcentaje: 0 })
    }
    setSaving(null)
    setEditMeta(p => { const n = { ...p }; delete n[profId]; return n })
    showToast('Meta guardada ✓')
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

  function prevMes() {
    setMesStr(s => {
      const [y, m] = s.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }
  function nextMes() {
    setMesStr(s => {
      const [y, m] = s.split('-').map(Number)
      const d = new Date(y, m, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }

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

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:4, margin:'16px 16px 0',
        background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:4 }}>
        {[['comisiones','Comisiones'],['planilla','Planilla'],['desempeño','Desempeño']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:'8px 0', borderRadius:8, cursor:'pointer', border:'none',
            background: tab === t ? col : 'transparent',
            color: tab === t ? '#fff' : 'var(--text-3)',
            fontWeight:700, fontSize:13, transition:'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'planilla' && (
        <div style={{ padding:'16px' }}>
          {loadingAnt ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
              <div className="sp-spinner" style={{ borderTopColor:col }} />
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {profesionales.map((prof, pi) => {
                const profCom = comisiones.filter(c => c.profesional_id === prof.id)
                const profAnt = anticipos.filter(a => a.profesional_id === prof.id)
                const totalCom = profCom.reduce((s,c) => s+(c.monto_comision||0), 0)
                const totalAnt = profAnt.filter(a => a.tipo === 'anticipo').reduce((s,a) => s+a.monto, 0)
                const totalDed = profAnt.filter(a => a.tipo === 'deduccion').reduce((s,a) => s+a.monto, 0)
                const neto    = Math.max(0, totalCom - totalAnt - totalDed)
                const profColor = PROF_COLORS[pi % PROF_COLORS.length]
                const isOpen = anticipoForm === prof.id

                return (
                  <div key={prof.id} style={{
                    borderRadius:18, overflow:'hidden',
                    boxShadow:'0 2px 16px rgba(0,0,0,0.14)',
                  }}>
                    {/* Header prof */}
                    <div style={{ padding:'14px 16px', background:`linear-gradient(135deg, ${profColor}22, ${profColor}08)`, display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{
                        width:38, height:38, borderRadius:12, background:`${profColor}22`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'Outfit', fontWeight:800, fontSize:16, color:profColor, flexShrink:0,
                      }}>
                        {prof.nombre[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{prof.nombre}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{profCom.length} comisiones pendientes</div>
                      </div>
                      <button onClick={() => {
                        setAnticipoForm(isOpen ? null : prof.id)
                        setAntMonto(''); setAntConcepto(''); setAntTipo('anticipo')
                      }} style={{
                        padding:'6px 12px', borderRadius:9, border:`1px solid ${profColor}44`,
                        background: isOpen ? `${profColor}22` : 'transparent',
                        color:profColor, fontWeight:700, fontSize:12, cursor:'pointer',
                      }}>
                        + Mov.
                      </button>
                    </div>

                    {/* Líneas de anticipo */}
                    {profAnt.length > 0 && (
                      <div style={{ padding:'0 16px', background:'var(--card)' }}>
                        {profAnt.map(a => (
                          <div key={a.id} className="sp-tbl-row" style={{ padding:'9px 0' }}>
                            <span style={{
                              fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6,
                              background: a.tipo === 'anticipo' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)',
                              color: a.tipo === 'anticipo' ? '#f59e0b' : '#ef4444',
                              textTransform:'uppercase', flexShrink:0,
                            }}>
                              {a.tipo === 'anticipo' ? 'Anticipo' : 'Ded.'}
                            </span>
                            <span style={{ flex:1, fontSize:12, color:'var(--text-3)' }}>{a.concepto || '—'}</span>
                            <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:13,
                              color: a.tipo === 'anticipo' ? '#f59e0b' : '#ef4444' }}>
                              −${a.monto.toLocaleString('es-CO')}
                            </span>
                            <button onClick={() => eliminarAnticipo(a.id)} style={{
                              background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:16, padding:'0 4px',
                            }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formulario agregar */}
                    {isOpen && (
                      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', background:'var(--bg)' }}>
                        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                          {[{ k:'anticipo', label:'Anticipo' }, { k:'deduccion', label:'Deducción' }].map(opt => (
                            <button key={opt.k} type="button" onClick={() => setAntTipo(opt.k)} style={{
                              flex:1, padding:'7px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:12,
                              border:`1.5px solid ${antTipo === opt.k ? profColor : 'var(--border)'}`,
                              background: antTipo === opt.k ? `${profColor}14` : 'transparent',
                              color: antTipo === opt.k ? profColor : 'var(--text-3)',
                            }}>{opt.label}</button>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:8 }}>
                          <div style={{ position:'relative', flex:'0 0 110px' }}>
                            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                              color:'var(--text-3)', fontSize:13, fontWeight:700, pointerEvents:'none' }}>$</span>
                            <input className="sp-input" type="number" min="0" step="1000"
                              placeholder="0" value={antMonto} onChange={e => setAntMonto(e.target.value)}
                              style={{ paddingLeft:22, fontSize:14 }} />
                          </div>
                          <input className="sp-input" placeholder="Concepto (opcional)"
                            value={antConcepto} onChange={e => setAntConcepto(e.target.value)}
                            style={{ flex:1 }} />
                          <button onClick={() => registrarAnticipo(prof.id)} disabled={guardandoAnt} style={{
                            padding:'0 14px', borderRadius:12, border:'none', cursor:'pointer',
                            background:profColor, color:'#fff', fontWeight:700, fontSize:13, flexShrink:0,
                          }}>
                            {guardandoAnt ? '…' : 'OK'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Footer totales */}
                    <div style={{ padding:'12px 16px', background:'var(--card)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                        <div className="sp-kpi-card" style={{ background:`linear-gradient(135deg,${profColor}20,transparent)`, textAlign:'center', padding:'10px 8px', gap:2 }}>
                          <div style={{ fontSize:14, fontWeight:800, fontFamily:'Outfit', color:profColor }}>{fmtCOP(totalCom)}</div>
                          <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, letterSpacing:0.3 }}>COMISIÓN</div>
                        </div>
                        <div className="sp-kpi-card" style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.15),transparent)', textAlign:'center', padding:'10px 8px', gap:2 }}>
                          <div style={{ fontSize:14, fontWeight:800, fontFamily:'Outfit', color:'#f59e0b' }}>−{fmtCOP(totalAnt + totalDed)}</div>
                          <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, letterSpacing:0.3 }}>ANTICIPOS</div>
                        </div>
                        <div className="sp-kpi-card" style={{
                          background: neto > 0 ? 'linear-gradient(135deg,rgba(34,197,94,0.18),transparent)' : 'transparent',
                          textAlign:'center', padding:'10px 8px', gap:2,
                        }}>
                          <div style={{ fontSize:16, fontWeight:800, fontFamily:'Outfit', color: neto > 0 ? '#22c55e' : 'var(--text-3)' }}>{fmtCOP(neto)}</div>
                          <div style={{ fontSize:9, fontWeight:700, letterSpacing:0.3, color: neto > 0 ? '#22c55e' : 'var(--text-3)' }}>NETO A PAGAR</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {profesionales.length === 0 && (
                <div className="sp-empty">
                  <span className="sp-empty-icon">📋</span>
                  <p className="sp-empty-title">Sin profesionales</p>
                  <p className="sp-empty-sub">Agrega profesionales en el módulo Equipo</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'desempeño' && (
        <>
          {/* ── Selector de mes ───────────────────────────── */}
          <div style={{ padding:'16px 16px 8px', display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={prevMes} style={{ width:34, height:34, borderRadius:10,
              background:'var(--card)', border:'1px solid var(--border)',
              cursor:'pointer', color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Ico d="M15 19l-7-7 7-7" size={16} />
            </button>
            <span style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:'var(--text)', fontFamily:'Outfit' }}>
              {new Date(mesStr + '-02').toLocaleDateString('es-CO', { month:'long', year:'numeric' })}
            </span>
            <button onClick={nextMes} style={{ width:34, height:34, borderRadius:10,
              background:'var(--card)', border:'1px solid var(--border)',
              cursor:'pointer', color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Ico d="M9 5l7 7-7 7" size={16} />
            </button>
          </div>

          {loadingDes ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
              <div className="sp-spinner" style={{ borderTopColor:col }} />
            </div>
          ) : desempeno.length === 0 ? (
            <div className="sp-empty">
              <span className="sp-empty-icon">📊</span>
              <p className="sp-empty-title">Sin datos este mes</p>
              <p className="sp-empty-sub">No hay citas completadas en el período</p>
            </div>
          ) : (
            <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:12 }}>
              {desempeno.map((d, i) => {
                const color      = PROF_COLORS[i % PROF_COLORS.length]
                const noShowClr  = d.no_show_rate >= 20 ? '#ef4444' : d.no_show_rate >= 10 ? '#f59e0b' : '#22c55e'
                return (
                  <div key={d.profesional_id} style={{
                    borderRadius:18, background:'var(--card)',
                    boxShadow:'0 2px 16px rgba(0,0,0,0.14)', overflow:'hidden',
                  }}>
                    {/* Header */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                      background:`linear-gradient(135deg, ${color}22, ${color}08)` }}>
                      <div style={{ width:44, height:44, borderRadius:12, background:`${color}22`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:'Outfit', fontWeight:800, fontSize:17, color, flexShrink:0 }}>
                        {d.nombre?.[0]}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{d.nombre}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{d.especialidad || '—'}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{
                          padding:'4px 10px', borderRadius:20,
                          background:`${noShowClr}18`, border:`1px solid ${noShowClr}40`,
                          fontSize:11, fontWeight:700, color:noShowClr,
                        }}>
                          {d.no_show_rate ?? 0}% no-show
                        </div>
                        <button
                          onClick={() => descargarPDFProf(d, i)}
                          disabled={generandoPDF === d.profesional_id}
                          title="Descargar liquidación PDF"
                          style={{
                            width:32, height:32, borderRadius:9, border:'1px solid var(--border)',
                            background:'var(--bg)', cursor:'pointer', display:'flex',
                            alignItems:'center', justifyContent:'center', color:'var(--text-3)',
                            opacity: generandoPDF === d.profesional_id ? 0.5 : 1, flexShrink:0,
                          }}>
                          {generandoPDF === d.profesional_id
                            ? <div className="sp-spinner" style={{ width:14, height:14, borderWidth:2, borderTopColor:color }} />
                            : <Ico d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={15} />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'12px 12px 4px' }}>
                      <div className="sp-kpi-card" style={{ background:`linear-gradient(135deg,${color}20,transparent)`, padding:'10px 12px', gap:2 }}>
                        <div style={{ fontSize:20, fontWeight:800, fontFamily:'Outfit', color }}>{d.citas_completadas ?? 0}</div>
                        <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5 }}>CITAS</div>
                      </div>
                      <div className="sp-kpi-card" style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.15),transparent)', padding:'10px 12px', gap:2 }}>
                        <div style={{ fontSize:20, fontWeight:800, fontFamily:'Outfit', color:'#6366f1' }}>{d.horas_trabajadas ?? 0}<span style={{ fontSize:12 }}>h</span></div>
                        <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5 }}>HORAS</div>
                      </div>
                      <div className="sp-kpi-card" style={{ background:'linear-gradient(135deg,rgba(34,197,94,0.15),transparent)', padding:'10px 12px', gap:2 }}>
                        <div style={{ fontSize:16, fontWeight:800, fontFamily:'Outfit', color:'#22c55e' }}>{fmtCOP(d.ingresos_cobrados ?? 0)}</div>
                        <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5 }}>INGRESOS</div>
                      </div>
                      <div className="sp-kpi-card" style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.15),transparent)', padding:'10px 12px', gap:2 }}>
                        <div style={{ fontSize:16, fontWeight:800, fontFamily:'Outfit', color:'#f59e0b' }}>{fmtCOP(d.comision_ganada ?? 0)}</div>
                        <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5 }}>COMISIÓN</div>
                      </div>
                    </div>

                    {/* Meta mensual progress */}
                    {(() => {
                      const meta = rules[d.profesional_id]?.meta_mensual
                      if (!meta || meta <= 0) return null
                      const pct = Math.min(100, Math.round((d.ingresos_cobrados || 0) / meta * 100))
                      const barColor = pct >= 100 ? '#22c55e' : pct >= 60 ? col : '#f59e0b'
                      return (
                        <div style={{ padding:'12px 16px 14px', background:'var(--card)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                            <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:700,
                              letterSpacing:0.8, textTransform:'uppercase' }}>Meta mensual</span>
                            <span style={{ fontSize:12, fontWeight:700, color:barColor }}>
                              {pct}% · {fmtCOP(meta)}
                            </span>
                          </div>
                          <div style={{ height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:barColor,
                              borderRadius:3, transition:'width 0.4s' }} />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ height:24 }} />
        </>
      )}

      {tab === 'comisiones' && (
        <>
          {/* KPI total pendiente */}
          {comisiones.length > 0 && (() => {
            const totalPend = comisiones.reduce((s,c) => s + (c.monto_comision||0), 0)
            return (
              <div className="sp-kpi-card" style={{
                margin:'16px 16px 0',
                background:`linear-gradient(135deg, ${col}28, ${col}08)`,
                flexDirection:'row', alignItems:'center', justifyContent:'space-between',
              }}>
                <div>
                  <div style={{ fontSize:22, fontWeight:800, fontFamily:'Outfit', color:col }}>
                    {fmtCOP(totalPend)}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, letterSpacing:0.5 }}>
                    TOTAL PENDIENTE · {comisiones.length} registro{comisiones.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ fontSize:32, opacity:0.4 }}>💸</div>
              </div>
            )
          })()}

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
              background:`linear-gradient(135deg, ${color}12 0%, ${color}04 100%)`,
              boxShadow:'0 2px 12px rgba(0,0,0,0.1)',
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
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'flex-end' }}>
                {/* Porcentaje comisión */}
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={valor}
                      onChange={e => setEditPct(p => ({ ...p, [prof.id]: e.target.value }))}
                      style={{
                        width:64, padding:'7px 24px 7px 9px', borderRadius:10,
                        border:`1px solid ${editing ? col : 'var(--border)'}`,
                        background:'var(--bg)', color:'var(--text)',
                        fontSize:14, fontWeight:700, fontFamily:'Outfit',
                        outline:'none', appearance:'textfield',
                      }}
                    />
                    <span style={{ position:'absolute', right:7, fontSize:12,
                      color:'var(--text-3)', pointerEvents:'none', fontWeight:600 }}>%</span>
                  </div>
                  {editing && (
                    <button
                      onClick={() => guardarPorcentaje(prof.id)}
                      disabled={saving === prof.id}
                      style={{
                        padding:'7px 11px', borderRadius:10, border:'none', cursor:'pointer',
                        background:col, color:'#fff', fontWeight:700, fontSize:13, fontFamily:'Outfit',
                        opacity: saving === prof.id ? 0.7 : 1,
                      }}>
                      {saving === prof.id ? '…' : '✓'}
                    </button>
                  )}
                </div>
                {/* Meta mensual */}
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                    <span style={{ position:'absolute', left:7, fontSize:11,
                      color:'var(--text-3)', pointerEvents:'none' }}>$</span>
                    <input
                      type="number" min="0" step="50000"
                      placeholder="Meta/mes"
                      value={editMeta[prof.id] !== undefined ? editMeta[prof.id] : (rule?.meta_mensual ?? '')}
                      onChange={e => setEditMeta(p => ({ ...p, [prof.id]: e.target.value }))}
                      style={{
                        width:80, padding:'7px 7px 7px 16px', borderRadius:10,
                        border:`1px solid ${editMeta[prof.id] !== undefined ? col : 'var(--border)'}`,
                        background:'var(--bg)', color:'var(--text)',
                        fontSize:13, fontWeight:600, fontFamily:'Outfit',
                        outline:'none', appearance:'textfield',
                      }}
                    />
                  </div>
                  {editMeta[prof.id] !== undefined && !editing && (
                    <button
                      onClick={() => guardarMeta(prof.id)}
                      disabled={saving === prof.id}
                      style={{
                        padding:'7px 11px', borderRadius:10, border:'none', cursor:'pointer',
                        background:col, color:'#fff', fontWeight:700, fontSize:12, fontFamily:'Outfit',
                        opacity: saving === prof.id ? 0.7 : 1,
                      }}>
                      {saving === prof.id ? '…' : '✓'}
                    </button>
                  )}
                </div>
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
                  borderRadius:16, overflow:'hidden',
                  boxShadow:'0 2px 16px rgba(0,0,0,0.14)',
                }}>
                  {/* Header del profesional */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
                    background:`linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`,
                    borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer' }}
                    onClick={toggleProf}>
                    <div style={{ width:38, height:38, borderRadius:10, background:`${color}30`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'Outfit', fontWeight:800, fontSize:15, color, flexShrink:0,
                      boxShadow:`0 0 12px ${color}40` }}>
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
                      width:20, height:20, borderRadius:6, border:`2px solid ${allSel ? col : 'rgba(255,255,255,0.2)'}`,
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
                        className="sp-tbl-row"
                        style={{ padding:'11px 16px', cursor:'pointer', background: sel ? `${col}10` : undefined }}>
                        <div style={{
                          width:16, height:16, borderRadius:4, border:`2px solid ${sel ? col : 'var(--border)'}`,
                          background: sel ? col : 'transparent', flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          {sel && <Ico d="M5 13l4 4L19 7" size={9} />}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:'var(--text-2)', fontWeight:600 }}>{fecha}</div>
                          <div style={{ fontSize:11, color:'var(--text-3)' }}>
                            Servicio: {fmtCOP(com.monto_servicio)}
                          </div>
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color: sel ? col : 'var(--text)', fontFamily:'Outfit' }}>
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
      )}
    </>
  )
}
