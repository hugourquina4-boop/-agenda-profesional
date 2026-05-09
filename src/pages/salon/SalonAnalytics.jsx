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
      padding:'16px', borderRadius:16, background:'var(--card)', border:'1px solid var(--border)',
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

  const cargar = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    try {
      const [kpiRes, staffRes, retRes] = await Promise.all([
        supabase.from('v_kpis_mes').select('*').eq('tenant_id', tenant.id).order('mes', { ascending: false }),
        supabase.from('v_revenue_staff').select('*').eq('tenant_id', tenant.id).order('ingresos_brutos', { ascending: false }),
        supabase.from('v_retention').select('*').eq('tenant_id', tenant.id).maybeSingle(),
      ])

      const kpiRows = kpiRes.data || []
      const mesActual = kpiRows[0] || null
      setKpi(mesActual)
      setHistoria([...kpiRows].reverse().slice(-6))
      setStaff(staffRes.data || [])
      setRetention(retRes.data || null)
    } catch (e) {
      console.error('[SalonAnalytics]', e)
    } finally {
      setLoading(false)
    }
  }, [tenant])

  useEffect(() => { cargar() }, [cargar])

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
        <KpiCard
          label="Citas completadas"
          value={kpi?.completadas ?? '—'}
          sub={`de ${kpi?.total_citas ?? '—'} totales`}
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          color="#4ade80"
        />
        <KpiCard
          label="Ingresos brutos"
          value={fmtCOP(kpi?.ingresos_brutos)}
          sub={`ticket prom. ${fmtCOP(kpi?.avg_ticket)}`}
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          color={col}
        />
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
            background:'var(--card)', border:'1px solid var(--border)' }}>
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
                background:'var(--card)', border:'1px solid var(--border)',
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
      <div style={{ height:24 }} />
    </>
  )
}
