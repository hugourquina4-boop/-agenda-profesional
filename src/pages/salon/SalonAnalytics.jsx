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

function fmtPct(n) { return n != null ? `${n}%` : '—' }

const PROF_COLORS = ['#f43f5e','#a855f7','#3b82f6','#22c55e','#f59e0b','#06b6d4','#ec4899']
const MES_LABELS  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/* ── Demo data ─────────────────────────────────────────────────────── */
const DEMO_KPI = {
  total_citas: 87, completadas: 74, no_shows: 6, canceladas: 7,
  no_show_rate: 6.9, avg_ticket: 98000, ingresos_brutos: 7252000,
}
const DEMO_HISTORIA = [
  { mes:'2025-11', ingresos_brutos:4100000, completadas:42, no_show_rate:8.2, avg_ticket:97600 },
  { mes:'2025-12', ingresos_brutos:5300000, completadas:55, no_show_rate:7.1, avg_ticket:96400 },
  { mes:'2026-01', ingresos_brutos:4800000, completadas:49, no_show_rate:7.8, avg_ticket:97900 },
  { mes:'2026-02', ingresos_brutos:5900000, completadas:61, no_show_rate:6.5, avg_ticket:96700 },
  { mes:'2026-03', ingresos_brutos:6500000, completadas:67, no_show_rate:5.9, avg_ticket:97000 },
  { mes:'2026-04', ingresos_brutos:7252000, completadas:74, no_show_rate:6.9, avg_ticket:98000 },
]
const DEMO_STAFF = [
  { nombre:'Valentina Cruz',  citas_completadas:31, ingresos_brutos:3040000, comisiones_ganadas:1368000, no_show_rate_prof:4.5 },
  { nombre:'Carlos Herrera',  citas_completadas:24, ingresos_brutos:2340000, comisiones_ganadas: 936000, no_show_rate_prof:8.3 },
  { nombre:'Isabella Torres', citas_completadas:19, ingresos_brutos:1872000, comisiones_ganadas: 655200, no_show_rate_prof:5.2 },
]
const DEMO_RETENTION = { clientes_activos:52, clientes_recurrentes:31, retention_rate:59.6 }

