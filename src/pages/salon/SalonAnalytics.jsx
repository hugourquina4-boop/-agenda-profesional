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
const COSTOS_CATS = new Set(['Insumos','Productos','Materiales','Compras','Costo productos','Producto'])

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
  const [fuenteData,setFuenteData]= useState([]) // captación por canal
  const [segData,   setSegData]   = useState(null) // {nuevos, recurrentes, vip, total}
  const [cliNuevosMes, setCliNuevosMes] = useState([])

  // Finanzas
  const [gastosHist, setGastosHist] = useState([])
  const [gastosCat,  setGastosCat]  = useState([])
  const [loadingF,   setLoadingF]   = useState(false)

  // Gerencial
  const [gerPeriodo, setGerPeriodo] = useState('mes')
  const [gerData,    setGerData]    = useState(null)
  const [loadingGer, setLoadingGer] = useState(false)

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

  function gerDates(p) {
    const n = new Date(), y = n.getFullYear(), m = n.getMonth()
    const todayISO = n.toISOString().slice(0,10)
    const fmt = (yr, mo, d) => `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    if (p === 'semana') {
      const dow = (n.getDay() + 6) % 7
      const mon = new Date(n); mon.setDate(n.getDate() - dow)
      return { desde: mon.toISOString().slice(0,10), hasta: todayISO, label: 'Esta semana' }
    }
    if (p === 'mes_ant') {
      const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y
      return { desde: fmt(py, pm, 1), hasta: new Date(y, m, 0).toISOString().slice(0,10), label: `${MES_LABELS[pm]} ${py}` }
    }
    if (p === 'bimestre') {
      const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y
      return { desde: fmt(py, pm, 1), hasta: todayISO, label: `${MES_LABELS[pm]}–${MES_LABELS[m]} ${y}` }
    }
    if (p === 'trimestre') {
      const pm = ((m - 2) % 12 + 12) % 12, py = m < 2 ? y - 1 : y
      return { desde: fmt(py, pm, 1), hasta: todayISO, label: `Trim. ${MES_LABELS[pm]}–${MES_LABELS[m]} ${y}` }
    }
    return { desde: fmt(y, m, 1), hasta: todayISO, label: `${MES_LABELS[m]} ${y}` }
  }

  async function cargarGerencial(p) {
    if (!tenant) return
    setLoadingGer(true)
    setGerData(null)
    const { desde, hasta, label } = gerDates(p || gerPeriodo)
    try {
      const [{ data: pagosD }, { data: citasD }, { data: gastosD }, { data: anticiposD }, { data: inventD }] = await Promise.all([
        supabase.from('pagos').select('monto').eq('tenant_id', tenant.id).eq('estado','pagado')
          .gte('created_at', desde + 'T00:00:00').lte('created_at', hasta + 'T23:59:59'),
        supabase.from('citas').select('precio_cobrado, servicios(nombre, categoria, precio)')
          .eq('tenant_id', tenant.id).eq('estado','completada')
          .gte('fecha_inicio', desde + 'T00:00:00').lte('fecha_inicio', hasta + 'T23:59:59'),
        supabase.from('gastos').select('monto, categoria, concepto')
          .eq('tenant_id', tenant.id).gte('fecha', desde).lte('fecha', hasta),
        supabase.from('anticipos_profesional').select('monto, tipo')
          .eq('tenant_id', tenant.id).gte('created_at', desde + 'T00:00:00').lte('created_at', hasta + 'T23:59:59'),
        supabase.from('productos_salon').select('stock, precio_costo')
          .eq('tenant_id', tenant.id).eq('activo', true),
      ])
      const pagosTot = (pagosD||[]).reduce((s,p) => s + Number(p.monto), 0)
      const citasTot = (citasD||[]).reduce((s,c) => s + Number(c.precio_cobrado || c.servicios?.precio || 0), 0)
      const totalIngresos = pagosTot > 0 ? pagosTot : citasTot

      const catMap = {}
      ;(citasD||[]).forEach(c => {
        const cat = c.servicios?.categoria || 'Servicios'
        const val = Number(c.precio_cobrado || c.servicios?.precio || 0)
        if (!catMap[cat]) catMap[cat] = { count:0, total:0 }
        catMap[cat].count++; catMap[cat].total += val
      })
      const ingPorCat = Object.entries(catMap).map(([cat,v]) => ({ cat, ...v })).sort((a,b) => b.total-a.total)

      const gastosArr = gastosD || []
      const costosArr = gastosArr.filter(g => COSTOS_CATS.has(g.categoria))
      const operArr   = gastosArr.filter(g => !COSTOS_CATS.has(g.categoria))
      const totalCostosD = costosArr.reduce((s,g) => s + Number(g.monto), 0)

      const nominaAnt = (anticiposD||[]).filter(a => a.tipo === 'anticipo').reduce((s,a) => s + Number(a.monto), 0)
      const gastosOpMap = {}
      operArr.forEach(g => { const c = g.categoria || 'Otros'; gastosOpMap[c] = (gastosOpMap[c]||0) + Number(g.monto) })
      if (nominaAnt > 0 && !gastosOpMap['Nómina']) gastosOpMap['Nómina'] = nominaAnt
      const gastosOpArr = Object.entries(gastosOpMap).map(([cat,total]) => ({ cat, total })).sort((a,b) => b.total-a.total)
      const totalGastosOp = gastosOpArr.reduce((s,g) => s + g.total, 0)

      const utilBruta  = totalIngresos - totalCostosD
      const margenB    = totalIngresos > 0 ? Math.round(utilBruta / totalIngresos * 1000) / 10 : 0
      const utilOper   = utilBruta - totalGastosOp
      const margenN    = totalIngresos > 0 ? Math.round(utilOper / totalIngresos * 1000) / 10 : 0
      const ivaGen     = Math.round(totalIngresos * 0.19)
      const ivaDes     = Math.round(totalCostosD * 0.19)
      const peBreak    = utilBruta > 0 && totalIngresos > 0 ? Math.round(totalGastosOp / (utilBruta / totalIngresos)) : 0
      const valorInv   = (inventD||[]).reduce((s,p) => s + Number(p.stock||0) * Number(p.precio_costo||0), 0)

      setGerData({
        periodo: { desde, hasta, label },
        numCitas: (citasD||[]).length,
        ingresos: { total: totalIngresos, porCat: ingPorCat },
        costos: { total: totalCostosD, detalle: costosArr },
        utilidadBruta: utilBruta, margenBruto: margenB,
        gastosOp: { total: totalGastosOp, detalle: gastosOpArr },
        utilidadOper: utilOper, margenNeto: margenN,
        iva: { generado: ivaGen, descontable: ivaDes, aPagar: Math.max(0, ivaGen - ivaDes) },
        kpis: { margenBruto: margenB, peBreak, ticketProm: (citasD||[]).length > 0 ? Math.round(totalIngresos / (citasD||[]).length) : 0, valorInv, numCitas: (citasD||[]).length },
      })
    } catch(e) { console.error('[Gerencial]', e) }
    finally { setLoadingGer(false) }
  }

  useEffect(() => {
    if (tabA === 'gerencial' && tenant) cargarGerencial(gerPeriodo)
  }, [tabA, tenant, gerPeriodo])

  // Ventas por método y servicio
  const [ventasMetodo,   setVentasMetodo]   = useState([])
  const [ventasServicio, setVentasServicio] = useState([])
  const [ventasProf,     setVentasProf]     = useState([])
  const [ventasRango,    setVentasRango]    = useState({ desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10), hasta: new Date().toISOString().slice(0,10) })
  const [loadingV,       setLoadingV]       = useState(false)

  async function cargarVentas() {
    if (!tenant) return
    setLoadingV(true)
    try {
      const [{ data: pagosData }, { data: citasData }] = await Promise.all([
        supabase.from('pagos').select('monto,metodo,estado,created_at')
          .eq('tenant_id', tenant.id).eq('estado','pagado')
          .gte('created_at', ventasRango.desde + 'T00:00:00')
          .lte('created_at', ventasRango.hasta + 'T23:59:59'),
        supabase.from('citas').select('servicios(nombre,precio),profesionales(nombre),estado')
          .eq('tenant_id', tenant.id).eq('estado','completada')
          .gte('fecha_inicio', ventasRango.desde + 'T00:00:00')
          .lte('fecha_inicio', ventasRango.hasta + 'T23:59:59'),
      ])
      // Por método de pago
      const metodoMap = {}
      ;(pagosData || []).forEach(p => {
        const m = p.metodo || 'otro'
        metodoMap[m] = (metodoMap[m] || 0) + Number(p.monto)
      })
      setVentasMetodo(Object.entries(metodoMap).map(([metodo,total]) => ({metodo,total})).sort((a,b) => b.total-a.total))
      // Por servicio
      const svcMap = {}
      ;(citasData || []).forEach(c => {
        const n = c.servicios?.nombre || 'Sin nombre'; const p = c.servicios?.precio || 0
        if (!svcMap[n]) svcMap[n] = { nombre:n, count:0, total:0 }
        svcMap[n].count++; svcMap[n].total += p
      })
      setVentasServicio(Object.values(svcMap).sort((a,b) => b.total-a.total).slice(0,10))
      // Por profesional
      const profMap = {}
      ;(citasData || []).forEach(c => {
        const n = c.profesionales?.nombre || 'Sin asignar'; const p = c.servicios?.precio || 0
        if (!profMap[n]) profMap[n] = { nombre:n, count:0, total:0 }
        profMap[n].count++; profMap[n].total += p
      })
      setVentasProf(Object.values(profMap).sort((a,b) => b.total-a.total))
    } finally { setLoadingV(false) }
  }

  useEffect(() => {
    if (tabA === 'ventas' && tenant) cargarVentas()
  }, [tabA, tenant, ventasRango])

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

      const [kpiRes, staffRes, retRes, citasRes, fuenteRes, cliSegRes] = await Promise.all([
        supabase.from('v_kpis_mes').select('*').eq('tenant_id', tenant.id).order('mes', { ascending: false }),
        supabase.from('v_revenue_staff').select('*').eq('tenant_id', tenant.id).order('ingresos_brutos', { ascending: false }),
        supabase.from('v_retention').select('*').eq('tenant_id', tenant.id).maybeSingle(),
        supabase.from('citas').select('fecha_inicio, servicios(id,nombre,precio)').eq('tenant_id', tenant.id).eq('estado', 'completada').gte('fecha_inicio', firstOfMonth),
        supabase.from('clientes_agenda').select('fuente_captacion').eq('tenant_id', tenant.id).not('fuente_captacion', 'is', null),
        supabase.from('clientes_agenda').select('id, num_visitas, segmento, created_at').eq('tenant_id', tenant.id).eq('activo', true),
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

      // Captación por canal
      const fMap = {}
      ;(fuenteRes.data || []).forEach(c => {
        const f = c.fuente_captacion || 'otro'
        fMap[f] = (fMap[f] || 0) + 1
      })
      setFuenteData(Object.entries(fMap).map(([canal, count]) => ({ canal, count })).sort((a,b) => b.count - a.count))

      // Segmentación de clientes
      const cliAll = cliSegRes.data || []
      const mesIso = firstOfMonth.slice(0, 7)
      setSegData({
        total:        cliAll.length,
        nuevos:       cliAll.filter(c => c.created_at?.slice(0, 7) === mesIso).length,
        recurrentes:  cliAll.filter(c => (c.num_visitas || 0) >= 2).length,
        vip:          cliAll.filter(c => c.segmento === 'vip' || c.segmento === 'frecuente').length,
      })
      // Tendencia nuevos clientes — últimos 6 meses
      setCliNuevosMes(Array.from({ length:6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        const iso = d.toISOString().slice(0, 7)
        return {
          mes: iso,
          label: d.toLocaleDateString('es-CO', { month:'short' }),
          count: cliAll.filter(c => c.created_at?.slice(0, 7) === iso).length,
        }
      }))
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

  async function exportarPDFGerencial(data) {
    const d = data || gerData
    if (!d) return
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' })
    const [r, g, b] = [parseInt(col.slice(1,3),16), parseInt(col.slice(3,5),16), parseInt(col.slice(5,7),16)]
    const W = 210, M = 14
    let y = 0
    const fmtN = n => n >= 0 ? `$${Math.round(n).toLocaleString('es-CO')}` : `($${Math.round(Math.abs(n)).toLocaleString('es-CO')})`
    const pctOf = n => d.ingresos.total > 0 ? `${Math.round(n/d.ingresos.total*100)}%` : '—'

    // ── Header ──
    doc.setFillColor(r,g,b); doc.rect(0,0,W,34,'F')
    doc.setTextColor(255,255,255)
    doc.setFontSize(14); doc.setFont('helvetica','bold')
    doc.text('INFORME DE GESTIÓN FINANCIERA', M, 13)
    doc.setFontSize(9); doc.setFont('helvetica','normal')
    doc.text(tenant?.nombre || 'Salón', M, 21)
    doc.text(`Período: ${d.periodo.label}`, W-M, 21, { align:'right' })
    doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, W-M, 28, { align:'right' })
    y = 44

    function secHdr(title) {
      doc.setFillColor(r,g,b); doc.rect(M, y-5, W-M*2, 8, 'F')
      doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold')
      doc.text(title, M+3, y+0.5); y += 9
    }
    function plRow(label, amount, pctStr, bold, indent) {
      if (y > 272) { doc.addPage(); y = 20 }
      if (bold) { doc.setFillColor(245,245,250); doc.rect(M,y-3,W-M*2,7,'F') }
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(40,40,40); doc.setFontSize(bold ? 9 : 8)
      doc.text(label, M+(indent?6:2), y+1)
      doc.text(fmtN(amount), W-M-20, y+1, { align:'right' })
      if (pctStr) { doc.setTextColor(130,130,130); doc.setFontSize(7); doc.text(pctStr, W-M-2, y+1, { align:'right' }) }
      y += 7
    }

    // ── Estado de Resultados ──
    secHdr('ESTADO DE RESULTADOS')
    doc.setTextColor(r,g,b); doc.setFontSize(7); doc.setFont('helvetica','bold')
    doc.text('INGRESOS OPERACIONALES', M+2, y+1); y += 6
    if (d.ingresos.porCat.length > 0) d.ingresos.porCat.forEach(c => plRow(c.cat, c.total, pctOf(c.total), false, true))
    else plRow('Servicios', d.ingresos.total, '100%', false, true)
    plRow('TOTAL INGRESOS', d.ingresos.total, '100%', true)
    y += 2

    if (d.costos.total > 0) {
      doc.setTextColor(200,40,40); doc.setFontSize(7); doc.setFont('helvetica','bold')
      doc.text('COSTO DE VENTAS', M+2, y+1); y += 6
      const catC = {}
      d.costos.detalle.forEach(g => { catC[g.categoria||'Insumos'] = (catC[g.categoria||'Insumos']||0)+Number(g.monto) })
      Object.entries(catC).forEach(([c,t]) => plRow(c,-t,pctOf(t),false,true))
      plRow('TOTAL COSTO VENTAS', -d.costos.total, pctOf(d.costos.total), true)
      y += 2
    }

    // Utilidad Bruta destacada
    const ubColor = d.utilidadBruta >= 0 ? [220,255,220] : [255,220,220]
    doc.setFillColor(...ubColor); doc.rect(M,y-3,W-M*2,9,'F')
    doc.setFont('helvetica','bold'); doc.setTextColor(d.utilidadBruta >= 0 ? 20 : 180, d.utilidadBruta >= 0 ? 120 : 20, 20); doc.setFontSize(10)
    doc.text('UTILIDAD BRUTA', M+2, y+2.5); doc.text(fmtN(d.utilidadBruta), W-M-20, y+2.5, { align:'right' })
    doc.setFontSize(8); doc.setTextColor(80,80,80); doc.text(`${d.margenBruto}%`, W-M-2, y+2.5, { align:'right' })
    y += 12

    if (d.gastosOp.total > 0) {
      doc.setTextColor(160,100,0); doc.setFontSize(7); doc.setFont('helvetica','bold')
      doc.text('GASTOS OPERACIONALES', M+2, y+1); y += 6
      d.gastosOp.detalle.forEach(g => plRow(g.cat,-g.total,pctOf(g.total),false,true))
      plRow('TOTAL GASTOS OPER.', -d.gastosOp.total, pctOf(d.gastosOp.total), true)
      y += 2
    }

    // Utilidad Operativa
    doc.setFillColor(r,g,b); doc.rect(M,y-3,W-M*2,10,'F')
    doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255); doc.setFontSize(11)
    doc.text('UTILIDAD OPERATIVA', M+2, y+3); doc.text(fmtN(d.utilidadOper), W-M-20, y+3, { align:'right' })
    doc.setFontSize(8); doc.text(`${d.margenNeto}%`, W-M-2, y+3, { align:'right' })
    y += 16

    // ── Tablero Gerencial ──
    if (y > 220) { doc.addPage(); y = 20 }
    secHdr('TABLERO GERENCIAL — INDICADORES CLAVE')
    const kpis = [
      ['Margen Bruto',      `${d.kpis.margenBruto}%`],
      ['Margen Neto',       `${d.margenNeto}%`],
      ['Punto de Equilibrio', fmtN(d.kpis.peBreak)],
      ['Ticket Promedio',   fmtCOP(d.kpis.ticketProm)],
      ['Citas del Período', String(d.kpis.numCitas)],
      ['Valor Inventario',  fmtCOP(d.kpis.valorInv)],
    ]
    const bgKpi = [[220,255,220],[220,255,220],[235,235,255],[200,230,255],[245,245,245],[240,220,255]]
    kpis.forEach(([lbl,val], i) => {
      const xPos = i%2 === 0 ? M : M+93
      if (i%2 === 0) {
        doc.setFillColor(...(bgKpi[i]||[245,245,245])); doc.rect(M,y-2,88,13,'F')
        doc.setFillColor(...(bgKpi[i+1]||[245,245,245])); doc.rect(M+93,y-2,88,13,'F')
      }
      doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont('helvetica','normal')
      doc.text(lbl.toUpperCase(), xPos+3, y+3)
      doc.setTextColor(20,20,20); doc.setFontSize(10); doc.setFont('helvetica','bold')
      doc.text(val, xPos+3, y+9.5)
      if (i%2 === 1) y += 15
    })
    y += 18

    // ── IVA Estimado ──
    if (y > 240) { doc.addPage(); y = 20 }
    secHdr('IVA ESTIMADO (19%) — SOLO ORIENTATIVO')
    plRow(`IVA Generado (ingresos $${Math.round(d.ingresos.total).toLocaleString('es-CO')} × 19%)`, d.iva.generado, pctOf(d.iva.generado))
    plRow(`IVA Descontable (costos $${Math.round(d.costos.total).toLocaleString('es-CO')} × 19%)`, -d.iva.descontable, pctOf(d.iva.descontable))
    plRow('IVA A PAGAR (ESTIMADO)', d.iva.aPagar, null, true)
    y += 6

    // Nota legal
    doc.setFillColor(255,250,220); doc.rect(M,y,W-M*2,16,'F')
    doc.setTextColor(100,80,0); doc.setFontSize(7); doc.setFont('helvetica','italic')
    doc.text('* Informe generado automáticamente por Salón Pro. Basado en datos registrados en la plataforma.', M+3, y+5)
    doc.text('* El cálculo de IVA es una estimación. Consulte a su contador para la declaración oficial ante la DIAN.', M+3, y+10)
    doc.text('* Este documento no reemplaza los estados financieros oficiales preparados por un contador público.', M+3, y+15)

    doc.save(`informe-gerencial-${d.periodo.label.replace(/[\s–\/]/g,'-').toLowerCase()}.pdf`)
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
      <div className="sp-tabs-scroll" style={{ padding:'16px 16px 0', gap:8, scrollbarWidth:'none' }}>
        {[['resumen','Resumen'],['ventas','Ventas'],['citas','Citas'],['finanzas','Finanzas'],['gerencial','Gerencial']].map(([t,label]) => (
          <button key={t} onClick={() => setTabA(t)} style={{
            flexShrink:0, padding:'8px 18px', borderRadius:20, cursor:'pointer',
            fontWeight:700, fontSize:13, fontFamily:'Outfit',
            background: tabA === t ? col : 'var(--card)',
            color: tabA === t ? '#fff' : 'var(--text-3)',
            border:`1px solid ${tabA === t ? col : 'var(--border)'}`,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Tab: Ventas ─────────────────────────────────────── */}
      {tabA === 'ventas' && (
        <div style={{ padding:'16px' }}>
          {/* Selector de fechas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:5, textTransform:'uppercase' }}>Desde</label>
              <input className="sp-input" type="date" value={ventasRango.desde}
                onChange={e => setVentasRango(r => ({...r, desde:e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-3)', fontWeight:700, letterSpacing:0.5, display:'block', marginBottom:5, textTransform:'uppercase' }}>Hasta</label>
              <input className="sp-input" type="date" value={ventasRango.hasta}
                onChange={e => setVentasRango(r => ({...r, hasta:e.target.value}))} />
            </div>
          </div>
          {/* Chips período rápido */}
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {[
              { label:'Hoy', desde:new Date().toISOString().slice(0,10), hasta:new Date().toISOString().slice(0,10) },
              { label:'Esta semana', desde:(() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10) })(), hasta:new Date().toISOString().slice(0,10) },
              { label:'Este mes', desde:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10), hasta:new Date().toISOString().slice(0,10) },
              { label:'Mes anterior', desde:new Date(new Date().getFullYear(),new Date().getMonth()-1,1).toISOString().slice(0,10), hasta:new Date(new Date().getFullYear(),new Date().getMonth(),0).toISOString().slice(0,10) },
            ].map(p => {
              const active = ventasRango.desde===p.desde && ventasRango.hasta===p.hasta
              return (
                <button key={p.label} onClick={() => setVentasRango({desde:p.desde,hasta:p.hasta})} style={{
                  padding:'5px 12px', borderRadius:16, fontSize:11, fontWeight:700, cursor:'pointer',
                  border:`1.5px solid ${active ? col : 'var(--border)'}`,
                  background: active ? `${col}18` : 'var(--card)',
                  color: active ? col : 'var(--text-3)',
                }}>{p.label}</button>
              )
            })}
          </div>

          {loadingV ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
              <div className="sp-spinner" style={{ borderTopColor:col }} />
            </div>
          ) : (() => {
            const totalVentas = ventasMetodo.reduce((s,m) => s+m.total, 0)
            const maxSvc = Math.max(...ventasServicio.map(s => s.total), 1)
            const maxProf = Math.max(...ventasProf.map(p => p.total), 1)
            const METODO_CLR    = { efectivo:'#22c55e', nequi:'#a855f7', daviplata:'#f59e0b', tarjeta:'#3b82f6', transferencia:'#06b6d4', wompi:'#10b981', otro:'#6b7280' }
            const METODO_LABELS = { wompi:'🌐 Portal' }
            return (
              <>
                {/* KPI total */}
                <div style={{ padding:'18px 20px', borderRadius:16, marginBottom:16,
                  background:`linear-gradient(135deg,${col}20,${col}08)`,
                  boxShadow:`0 4px 24px ${col}15`,
                }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:0.5, textTransform:'uppercase', marginBottom:6 }}>Total cobrado en período</div>
                  <div style={{ fontFamily:'Outfit', fontWeight:900, fontSize:32, color:col, lineHeight:1 }}>
                    {fmtCOP(totalVentas)}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:6 }}>
                    {ventasServicio.reduce((s,v) => s+v.count, 0)} citas completadas
                  </div>
                </div>

                {/* Métodos de pago */}
                {ventasMetodo.length > 0 && (
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', marginBottom:16, boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:14 }}>Métodos de pago</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {ventasMetodo.map(m => {
                        const pct = totalVentas > 0 ? Math.round(m.total/totalVentas*100) : 0
                        const clr = METODO_CLR[m.metodo] || '#6b7280'
                        return (
                          <div key={m.metodo}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                              <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', textTransform: METODO_LABELS[m.metodo] ? 'none' : 'capitalize' }}>{METODO_LABELS[m.metodo] || m.metodo}</span>
                              <span style={{ fontSize:12, fontWeight:800, color:clr }}>{fmtCOP(m.total)} <span style={{ fontWeight:500, color:'var(--text-3)' }}>({pct}%)</span></span>
                            </div>
                            <div style={{ height:6, borderRadius:4, background:'rgba(255,255,255,0.07)' }}>
                              <div style={{ height:'100%', borderRadius:4, background:clr, width:`${pct}%`, transition:'width 0.4s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Top servicios */}
                {ventasServicio.length > 0 && (
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', marginBottom:16, boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:14 }}>Top servicios</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {ventasServicio.map((s, i) => {
                        const pct = Math.round(s.total/maxSvc*100)
                        const clr = PROF_COLORS[i % PROF_COLORS.length]
                        return (
                          <div key={s.nombre}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }}>{s.nombre}</span>
                              <span style={{ fontSize:12, fontWeight:800, color:clr, flexShrink:0 }}>{fmtCOP(s.total)} <span style={{ fontWeight:500, color:'var(--text-3)', fontSize:10 }}>×{s.count}</span></span>
                            </div>
                            <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.07)' }}>
                              <div style={{ height:'100%', borderRadius:3, background:clr, width:`${pct}%`, transition:'width 0.4s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Por profesional */}
                {ventasProf.length > 0 && (
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:14 }}>Por profesional</div>
                    {ventasProf.map((p, i) => {
                      const clr = PROF_COLORS[i % PROF_COLORS.length]
                      const pct = Math.round(p.total/maxProf*100)
                      return (
                        <div key={p.nombre} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                          <div style={{ width:34, height:34, borderRadius:10, background:`${clr}20`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight:800, fontSize:14, color:clr, flexShrink:0 }}>
                            {p.nombre[0]}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                              <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{p.nombre.split(' ')[0]}</span>
                              <span style={{ fontSize:13, fontWeight:800, color:clr }}>{fmtCOP(p.total)}</span>
                            </div>
                            <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,0.07)' }}>
                              <div style={{ height:'100%', borderRadius:3, background:clr, width:`${pct}%`, transition:'width 0.4s' }} />
                            </div>
                            <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{p.count} cita{p.count!==1?'s':''}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {totalVentas === 0 && ventasServicio.length === 0 && (
                  <div className="sp-empty">
                    <span className="sp-empty-icon">📊</span>
                    <p className="sp-empty-title">Sin datos en este período</p>
                    <p className="sp-empty-sub">Selecciona otro rango de fechas</p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

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

      {/* ── Tab: Gerencial ──────────────────────────────── */}
      {tabA === 'gerencial' && (() => {
        const GER_PERIODOS = [
          { k:'semana',   l:'Semana' },
          { k:'mes',      l:'Este mes' },
          { k:'mes_ant',  l:'Mes ant.' },
          { k:'bimestre', l:'Bimestre' },
          { k:'trimestre',l:'Trimestre' },
        ]

        function LineaPL({ label, valor, pctVal, bold, color, indent, separator }) {
          const clr = color || (valor < 0 ? '#f87171' : 'var(--text-2)')
          return (
            <div style={{
              display:'flex', alignItems:'baseline',
              padding: `${bold ? 5 : 3}px 0`,
              borderTop: separator ? '1px solid var(--border)' : 'none',
              marginTop: separator ? 3 : 0,
            }}>
              <span style={{
                flex:1, fontSize: bold ? 13 : 12,
                fontWeight: bold ? 800 : 500,
                color: bold ? 'var(--text)' : 'var(--text-2)',
                paddingLeft: indent ? 14 : 0,
              }}>{label}</span>
              <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 800 : 600, color: clr, minWidth:100, textAlign:'right' }}>
                {valor >= 0 ? `$${Math.round(valor).toLocaleString('es-CO')}` : `($${Math.round(Math.abs(valor)).toLocaleString('es-CO')})`}
              </span>
              {pctVal !== undefined && (
                <span style={{ fontSize:10, color:'var(--text-3)', minWidth:38, textAlign:'right', marginLeft:6 }}>
                  {pctVal}
                </span>
              )}
            </div>
          )
        }

        return (
          <div style={{ padding:'16px' }}>
            {/* Chips período */}
            <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', scrollbarWidth:'none' }}>
              {GER_PERIODOS.map(({ k, l }) => (
                <button key={k} onClick={() => setGerPeriodo(k)} style={{
                  flexShrink:0, padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:700,
                  cursor:'pointer', border:`1.5px solid ${gerPeriodo===k ? col : 'var(--border)'}`,
                  background: gerPeriodo===k ? `${col}18` : 'var(--card)',
                  color: gerPeriodo===k ? col : 'var(--text-3)',
                }}>{l}</button>
              ))}
            </div>

            {loadingGer ? (
              <div style={{ display:'flex', justifyContent:'center', padding:'40px 0' }}>
                <div className="sp-spinner" style={{ borderTopColor:col }} />
              </div>
            ) : !gerData ? (
              <div className="sp-empty">
                <span className="sp-empty-icon">📊</span>
                <p className="sp-empty-title">Sin datos</p>
                <p className="sp-empty-sub">Registra citas y gastos para ver el informe</p>
              </div>
            ) : (() => {
              const d = gerData
              const pctOf = n => d.ingresos.total > 0 ? `${Math.round(n/d.ingresos.total*100)}%` : '—'

              return (
                <>
                  {/* Header + PDF */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', fontFamily:'Outfit' }}>Informe Financiero</div>
                      <div style={{ fontSize:12, color:'var(--text-3)' }}>{d.periodo.label}</div>
                    </div>
                    <button onClick={() => exportarPDFGerencial(d)} style={{
                      display:'flex', alignItems:'center', gap:6, padding:'10px 16px', borderRadius:12,
                      background:col, border:'none', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer',
                    }}>
                      <Ico d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" size={13} />
                      ↓ PDF
                    </button>
                  </div>

                  {/* Estado de Resultados */}
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px 18px', marginBottom:14, boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:800, color:'var(--text-3)', letterSpacing:0.6, textTransform:'uppercase' }}>Estado de Resultados</span>
                      <span style={{ fontSize:10, color:'var(--text-3)' }}>% ing.</span>
                    </div>

                    {/* Ingresos */}
                    <div style={{ fontSize:10, fontWeight:800, color:col, letterSpacing:0.5, textTransform:'uppercase', marginBottom:4 }}>Ingresos Operacionales</div>
                    {d.ingresos.porCat.length > 0
                      ? d.ingresos.porCat.map(c => <LineaPL key={c.cat} label={c.cat} valor={c.total} pctVal={pctOf(c.total)} indent />)
                      : <LineaPL label="Servicios" valor={d.ingresos.total} pctVal="100%" indent />
                    }
                    <LineaPL label="TOTAL INGRESOS" valor={d.ingresos.total} pctVal="100%" bold color={col} separator />

                    {/* Costos directos */}
                    {d.costos.total > 0 && (() => {
                      const catC = {}
                      d.costos.detalle.forEach(g => { catC[g.categoria||'Insumos'] = (catC[g.categoria||'Insumos']||0)+Number(g.monto) })
                      return (
                        <div style={{ marginTop:10 }}>
                          <div style={{ fontSize:10, fontWeight:800, color:'#f87171', letterSpacing:0.5, textTransform:'uppercase', marginBottom:4 }}>Costo de Ventas</div>
                          {Object.entries(catC).map(([c,t]) => <LineaPL key={c} label={c} valor={-t} pctVal={pctOf(t)} indent />)}
                          <LineaPL label="TOTAL COSTOS" valor={-d.costos.total} pctVal={pctOf(d.costos.total)} bold color="#f87171" separator />
                        </div>
                      )
                    })()}

                    {/* Utilidad Bruta */}
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'9px 12px', borderRadius:10, marginTop:8,
                      background: d.utilidadBruta >= 0 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                    }}>
                      <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>UTILIDAD BRUTA</span>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:16, fontWeight:900, color: d.utilidadBruta >= 0 ? '#4ade80' : '#f87171', fontFamily:'Outfit' }}>
                          ${Math.round(Math.abs(d.utilidadBruta)).toLocaleString('es-CO')}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>margen {d.margenBruto}%</div>
                      </div>
                    </div>

                    {/* Gastos operacionales */}
                    {d.gastosOp.total > 0 && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'#f59e0b', letterSpacing:0.5, textTransform:'uppercase', marginBottom:4 }}>Gastos Operacionales</div>
                        {d.gastosOp.detalle.map(g => <LineaPL key={g.cat} label={g.cat} valor={-g.total} pctVal={pctOf(g.total)} indent />)}
                        <LineaPL label="TOTAL GASTOS OPER." valor={-d.gastosOp.total} pctVal={pctOf(d.gastosOp.total)} bold color="#f59e0b" separator />
                      </div>
                    )}

                    {/* Utilidad Operativa */}
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'10px 12px', borderRadius:10, marginTop:8,
                      background: `linear-gradient(135deg,${col}22,${col}08)`,
                      border:`1px solid ${col}30`,
                    }}>
                      <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>UTILIDAD OPERATIVA</span>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:18, fontWeight:900, color: d.utilidadOper >= 0 ? col : '#f87171', fontFamily:'Outfit' }}>
                          ${Math.round(Math.abs(d.utilidadOper)).toLocaleString('es-CO')}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>margen neto {d.margenNeto}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Tablero Gerencial */}
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', marginBottom:14, boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'var(--text-3)', letterSpacing:0.6, textTransform:'uppercase', marginBottom:12 }}>
                      Tablero Gerencial
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      {[
                        { label:'Margen Bruto', value:`${d.kpis.margenBruto}%`, color: d.kpis.margenBruto >= 50 ? '#4ade80' : d.kpis.margenBruto >= 30 ? '#f59e0b' : '#f87171', sub:'Meta ≥50%' },
                        { label:'Margen Neto',  value:`${d.margenNeto}%`,        color: d.margenNeto >= 20 ? '#4ade80' : d.margenNeto >= 10 ? '#f59e0b' : '#f87171', sub:'Meta ≥20%' },
                        { label:'Pto. Equilibrio', value:fmtCOP(d.kpis.peBreak), color:'#a855f7', sub:'ingresos mínimos' },
                        { label:'Ticket Prom.',    value:fmtCOP(d.kpis.ticketProm), color:col, sub:`${d.kpis.numCitas} citas` },
                        { label:'Val. Inventario', value:fmtCOP(d.kpis.valorInv), color:'#06b6d4', sub:'a costo' },
                        { label:'Retención',       value:`${retention?.retention_rate || 0}%`, color:'#ec4899', sub:'clientes' },
                      ].map(k => (
                        <div key={k.label} style={{
                          padding:'10px', borderRadius:12,
                          background:`${k.color}12`,
                          border:`1px solid ${k.color}28`,
                        }}>
                          <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:15, color:k.color, lineHeight:1.1 }}>{k.value}</div>
                          <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:700, marginTop:3, letterSpacing:0.3 }}>{k.label.toUpperCase()}</div>
                          <div style={{ fontSize:9, color:'var(--text-3)', marginTop:1 }}>{k.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* IVA Estimado */}
                  <div style={{ background:'var(--card)', borderRadius:16, padding:'16px', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:800, color:'var(--text-3)', letterSpacing:0.6, textTransform:'uppercase' }}>IVA Estimado 19%</span>
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(245,158,11,0.15)', color:'#fbbf24', fontWeight:700 }}>ESTIMADO</span>
                    </div>
                    <LineaPL label="IVA Generado (ventas × 19%)" valor={d.iva.generado} pctVal={pctOf(d.iva.generado)} />
                    <LineaPL label="IVA Descontable (costos × 19%)" valor={-d.iva.descontable} pctVal={pctOf(d.iva.descontable)} />
                    <LineaPL label="IVA A PAGAR" valor={d.iva.aPagar} bold color={d.iva.aPagar > 0 ? '#f87171' : '#4ade80'} separator />
                    <p style={{ fontSize:10, color:'var(--text-3)', marginTop:8, lineHeight:1.6, fontStyle:'italic' }}>
                      Cálculo orientativo. Consulte a su contador para la declaración oficial ante la DIAN. Los servicios de peluquería pueden estar excluidos o exentos según régimen tributario.
                    </p>
                  </div>
                </>
              )
            })()}
          </div>
        )
      })()}

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

      {/* ── Captación por canal ───────────────────────────── */}
      {fuenteData.length > 0 && (<>
        <div className="sp-section" style={{ marginTop:20 }}>
          <span className="sp-section-title">¿Cómo nos conocen?</span>
        </div>
        <div style={{ margin:'0 16px', padding:'16px', borderRadius:16,
          background:'var(--card)', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
          {fuenteData.map((f, i) => {
            const max = fuenteData[0].count
            const pct = f.count / max
            const EMOJI = { instagram:'📸', facebook:'👍', tiktok:'🎵', google:'🔍', referido:'🤝', paso_por_aqui:'🚶', otro:'💬' }
            const LABEL = { instagram:'Instagram', facebook:'Facebook', tiktok:'TikTok', google:'Google', referido:'Referido', paso_por_aqui:'Pasó por aquí', otro:'Otro' }
            return (
              <div key={f.canal} style={{ marginBottom: i < fuenteData.length-1 ? 12 : 0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, color:'var(--text-2)', fontWeight:600 }}>
                    {EMOJI[f.canal] || '💬'} {LABEL[f.canal] || f.canal}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, fontFamily:'Outfit', color:col }}>{f.count}</span>
                </div>
                <div style={{ height:6, borderRadius:4, background:'var(--border)' }}>
                  <div style={{ height:'100%', borderRadius:4, width:`${pct*100}%`, background:col }} />
                </div>
              </div>
            )
          })}
        </div>
      </>)}

      {segData && segData.total > 0 && (<>
        <div className="sp-section" style={{ marginTop:20 }}>
          <span className="sp-section-title">Segmentación de clientes</span>
        </div>
        <div style={{ margin:'0 16px', padding:'16px', borderRadius:16,
          background:'var(--card)', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            {[
              { label:'Total activos', value:segData.total,       icon:'👥', color:'var(--text)' },
              { label:'Nuevos este mes',value:segData.nuevos,     icon:'🆕', color:'#818cf8' },
              { label:'Recurrentes',   value:segData.recurrentes, icon:'🔄', color:col },
              { label:'VIP / Frecuentes',value:segData.vip,      icon:'⭐', color:'#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ padding:'10px 12px', borderRadius:12,
                background:'var(--bg)', border:'1px solid var(--border)' }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{s.icon}</div>
                <div style={{ fontFamily:'Outfit', fontWeight:800, fontSize:20, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ height:6, borderRadius:4, background:'var(--border)', overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:4, background:`linear-gradient(90deg,${col},#818cf8)`,
              width:`${segData.total > 0 ? Math.round(segData.recurrentes/segData.total*100) : 0}%`,
              transition:'width 0.5s',
            }} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', marginTop:6 }}>
            {segData.total > 0 ? Math.round(segData.recurrentes/segData.total*100) : 0}% retención (clientes con ≥2 visitas)
          </div>
        </div>
      </>)}

      {cliNuevosMes.some(m => m.count > 0) && (<>
        <div className="sp-section" style={{ marginTop:20 }}>
          <span className="sp-section-title">Nuevos clientes por mes</span>
        </div>
        <div style={{ margin:'0 16px', padding:'16px', borderRadius:16,
          background:'var(--card)', boxShadow:'0 2px 14px rgba(0,0,0,0.1)' }}>
          {(() => {
            const max = Math.max(...cliNuevosMes.map(m => m.count), 1)
            return (
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:80 }}>
                {cliNuevosMes.map((m, i) => {
                  const isLast = i === cliNuevosMes.length - 1
                  const pct = m.count / max * 100
                  return (
                    <div key={m.mes} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: isLast ? col : 'var(--text-3)' }}>
                        {m.count > 0 ? m.count : ''}
                      </div>
                      <div style={{ width:'100%', borderRadius:'4px 4px 0 0',
                        background: isLast ? col : `${col}55`,
                        height: `${Math.max(pct, 4)}%`, minHeight: m.count > 0 ? 4 : 2,
                        transition:'height 0.4s',
                      }} />
                      <div style={{ fontSize:9, color:'var(--text-3)', fontWeight:600, textTransform:'capitalize' }}>{m.label}</div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </>)}

      <div style={{ height:24 }} />
      </>)}
    </>
  )
}