/* ── KPI Card ─────────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon, color, trend }) {
  return (
    <div style={{
      padding:'16px', borderRadius:16,
      background:`linear-gradient(135deg,${color}18,${color}06)`,
      boxShadow:'0 2px 14px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}20`,
          display:'flex', alignItems:'center', justifyContent:'center', color }}>
          <Ico d={icon} size={16} />
        </div>
        {trend != null && (
          <span style={{
            fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20,
            background: trend >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            color: trend >= 0 ? '#4ade80' : '#f87171',
          }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div style={{ fontSize:22, fontWeight:800, color, fontFamily:'Outfit', lineHeight:1 }}>
        {value}
      </div>
      <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

/* ── Mini bar chart ───────────────────────────────────────────────── */
function BarChart({ data, col }) {
  const max = Math.max(...data.map(d => d.ingresos_brutos || 0), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80, padding:'0 4px' }}>
      {data.map((d, i) => {
        const pct = (d.ingresos_brutos || 0) / max
        const mes  = d.mes ? MES_LABELS[parseInt(d.mes.slice(5,7)) - 1] : ''
        const isLast = i === data.length - 1
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <div style={{ width:'100%', borderRadius:'6px 6px 0 0',
              background: isLast ? col : `${col}55`,
              height:`${Math.max(pct * 100, 4)}%`,
              transition:'height 0.3s ease',
            }} />
            <span style={{ fontSize:9, color:'var(--text-3)', fontWeight:600 }}>{mes}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function SalonAnalytics() {
  const { tenant } = useTenant()
  const isDemo = !tenant
  const col = tenant?.color_primario || '#f43f5e'

  const [kpi,       setKpi]       = useState(isDemo ? DEMO_KPI       : null)
  const [historia,  setHistoria]  = useState(isDemo ? DEMO_HISTORIA  : [])
  const [staff,     setStaff]     = useState(isDemo ? DEMO_STAFF     : [])
  const [retention, setRetention] = useState(isDemo ? DEMO_RETENTION : null)
  const [loading,   setLoading]   = useState(!isDemo)
  const [tabA,      setTabA]      = useState('resumen')
  const [topServs,  setTopServs]  = useState([])
  const [heatmap,   setHeatmap]   = useState(new Array(7).fill(0)) // Lun→Dom
  const [kpiPrev,   setKpiPrev]   = useState(null) // mes anterior para comparativa

  // Finanzas
  const [gastosHist, setGastosHist] = useState([])
  const [gastosCat,  setGastosCat]  = useState([])
  const [loadingF,   setLoadingF]   = useState(false)

  async function cargarFinanzas() {
    if (!tenant || loadingF) return
    setLoadingF(true)
    try {
      const base = new Date(); base.setMonth(base.getMonth() - 5); base.setDate(1)
      const desde = base.toISOString().slice(0, 10)
      const mesActual = new Date().toISOString().slice(0, 7)
      const { data } = await supabase
        .from('gastos').select('monto,fecha,categoria')
        .eq('tenant_id', tenant.id).gte('fecha', desde)
      const porMes = {}, porCat = {}
      ;(data || []).forEach(g => {
        const mes = g.fecha.slice(0, 7)
        porMes[mes] = (porMes[mes] || 0) + Number(g.monto)
        if (mes === mesActual) {
          const cat = g.categoria || 'Otros'
          porCat[cat] = (porCat[cat] || 0) + Number(g.monto)
        }
      })
      const histArr = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1)
        const mes = d.toISOString().slice(0, 7)
        histArr.push({ mes, total: porMes[mes] || 0 })
      }
      setGastosHist(histArr)
      setGastosCat(Object.entries(porCat).map(([cat,total]) => ({cat,total})).sort((a,b) => b.total - a.total))
    } finally { setLoadingF(false) }
  }

  useEffect(() => {
    if (tabA === 'finanzas' && tenant && gastosHist.length === 0) cargarFinanzas()
  }, [tabA, tenant])

  // Informe citas
  const hoy = new Date().toISOString().slice(0,10)
  const primeroDeMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)
  const [infDesde,    setInfDesde]    = useState(primeroDeMes)
  const [infHasta,    setInfHasta]    = useState(hoy)
  const [infProf,     setInfProf]     = useState('')
  const [infEstado,   setInfEstado]   = useState('')
  const [infCitas,    setInfCitas]    = useState([])
  const [infLoading,  setInfLoading]  = useState(false)
  const [profesionales, setProfesionales] = useState([])

  const cargar = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    try {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [kpiRes, staffRes, retRes, citasRes] = await Promise.all([
        supabase.from('v_kpis_mes').select('*').eq('tenant_id', tenant.id).order('mes', { ascending: false }),
        supabase.from('v_revenue_staff').select('*').eq('tenant_id', tenant.id).order('ingresos_brutos', { ascending: false }),
        supabase.from('v_retention').select('*').eq('tenant_id', tenant.id).maybeSingle(),
        supabase.from('citas').select('fecha_inicio, servicios(id,nombre,precio)').eq('tenant_id', tenant.id).eq('estado', 'completada').gte('fecha_inicio', firstOfMonth),
      ])

      const kpiRows = kpiRes.data || []
      setKpi(kpiRows[0] || null)
      setKpiPrev(kpiRows[1] || null)
      setHistoria([...kpiRows].reverse().slice(-6))
      setStaff(staffRes.data || [])
      setRetention(retRes.data || null)

      // Heatmap día de semana (0=Dom→6=Sáb, reordenamos a Lun→Dom)
      const dow = new Array(7).fill(0)
      ;(citasRes.data || []).forEach(c => { dow[new Date(c.fecha_inicio).getDay()]++ })
      // Reordenar: Lun(1)→Dom(0)
      setHeatmap([dow[1],dow[2],dow[3],dow[4],dow[5],dow[6],dow[0]])

      // Top servicios por ingresos
      const svcMap = {}
      ;(citasRes.data || []).forEach(c => {
        const s = c.servicios
        if (!s) return
        if (!svcMap[s.id]) svcMap[s.id] = { nombre:s.nombre, precio:s.precio||0, count:0, total:0 }
        svcMap[s.id].count++
        svcMap[s.id].total += s.precio || 0
      })
      setTopServs(Object.values(svcMap).sort((a,b) => b.total - a.total).slice(0,5))
    } catch (e) {
      console.error('[SalonAnalytics]', e)
    } finally {
      setLoading(false)
    }
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!tenant) return
    supabase.from('profesionales').select('id,nombre').eq('tenant_id', tenant.id).eq('activo', true).order('nombre')
      .then(({ data }) => setProfesionales(data || []))
  }, [tenant])

  async function cargarInforme() {
    if (!tenant) return
    setInfLoading(true)
    let q = supabase.from('citas')
      .select('id, fecha_inicio, estado, clientes_agenda(nombre), servicios(nombre, precio), profesionales(nombre, id)')
      .eq('tenant_id', tenant.id)
      .gte('fecha_inicio', infDesde + 'T00:00:00')
      .lte('fecha_inicio', infHasta + 'T23:59:59')
      .order('fecha_inicio')
    if (infProf)   q = q.eq('profesional_id', infProf)
    if (infEstado) q = q.eq('estado', infEstado)
    const { data } = await q.limit(500)
    setInfCitas(data || [])
    setInfLoading(false)
  }

  function exportarInfCSV() {
    const cols = ['fecha','hora','cliente','servicio','profesional','estado','precio']
    const header = cols.join(',')
    const rows = infCitas.map(c => {
      const d = new Date(c.fecha_inicio)
      return [
        d.toLocaleDateString('es-CO'),
        d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }),
        c.clientes_agenda?.nombre || '—',
        c.servicios?.nombre || '—',
        c.profesionales?.nombre || '—',
        c.estado,
        c.servicios?.precio || 0,
      ].map(v => String(v).includes(',') ? `"${v}"` : v).join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citas-${infDesde}-${infHasta}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const ESTADO_COLOR2 = { completada:'#22c55e', confirmada:'#3b82f6', pendiente:'#f59e0b', cancelada:'#6b7280', no_asistio:'#f43f5e' }

  async function descargarPDF() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' })
    const [r, g, b] = [parseInt(col.slice(1,3),16), parseInt(col.slice(3,5),16), parseInt(col.slice(5,7),16)]
    const mesLabel = kpi?.mes ? `${MES_LABELS[parseInt(kpi.mes.slice(5,7))-1]} ${kpi.mes.slice(0,4)}` : new Date().toLocaleDateString('es-CO',{month:'long',year:'numeric'})

    doc.setFillColor(r,g,b); doc.rect(0,0,210,28,'F')
    doc.setTextColor(255,255,255)
    doc.setFontSize(16); doc.setFont('helvetica','bold')
    doc.text(tenant?.nombre || 'Salón', 14, 12)
    doc.setFontSize(10); doc.setFont('helvetica','normal')
    doc.text(`Reporte Analytics · ${mesLabel}`, 14, 20)

    doc.setTextColor(0,0,0)
    // KPIs
    const kpis = [
      ['Citas completadas', String(kpi?.completadas ?? '—')],
      ['Ingresos brutos', `$${(kpi?.ingresos_brutos||0).toLocaleString('es-CO')}`],
      ['Ticket promedio', `$${(kpi?.avg_ticket||0).toLocaleString('es-CO')}`],
      ['No-show rate', `${kpi?.no_show_rate ?? '—'}%`],
      ['Retención', `${retention?.retention_rate ?? '—'}%`],
      ['Clientes recurrentes', String(retention?.clientes_recurrentes ?? '—')],
    ]
    let x = 14, y = 42
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(r,g,b)
    doc.text('MÉTRICAS DEL MES', x, y); y += 7
    kpis.forEach(([label, val], i) => {
      if (i % 2 === 0 && i > 0) { x = 14; y += 12 }
      if (i % 2 === 1) x = 110
      doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100)
      doc.text(label, x, y)
      doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.setFontSize(12)
      doc.text(val, x, y + 6)
      doc.setFontSize(9)
      if (i % 2 === 0) x = 110
    })

    // Historial
    if (historia.length > 0) {
      y = 90
      doc.setFillColor(245,245,245); doc.rect(10, y-5, 190, 9, 'F')
      doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.text('Mes', 14, y); doc.text('Ingresos', 60, y)
      doc.text('Citas', 110, y); doc.text('No-show', 155, y); y += 8
      historia.forEach((d, i) => {
        if (i%2===0) { doc.setFillColor(252,252,252); doc.rect(10,y-4,190,7,'F') }
        doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
        doc.text(d.mes||'', 14, y)
        doc.text(`$${(d.ingresos_brutos||0).toLocaleString('es-CO')}`, 60, y)
        doc.text(String(d.completadas||0), 110, y)
        doc.text(`${d.no_show_rate||0}%`, 155, y)
        y += 7
      })
    }

    // Staff
    if (staff.length > 0) {
      y += 10
      doc.setFillColor(r,g,b,50); doc.rect(10,y-5,190,9,'F')
      doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
      doc.text('Profesional', 14, y); doc.text('Citas', 80, y)
      doc.text('Ingresos', 110, y); doc.text('Comisión', 160, y); y += 8
      staff.forEach((s, i) => {
        if (y > 270) { doc.addPage(); y = 20 }
        if (i%2===0) { doc.setFillColor(252,252,252); doc.rect(10,y-4,190,7,'F') }
        doc.setFont('helvetica','normal'); doc.setTextColor(0,0,0)
        doc.text((s.nombre||'').substring(0,22), 14, y)
        doc.text(String(s.citas_completadas||0), 80, y)
        doc.text(`$${(s.ingresos_brutos||0).toLocaleString('es-CO')}`, 110, y)
        doc.text(`$${(s.comisiones_ganadas||0).toLocaleString('es-CO')}`, 160, y)
        y += 7
      })
    }

    doc.save(`analytics-${mesLabel.replace(' ','-')}.pdf`)
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
      <div className="sp-spinner" style={{ borderTopColor:col }} />
    </div>
  )

  const maxIngresos = Math.max(...staff.map(s => s.ingresos_brutos || 0), 1)

  return (
    <>
      {isDemo && (
        <div style={{ margin:'16px 16px 0', padding:'10px 16px', borderRadius:12,
          background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)',
          fontSize:12, color:'#fbbf24', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
          <Ico d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={15} />
          Modo demo — datos de ejemplo
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ padding:'16px 16px 0', display:'flex', gap:8, overflowX:'auto', overflowY:'clip', scrollbarWidth:'none' }}>
        {[['resumen','Resumen'],['citas','Citas'],['finanzas','Finanzas']].map(([t,label]) => (
          <button key={t} onClick={() => setTabA(t)} style={{
            flexShrink:0, padding:'8px 18px', borderRadius:20, cursor:'pointer',
            fontWeight:700, fontSize:13, fontFamily:'Outfit',
            background: tabA === t ? col : 'var(--card)',
            color: tabA === t ? '#fff' : 'var(--text-3)',
            border:`1px solid ${tabA === t ? col : 'var(--border)'}`,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Tab: Informe Citas ─────────────────────────────── */}
      {tabA === 'citas' && (
        <div style={{ padding:'16px' }}>
          {/* Filtros */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:5, textTransform:'uppercase' }}>Desde</label>
                <input className="sp-input" type="date" value={infDesde} onChange={e => setInfDesde(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:5, textTransform:'uppercase' }}>Hasta</label>
                <input className="sp-input" type="date" value={infHasta} onChange={e => setInfHasta(e.target.value)} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <select className="sp-input" value={infProf} onChange={e => setInfProf(e.target.value)}>
                <option value="">Todos los profesionales</option>
                {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <select className="sp-input" value={infEstado} onChange={e => setInfEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {['pendiente','confirmada','completada','cancelada','no_asistio'].map(e => (
                  <option key={e} value={e}>{e.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <button onClick={cargarInforme} disabled={infLoading} style={{
              width:'100%', padding:'12px', borderRadius:13, border:'none', cursor:'pointer',
              background:col, color:'#fff', fontWeight:700, fontSize:14, fontFamily:'Outfit',
              opacity: infLoading ? 0.7 : 1,
            }}>
              {infLoading ? 'Cargando…' : 'Generar informe'}
            </button>
          </div>

          {/* Resumen */}
          {infCitas.length > 0 && (() => {
            const completadas = infCitas.filter(c => c.estado === 'completada')
            const totalIngresos = completadas.reduce((s,c) => s+(c.servicios?.precio||0), 0)
            return (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                  {[
                    { label:'Total citas', value:infCitas.length, color:'var(--text)' },
                    { label:'Completadas', value:completadas.length, color:'#22c55e' },
                    { label:'Ingresos est.', value:`$${(totalIngresos/1000).toFixed(0)}K`, color:col },
                  ].map(s => (
                    <div key={s.label} className="sp-kpi-card" style={{
                      background:`linear-gradient(135deg,${s.color === 'var(--text)' ? 'rgba(255,255,255,0.06)' : `${s.color}20`},transparent)`,
                      padding:'10px', textAlign:'center', gap:2,
                    }}>
                      <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:18, color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, letterSpacing:0.3 }}>{s.label.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                <button onClick={exportarInfCSV} style={{
                  width:'100%', padding:'10px', borderRadius:12, marginBottom:14,
                  background:'var(--card)', border:`1px solid ${col}44`,
                  color:col, fontWeight:700, fontSize:13, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}>
                  <Ico d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" size={14} />
                  Exportar CSV ({infCitas.length} citas)
                </button>
              </>
            )
          })()}

          {/* Lista */}
          {infCitas.length === 0 && !infLoading ? (
            <div className="sp-empty">
              <span className="sp-empty-icon">📋</span>
              <p className="sp-empty-title">Sin datos</p>
              <p className="sp-empty-sub">Selecciona rango de fechas y genera el informe</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {infCitas.map(c => {
                const d = new Date(c.fecha_inicio)
                const clr = ESTADO_COLOR2[c.estado] || 'var(--text-3)'
                return (
                  <div key={c.id} style={{
                    padding:'10px 14px', borderRadius:12,
                    background:'var(--card)', boxShadow:'0 1px 8px rgba(0,0,0,0.08)',
                    display:'flex', alignItems:'center', gap:10,
                    position:'relative', overflow:'hidden',
                  }}>
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:clr }} />
                    <div style={{ flex:1, paddingLeft:8 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>
                        {c.clientes_agenda?.nombre || '—'}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                        {d.toLocaleDateString('es-CO',{day:'numeric',month:'short'})} {d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})} · {c.servicios?.nombre || '—'} · {c.profesionales?.nombre?.split(' ')[0] || '—'}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0 }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6,
                        background:`${clr}18`, color:clr, textTransform:'capitalize' }}>
                        {c.estado?.replace('_',' ')}
                      </span>
                      {c.servicios?.precio > 0 && (
                        <span style={{ fontFamily:'Outfit', fontWeight:700, fontSize:12, color:col }}>
                          ${Number(c.servicios.precio).toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Finanzas ─────────────────────────────────── */}
      {tabA === 'finanzas' && (
        <div style={{ padding:'16px' }}>
          {loadingF ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
              <div className="sp-spinner" style={{ borderTopColor:col }} />
            </div>
          ) : (() => {
            const mesActual = new Date().toISOString().slice(0, 7)
            const ingresosMes = historia.find(h => h.mes === mesActual)?.ingresos_brutos || 0
            const gastosMesTotal = gastosHist.find(h => h.mes === mesActual)?.total || 0
            const utilidad = ingresosMes - gastosMesTotal
            const margen = ingresosMes > 0 ? Math.round(utilidad / ingresosMes * 100) : 0
            const maxBar = Math.max(...historia.map(h => h.ingresos_brutos || 0), ...gastosHist.map(h => h.total), 1)
            const totalGastosCat = gastosCat.reduce((s,c) => s + c.total, 0)

            const CAT_COLORS2 = {
              Insumos:'#f43f5e', Equipos:'#3b82f6', Servicios:'#a855f7',
              Arriendo:'#f59e0b', Publicidad:'#ec4899', Nómina:'#22c55e', Otros:'#6b7280',
            }

            return (
              <>
                {/* 4 KPIs */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                  {[
                    { label:'Ingresos mes',  value:fmtCOP(ingresosMes),      color:'#4ade80', icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { label:'Gastos mes',    value:fmtCOP(gastosMesTotal),    color:'#f87171', icon:'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
                    { label:'Utilidad neta', value:fmtCOP(Math.abs(utilidad)), color: utilidad >= 0 ? '#4ade80' : '#f87171', icon:'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                    { label:'Margen',        value:`${margen}%`,              color: margen >= 40 ? '#4ade80' : margen >= 20 ? '#f59e0b' : '#f87171', icon:'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' },
                  ].map(k => (
                    <div key={k.label} style={{
                      padding:'14px 16px', borderRadius:16,
                      background:`linear-gradient(135deg,${k.color}18,${k.color}06)`,
                      boxShadow:'0 2px 12px rgba(0,0,0,0.09)',
                    }}>
                      <div style={{ width:30, height:30, borderRadius:9, background:`${k.color}20`,
                        display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8, color:k.color }}>
                        <Ico d={k.icon} size={14} />
                      </div>
                      <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:k.color }}>{k.value}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.4, marginTop:3 }}>
                        {k.label.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gráfico 6 meses ingresos vs gastos */}
                {(historia.length > 0 || gastosHist.some(h => h.total > 0)) && (
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', marginBottom:16, boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:14 }}>
                      Ingresos vs Gastos — últimos 6 meses
                    </div>
                    {/* Leyenda */}
                    <div style={{ display:'flex', gap:14, marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ width:10, height:10, borderRadius:3, background:`${col}cc`, display:'inline-block' }} />
                        <span style={{ fontSize:11, color:'var(--text-3)' }}>Ingresos</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ width:10, height:10, borderRadius:3, background:'rgba(239,68,68,0.7)', display:'inline-block' }} />
                        <span style={{ fontSize:11, color:'var(--text-3)' }}>Gastos</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:90 }}>
                      {Array.from({length:6}, (_,i) => {
                        const d = new Date(); d.setMonth(d.getMonth() - (5-i)); d.setDate(1)
                        const mes = d.toISOString().slice(0,7)
                        const ing = historia.find(h => h.mes === mes)?.ingresos_brutos || 0
                        const gst = gastosHist.find(h => h.mes === mes)?.total || 0
                        const label = MES_LABELS[d.getMonth()]
                        return (
                          <div key={mes} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                            <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:72 }}>
                              <div style={{ flex:1, borderRadius:'4px 4px 0 0',
                                background: mes === mesActual ? col : `${col}55`,
                                height:`${Math.max(ing/maxBar*100,2)}%`,
                                transition:'height 0.3s',
                              }} />
                              <div style={{ flex:1, borderRadius:'4px 4px 0 0',
                                background: gst > 0 ? 'rgba(239,68,68,0.65)' : 'transparent',
                                height:`${Math.max(gst/maxBar*100,gst>0?2:0)}%`,
                                transition:'height 0.3s',
                              }} />
                            </div>
                            <span style={{ fontSize:9, color:'var(--text-3)', fontWeight:600 }}>{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Breakdown categorías */}
                {gastosCat.length > 0 && (
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:14 }}>
                      Gastos por categoría — mes actual
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {gastosCat.map(c => {
                        const pct = totalGastosCat > 0 ? Math.round(c.total / totalGastosCat * 100) : 0
                        const color = CAT_COLORS2[c.cat] || '#6b7280'
                        return (
                          <div key={c.cat}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:12, fontWeight:700, color:'var(--text-2)' }}>{c.cat}</span>
                              <span style={{ fontSize:12, fontWeight:800, color }}>
                                {fmtCOP(c.total)} <span style={{ fontWeight:500, color:'var(--text-3)' }}>({pct}%)</span>
                              </span>
                            </div>
                            <div style={{ height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.4s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {gastosHist.every(h => h.total === 0) && gastosCat.length === 0 && (
                  <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-3)' }}>
                    <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
                    <div style={{ fontSize:14, fontWeight:600 }}>Sin gastos registrados aún</div>
                    <div style={{ fontSize:12, marginTop:4 }}>
                      Registra gastos en el módulo Proveedores para ver el análisis aquí.
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {tabA === 'resumen' && (<>

      {/* ── KPIs del mes ──────────────────────────────────── */}
      <div className="sp-section" style={{ marginTop:20 }}>
        <span className="sp-section-title">Este mes</span>
        {kpi && (
          <button onClick={descargarPDF} style={{
            padding:'5px 14px', borderRadius:9, cursor:'pointer',
            background:`${col}18`, border:`1px solid ${col}40`,
            color:col, fontWeight:700, fontSize:12,
          }}>↓ PDF</button>
        )}
      </div>

      <div style={{ padding:'0 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {(() => {
          const trendCitas = kpiPrev?.completadas > 0
            ? Math.round(((kpi?.completadas||0) - kpiPrev.completadas) / kpiPrev.completadas * 100) : null
          const trendIng = kpiPrev?.ingresos_brutos > 0
            ? Math.round(((kpi?.ingresos_brutos||0) - kpiPrev.ingresos_brutos) / kpiPrev.ingresos_brutos * 100) : null
          return (<>
            <KpiCard
              label="Citas completadas"
              value={kpi?.completadas ?? '—'}
              sub={`de ${kpi?.total_citas ?? '—'} totales`}
              icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              color="#4ade80"
              trend={trendCitas}
            />
            <KpiCard
              label="Ingresos brutos"
              value={fmtCOP(kpi?.ingresos_brutos)}
              sub={`ticket prom. ${fmtCOP(kpi?.avg_ticket)}`}
              icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              color={col}
              trend={trendIng}
            />
          </>)
        })()}
        <KpiCard
          label="No-show rate"
          value={fmtPct(kpi?.no_show_rate)}
          sub={`${kpi?.no_shows ?? 0} cita${kpi?.no_shows !== 1 ? 's' : ''} sin asistir`}
          icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          color="#f87171"
        />
        <KpiCard
          label="Retención clientes"
          value={fmtPct(retention?.retention_rate)}
          sub={`${retention?.clientes_recurrentes ?? 0} recurrentes`}
          icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          color="#c084fc"
        />
      </div>

      {/* ── Gráfico histórico ─────────────────────────────── */}
      {historia.length > 1 && (
        <>
          <div className="sp-section" style={{ marginTop:20 }}>
            <span className="sp-section-title">Ingresos últimos 6 meses</span>
          </div>
          <div style={{ margin:'0 16px', padding:'16px', borderRadius:16,
            background:'var(--card)', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
            <BarChart data={historia} col={col} />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, gap:8,
              flexWrap:'wrap' }}>
              {historia.map((d, i) => (
                <div key={i} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', fontFamily:'Outfit' }}>
                    {fmtCOP(d.ingresos_brutos)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Revenue por profesional ───────────────────────── */}
      <div className="sp-section" style={{ marginTop:20 }}>
        <span className="sp-section-title">Rendimiento del equipo</span>
        <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>mes actual</span>
      </div>

      {staff.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon">📊</span>
          <p className="sp-empty-title">Sin datos aún</p>
          <p className="sp-empty-sub">Aparecerá aquí cuando haya citas completadas</p>
        </div>
      ) : (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {staff.map((prof, i) => {
            const color   = PROF_COLORS[i % PROF_COLORS.length]
            const barPct  = ((prof.ingresos_brutos || 0) / maxIngresos) * 100

            return (
              <div key={i} style={{
                padding:'16px', borderRadius:16,
                background:`linear-gradient(135deg,${color}14,var(--card))`,
                boxShadow:'0 2px 14px rgba(0,0,0,0.1)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${color}22`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Outfit', fontWeight:800, fontSize:15, color, flexShrink:0 }}>
                    {prof.nombre[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>
                      {prof.nombre.split(' ')[0]}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>
                      {prof.citas_completadas ?? 0} citas
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:16, fontWeight:800, color, fontFamily:'Outfit' }}>
                      {fmtCOP(prof.ingresos_brutos)}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>
                      com. {fmtCOP(prof.comisiones_ganadas)}
                    </div>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div style={{ height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, background:color,
                    width:`${barPct}%`, transition:'width 0.4s ease' }} />
                </div>

                {/* Métricas secundarias */}
                <div style={{ display:'flex', gap:16, marginTop:10 }}>
                  <div>
                    <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:700,
                      textTransform:'uppercase', letterSpacing:0.5 }}>No-show</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)',
                      marginLeft:6, fontFamily:'Outfit' }}>
                      {fmtPct(prof.no_show_rate_prof)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:700,
                      textTransform:'uppercase', letterSpacing:0.5 }}>Ticket prom.</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)',
                      marginLeft:6, fontFamily:'Outfit' }}>
                      {prof.citas_completadas
                        ? fmtCOP(Math.round((prof.ingresos_brutos || 0) / prof.citas_completadas))
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* ── Top Servicios ────────────────────────────────── */}
      {topServs.length > 0 && (<>
        <div className="sp-section" style={{ marginTop:20 }}>
          <span className="sp-section-title">Top servicios</span>
          <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>este mes</span>
        </div>
        <div style={{ padding:'0 16px' }}>
          <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
            {(() => {
              const maxT = Math.max(...topServs.map(s => s.total), 1)
              return topServs.map((s, i) => {
                const sColor = PROF_COLORS[i % PROF_COLORS.length]
                const pct = Math.round(s.total / maxT * 100)
                return (
                  <div key={s.nombre} style={{ marginBottom: i < topServs.length-1 ? 14 : 0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', display:'block',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nombre}</span>
                        <span style={{ fontSize:10, color:'var(--text-3)' }}>{s.count} cita{s.count !== 1 ? 's' : ''}</span>
                      </div>
                      <span style={{ fontFamily:'Outfit', fontWeight:800, fontSize:14, color:sColor, marginLeft:8, flexShrink:0 }}>
                        {fmtCOP(s.total)}
                      </span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:sColor, borderRadius:3, transition:'width 0.4s' }} />
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      </>)}

      {/* ── Heatmap días semana ───────────────────────────── */}
      {heatmap.some(v => v > 0) && (<>
        <div className="sp-section" style={{ marginTop:20 }}>
          <span className="sp-section-title">Días más activos</span>
          <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>citas completadas</span>
        </div>
        <div style={{ padding:'0 16px' }}>
          <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
            {(() => {
              const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
              const maxH = Math.max(...heatmap, 1)
              return (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
                  {dias.map((dia, i) => {
                    const val = heatmap[i]
                    const pct = val / maxH
                    const intensity = Math.round(pct * 100)
                    const isMax = val === maxH && val > 0
                    return (
                      <div key={dia} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                        <div style={{
                          width:'100%', aspectRatio:'1/1', borderRadius:10,
                          background: val === 0 ? 'var(--border)' : `${col}`,
                          opacity: val === 0 ? 0.3 : Math.max(0.18, pct),
                          display:'flex', alignItems:'center', justifyContent:'center',
                          position:'relative',
                          boxShadow: isMax ? `0 0 10px ${col}60` : 'none',
                          border: isMax ? `1.5px solid ${col}` : '1.5px solid transparent',
                        }}>
                          <span style={{
                            fontFamily:'Outfit', fontWeight:800,
                            fontSize: val >= 10 ? 13 : 15,
                            color: pct > 0.4 ? '#fff' : 'var(--text)',
                          }}>{val}</span>
                        </div>
                        <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:700 }}>{dia}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </>)}

      <div style={{ height:24 }} />
      </>)}
    </>
  )
}
